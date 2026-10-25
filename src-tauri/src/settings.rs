use crate::catalog::{SettingsSource, Tool};
use serde_json::Value;

fn source(tool: &Tool) -> Result<&SettingsSource, String> {
    tool.settings.as_ref().ok_or_else(|| "This tool has no settings command.".into())
}

pub fn show(tool: &Tool, _profile: &str) -> Result<Value, String> {
    Err(format!("Config is not built yet ({}).", source(tool)?.show.join(" ")))
}

pub fn set(tool: &Tool, _profile: &str, _defaults: bool, _setting: &str, _value: &str) -> Result<(), String> {
    Err(format!("Config is not built yet ({}).", source(tool)?.set.join(" ")))
}

pub fn unset(tool: &Tool, _profile: &str, _defaults: bool, _setting: &str) -> Result<(), String> {
    Err(format!("Config is not built yet ({}).", source(tool)?.unset.join(" ")))
}
