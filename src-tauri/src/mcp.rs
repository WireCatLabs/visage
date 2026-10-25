use crate::catalog::{self, McpSource, Tool};
use crate::skills::{body, call, failure};
use crate::{paths, redact, run};
use serde::Serialize;
use serde_json::Value;
use std::path::PathBuf;
use std::time::Duration;

/// Where each agent keeps its MCP servers, from the agents' own docs. Read only, and only the server names leave.
enum Registry {
    /// The agent's own command prints the list as JSON (`codex mcp list --json`).
    Command { program: &'static str, args: &'static [&'static str] },
    /// No command lists without starting every server, so the settings file is read: a key under home.
    File { path: &'static str, key: &'static str },
}

struct AgentMcp {
    id: &'static str,
    registry: Registry,
    /// The `mcp add` client name the `WireCat` tools register with, when they can.
    client: Option<&'static str>,
    /// The agent's own command that removes a user-level server; `{name}` is a validated `WireCat` server name.
    remove: Option<(&'static str, &'static [&'static str])>,
}

const AGENTS: [AgentMcp; 5] = [
    // `claude mcp list` and `get` health-check every server, so they would start unrelated servers on page load.
    AgentMcp {
        id: "claude",
        registry: Registry::File { path: ".claude.json", key: "mcpServers" },
        client: Some("claude-code"),
        remove: Some(("claude", &["mcp", "remove", "{name}", "--scope", "user"])),
    },
    AgentMcp {
        id: "codex",
        registry: Registry::Command { program: "codex", args: &["mcp", "list", "--json"] },
        client: Some("codex"),
        remove: Some(("codex", &["mcp", "remove", "{name}"])),
    },
    AgentMcp {
        id: "cursor",
        registry: Registry::File { path: ".cursor/mcp.json", key: "mcpServers" },
        client: None,
        remove: None,
    },
    AgentMcp {
        id: "gemini",
        registry: Registry::File { path: ".gemini/settings.json", key: "mcpServers" },
        client: None,
        remove: None,
    },
    AgentMcp {
        id: "opencode",
        registry: Registry::File { path: ".config/opencode/opencode.json", key: "mcp" },
        client: None,
        remove: None,
    },
];

fn agent(id: &str) -> Result<&'static AgentMcp, String> {
    AGENTS.iter().find(|a| a.id == id).ok_or_else(|| format!("unknown agent: {id}"))
}

#[derive(Serialize, Debug)]
#[serde(rename_all = "camelCase")]
pub struct Registrations {
    /// The command run or the file read, so the interface can say where the answer came from.
    pub source: String,
    /// Only names a `WireCat` tool would register: `<bin>` or `<bin>-<profile>`.
    pub names: Vec<String>,
    /// Whether the tools' own `mcp add` can register with this agent.
    pub can_add: bool,
    pub can_remove: bool,
}

/// `tg-personal` is what cli-core's `mcp add` names a profile's server; `tg` alone is what its help suggests.
fn is_wirecat(name: &str) -> bool {
    catalog::catalog().tools.iter().filter(|t| t.part_of.is_none()).any(|t| {
        name == t.bin || name.strip_prefix(&t.bin).and_then(|r| r.strip_prefix('-')).is_some_and(plain_profile)
    })
}

fn plain_profile(p: &str) -> bool {
    catalog::validate_profile(p).is_ok()
}

fn wirecat_names(keys: impl Iterator<Item = String>) -> Vec<String> {
    let mut names: Vec<String> = keys.filter(|k| is_wirecat(k)).collect();
    names.sort();
    names
}

pub fn registrations(id: &str) -> Result<Registrations, String> {
    let a = agent(id)?;
    let can_remove = a.remove.is_some_and(|(program, _)| paths::find(program).is_some());
    let can_add = a.client.is_some() && can_remove;
    match &a.registry {
        Registry::File { path, key } => {
            let home = paths::home().ok_or("no home folder")?;
            let file = home.join(path);
            Ok(Registrations {
                source: format!("~/{path}"),
                names: wirecat_names(keys_in(&file, key)?.into_iter()),
                can_add,
                can_remove,
            })
        }
        Registry::Command { program, args } => {
            let source = format!("{program} {}", args.join(" "));
            let bin = paths::find(program).ok_or_else(|| format!("{program} is not on PATH"))?;
            let out = run::run(&bin, args, Some(&paths::search_path()), Duration::from_secs(20))
                .map_err(|e| e.to_string())?;
            let list = out.json().filter(|_| out.code == Some(0)).ok_or_else(|| failure(&out, None))?;
            let keys = list.as_array().into_iter().flatten().filter_map(|s| s["name"].as_str().map(str::to_string));
            Ok(Registrations { source, names: wirecat_names(keys), can_add, can_remove })
        }
    }
}

/// The keys of one object in a JSON settings file; a missing file has none. Values (commands, env, headers with keys
/// in them) are dropped here and never leave this function.
fn keys_in(file: &PathBuf, key: &str) -> Result<Vec<String>, String> {
    let text = match std::fs::read_to_string(file) {
        Ok(t) => t,
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => return Ok(Vec::new()),
        Err(e) => return Err(format!("could not read {}: {e}", paths::tilde(&file.to_string_lossy()))),
    };
    let v: Value = serde_json::from_str(&text)
        .map_err(|_| format!("{} is not plain JSON, so it could not be read", paths::tilde(&file.to_string_lossy())))?;
    Ok(v[key].as_object().map(|m| m.keys().cloned().collect()).unwrap_or_default())
}

fn source(tool: &Tool) -> Result<&McpSource, String> {
    tool.mcp.as_ref().ok_or_else(|| format!("{} cannot register its MCP server yet", tool.name))
}

/// Before `mcp add` and `mcp check` the commands were `setup` and `doctor`, and `mcp` took no subcommand at all.
fn unsupported(json: Option<&Value>) -> bool {
    json.and_then(|v| v["error"]["message"].as_str()).is_some_and(|m| {
        m.starts_with("too many arguments for 'mcp'") || m.starts_with("unknown command 'add'") || m.contains("'check'")
    })
}

fn too_old(tool: &Tool) -> String {
    format!("This version of {} cannot do this yet. Update it on the Tools page.", tool.name)
}

#[derive(Serialize, Debug, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct Health {
    pub healthy: bool,
    pub signed_in: bool,
    pub tools: u64,
    /// MCP tools the server offers that may write (send, delete); `mcp add` asks for `--allow-writes` when above 0.
    pub potential_writes: u64,
}

fn health(v: &Value) -> Option<Health> {
    let item = body(v);
    Some(Health {
        healthy: item["healthy"].as_bool()?,
        signed_in: item["signed_in"].as_bool().unwrap_or(false),
        tools: item["tools"].as_u64().unwrap_or(0),
        potential_writes: item["potential_writes"].as_u64().unwrap_or(0),
    })
}

/// Starts the profile's server once and asks it for its tool list: the tool's own `mcp check`. Writes nothing.
pub fn check(tool: &Tool, profile: &str) -> Result<Health, String> {
    let args = catalog::with_profile(&source(tool)?.check, Some(profile))?;
    let (out, json) = call(tool, &args, Duration::from_secs(40))?;
    if unsupported(json.as_ref()) {
        return Err(too_old(tool));
    }
    match json.as_ref().and_then(health) {
        Some(h) if out.code == Some(0) => Ok(h),
        _ => Err(failure(&out, json.as_ref())),
    }
}

fn add_args(src: &McpSource, profile: &str, client: &str, allow_writes: bool) -> Result<Vec<String>, String> {
    let mut args: Vec<String> = catalog::with_profile(&src.add, Some(profile))?
        .into_iter()
        .map(|a| if a == "{client}" { client.to_string() } else { a })
        .collect();
    if allow_writes {
        args.push("--allow-writes".into());
    }
    Ok(args)
}

/// The tool's own `mcp add`, which registers `<bin>-<profile>` through the agent's CLI at user level.
pub fn add(tool: &Tool, profile: &str, agent_id: &str, allow_writes: bool) -> Result<(), String> {
    let client = agent(agent_id)?.client.ok_or("the tools cannot register with this agent themselves")?;
    let args = add_args(source(tool)?, profile, client, allow_writes)?;
    let (out, json) = call(tool, &args, Duration::from_mins(1))?;
    if unsupported(json.as_ref()) {
        return Err(too_old(tool));
    }
    if out.code == Some(0) { Ok(()) } else { Err(failure(&out, json.as_ref())) }
}

/// Only a name a `WireCat` tool registers, built here from the catalog and a validated profile.
fn server_name(tool: &Tool, profile: Option<&str>) -> Result<String, String> {
    match profile {
        Some(p) => {
            catalog::validate_profile(p)?;
            Ok(format!("{}-{p}", tool.bin))
        }
        None => Ok(tool.bin.clone()),
    }
}

fn remove_args(spec: &[&str], name: &str) -> Vec<String> {
    spec.iter().map(|a| if *a == "{name}" { name.to_string() } else { (*a).to_string() }).collect()
}

/// No `WireCat` tool removes its server yet, so the agent's own command does, for a `WireCat` name only.
pub fn remove(tool: &Tool, profile: Option<&str>, agent_id: &str) -> Result<(), String> {
    let (program, spec) = agent(agent_id)?.remove.ok_or("this agent's servers are changed in its own settings")?;
    let name = server_name(tool, profile)?;
    let bin = paths::find(program).ok_or_else(|| format!("{program} is not on PATH"))?;
    let args = remove_args(spec, &name);
    let refs: Vec<&str> = args.iter().map(String::as_str).collect();
    let out = run::run(&bin, &refs, Some(&paths::search_path()), Duration::from_secs(30)).map_err(|e| e.to_string())?;
    if out.code == Some(0) { Ok(()) } else { Err(redact::text(&failure(&out, None))) }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn tg() -> &'static Tool {
        catalog::tool("tg").unwrap()
    }

    #[test]
    fn only_wirecat_names_pass() {
        let keys = ["pencil", "tg", "tg-personal", "max-work.2", "tgx", "tg-", "tg--help", "github", "memo"];
        assert_eq!(wirecat_names(keys.iter().map(ToString::to_string)), ["max-work.2", "memo", "tg", "tg-personal"]);
    }

    #[test]
    fn add_fills_profile_and_client_and_asks_for_writes_only_when_told() {
        let src = source(tg()).unwrap();
        assert_eq!(add_args(src, "personal", "codex", false).unwrap(), ["personal", "mcp", "add", "codex", "--json"]);
        assert_eq!(
            add_args(src, "work", "claude-code", true).unwrap(),
            ["work", "mcp", "add", "claude-code", "--json", "--allow-writes"]
        );
        assert!(add_args(src, "--help", "codex", false).is_err());
    }

    #[test]
    fn removes_only_a_name_built_from_the_catalog() {
        assert_eq!(server_name(tg(), Some("personal")).unwrap(), "tg-personal");
        assert_eq!(server_name(tg(), None).unwrap(), "tg");
        assert!(server_name(tg(), Some("x y")).is_err());
        let (_, spec) = agent("claude").unwrap().remove.unwrap();
        assert_eq!(remove_args(spec, "tg-personal"), ["mcp", "remove", "tg-personal", "--scope", "user"]);
        assert!(agent("cursor").unwrap().remove.is_none());
        assert!(agent("vim").is_err());
    }

    #[test]
    fn an_old_cli_says_update() {
        let old = serde_json::json!({"error": {"message": "too many arguments for 'mcp'. Expected 0 arguments but got 1: check."}});
        assert!(unsupported(Some(&old)));
        assert!(!unsupported(Some(&serde_json::json!({"error": {"message": "tg-personal is already configured"}}))));
    }

    #[test]
    fn health_reads_the_check_answer() {
        let v = serde_json::json!({"item": {"healthy": false, "profile": "p", "signed_in": false, "tools": 3, "potential_writes": 1}});
        assert_eq!(health(&v), Some(Health { healthy: false, signed_in: false, tools: 3, potential_writes: 1 }));
        assert_eq!(health(&serde_json::json!({"item": {}})), None);
    }

    #[test]
    fn a_settings_file_gives_keys_only() {
        let dir = std::env::temp_dir().join(format!("wirecat-mcp-{}", std::process::id()));
        std::fs::create_dir_all(&dir).unwrap();
        let file = dir.join("mcp.json");
        std::fs::write(&file, r#"{"mcpServers": {"tg-personal": {"env": {"API_KEY": "x"}}, "github": {}}}"#).unwrap();
        assert_eq!(keys_in(&file, "mcpServers").unwrap(), ["github", "tg-personal"]);
        assert!(keys_in(&dir.join("absent.json"), "mcpServers").unwrap().is_empty());
        std::fs::remove_dir_all(&dir).unwrap();
    }

    /// `cargo test -- --ignored real_mcp`: which agents list `WireCat` servers, names only.
    #[test]
    #[ignore = "reads the agents' settings on this computer"]
    fn real_mcp() {
        for a in &AGENTS {
            match registrations(a.id) {
                Ok(r) => {
                    println!("{}: {} via {} add={} remove={}", a.id, r.names.len(), r.source, r.can_add, r.can_remove);
                }
                Err(e) => println!("{}: error {e}", a.id),
            }
        }
    }
}
