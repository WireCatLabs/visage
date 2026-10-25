use crate::catalog::Tool;
use crate::{node, paths, redact, run, system, tools};
use serde::Serialize;
use std::collections::HashSet;
use std::sync::Mutex;
use std::time::Duration;
use tauri::ipc::Channel;

const PNPM_WIRECAT_NOW: &str = "--config.minimum-release-age-exclude=@wirecat/*";
const INSTALL_TIMEOUT: Duration = Duration::from_mins(15);

#[derive(Serialize, Clone)]
// `rename_all` renames only the variants; the fields need `rename_all_fields` to reach the interface as camelCase.
#[serde(rename_all = "camelCase", rename_all_fields = "camelCase", tag = "event")]
pub enum InstallEvent {
    Step { step: Step },
    Log { line: String, stderr: bool },
    Done { version: String, path: String, shadowed_by: Option<String> },
    Removed,
    Failed { reason: Reason, message: String, hint: Option<String> },
}

#[derive(Serialize, Clone, Copy)]
#[serde(rename_all = "camelCase")]
pub enum Step {
    Check,
    Install,
    Remove,
    Verify,
}

#[derive(Serialize, Clone, Copy, Debug, PartialEq)]
#[serde(rename_all = "camelCase")]
pub enum Reason {
    Requirements,
    Permission,
    Network,
    Timeout,
    Cancelled,
    Verify,
    Failed,
}

#[derive(Default)]
pub struct Running(Mutex<HashSet<String>>);

impl Running {
    pub fn start(&self, id: &str) -> bool {
        self.0.lock().unwrap().insert(id.to_string())
    }
    pub fn finish(&self, id: &str) {
        self.0.lock().unwrap().remove(id);
    }
    pub fn is_running(&self, id: &str) -> bool {
        self.0.lock().unwrap().contains(id)
    }
    pub fn cancel(&self, id: &str) {
        self.finish(id);
    }
}

struct Failure(Reason, String, Option<String>);

/// Installs a new tool with npm, or updates an existing one with the manager that owns it,
/// so an update never leaves a second copy that shadows the first.
pub fn install(tool: &Tool, running: &Running, events: &Channel<InstallEvent>) {
    guarded(tool, running, events, install_steps);
}

/// Removes every copy of the tool, each with the manager that installed it. Data stays; see `storage.rs`.
pub fn uninstall(tool: &Tool, running: &Running, events: &Channel<InstallEvent>) {
    guarded(tool, running, events, uninstall_steps);
}

type Steps = fn(&Tool, &Running, &Channel<InstallEvent>) -> Result<InstallEvent, Failure>;

fn guarded(tool: &Tool, running: &Running, events: &Channel<InstallEvent>, steps: Steps) {
    if !running.start(&tool.id) {
        let _ = events.send(InstallEvent::Failed {
            reason: Reason::Failed,
            message: "Another operation on this tool is running.".into(),
            hint: None,
        });
        return;
    }
    let result = steps(tool, running, events);
    running.finish(&tool.id);
    let _ = events.send(match result {
        Ok(done) => done,
        Err(Failure(reason, message, hint)) => InstallEvent::Failed { reason, message, hint },
    });
}

fn install_steps(tool: &Tool, running: &Running, events: &Channel<InstallEvent>) -> Result<InstallEvent, Failure> {
    let send = |e| {
        let _ = events.send(e);
    };
    send(InstallEvent::Step { step: Step::Check });
    let ready = system::readiness();
    if !ready.node.ok {
        return Err(Failure(
            Reason::Requirements,
            format!("Node.js {}.", ready.node.problem.as_deref().unwrap_or("is missing")),
            Some(
                "Let WireCat set up Node.js for you, or install Node.js 22.16 or newer (24 recommended) yourself."
                    .into(),
            ),
        ));
    }
    let existing = tools::detect(tool).installs.into_iter().next();
    let manager = existing.as_ref().map_or("npm", |i| i.manager);
    // The exact version, not `@latest`: a manager that still holds new releases back then fails loudly instead of
    // quietly installing an older one.
    let wanted = tools::latest_version(&tool.package);
    let spec = format!("{}@{}", tool.package, wanted.as_deref().unwrap_or("latest"));
    let (program, args): (&str, Vec<&str>) = match manager {
        // pnpm 11+ waits a day before installing a new release; WireCat's own packages are exempt (owner, NEED-26).
        "pnpm" => ("pnpm", vec!["add", "--global", &spec, PNPM_WIRECAT_NOW]),
        "bun" => ("bun", vec!["add", "--global", &spec]),
        _ => ("npm", vec!["install", "--global", &spec, "--no-fund", "--no-audit"]),
    };
    let program_path = paths::find(program).ok_or_else(|| {
        Failure(
            Reason::Requirements,
            format!("{program} was not found."),
            Some(format!("{manager} installed this tool; reinstall {program} or install Node.js again.")),
        )
    })?;
    if program == "npm" && ready.npm_prefix_writable == Some(false) {
        return Err(Failure(
            Reason::Permission,
            format!("npm installs into {}, which needs administrator rights.", ready.npm_prefix.unwrap_or_default()),
            Some("Let WireCat set up its own Node.js in your home folder, or point npm at one: npm config set prefix ~/.npm-global.".into()),
        ));
    }

    send(InstallEvent::Step { step: Step::Install });
    run_manager(&program_path, &args, tool, running, events, "Installation")?;

    send(InstallEvent::Step { step: Step::Verify });
    let extra: Vec<_> = system::npm_prefix().map(|p| system::npm_bin_dir(&p)).into_iter().collect();
    paths::refresh(&extra);
    let state = tools::detect(tool);
    let first = state.installs.first().ok_or_else(|| {
        Failure(
            Reason::Verify,
            format!("The install finished, but `{}` is not on your PATH.", tool.bin),
            Some(path_hint(&extra)),
        )
    })?;
    let version = first.version.clone().ok_or_else(|| {
        Failure(
            Reason::Verify,
            format!("`{} --version` did not run: {}", tool.bin, first.problem.clone().unwrap_or_default()),
            None,
        )
    })?;
    let ours = state.installs.iter().find(|i| i.manager == manager).unwrap_or(first);
    if let (Some(wanted), Some(got)) = (wanted.as_deref(), ours.version.as_deref())
        && wanted != got
    {
        return Err(Failure(
            Reason::Verify,
            format!("{manager} installed {} {got}, not {wanted}.", tool.bin),
            Some(format!(
                "{manager} may hold back new releases for a while. Try again later, or run `{manager} add --global {}@{wanted}` yourself.",
                tool.package
            )),
        ));
    }
    let shadowed_by = (ours.path != first.path).then(|| first.path.clone());
    Ok(InstallEvent::Done { version, path: ours.path.clone(), shadowed_by })
}

fn uninstall_steps(tool: &Tool, running: &Running, events: &Channel<InstallEvent>) -> Result<InstallEvent, Failure> {
    let _ = events.send(InstallEvent::Step { step: Step::Check });
    let mut plan = Vec::new();
    for copy in paths::find_all(&tool.bin) {
        let manager = paths::manager_for(&copy);
        let (program, args): (&str, Vec<&str>) = match manager {
            "pnpm" => ("pnpm", vec!["remove", "--global", &tool.package]),
            "bun" => ("bun", vec!["remove", "--global", &tool.package]),
            "volta" => ("volta", vec!["uninstall", &tool.package]),
            _ => ("npm", vec!["uninstall", "--global", &tool.package]),
        };
        // An nvm copy belongs to the npm of that Node version, which sits beside it.
        let beside = copy.parent().and_then(|dir| which::which_in(program, Some(dir), std::env::temp_dir()).ok());
        let path = beside.or_else(|| paths::find(program)).ok_or_else(|| {
            Failure(
                Reason::Requirements,
                format!("{program} was not found, so {} cannot be removed.", paths::tilde(&copy.to_string_lossy())),
                None,
            )
        })?;
        plan.push((path, args));
    }

    let _ = events.send(InstallEvent::Step { step: Step::Remove });
    for (program, args) in &plan {
        run_manager(program, args, tool, running, events, "Uninstalling")?;
    }

    let _ = events.send(InstallEvent::Step { step: Step::Verify });
    paths::refresh(&[]);
    if let Some(left) = paths::find(&tool.bin) {
        return Err(Failure(
            Reason::Verify,
            format!("`{}` is still at {}.", tool.bin, paths::tilde(&left.to_string_lossy())),
            Some("It was not installed by npm or pnpm. Remove it the way you installed it.".into()),
        ));
    }
    Ok(InstallEvent::Removed)
}

/// Runs npm, pnpm, bun or volta with streamed, masked output; `what` names the operation in errors.
fn run_manager(
    program: &std::path::Path,
    args: &[&str],
    tool: &Tool,
    running: &Running,
    events: &Channel<InstallEvent>,
    what: &str,
) -> Result<(), Failure> {
    let send = |e| {
        let _ = events.send(e);
    };
    let name = program.file_stem().unwrap_or_default().to_string_lossy().to_string();
    send(InstallEvent::Log { line: format!("$ {name} {}", args.join(" ")), stderr: false });
    let mut tail: Vec<String> = Vec::new();
    let mut cmd = run::command(program, args, Some(&paths::search_path()));
    if let Some(home) = paths::pnpm_home() {
        cmd.env("PNPM_HOME", home);
    }
    if let Some(runtime) = node::owner_of(program) {
        cmd.env("npm_config_prefix", runtime);
    }
    let code = run::stream(
        cmd,
        INSTALL_TIMEOUT,
        || !running.is_running(&tool.id),
        |line| {
            let (line, stderr) = match line {
                run::Line::Out(l) => (l, false),
                run::Line::Err(l) => (l, true),
            };
            let line = redact::text(&line);
            tail.push(line.clone());
            if tail.len() > 40 {
                tail.remove(0);
            }
            send(InstallEvent::Log { line, stderr });
        },
    )
    .map_err(|e| match e {
        run::RunError::Cancelled => Failure(Reason::Cancelled, format!("{what} cancelled."), None),
        run::RunError::TimedOut => Failure(
            Reason::Timeout,
            format!("{what} took longer than 15 minutes and was stopped."),
            Some("Check your connection and try again.".into()),
        ),
        other => Failure(Reason::Failed, other.to_string(), None),
    })?;
    if code == Some(0) { Ok(()) } else { Err(classify(&tail.join("\n"), &name)) }
}

fn classify(log: &str, program: &str) -> Failure {
    let l = log.to_lowercase();
    if l.contains("eacces") || l.contains("eperm") || l.contains("permission denied") {
        Failure(
            Reason::Permission,
            format!("{program} could not write to its global folder."),
            Some("Use a global folder in your home instead of a system one, then try again.".into()),
        )
    } else if ["enotfound", "etimedout", "econnreset", "eai_again", "network", "fetch failed"]
        .iter()
        .any(|k| l.contains(k))
    {
        Failure(
            Reason::Network,
            "Could not reach the npm registry.".into(),
            Some("Check your internet connection or proxy, then try again.".into()),
        )
    } else if l.contains("node-gyp") || l.contains("gyp err") {
        Failure(
            Reason::Failed,
            "A native part of the tool could not be built.".into(),
            Some("Install build tools for your system (on Windows: Visual Studio Build Tools), then try again.".into()),
        )
    } else {
        Failure(Reason::Failed, format!("{program} stopped with an error."), Some("Open the log for details.".into()))
    }
}

fn path_hint(extra: &[std::path::PathBuf]) -> String {
    match extra.first() {
        Some(dir) => format!("Add {} to your PATH, then open a new terminal.", paths::tilde(&dir.to_string_lossy())),
        None => "Add npm's global folder to your PATH, then open a new terminal.".into(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn events_reach_the_interface_in_camel_case() {
        let done = InstallEvent::Done { version: "0.91.0".into(), path: "~/bin/tg".into(), shadowed_by: None };
        let json = serde_json::to_value(&done).unwrap();
        assert_eq!(json["event"], "done");
        assert!(json.get("shadowedBy").is_some(), "{json}");
    }

    #[test]
    fn classifies_npm_failures() {
        assert_eq!(classify("npm ERR! code EACCES", "npm").0, Reason::Permission);
        assert_eq!(classify("npm ERR! code ENOTFOUND registry", "npm").0, Reason::Network);
        assert_eq!(classify("something odd", "npm").0, Reason::Failed);
    }
}
