use crate::catalog::Tool;
use crate::{paths, redact, run, system, tools};
use serde::Serialize;
use std::collections::HashSet;
use std::sync::Mutex;
use std::time::Duration;
use tauri::ipc::Channel;

const INSTALL_TIMEOUT: Duration = Duration::from_secs(15 * 60);

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase", tag = "event")]
pub enum InstallEvent {
    Step { step: Step },
    Log { line: String, stderr: bool },
    Done { version: String, path: String, shadowed_by: Option<String> },
    Failed { reason: Reason, message: String, hint: Option<String> },
}

#[derive(Serialize, Clone, Copy)]
#[serde(rename_all = "camelCase")]
pub enum Step {
    Check,
    Install,
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
    fn start(&self, id: &str) -> bool {
        self.0.lock().unwrap().insert(id.to_string())
    }
    fn finish(&self, id: &str) {
        self.0.lock().unwrap().remove(id);
    }
    fn is_running(&self, id: &str) -> bool {
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
    if !running.start(&tool.id) {
        let _ = events.send(InstallEvent::Failed {
            reason: Reason::Failed,
            message: "This tool is already being installed.".into(),
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

fn steps(tool: &Tool, running: &Running, events: &Channel<InstallEvent>) -> Result<InstallEvent, Failure> {
    let send = |e| {
        let _ = events.send(e);
    };
    send(InstallEvent::Step { step: Step::Check });
    let ready = system::readiness();
    if !ready.node.ok {
        return Err(Failure(
            Reason::Requirements,
            format!("Node.js {}.", ready.node.problem.as_deref().unwrap_or("is missing")),
            Some("Install Node.js 22.16 or newer (24 recommended), then check again.".into()),
        ));
    }
    let existing = tools::detect(tool).installs.into_iter().next();
    let manager = existing.as_ref().map(|i| i.manager).unwrap_or("npm");
    let spec = format!("{}@latest", tool.package);
    let (program, args): (&str, Vec<&str>) = match manager {
        "pnpm" => ("pnpm", vec!["add", "--global", &spec]),
        "bun" => ("bun", vec!["add", "--global", &spec]),
        _ => ("npm", vec!["install", "--global", &spec, "--no-fund", "--no-audit"]),
    };
    let program_path = paths::find(program).ok_or_else(|| {
        Failure(
            Reason::Requirements,
            format!("{program} was not found."),
            Some(format!("{} installed this tool; reinstall {program} or install Node.js again.", manager)),
        )
    })?;
    if program == "npm" && ready.npm_prefix_writable == Some(false) {
        return Err(Failure(
            Reason::Permission,
            format!("npm installs into {}, which needs administrator rights.", ready.npm_prefix.unwrap_or_default()),
            Some("Point npm at a folder in your home: npm config set prefix ~/.npm-global, add ~/.npm-global/bin to PATH, then try again.".into()),
        ));
    }

    send(InstallEvent::Step { step: Step::Install });
    send(InstallEvent::Log { line: format!("$ {program} {}", args.join(" ")), stderr: false });
    let mut tail: Vec<String> = Vec::new();
    let cmd = run::command(&program_path, &args, Some(&paths::search_path()));
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
        run::RunError::Cancelled => Failure(Reason::Cancelled, "Installation cancelled.".into(), None),
        run::RunError::TimedOut => Failure(
            Reason::Timeout,
            "Installation took longer than 15 minutes and was stopped.".into(),
            Some("Check your connection and try again.".into()),
        ),
        other => Failure(Reason::Failed, other.to_string(), None),
    })?;
    if code != Some(0) {
        return Err(classify(&tail.join("\n"), program));
    }

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
    let shadowed_by = (ours.path != first.path).then(|| first.path.clone());
    Ok(InstallEvent::Done { version, path: ours.path.clone(), shadowed_by })
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
    fn classifies_npm_failures() {
        assert_eq!(classify("npm ERR! code EACCES", "npm").0, Reason::Permission);
        assert_eq!(classify("npm ERR! code ENOTFOUND registry", "npm").0, Reason::Network);
        assert_eq!(classify("something odd", "npm").0, Reason::Failed);
    }
}
