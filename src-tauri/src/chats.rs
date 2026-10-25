use crate::skills::failure;
use crate::{paths, run};
use serde::Serialize;
use serde_json::Value;
use std::path::{Path, PathBuf};
use std::time::Duration;

/// Which chat apps can drive an agent: anyone such a bot accepts can make it run the tools. Read only; only the
/// apps' names leave Rust, never a chat, account or user id.
#[derive(Serialize, Debug, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Chats {
    /// The file read or the command run.
    pub source: String,
    /// `None` when the source does not say.
    pub running: Option<bool>,
    pub channels: Vec<String>,
}

pub fn read(agent: &str) -> Result<Chats, String> {
    match agent {
        "hermes" => Ok(hermes(&hermes_home().ok_or("no home folder")?)),
        "openclaw" => openclaw(),
        _ => Err(format!("{agent} is not driven from chats")),
    }
}

fn hermes_home() -> Option<PathBuf> {
    std::env::var_os("HERMES_HOME")
        .filter(|v| !v.is_empty())
        .map(PathBuf::from)
        .or_else(|| Some(paths::home()?.join(".hermes")))
}

/// The PATH Hermes's gateway starts with: `hermes gateway install` writes it into its systemd unit. Without one
/// (macOS, a gateway run by hand, Hermes used only in a terminal) Hermes inherits a terminal's PATH, so `None`.
pub fn hermes_base_path() -> Option<std::ffi::OsString> {
    let unit = paths::home()?.join(".config/systemd/user/hermes-gateway.service");
    service_path(&std::fs::read_to_string(unit).ok()?).map(Into::into)
}

fn service_path(unit: &str) -> Option<&str> {
    unit.lines().rev().find_map(|l| {
        let v = l.trim().strip_prefix("Environment=")?.trim_matches('"');
        v.strip_prefix("PATH=").filter(|p| !p.is_empty())
    })
}

/// A platform name is a plain word; anything else is not a name and stays here.
fn plain(name: &str) -> bool {
    (1..=32).contains(&name.len())
        && name.bytes().all(|b| b.is_ascii_lowercase() || b.is_ascii_digit() || b == b'_' || b == b'-')
}

/// The gateway writes `gateway_state.json` itself. `hermes gateway status` would say the same in prose, along with
/// the service journal. The platforms count even while the gateway is stopped: it starts again with them.
fn hermes(home: &Path) -> Chats {
    let file = home.join("gateway_state.json");
    let source = paths::tilde(&file.to_string_lossy());
    let state: Value =
        std::fs::read_to_string(&file).ok().and_then(|t| serde_json::from_str(&t).ok()).unwrap_or(Value::Null);
    let mut channels: Vec<String> =
        state["platforms"].as_object().into_iter().flat_map(|m| m.keys()).filter(|k| plain(k)).cloned().collect();
    channels.sort();
    let running = state["gateway_state"].as_str() == Some("running") && state["pid"].as_u64().is_some_and(alive);
    Chats { source, running: Some(running), channels }
}

/// A gateway that crashed leaves its last state behind; a process with its id must still be there.
fn alive(pid: u64) -> bool {
    if cfg!(target_os = "linux") { Path::new("/proc").join(pid.to_string()).exists() } else { true }
}

const OPENCLAW_CHANNELS: [&str; 3] = ["channels", "list", "--json"];

/// `channels list --json` reads `OpenClaw`'s local inventory without contacting its gateway (docs/cli/channels.md).
fn openclaw() -> Result<Chats, String> {
    let source = format!("openclaw {}", OPENCLAW_CHANNELS.join(" "));
    let bin = paths::find("openclaw").ok_or("openclaw is not on PATH, so its channels could not be read")?;
    let out = run::run(&bin, &OPENCLAW_CHANNELS, Some(&paths::search_path()), Duration::from_secs(20))
        .map_err(|e| e.to_string())?;
    let json = out.json().filter(|_| out.code == Some(0)).ok_or_else(|| failure(&out, None))?;
    Ok(Chats { source, running: None, channels: openclaw_channels(&json) })
}

/// Each chat app is `chat.<name>` with the ids of its configured `accounts`; only the name is kept.
fn openclaw_channels(v: &Value) -> Vec<String> {
    let mut names: Vec<String> = v["chat"]
        .as_object()
        .into_iter()
        .flatten()
        .filter(|(name, entry)| plain(name) && entry["accounts"].as_array().is_some_and(|a| !a.is_empty()))
        .map(|(name, _)| name.clone())
        .collect();
    names.sort();
    names
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    fn temp_home(name: &str) -> PathBuf {
        let dir = std::env::temp_dir().join(format!("wirecat-chats-{name}-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&dir);
        std::fs::create_dir_all(&dir).unwrap();
        dir
    }

    #[test]
    fn hermes_without_a_gateway_has_no_chats() {
        let home = temp_home("none");
        let chats = hermes(&home);
        assert_eq!((chats.running, chats.channels.len()), (Some(false), 0));
        std::fs::remove_dir_all(&home).unwrap();
    }

    #[test]
    fn hermes_platforms_leave_by_name_only() {
        let home = temp_home("gateway");
        let state = json!({
            "pid": std::process::id(),
            "gateway_state": "running",
            "platforms": {
                "telegram": {"state": "connected", "chat_id": "123456789"},
                "Bad Name 123456789": {"state": "connected"}
            }
        });
        std::fs::write(home.join("gateway_state.json"), state.to_string()).unwrap();
        let chats = hermes(&home);
        assert_eq!(chats.channels, ["telegram"]);
        assert_eq!(chats.running, Some(true));
        assert!(!serde_json::to_string(&chats).unwrap().contains("123456789"));
        std::fs::remove_dir_all(&home).unwrap();
    }

    #[cfg(target_os = "linux")]
    #[test]
    fn a_stale_running_state_is_not_running() {
        let home = temp_home("stale");
        let state = json!({"pid": u64::from(u32::MAX), "gateway_state": "running", "platforms": {"discord": {}}});
        std::fs::write(home.join("gateway_state.json"), state.to_string()).unwrap();
        let chats = hermes(&home);
        assert_eq!((chats.running, chats.channels), (Some(false), vec!["discord".to_string()]));
        std::fs::remove_dir_all(&home).unwrap();
    }

    #[test]
    fn reads_the_gateway_path_from_its_unit() {
        let unit = "[Service]\nEnvironment=\"PATH=/a/bin:/usr/bin\"\nEnvironment=\"HERMES_HOME=/h\"\n";
        assert_eq!(service_path(unit), Some("/a/bin:/usr/bin"));
        assert_eq!(service_path("Environment=PATH=/b\n"), Some("/b"));
        assert_eq!(service_path("[Service]\nExecStart=hermes\n"), None);
    }

    /// Shaped like openclaw's own `channels.list.test.ts`: configured accounts only, ids never kept.
    #[test]
    fn openclaw_channels_with_accounts_only() {
        let v = json!({"chat": {
            "telegram": {"label": "Telegram", "accounts": ["default"], "installed": true},
            "discord": {"label": "Discord", "accounts": [], "installed": true},
            "whatsapp": {"label": "WhatsApp", "accounts": ["+34600000000"]}
        }});
        assert_eq!(openclaw_channels(&v), ["telegram", "whatsapp"]);
        assert!(openclaw_channels(&json!({})).is_empty());
    }

    /// `cargo test -- --ignored real_chats`: the gateway's platform names on this computer.
    #[test]
    #[ignore = "reads this computer's Hermes"]
    fn real_chats() {
        println!("{:?}", read("hermes"));
        let path = hermes_base_path().and_then(|base| paths::bash_login_path(&base));
        for bin in ["tg", "max", "wa", "zm", "drive", "memo"] {
            println!("{bin}: the Hermes gateway finds it: {}", path.as_ref().is_some_and(|p| paths::finds(bin, p)));
        }
    }
}
