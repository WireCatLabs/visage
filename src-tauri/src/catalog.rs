use serde::Deserialize;
use std::sync::OnceLock;

const CATALOG_JSON: &str = include_str!("../../catalog/tools.json");

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Catalog {
    pub tools: Vec<Tool>,
    pub shared_storage: Storage,
}

#[derive(Debug, Deserialize)]
pub struct Tool {
    pub id: String,
    pub bin: String,
    pub package: String,
    pub profiles: Option<ProfileSource>,
    pub doctor: Vec<String>,
    pub setup: Option<Vec<String>>,
    pub storage: Storage,
}

/// The folder name and environment prefix a tool passes to cli-base's `resolvePaths`.
#[derive(Debug, Deserialize)]
pub struct Storage {
    pub app: String,
    pub env: String,
}

#[derive(Debug, Deserialize)]
pub struct ProfileSource {
    pub args: Vec<String>,
    pub shape: String,
}

pub fn catalog() -> &'static Catalog {
    static CATALOG: OnceLock<Catalog> = OnceLock::new();
    CATALOG.get_or_init(|| serde_json::from_str(CATALOG_JSON).expect("catalog/tools.json is valid"))
}

pub fn tool(id: &str) -> Result<&'static Tool, String> {
    catalog().tools.iter().find(|t| t.id == id).ok_or_else(|| format!("unknown tool: {id}"))
}

/// Profiles come from the user and end up as process arguments, so only plain names pass.
pub fn validate_profile(profile: &str) -> Result<(), String> {
    let ok = !profile.is_empty()
        && profile.len() <= 64
        && !profile.starts_with('-')
        && profile.chars().all(|c| c.is_ascii_alphanumeric() || matches!(c, '-' | '_' | '.'));
    if ok { Ok(()) } else { Err(format!("not a valid profile name: {profile}")) }
}

pub fn with_profile(args: &[String], profile: Option<&str>) -> Result<Vec<String>, String> {
    args.iter()
        .map(|a| match (a.as_str(), profile) {
            ("{profile}", Some(p)) => {
                validate_profile(p)?;
                Ok(p.to_string())
            }
            ("{profile}", None) => Err("this command needs a profile".to_string()),
            _ => Ok(a.clone()),
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn every_catalog_entry_parses() {
        assert_eq!(catalog().tools.len(), 6);
    }

    #[test]
    fn rejects_flag_like_and_shell_profiles() {
        assert!(validate_profile("personal").is_ok());
        assert!(validate_profile("--help").is_err());
        assert!(validate_profile("a;rm").is_err());
        assert!(validate_profile("").is_err());
    }

    #[test]
    fn substitutes_profile() {
        let args = vec!["{profile}".to_string(), "doctor".to_string()];
        assert_eq!(with_profile(&args, Some("work")).unwrap(), vec!["work", "doctor"]);
        assert!(with_profile(&args, None).is_err());
    }
}
