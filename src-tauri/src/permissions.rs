use crate::catalog::{PermissionsSource, Tool};
use crate::settings::{self, Origin};
use crate::{redact, run};
use serde::Serialize;
use serde_json::Value;

const LEVELS: [&str; 4] = ["deny", "readonly", "ask", "allow"];

/// The first-run answer sits among the levels under this key; only `setup` writes it.
const CEILING_KEY: &str = "*";

#[derive(Serialize, Debug, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct OwnLevel {
    pub key: String,
    pub level: String,
    pub origin: Origin,
    pub from: Option<String>,
}

#[derive(Serialize, Debug, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct CommandAccess {
    pub path: Vec<String>,
    pub writes: bool,
    pub available: bool,
    pub reason: Option<String>,
    pub permission: Option<String>,
}

#[derive(Serialize, Debug)]
#[serde(rename_all = "camelCase")]
pub struct Permissions {
    /// What the owner wrote, nearest layer first as the tool resolved it. Built-in defaults are not here.
    pub levels: Vec<OwnLevel>,
    pub ceiling: Option<String>,
    /// `None` when the tool does not say per command whether this profile may run it.
    pub commands: Option<Vec<CommandAccess>>,
    pub commands_error: Option<String>,
}

fn source(tool: &Tool) -> Result<&PermissionsSource, String> {
    tool.permissions.as_ref().ok_or_else(|| "WireCat cannot show this tool's permissions yet.".into())
}

fn is_key(key: &str) -> bool {
    key.len() <= 128
        && key.split('.').all(|part| {
            part.starts_with(|c: char| c.is_ascii_lowercase())
                && part.chars().all(|c| c.is_ascii_lowercase() || c.is_ascii_digit() || c == '-')
        })
}

/// Keys and levels pass by shape, not through `redact::json`: its key masking would hide `account.*` levels.
fn own_levels(item: &Value, env_prefix: &str) -> (Vec<OwnLevel>, Option<String>) {
    let row = item["settings"].as_array().and_then(|rows| rows.iter().find(|r| r["setting"] == "permissions"));
    let Some(row) = row else { return (Vec::new(), None) };
    let mut ceiling = None;
    let mut levels = Vec::new();
    for (key, level) in row["value"].as_object().into_iter().flatten() {
        let Some(level) = level.as_str().filter(|l| LEVELS.contains(l)) else { continue };
        if key == CEILING_KEY {
            ceiling = Some(level.to_string());
            continue;
        }
        if !is_key(key) {
            continue;
        }
        let from = row["sources"][key].as_str().map(str::to_string);
        levels.push(OwnLevel {
            key: key.clone(),
            level: level.to_string(),
            origin: from.as_deref().map_or(Origin::Other, |f| settings::origin_of(f, env_prefix)),
            from: from.as_deref().map(redact::text),
        });
    }
    (levels, ceiling)
}

fn leaves<'a>(nodes: &'a [Value], out: &mut Vec<&'a Value>) {
    for node in nodes {
        match node["commands"].as_array() {
            Some(children) if !children.is_empty() => leaves(children, out),
            _ => out.push(node),
        }
    }
}

/// Only leaves that carry `availability`: an older tool lists its commands without saying who may run them.
fn command_access(doc: &Value) -> Option<Vec<CommandAccess>> {
    let mut found = Vec::new();
    leaves(doc["commands"].as_array().map_or(&[], Vec::as_slice), &mut found);
    let commands: Option<Vec<CommandAccess>> = found
        .into_iter()
        .map(|leaf| {
            let availability = leaf.get("availability")?;
            let effects = &leaf["effects"];
            Some(CommandAccess {
                path: leaf["path"].as_array()?.iter().filter_map(|w| w.as_str().map(str::to_string)).collect(),
                writes: effects.is_null() || effects["remote"] == "write" || effects["local"] == "write",
                available: availability["available"].as_bool()?,
                reason: availability["reason"].as_str().map(redact::text),
                permission: availability["permission"].as_str().filter(|k| is_key(k)).map(str::to_string),
            })
        })
        .collect();
    commands.filter(|c| !c.is_empty())
}

pub fn show(tool: &Tool, profile: Option<&str>) -> Result<Permissions, String> {
    let src = source(tool)?;
    let settings_src = tool.settings.as_ref().ok_or("This tool has no settings command.")?;
    let out = settings::run_tool(tool, &settings::args_for(&settings_src.show, profile)?)?;
    let json = settings::parsed(&out);
    let item = match json.as_ref() {
        Some(v) if out.code == Some(0) && v.get("item").is_some() => &v["item"],
        _ => return Err(settings::failure(&out, json.as_ref())),
    };
    let (levels, ceiling) = own_levels(item, &tool.storage.env);

    // Without a profile the tool has no levels to check a command against, so it reports none.
    let (commands, commands_error) = match profile {
        None => (None, None),
        Some(p) => match listed(tool, src, p) {
            Ok(c) => (c, None),
            Err(e) => (None, Some(e)),
        },
    };
    Ok(Permissions { levels, ceiling, commands, commands_error })
}

fn listed(tool: &Tool, src: &PermissionsSource, profile: &str) -> Result<Option<Vec<CommandAccess>>, String> {
    let out: run::Output = settings::run_tool(tool, &settings::args_for(&src.commands, Some(profile))?)?;
    let json = settings::parsed(&out);
    match json {
        Some(v) if out.code == Some(0) => Ok(command_access(&v)),
        _ => Err(settings::failure(&out, json.as_ref())),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn levels_keep_account_keys_and_lift_out_the_setup_answer() {
        let item = json!({"settings": [
            {"setting": "limit", "value": 20, "from": "default"},
            {"setting": "permissions", "from": "config file",
             "value": {"account.sessions.end": "allow", "messages": "readonly", "*": "readonly",
                       "chats": "everything", "Bad Key": "deny"},
             "sources": {"account.sessions.end": "config file: personal.profiles.work",
                         "messages": "config file: personal.defaults", "*": "setup answer"}}
        ]});
        let (levels, ceiling) = own_levels(&item, "TG");
        assert_eq!(ceiling.as_deref(), Some("readonly"));
        assert_eq!(levels.len(), 2, "unknown levels and malformed keys are dropped");
        let account = levels.iter().find(|l| l.key == "account.sessions.end").unwrap();
        assert_eq!((account.level.as_str(), account.origin), ("allow", Origin::Profile));
        let messages = levels.iter().find(|l| l.key == "messages").unwrap();
        assert_eq!(messages.origin, Origin::Defaults);
    }

    #[test]
    fn no_permissions_row_is_no_levels() {
        let (levels, ceiling) = own_levels(&json!({"settings": []}), "TG");
        assert!(levels.is_empty() && ceiling.is_none());
    }

    #[test]
    fn commands_flatten_to_leaves_with_their_access() {
        let doc = json!({"commands": [
            {"path": ["messages"], "commands": [
                {"path": ["messages", "list"], "effects": {"remote": "read", "local": "read"},
                 "availability": {"available": true}, "commands": []},
                {"path": ["messages", "send"], "effects": {"remote": "write", "local": "write"},
                 "availability": {"available": false, "reason": "messages.send is readonly in this profile",
                                  "permission": "messages.send"}, "commands": []}
            ]},
            {"path": ["config"], "effects": {"remote": "none", "local": "write"},
             "availability": {"available": true}, "commands": []}
        ]});
        let c = command_access(&doc).unwrap();
        assert_eq!(c.len(), 3);
        assert!(!c[0].writes && c[0].available);
        assert_eq!(c[1].permission.as_deref(), Some("messages.send"));
        assert!(c[1].writes && !c[1].available);
        assert!(c[2].writes, "a local write is a change too");
    }

    #[test]
    fn an_older_tool_without_availability_reports_none() {
        let doc = json!({"commands": [{"path": ["messages", "list"], "effects": {"remote": "read"}, "commands": []}]});
        assert!(command_access(&doc).is_none());
    }

    #[test]
    fn keys_are_command_paths() {
        assert!(is_key("chats.members.remove"));
        assert!(is_key("mark-read"));
        assert!(!is_key("*"));
        assert!(!is_key("messages..send"));
        assert!(!is_key("--defaults"));
    }
}
