use crate::catalog::{self, Tool};
use crate::{paths, redact, run};
use serde::Serialize;
use serde_json::Value;
use std::collections::BTreeMap;
use std::time::Duration;

/// The messengers share one store, so the first one installed answers for all of them.
const ASKED_IN_ORDER: [&str; 3] = ["tg", "wa", "max"];

#[derive(Serialize, Debug, Default, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Counts {
    pub accounts: u64,
    pub chats: u64,
    pub messages: u64,
    pub emails: u64,
    pub documents: u64,
    pub meetings: u64,
}

#[derive(Serialize, Debug, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Group {
    pub provider: String,
    /// A chat kind, an account's profile name, or a year; `None` for the per-provider totals.
    pub key: Option<String>,
    #[serde(flatten)]
    pub counts: Counts,
}

#[derive(Serialize, Debug, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct AttachmentGroup {
    /// What the files hang on: a message, an email, a document…
    pub owner: String,
    pub kind: String,
    pub count: u64,
    pub bytes: u64,
}

#[derive(Serialize, Debug, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Breakdown {
    pub providers: Vec<Group>,
    pub chat_kinds: Vec<Group>,
    pub accounts: Vec<Group>,
    pub years: Vec<Group>,
    pub attachment_kinds: Vec<AttachmentGroup>,
}

#[derive(Serialize, Debug, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct StoreInfo {
    pub answered_by: String,
    pub path: Option<String>,
    pub exists: bool,
    /// Set when the file is there but could not be read.
    pub problem: Option<String>,
    pub file_bytes: u64,
    pub wal_bytes: u64,
    pub schema: Option<u64>,
    pub writable: Option<bool>,
    /// Row counts per table, whichever tables this store version has.
    pub rows: BTreeMap<String, u64>,
    pub search_ready: Option<bool>,
    /// Absent from tools older than the breakdown in `store info`.
    pub breakdown: Option<Breakdown>,
}

fn num(v: &Value, key: &str) -> u64 {
    v[key].as_u64().unwrap_or(0)
}

fn counts(v: &Value) -> Counts {
    Counts {
        accounts: num(v, "accounts"),
        chats: num(v, "chats"),
        messages: num(v, "messages"),
        emails: num(v, "emails"),
        documents: num(v, "documents"),
        meetings: num(v, "meetings"),
    }
}

fn list<'a>(item: &'a Value, key: &str) -> impl Iterator<Item = &'a Value> {
    item[key].as_array().into_iter().flatten()
}

fn group(v: &Value, key: Option<String>) -> Group {
    Group { provider: v["provider"].as_str().unwrap_or("unknown").into(), key, counts: counts(v) }
}

/// The account's name is the profile name `account list` prints; anything else is masked like doctor output.
fn profile_name(v: &Value) -> String {
    v["name"].as_str().filter(|n| catalog::validate_profile(n).is_ok()).map_or_else(|| "•••".into(), str::to_string)
}

fn breakdown(item: &Value) -> Option<Breakdown> {
    item.get("by_provider")?;
    Some(Breakdown {
        providers: list(item, "by_provider").map(|v| group(v, None)).collect(),
        chat_kinds: list(item, "by_chat_kind").map(|v| group(v, v["kind"].as_str().map(str::to_string))).collect(),
        accounts: list(item, "by_account").map(|v| group(v, Some(profile_name(v)))).collect(),
        years: list(item, "by_year").map(|v| group(v, v["year"].as_u64().map(|y| y.to_string()))).collect(),
        attachment_kinds: list(item, "by_attachment_kind")
            .map(|v| AttachmentGroup {
                owner: v["type"].as_str().unwrap_or("unknown").into(),
                kind: v["kind"].as_str().unwrap_or("unknown").into(),
                count: num(v, "count"),
                bytes: num(v, "bytes"),
            })
            .collect(),
    })
}

/// Picks only known fields: the generic masker would hide `accounts` and `emails` counts by their names.
fn shape(answered_by: &str, item: &Value) -> StoreInfo {
    StoreInfo {
        answered_by: answered_by.into(),
        path: item["path"].as_str().map(paths::tilde),
        exists: item["exists"].as_bool().unwrap_or(false),
        problem: item["error"].as_str().map(redact::text),
        file_bytes: num(&item["bytes"], "file"),
        wal_bytes: num(&item["bytes"], "wal"),
        schema: item["schema"]["version"].as_u64(),
        writable: item["schema"]["writable"].as_bool(),
        rows: item["rows"]
            .as_object()
            .into_iter()
            .flatten()
            .filter_map(|(k, v)| v.as_u64().map(|n| (k.clone(), n)))
            .collect(),
        search_ready: item["word_index"]["ready"].as_bool(),
        breakdown: breakdown(item),
    }
}

fn asked() -> Option<(&'static Tool, &'static [String])> {
    ASKED_IN_ORDER.iter().find_map(|id| {
        let tool = catalog::tool(id).ok()?;
        let args = tool.store_info.as_deref()?;
        paths::find(&tool.bin).map(|_| (tool, args))
    })
}

/// `None` when no messenger tool is installed to ask.
pub fn info() -> Result<Option<StoreInfo>, String> {
    let Some((tool, args)) = asked() else { return Ok(None) };
    let bin = paths::find(&tool.bin).ok_or("the tool is not installed")?;
    let refs: Vec<&str> = args.iter().map(String::as_str).collect();
    let out = run::run(&bin, &refs, Some(&paths::search_path()), Duration::from_secs(30)).map_err(|e| e.to_string())?;
    let json = out.json();
    match json {
        Some(v) if out.code == Some(0) => Ok(Some(shape(&tool.id, v.get("item").unwrap_or(&v)))),
        Some(v) if v["error"]["message"].is_string() => Err(redact::text(v["error"]["message"].as_str().unwrap_or(""))),
        _ => {
            let line = out.stderr.lines().rev().find(|l| !l.trim().is_empty()).unwrap_or("the tool gave no answer");
            Err(redact::text(line.trim()))
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    fn plain() -> Value {
        json!({
            "path": "/home/u/.local/share/WireCat/wirecat.db",
            "exists": true,
            "bytes": {"file": 3_000_000, "wal": 500},
            "schema": {"version": 29, "min_compatible": 1, "speaks": 29, "writable": true},
            "rows": {"accounts": 14, "chats": 1784, "messages": 16739, "attachments": 18107, "identities": 8006},
            "pending_normalization": 0,
            "word_index": {"ready": true},
            "stem_index": null
        })
    }

    #[test]
    fn keeps_counts_whose_names_the_masker_would_hide() {
        let info = shape("tg", &plain());
        assert_eq!(info.rows["accounts"], 14);
        assert_eq!(info.schema, Some(29));
        assert_eq!(info.search_ready, Some(true));
        assert!(info.breakdown.is_none());
    }

    #[test]
    fn reads_the_breakdown_when_the_tool_has_it() {
        let mut item = plain();
        item["rows"]["emails"] = json!(120);
        item["by_provider"] = json!([{"provider": "telegram", "accounts": 2, "chats": 10, "messages": 500,
            "emails": 0, "documents": 0, "meetings": 0}]);
        item["by_chat_kind"] = json!([{"provider": "telegram", "kind": "group", "chats": 4, "messages": 300}]);
        item["by_account"] = json!([
            {"provider": "telegram", "account_id": 3, "name": "personal", "chats": 10, "messages": 500,
             "emails": 0, "documents": 0, "meetings": 0},
            {"provider": "gmail", "account_id": 4, "name": "me@example.com", "chats": 0, "messages": 0,
             "emails": 120, "documents": 0, "meetings": 0}
        ]);
        item["by_year"] = json!([{"provider": "telegram", "year": 2025, "messages": 500}]);
        item["by_attachment_kind"] = json!([{"type": "message", "kind": "photo", "count": 9, "bytes": 1024}]);
        let b = shape("tg", &item).breakdown.unwrap();
        assert_eq!(b.providers[0].counts.accounts, 2);
        assert_eq!(b.chat_kinds[0].key.as_deref(), Some("group"));
        assert_eq!(b.accounts[0].key.as_deref(), Some("personal"));
        assert_eq!(b.accounts[1].key.as_deref(), Some("•••"));
        assert_eq!(b.years[0].key.as_deref(), Some("2025"));
        assert_eq!(b.attachment_kinds[0].owner, "message");
    }

    #[test]
    fn a_store_that_does_not_open_says_why() {
        let info = shape("wa", &json!({"path": "/x/wirecat.db", "exists": true, "opens": false, "error": "locked"}));
        assert_eq!(info.problem.as_deref(), Some("locked"));
        assert!(info.rows.is_empty());
    }

    /// `cargo test -- --ignored real_store_info`: counts and keys only, never paths or names.
    #[test]
    #[ignore = "needs a messenger tool installed"]
    fn real_store_info() {
        let info = info().unwrap().unwrap();
        println!(
            "answered by {}, schema {:?}, rows {:?}, search ready {:?}, breakdown {}",
            info.answered_by,
            info.schema,
            info.rows,
            info.search_ready,
            info.breakdown.is_some()
        );
    }
}
