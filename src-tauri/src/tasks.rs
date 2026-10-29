use crate::catalog::{self, TasksSource, Tool};
use crate::redact;
use crate::skills::{body, call, failure};
use serde::Serialize;
use serde_json::Value;
use std::time::Duration;

fn source(tool: &Tool) -> Result<&TasksSource, String> {
    tool.tasks.as_ref().ok_or_else(|| format!("{} keeps no tasks", tool.name))
}

/// A task id or key comes back from the tool but reaches us through the interface, so only plain words pass.
pub fn validate_task(task: &str) -> Result<(), String> {
    let ok = !task.is_empty()
        && task.len() <= 100
        && !task.starts_with('-')
        && task.chars().all(|c| c.is_ascii_alphanumeric() || matches!(c, '-' | '_' | '.' | ':'));
    if ok { Ok(()) } else { Err(format!("not a valid task: {task}")) }
}

#[derive(Serialize, Debug, PartialEq, Eq)]
pub struct Claim {
    pub id: String,
    pub key: Option<String>,
    /// `claude-code:<session>`, `codex:<thread>`, an agent's bare name, `owner`, or what `--holder` was given.
    pub holder: String,
    pub until: Option<String>,
}

#[derive(Serialize, Debug, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct Claims {
    pub items: Vec<Claim>,
    pub open: usize,
    /// More open tasks than one page holds: claims past it are not seen.
    pub more: bool,
    /// The profile was never signed in, so it has no tasks to read: not a failure to report.
    pub signed_out: bool,
}

/// The list asks for these four fields only, so no task title or source reaches the app. A lapsed claim reads as none.
fn claims_of(v: &Value) -> Claims {
    let items = v["items"].as_array().cloned().unwrap_or_default();
    let claims = items
        .iter()
        .filter_map(|t| {
            let holder = t["claimed_by"].as_str().filter(|h| !h.is_empty())?;
            Some(Claim {
                id: t["id"].as_str()?.to_string(),
                key: t["key"].as_str().map(str::to_string),
                holder: redact::text(holder),
                until: t["claimed_until"].as_str().map(str::to_string),
            })
        })
        .collect();
    Claims {
        items: claims,
        open: items.len(),
        more: v["page"]["has_more"].as_bool().unwrap_or(false),
        signed_out: false,
    }
}

/// cli-core answers `not_found` both for a profile it does not know and for one never signed in; only the wording
/// tells them apart, and only the second is the owner's next step rather than a fault.
fn never_signed_in(v: &Value) -> bool {
    v["error"]["code"] == "not_found"
        && v["error"]["message"].as_str().is_some_and(|m| m.starts_with("nothing recorded for profile"))
}

pub fn claims(tool: &Tool, profile: &str) -> Result<Claims, String> {
    let args = catalog::with_profile(&source(tool)?.list, Some(profile))?;
    let (out, json) = call(tool, &args, Duration::from_mins(1))?;
    match json {
        Some(v) if out.code == Some(0) => Ok(claims_of(&v)),
        Some(v) if never_signed_in(&v) => Ok(Claims { items: Vec::new(), open: 0, more: false, signed_out: true }),
        j => Err(failure(&out, j.as_ref())),
    }
}

fn release_args(src: &TasksSource, profile: &str, task: &str) -> Result<Vec<String>, String> {
    validate_task(task)?;
    Ok(catalog::with_profile(&src.release, Some(profile))?
        .into_iter()
        .map(|a| if a == "{task}" { task.to_string() } else { a })
        .collect())
}

/// The owner may release any claim; `--holder owner` is passed so an app started from an agent's terminal does not
/// act as that agent.
pub fn release(tool: &Tool, profile: &str, task: &str) -> Result<(), String> {
    let args = release_args(source(tool)?, profile, task)?;
    let (out, json) = call(tool, &args, Duration::from_secs(30))?;
    if out.code == Some(0) && json.as_ref().is_some_and(|v| body(v).get("id").is_some()) {
        Ok(())
    } else {
        Err(failure(&out, json.as_ref()))
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    fn tg() -> &'static Tool {
        catalog::tool("tg").unwrap()
    }

    #[test]
    fn release_names_the_owner_and_one_plain_task() {
        let src = source(tg()).unwrap();
        assert_eq!(
            release_args(src, "personal", "Q-15").unwrap(),
            ["personal", "tasks", "release", "Q-15", "--holder", "owner", "--json"]
        );
        assert!(release_args(src, "personal", "--holder").is_err());
        assert!(release_args(src, "personal", "a b").is_err());
        assert!(release_args(src, "-x", "Q-1").is_err());
    }

    #[test]
    fn the_list_asks_for_claim_fields_only() {
        let list = &source(tg()).unwrap().list;
        assert!(list.iter().any(|a| a == "--json=id,key,claimed_by,claimed_until"));
        assert!(!list.iter().any(|a| a.contains("title")));
    }

    #[test]
    fn keeps_claimed_tasks_and_counts_the_rest() {
        let v = json!({"items": [
            {"id": "t1", "key": "Q-1", "claimed_by": "claude-code:3b8e", "claimed_until": "2026-10-25T15:00:00.000Z"},
            {"id": "t2", "key": null, "claimed_by": null, "claimed_until": null},
            {"id": "t3", "key": "P-2", "claimed_by": "codex", "claimed_until": "2026-10-25T15:30:00.000Z"}
        ], "page": {"has_more": true}});
        let c = claims_of(&v);
        assert_eq!(c.open, 3);
        assert!(c.more);
        assert_eq!(c.items.iter().map(|x| x.holder.as_str()).collect::<Vec<_>>(), ["claude-code:3b8e", "codex"]);
        assert_eq!(c.items[0].key.as_deref(), Some("Q-1"));
    }

    #[test]
    fn tells_a_profile_never_signed_in_from_a_profile_that_does_not_exist() {
        let never = json!({"error": {"code": "not_found", "message": "nothing recorded for profile \"personal\" yet — log in with `max personal setup`"}});
        let unknown =
            json!({"error": {"code": "not_found", "message": "no profile named \"x\" — profiles here: personal"}});
        assert!(never_signed_in(&never));
        assert!(!never_signed_in(&unknown));
    }
}
