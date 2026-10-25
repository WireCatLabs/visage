use crate::catalog::{self, SettingsShape, SettingsSource, Tool};
use crate::{paths, redact, run};
use serde::Serialize;
use serde_json::{Map, Value};
use std::time::Duration;

/// Where a value came from, in the few kinds the interface tells apart.
#[derive(Serialize, Debug, Clone, Copy, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum Origin {
    Default,
    Defaults,
    Profile,
    Environment,
    Store,
    Computed,
    File,
    Other,
}

#[derive(Serialize, Debug, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Row {
    /// The name `config set` takes.
    pub key: String,
    pub value: Value,
    pub origin: Origin,
    /// The tool's own words for the origin, when it gives them.
    pub from: Option<String>,
    /// Set for settings that live in the shared store rather than in this tool's file.
    pub scope: Option<String>,
    /// Why the value cannot be changed here.
    pub locked: Option<String>,
    /// The value was masked or shortened on its way out, so it must never be written back.
    pub masked: bool,
    /// `config unset` would remove it from the layer being shown.
    pub resettable: bool,
}

#[derive(Serialize, Debug)]
#[serde(rename_all = "camelCase")]
pub struct Settings {
    pub rows: Vec<Row>,
    pub config_file: Option<String>,
    pub notice: Option<String>,
}

fn source(tool: &Tool) -> Result<&SettingsSource, String> {
    tool.settings.as_ref().ok_or_else(|| "This tool has no settings command.".into())
}

/// `None` is the defaults every profile gets; the `{profile}` word is then left out.
fn args_for(template: &[String], profile: Option<&str>) -> Result<Vec<String>, String> {
    if let Some(p) = profile {
        catalog::validate_profile(p)?;
    }
    Ok(template
        .iter()
        .filter_map(|a| match (a.as_str(), profile) {
            ("{profile}", Some(p)) => Some(p.to_string()),
            ("{profile}", None) => None,
            _ => Some(a.clone()),
        })
        .collect())
}

/// Setting names become process arguments; only the characters real names use pass.
pub fn validate_setting(setting: &str) -> Result<(), String> {
    let ok = !setting.is_empty()
        && setting.len() <= 128
        && !setting.starts_with('-')
        && setting.chars().all(|c| c.is_ascii_alphanumeric() || matches!(c, '.' | '_' | '-'));
    if ok { Ok(()) } else { Err(format!("not a setting name: {setting}")) }
}

fn validate_value(value: &str) -> Result<(), String> {
    if value.starts_with('-') {
        return Err("A value cannot start with \"-\": the tool would read it as an option.".into());
    }
    if value.len() > 8192 || value.contains('\0') {
        return Err("That value is too long or holds characters a command line cannot carry.".into());
    }
    Ok(())
}

fn run_tool(tool: &Tool, args: &[String]) -> Result<run::Output, String> {
    let bin = paths::find(&tool.bin).ok_or("the tool is not installed")?;
    let refs: Vec<&str> = args.iter().map(String::as_str).collect();
    run::run(&bin, &refs, Some(&paths::search_path()), Duration::from_mins(1)).map_err(|e| e.to_string())
}

fn parsed(out: &run::Output) -> Option<Value> {
    serde_json::from_str(&out.stdout).or_else(|_| serde_json::from_str(&out.stderr)).ok()
}

/// The CLI's own message, so a rejected value is explained in the tool's words.
fn failure(out: &run::Output, json: Option<&Value>) -> String {
    if let Some(m) = json.and_then(|v| v["error"]["message"].as_str()) {
        return redact::text(m);
    }
    let last = out.stderr.lines().rev().find(|l| !l.trim().is_empty()).map(str::trim);
    match (last, out.code) {
        (Some(l), _) => redact::text(l),
        (None, Some(c)) => format!("the tool stopped with exit code {c}"),
        (None, None) => "the tool stopped without saying why".into(),
    }
}

pub fn show(tool: &Tool, profile: Option<&str>) -> Result<Settings, String> {
    let src = source(tool)?;
    let profile = if src.per_profile { profile } else { None };
    if profile.is_none() && src.per_profile && !src.defaults {
        return Err("Choose a profile.".into());
    }
    let out = run_tool(tool, &args_for(&src.show, profile)?)?;
    let json = parsed(&out);
    match json {
        Some(v) if out.code == Some(0) && v.get("item").is_some() => Ok(normalise(src, &tool.storage.env, &v, profile)),
        _ => Err(failure(&out, json.as_ref())),
    }
}

fn change(
    tool: &Tool,
    template: &[String],
    profile: Option<&str>,
    defaults: bool,
    tail: &[&str],
) -> Result<(), String> {
    let src = source(tool)?;
    if defaults && !src.defaults {
        return Err("This tool has no defaults for every profile.".into());
    }
    let profile = if src.per_profile { profile } else { None };
    let mut args = args_for(template, profile)?;
    if defaults {
        args.push("--defaults".into());
    }
    args.extend(tail.iter().map(|s| (*s).to_string()));
    let out = run_tool(tool, &args)?;
    if out.code == Some(0) { Ok(()) } else { Err(failure(&out, parsed(&out).as_ref())) }
}

pub fn set(tool: &Tool, profile: Option<&str>, defaults: bool, setting: &str, value: &str) -> Result<(), String> {
    validate_setting(setting)?;
    validate_value(value)?;
    change(tool, &source(tool)?.set, profile, defaults, &[setting, value])
}

pub fn unset(tool: &Tool, profile: Option<&str>, defaults: bool, setting: &str) -> Result<(), String> {
    validate_setting(setting)?;
    let template = source(tool)?.unset.as_ref().ok_or("This tool cannot remove a setting; give it a value instead.")?;
    change(tool, template, profile, defaults, &[setting])
}

fn origin_of(from: &str, env_prefix: &str) -> Origin {
    let is_env_name =
        from.starts_with(&format!("{env_prefix}_")) && from.chars().all(|c| c.is_ascii_uppercase() || c == '_');
    match from {
        _ if is_env_name => Origin::Environment,
        "default" => Origin::Default,
        "config defaults" => Origin::Defaults,
        "store" => Origin::Store,
        "resolved per purpose" => Origin::Computed,
        f if f.starts_with("config file") && f.ends_with("defaults") => Origin::Defaults,
        f if f.starts_with("config file") => Origin::Profile,
        _ => Origin::Other,
    }
}

struct Raw {
    key: String,
    value: Value,
    origin: Origin,
    from: Option<String>,
    scope: Option<String>,
}

fn rows_shape(item: &Value, env_prefix: &str) -> Vec<Raw> {
    let list = |name: &str| item[name].as_array().cloned().unwrap_or_default();
    let store = list("store_settings");
    list("settings")
        .iter()
        .map(|s| (s, false))
        .chain(store.iter().map(|s| (s, true)))
        .filter_map(|(s, in_store)| {
            let key = s["setting"].as_str()?.to_string();
            let from = s["from"].as_str().unwrap_or("").to_string();
            Some(Raw {
                key,
                value: s["value"].clone(),
                origin: origin_of(&from, env_prefix),
                from: Some(redact::text(&from)),
                scope: in_store.then(|| s["scope"].as_str().unwrap_or("store").to_string()),
            })
        })
        .collect()
}

fn flat_shape(item: &Value, src: &SettingsSource) -> Vec<Raw> {
    src.keys
        .iter()
        .flatten()
        .map(|(shown, key)| {
            let value = item.get(shown).cloned().unwrap_or(Value::Null);
            let origin = if value.is_null() { Origin::Default } else { Origin::File };
            Raw { key: key.clone(), value, origin, from: None, scope: None }
        })
        .collect()
}

/// Nested objects become dotted keys, the form `config set` takes (`permissions.files`, `models.memories.provider`).
fn flatten(prefix: &str, value: &Value, out: &mut Vec<(String, Value)>) {
    match value {
        Value::Object(map) => {
            for (k, v) in map {
                let key = if prefix.is_empty() { k.clone() } else { format!("{prefix}.{k}") };
                flatten(&key, v, out);
            }
        }
        _ if !prefix.is_empty() => out.push((prefix.to_string(), value.clone())),
        _ => {}
    }
}

fn profiles_shape(item: &Value, profile: Option<&str>) -> Vec<Raw> {
    let mut defaults = Vec::new();
    flatten("", &item["defaults"], &mut defaults);
    let mut own = Vec::new();
    if let Some(p) = profile {
        flatten("", &item["profiles"][p], &mut own);
    }
    let mut rows: Vec<Raw> = own
        .into_iter()
        .map(|(key, value)| Raw { key, value, origin: Origin::Profile, from: None, scope: None })
        .collect();
    for (key, value) in defaults {
        if !rows.iter().any(|r| r.key == key) {
            rows.push(Raw { key, value, origin: Origin::Defaults, from: None, scope: None });
        }
    }
    rows.sort_by(|a, b| a.key.cmp(&b.key));
    rows
}

/// Masks by the setting's name as well as by content: in a `{setting, value}` row the JSON key is only "value".
fn mask(key: &str, value: &Value) -> (Value, bool) {
    if value.is_null() || value.is_boolean() {
        return (value.clone(), false);
    }
    let mut wrapped = Value::Object(Map::from_iter([(key.to_string(), value.clone())]));
    redact::json(&mut wrapped);
    let shown = wrapped[key].clone();
    let masked = shown != *value;
    (shown, masked)
}

fn normalise(src: &SettingsSource, env_prefix: &str, v: &Value, profile: Option<&str>) -> Settings {
    let item = &v["item"];
    let found = match src.shape {
        SettingsShape::Rows => rows_shape(item, env_prefix),
        SettingsShape::Flat => flat_shape(item, src),
        SettingsShape::Profiles => profiles_shape(item, profile),
    };
    let defaults_view = src.per_profile && profile.is_none();
    // With no profile named, TG_PROFILE, default_profile or a profile literally named "default" can still supply
    // values; they are not the defaults, and `set --defaults` would not change what is shown.
    let from_a_profile = defaults_view && found.iter().any(|r| r.origin == Origin::Profile);
    let rows = found
        .into_iter()
        .map(|r| {
            let (value, masked) = mask(&r.key, &r.value);
            let locked = if r.origin == Origin::Environment {
                Some(format!(
                    "Set by the environment variable {}. Change or remove it there; config set cannot override it.",
                    r.from.as_deref().unwrap_or("")
                ))
            } else if src.read_only.contains(&r.key) {
                Some("This tool does not change it with config set.".into())
            } else if r.value.is_object() {
                Some("Combined from several places. Change its parts in a terminal.".into())
            } else if defaults_view && r.origin == Origin::Profile {
                Some("This value belongs to a profile, not to the defaults. Choose that profile to change it.".into())
            } else {
                None
            };
            let layer = if defaults_view { Origin::Defaults } else { Origin::Profile };
            let resettable =
                src.unset.is_some() && locked.is_none() && (r.origin == layer || r.origin == Origin::Store);
            Row { key: r.key, value, origin: r.origin, from: r.from, scope: r.scope, locked, masked, resettable }
        })
        .collect();
    Settings {
        rows,
        config_file: item["config_file"].as_str().map(redact::text),
        notice: from_a_profile.then(|| {
            let named = item["profile"].as_str().map_or_else(String::new, |p| format!(" ({p})"));
            format!("Some values here come from a profile{named}, not from the defaults, so they are read-only in this view.")
        }),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    fn tool(id: &str) -> &'static Tool {
        catalog::tool(id).unwrap()
    }

    fn src(id: &str) -> &'static SettingsSource {
        tool(id).settings.as_ref().unwrap()
    }

    fn row<'a>(s: &'a Settings, key: &str) -> &'a Row {
        s.rows.iter().find(|r| r.key == key).unwrap_or_else(|| panic!("no row {key}"))
    }

    #[test]
    fn rows_shape_marks_origin_lock_and_mask() {
        let v = json!({"item": {
            "profile": "work",
            "config_file": "/tmp/x/config.json",
            "settings": [
                {"setting": "limit", "value": 20, "from": "config file"},
                {"setting": "color", "value": null, "from": "default"},
                {"setting": "sends_per_hour", "value": 5, "from": "config defaults"},
                {"setting": "requests_per_minute", "value": 30, "from": "TG_REQUESTS_PER_MINUTE"},
                {"setting": "proxy", "value": "http://u:p@host", "from": "config file"},
                {"setting": "permissions", "value": {"send": "ask"}, "from": "config file"},
                {"setting": "default_profile", "value": null, "from": "default"}
            ],
            "store_settings": [{"setting": "task_agent_close", "value": "ask", "from": "store", "scope": "store"}]
        }});
        let s = normalise(src("tg"), "TG", &v, Some("work"));
        assert!(row(&s, "limit").resettable);
        assert_eq!(row(&s, "limit").origin, Origin::Profile);
        assert!(!row(&s, "sends_per_hour").resettable, "inherited from the defaults");
        assert!(!row(&s, "color").resettable);
        let env = row(&s, "requests_per_minute");
        assert_eq!(env.origin, Origin::Environment);
        assert!(env.locked.as_deref().unwrap().contains("TG_REQUESTS_PER_MINUTE"));
        let proxy = row(&s, "proxy");
        assert_eq!((proxy.value.clone(), proxy.masked), (json!("•••"), true));
        assert!(row(&s, "permissions").locked.is_some());
        assert!(row(&s, "default_profile").locked.is_some());
        let store = row(&s, "task_agent_close");
        assert_eq!((store.scope.as_deref(), store.resettable), (Some("store"), true));
        assert!(s.notice.is_none());
    }

    #[test]
    fn defaults_view_resets_the_defaults_layer_and_flags_a_picked_profile() {
        let v = json!({"item": {"profile": null, "settings": [
            {"setting": "limit", "value": 20, "from": "config defaults"},
            {"setting": "record", "value": true, "from": "config file: defaults"}
        ]}});
        let s = normalise(src("tg"), "TG", &v, None);
        assert!(row(&s, "limit").resettable);
        assert_eq!(row(&s, "record").origin, Origin::Defaults);
        assert!(s.notice.is_none());

        let picked =
            json!({"item": {"profile": "work", "settings": [{"setting": "limit", "value": 3, "from": "config file"}]}});
        let s = normalise(src("tg"), "TG", &picked, None);
        assert!(s.notice.is_some());
        assert!(row(&s, "limit").locked.is_some());
    }

    #[test]
    fn flat_shape_maps_shown_keys_to_set_keys() {
        let v = json!({"item": {"client_id": "abc", "source": "api", "files_folder": null, "profiles": ["p"]}});
        let s = normalise(src("zm"), "ZM", &v, None);
        assert_eq!(s.rows.len(), 4);
        assert!(row(&s, "zoom.client_id").masked);
        let source = row(&s, "source");
        assert_eq!((source.value.clone(), source.origin, source.resettable), (json!("api"), Origin::File, false));
        assert_eq!(row(&s, "files.folder").origin, Origin::Default);
    }

    #[test]
    fn profiles_shape_flattens_and_layers_defaults_under_the_profile() {
        let v = json!({"item": {
            "defaults": {"max_text_chars": 1000, "permissions": {"files": "readonly"}},
            "profiles": {"work": {"principal": "a@b.test", "roots": ["x"], "max_text_chars": 5000}}
        }});
        let s = normalise(src("drive"), "DRIVE", &v, Some("work"));
        assert_eq!(row(&s, "max_text_chars").value, json!(5000));
        assert_eq!(row(&s, "max_text_chars").origin, Origin::Profile);
        assert_eq!(row(&s, "permissions.files").origin, Origin::Defaults);
        assert!(row(&s, "principal").masked);
        assert!(row(&s, "roots").locked.is_some());
        assert!(!row(&s, "max_text_chars").resettable, "drive has no unset");

        let d = normalise(src("drive"), "DRIVE", &v, None);
        assert_eq!(d.rows.len(), 2);
    }

    #[test]
    fn home_paths_count_as_masked() {
        let home = std::env::var("HOME").unwrap_or_default();
        if home.is_empty() {
            return;
        }
        let (shown, masked) = mask("files_folder", &json!(format!("{home}/Zoom")));
        assert!(masked);
        assert_eq!(shown, json!("~/Zoom"));
        assert_eq!(mask("limit", &json!(20)), (json!(20), false));
        assert_eq!(mask("record", &json!(true)), (json!(true), false));
    }

    #[test]
    fn origin_from_the_tools_words() {
        assert_eq!(origin_of("TG_TIMEOUT", "TG"), Origin::Environment);
        assert_eq!(origin_of("TG", "TG"), Origin::Other);
        assert_eq!(origin_of("config file: personal.profiles.work", "TG"), Origin::Profile);
        assert_eq!(origin_of("config file: personal.defaults", "TG"), Origin::Defaults);
        assert_eq!(origin_of("resolved per purpose", "TG"), Origin::Computed);
    }

    #[test]
    fn arguments_drop_the_profile_for_defaults_and_refuse_flags() {
        let t = vec!["{profile}".to_string(), "config".into(), "set".into()];
        assert_eq!(args_for(&t, Some("work")).unwrap(), vec!["work", "config", "set"]);
        assert_eq!(args_for(&t, None).unwrap(), vec!["config", "set"]);
        assert!(args_for(&t, Some("--help")).is_err());

        assert!(validate_setting("task_categories.elder-care").is_ok());
        assert!(validate_setting("models.memories.base_url").is_ok());
        assert!(validate_setting("--defaults").is_err());
        assert!(validate_setting("a b").is_err());
        assert!(validate_setting("").is_err());

        assert!(validate_value("send,reaction").is_ok());
        assert!(validate_value("\"readonly\"").is_ok());
        assert!(validate_value("--help").is_err());
        assert!(validate_value("a\0b").is_err());
    }

    #[test]
    fn errors_come_back_in_the_tools_words() {
        let out = run::Output { code: Some(2), stdout: String::new(), stderr: String::new() };
        let v = json!({"error": {"message": "limit takes a number, write to a@b.test"}});
        assert_eq!(failure(&out, Some(&v)), "limit takes a number, write to [email]");
        let out = run::Output { code: Some(1), stdout: String::new(), stderr: "boom\n\n".into() };
        assert_eq!(failure(&out, None), "boom");
    }

    #[test]
    fn defaults_are_refused_where_the_tool_has_none() {
        assert!(change(tool("zm"), &src("zm").set, None, true, &["source", "api"]).is_err());
        assert!(unset(tool("zm"), None, false, "source").is_err());
        assert!(unset(tool("tg"), Some("p"), false, "--x").is_err());
    }
}
