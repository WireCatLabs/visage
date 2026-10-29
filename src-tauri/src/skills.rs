use crate::cache::REFUSED;
use crate::catalog::{SkillSource, Tool};
use crate::{paths, redact, run};
use serde::Serialize;
use serde_json::Value;
use std::ffi::OsString;
use std::path::{Path, PathBuf};
use std::time::Duration;

/// The places `skill install --for` writes to. `all` is left out on purpose: one cell is one place. `hermes` arrives
/// with cli-base's W1 release; a tool whose `skill status` does not list it cannot write it yet.
pub const TARGETS: [&str; 3] = ["claude", "agents", "hermes"];

struct AgentSpec {
    id: &'static str,
    name: &'static str,
    programs: &'static [&'static str],
    /// Relative to home. Never `~/.claude/skills` or `~/.agents`: `skill install` creates those itself.
    marks: &'static [&'static str],
    /// An environment variable that moves the agent's home elsewhere (absolute, so not one of `marks`), and the file
    /// in it that marks the agent.
    home_env: Option<(&'static str, &'static str)>,
    /// From each agent's own docs: Claude Code reads `~/.claude/skills`; Codex, Gemini CLI, Cursor, `OpenCode` and
    /// `OpenClaw` read `~/.agents/skills`; Cursor and `OpenCode` also read `~/.claude/skills`. Hermes reads its own
    /// `skills` folder and its `skills.external_dirs`, which only the tools' `--for hermes` sets up.
    reads: &'static [&'static str],
}

const AGENTS: [AgentSpec; 7] = [
    AgentSpec {
        id: "claude",
        name: "Claude Code",
        programs: &["claude"],
        marks: &[".claude.json"],
        home_env: None,
        reads: &["claude"],
    },
    AgentSpec {
        id: "codex",
        name: "Codex",
        programs: &["codex"],
        marks: &[".codex"],
        home_env: None,
        reads: &["agents"],
    },
    AgentSpec {
        id: "cursor",
        name: "Cursor",
        programs: &["cursor-agent", "cursor"],
        marks: &[".cursor"],
        home_env: None,
        reads: &["agents", "claude"],
    },
    AgentSpec {
        id: "gemini",
        name: "Gemini CLI",
        programs: &["gemini"],
        marks: &[".gemini"],
        home_env: None,
        reads: &["agents"],
    },
    AgentSpec {
        id: "opencode",
        name: "OpenCode",
        programs: &["opencode"],
        marks: &[".config/opencode"],
        home_env: None,
        reads: &["agents", "claude"],
    },
    AgentSpec {
        id: "hermes",
        name: "Hermes Agent",
        programs: &["hermes"],
        // Its settings file, not the folder: other skill installers create `~/.hermes/skills` or `~/.openclaw/skills`
        // on computers that never had the agent.
        marks: &[".hermes/config.yaml"],
        home_env: Some(("HERMES_HOME", "config.yaml")),
        reads: &["hermes"],
    },
    AgentSpec {
        id: "openclaw",
        name: "OpenClaw",
        programs: &["openclaw"],
        marks: &[".openclaw/openclaw.json"],
        home_env: Some(("OPENCLAW_STATE_DIR", "openclaw.json")),
        reads: &["agents"],
    },
];

#[derive(Serialize, Debug)]
#[serde(rename_all = "camelCase")]
pub struct Agent {
    pub id: &'static str,
    pub name: &'static str,
    /// `program` when it is on PATH, `folder` when only its settings folder is there, `None` when not found.
    pub found_by: Option<&'static str>,
    pub reads: &'static [&'static str],
}

pub fn agents() -> Vec<Agent> {
    detect(paths::home().as_deref(), |k| std::env::var_os(k), |p| paths::find(p).is_some())
}

fn detect(home: Option<&Path>, env: impl Fn(&str) -> Option<OsString>, on_path: impl Fn(&str) -> bool) -> Vec<Agent> {
    AGENTS
        .iter()
        .map(|a| {
            let program = a.programs.iter().any(|p| on_path(p));
            let moved = a
                .home_env
                .and_then(|(var, file)| env(var).filter(|v| !v.is_empty()).map(|d| PathBuf::from(d).join(file)));
            let folder =
                moved.is_some_and(|f| f.exists()) || home.is_some_and(|h| a.marks.iter().any(|m| h.join(m).exists()));
            let found_by = if program {
                Some("program")
            } else if folder {
                Some("folder")
            } else {
                None
            };
            Agent { id: a.id, name: a.name, found_by, reads: a.reads }
        })
        .collect()
}

#[derive(Serialize, Debug, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct TargetStatus {
    pub target: String,
    pub path: Option<String>,
    pub installed: Option<String>,
    /// `current`, `stale`, `missing` or `unversioned`; `None` when only the version is known and the interface compares.
    pub state: Option<String>,
}

#[derive(Serialize, Debug, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct SkillReport {
    /// `status` from `skill status`, `doctor` from a doctor's skill list, `none` when this version cannot tell.
    pub source: &'static str,
    pub targets: Vec<TargetStatus>,
}

pub(crate) fn call(tool: &Tool, args: &[String], timeout: Duration) -> Result<(run::Output, Option<Value>), String> {
    let bin = paths::find(&tool.bin).ok_or("the tool is not installed")?;
    let refs: Vec<&str> = args.iter().map(String::as_str).collect();
    let out = run::run(&bin, &refs, Some(&paths::search_path()), timeout).map_err(|e| e.to_string())?;
    let json = out.json();
    Ok((out, json))
}

/// Some commands wrap their answer in `item`, others print it bare.
pub(crate) fn body(v: &Value) -> &Value {
    v.get("item").unwrap_or(v)
}

pub(crate) fn failure(out: &run::Output, json: Option<&Value>) -> String {
    if let Some(m) = json.and_then(|v| v["error"]["message"].as_str()) {
        return redact::text(m);
    }
    let text = if out.stderr.trim().is_empty() { &out.stdout } else { &out.stderr };
    let line = text.lines().rev().find(|l| !l.trim().is_empty()).unwrap_or("the tool gave no answer");
    redact::text(line.trim())
}

/// A CLI from before `skill status` says so as a usage error; anything else is a real failure.
fn unsupported(json: Option<&Value>) -> bool {
    json.and_then(|v| v["error"]["message"].as_str())
        .is_some_and(|m| m.starts_with("unknown command 'status'") || m.starts_with("unknown command 'skill'"))
}

fn copy_status(target: &str, t: &Value) -> TargetStatus {
    let state = t["state"].as_str().filter(|s| matches!(*s, "current" | "stale" | "missing" | "unversioned"));
    TargetStatus {
        target: target.into(),
        path: t["path"].as_str().map(paths::tilde),
        installed: t["installed"].as_str().map(str::to_string),
        state: Some(state.unwrap_or("missing").into()),
    }
}

/// cli-base reports Hermes beside `targets`, as `hermes: {path, installed, state, via}`: it is reached through
/// Hermes's own settings, not a folder of its own. A tool without that key cannot write it yet.
fn from_status(v: &Value) -> Vec<TargetStatus> {
    let b = body(v);
    let folders = b["targets"].as_array().into_iter().flatten().filter_map(|t| {
        let target = t["target"].as_str().filter(|x| TARGETS.contains(x) && *x != "hermes")?;
        Some(copy_status(target, t))
    });
    let hermes = b["hermes"].is_object().then(|| copy_status("hermes", &b["hermes"]));
    folders.chain(hermes).collect()
}

/// `memo doctor` lists the copies it found; a target it does not list has none. It knows only the two folders it
/// writes, so a Hermes target stays unreported (the interface then says it needs a newer tool) rather than missing.
fn from_doctor(v: &Value) -> Vec<TargetStatus> {
    let found = body(v)["skills"].as_array().cloned().unwrap_or_default();
    ["claude", "agents"]
        .iter()
        .map(|target| {
            let copy = found.iter().find(|s| s["target"].as_str() == Some(target));
            let installed = copy.and_then(|s| s["version"].as_str()).map(str::to_string);
            let state = match (copy, &installed) {
                (None, _) => Some("missing".into()),
                (Some(_), None) => Some("unversioned".into()),
                (Some(_), Some(_)) => None,
            };
            TargetStatus {
                target: (*target).into(),
                path: copy.and_then(|s| s["path"].as_str()).map(paths::tilde),
                installed,
                state,
            }
        })
        .collect()
}

const NO_SKILL: &str = "this tool has no skill of its own";

const STATUS: &str = "skill status";
const DOCTOR_SKILLS: &str = "doctor skills";

/// A version that refused `skill status`, or whose doctor lists no skills, is not asked that again until it changes.
pub fn status(tool: &Tool) -> Result<SkillReport, String> {
    let src: &SkillSource = tool.skill.as_ref().ok_or(NO_SKILL)?;
    let bin = paths::find(&tool.bin).ok_or("the tool is not installed")?;
    if REFUSED.known(&tool.id, STATUS, &bin).is_none() {
        let (out, json) = call(tool, &src.status, Duration::from_secs(30))?;
        match json {
            Some(v) if out.code == Some(0) => return Ok(SkillReport { source: "status", targets: from_status(&v) }),
            ref j if !unsupported(j.as_ref()) => return Err(failure(&out, j.as_ref())),
            _ => REFUSED.remember(&tool.id, STATUS, &bin, ""),
        }
    }
    if let Some(doctor) = &src.doctor_skills
        && REFUSED.known(&tool.id, DOCTOR_SKILLS, &bin).is_none()
    {
        let (out, json) = call(tool, doctor, Duration::from_mins(1))?;
        if let Some(v) = json.filter(|v| body(v).get("skills").is_some()) {
            return Ok(SkillReport { source: "doctor", targets: from_doctor(&v) });
        }
        if out.code != Some(0) {
            return Err(failure(&out, None));
        }
        REFUSED.remember(&tool.id, DOCTOR_SKILLS, &bin, "");
    }
    Ok(SkillReport { source: "none", targets: Vec::new() })
}

pub fn validate_target(target: &str) -> Result<(), String> {
    if TARGETS.contains(&target) { Ok(()) } else { Err(format!("not a skill target: {target}")) }
}

fn install_args(src: &SkillSource, target: &str) -> Result<Vec<String>, String> {
    validate_target(target)?;
    Ok(src.install.iter().map(|a| if a == "{target}" { target.to_string() } else { a.clone() }).collect())
}

/// Returns the version written, which is the CLI's own. `--for hermes` must find `hermes` itself, or it copies into
/// `$HERMES_HOME/skills` and Hermes, which may read the shared folder too, sees the skill twice; `call` runs with the
/// full search PATH (`~/.local/bin` and the login shell's), so it does.
pub fn install(tool: &Tool, target: &str) -> Result<Option<String>, String> {
    let args = install_args(tool.skill.as_ref().ok_or(NO_SKILL)?, target)?;
    let (out, json) = call(tool, &args, Duration::from_mins(1))?;
    if out.code == Some(0) {
        Ok(json.as_ref().and_then(|v| body(v)["version"].as_str()).map(str::to_string))
    } else {
        Err(failure(&out, json.as_ref()))
    }
}

#[derive(Serialize, Debug)]
pub struct SkillText {
    pub name: String,
    pub content: String,
}

/// The SKILL.md this version of the tool ships, printed by the tool. Not masked: it is the tool's own published text.
pub fn show(tool: &Tool) -> Result<SkillText, String> {
    let src = tool.skill.as_ref().ok_or(NO_SKILL)?;
    let (out, json) = call(tool, &src.show, Duration::from_secs(30))?;
    let item = json.as_ref().map(body).filter(|_| out.code == Some(0));
    if let Some((name, content)) = item.and_then(|v| Some((v["name"].as_str()?, v["content"].as_str()?))) {
        return Ok(SkillText { name: name.into(), content: content.into() });
    }
    // memo has no `--json` on `skill show` and prints the file itself.
    match plain_skill(&out.stdout).filter(|_| out.code == Some(0)) {
        Some(text) => Ok(text),
        None => Err(failure(&out, json.as_ref())),
    }
}

fn plain_skill(stdout: &str) -> Option<SkillText> {
    let front = stdout.strip_prefix("---\n")?;
    let name = front.lines().take_while(|l| *l != "---").find_map(|l| l.strip_prefix("name:"))?.trim();
    Some(SkillText { name: name.into(), content: stdout.into() })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::catalog;
    use serde_json::json;

    #[test]
    fn target_is_one_place_and_never_a_flag() {
        let src = catalog::tool("tg").unwrap().skill.as_ref().unwrap();
        assert_eq!(install_args(src, "agents").unwrap(), ["skill", "install", "--for", "agents", "--json"]);
        assert!(install_args(src, "all").is_err());
        assert!(install_args(src, "--help").is_err());
        assert!(install_args(src, "claude agents").is_err());
    }

    #[test]
    fn an_old_cli_is_unsupported_and_a_crash_is_not() {
        let old = json!({"error": {"code": "validation_error", "message": "unknown command 'status'"}});
        assert!(unsupported(Some(&old)));
        assert!(unsupported(Some(&json!({"error": {"message": "unknown command 'skill'"}}))));
        assert!(!unsupported(Some(&json!({"error": {"message": "command.crashed"}}))));
        assert!(!unsupported(None));
    }

    #[test]
    fn reads_status_bare_or_wrapped() {
        let bare = json!({"name": "tg-cli", "version": "0.90.0", "targets": [
            {"target": "claude", "path": "/x/.claude/skills/tg-cli/SKILL.md", "installed": "0.90.0", "state": "current"},
            {"target": "agents", "path": "/x/.agents/skills/tg-cli/SKILL.md", "installed": null, "state": "missing"},
            {"target": "elsewhere", "path": "/x", "installed": null, "state": "missing"}
        ]});
        let rows = from_status(&bare);
        assert_eq!(rows.len(), 2);
        assert_eq!(rows[0].state.as_deref(), Some("current"));
        assert_eq!(rows[1].installed, None);
        assert_eq!(from_status(&json!({"item": bare})), rows);
    }

    #[test]
    fn reads_a_skill_printed_as_the_file_itself() {
        let text = plain_skill("---\nname: cli-memo\ndescription: x\n---\n# Memo\n").unwrap();
        assert_eq!(text.name, "cli-memo");
        assert!(text.content.starts_with("---\nname: cli-memo"));
        assert!(plain_skill("unknown option '--json'").is_none());
    }

    #[test]
    fn hermes_is_a_target_once_a_tool_reports_it() {
        let hermes = json!({"path": "/x/.agents/skills/tg-cli/SKILL.md", "installed": "1.0.0", "state": "current",
            "via": "external_dirs"});
        let v = json!({"targets": [{"target": "claude", "path": null, "installed": null, "state": "missing"}],
            "hermes": hermes});
        let rows = from_status(&v);
        assert_eq!((rows[1].target.as_str(), rows[1].state.as_deref()), ("hermes", Some("current")));
        assert_eq!(from_status(&json!({"item": v})), rows);
        assert_eq!(from_status(&json!({"targets": []})), Vec::<TargetStatus>::new());
        assert!(validate_target("hermes").is_ok());
        assert!(from_doctor(&json!({"skills": []})).iter().all(|t| t.target != "hermes"));
    }

    fn found(home: &Path, env: &[(&str, &Path)], programs: &[&str]) -> Vec<(&'static str, Option<&'static str>)> {
        detect(
            Some(home),
            |k| env.iter().find(|(n, _)| *n == k).map(|(_, v)| v.as_os_str().to_owned()),
            |p| programs.contains(&p),
        )
        .into_iter()
        .filter(|a| a.id == "hermes" || a.id == "openclaw")
        .map(|a| (a.id, a.found_by))
        .collect()
    }

    fn temp_home(name: &str) -> PathBuf {
        let dir = std::env::temp_dir().join(format!("wirecat-agents-{name}-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&dir);
        std::fs::create_dir_all(&dir).unwrap();
        dir
    }

    #[test]
    fn hermes_and_openclaw_are_found_by_program_or_folder() {
        let home = temp_home("empty");
        assert_eq!(found(&home, &[], &[]), [("hermes", None), ("openclaw", None)]);
        assert_eq!(
            found(&home, &[], &["hermes", "openclaw"]),
            [("hermes", Some("program")), ("openclaw", Some("program"))]
        );
        std::fs::create_dir_all(home.join(".hermes/skills")).unwrap();
        std::fs::create_dir_all(home.join(".openclaw/skills")).unwrap();
        assert_eq!(
            found(&home, &[], &[]),
            [("hermes", None), ("openclaw", None)],
            "a skills folder alone is not the agent"
        );
        std::fs::write(home.join(".hermes/config.yaml"), "").unwrap();
        std::fs::write(home.join(".openclaw/openclaw.json"), "{}").unwrap();
        assert_eq!(found(&home, &[], &[]), [("hermes", Some("folder")), ("openclaw", Some("folder"))]);
        std::fs::remove_dir_all(&home).unwrap();
    }

    #[test]
    fn a_moved_hermes_home_counts_and_an_empty_one_does_not() {
        let home = temp_home("moved");
        let moved = home.join("elsewhere");
        std::fs::create_dir_all(&moved).unwrap();
        std::fs::write(moved.join("config.yaml"), "").unwrap();
        std::fs::write(moved.join("openclaw.json"), "{}").unwrap();
        assert_eq!(found(&home, &[("HERMES_HOME", &moved)], &[])[0], ("hermes", Some("folder")));
        assert_eq!(found(&home, &[("HERMES_HOME", Path::new(""))], &[])[0], ("hermes", None));
        assert_eq!(found(&home, &[("OPENCLAW_STATE_DIR", &moved)], &[])[1], ("openclaw", Some("folder")));
        std::fs::remove_dir_all(&home).unwrap();
    }

    #[test]
    fn hermes_reads_its_own_target_and_openclaw_the_shared_one() {
        let home = temp_home("reads");
        let all = detect(Some(&home), |_| None, |_| false);
        assert_eq!(all.iter().find(|a| a.id == "hermes").unwrap().reads, ["hermes"]);
        assert_eq!(all.iter().find(|a| a.id == "openclaw").unwrap().reads, ["agents"]);
        std::fs::remove_dir_all(&home).unwrap();
    }

    #[test]
    fn doctor_skills_leave_the_comparison_to_the_interface() {
        let v = json!({"item": {"skills": [{"target": "claude", "path": "/x/SKILL.md", "version": "0.93.0"}]}});
        let rows = from_doctor(&v);
        assert_eq!(rows[0].installed.as_deref(), Some("0.93.0"));
        assert_eq!(rows[0].state, None);
        assert_eq!(rows[1].state.as_deref(), Some("missing"));
    }

    /// `cargo test -- --ignored real_skills`: agent names and skill states only, never paths.
    #[test]
    #[ignore = "needs the tools installed"]
    fn real_skills() {
        let found: Vec<_> =
            agents().into_iter().filter_map(|a| a.found_by.map(|f| format!("{} ({f})", a.name))).collect();
        println!("agents: {found:?}");
        for tool in catalog::catalog().tools.iter().filter(|t| t.skill.is_some()) {
            match status(tool) {
                Ok(r) => println!(
                    "{}: {} {:?}",
                    tool.id,
                    r.source,
                    r.targets
                        .iter()
                        .map(|t| (t.target.clone(), t.state.clone(), t.installed.clone()))
                        .collect::<Vec<_>>()
                ),
                Err(e) => println!("{}: error {e}", tool.id),
            }
        }
    }
}
