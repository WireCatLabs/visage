use crate::catalog::{self, Tool};
use crate::{compat, paths, redact, run};
use serde::Serialize;
use serde_json::Value;
use std::collections::BTreeMap;
use std::sync::Mutex;
use std::time::Duration;

/// Before `store info` has ranked the installed tools, the messengers answer in this order.
const ASKED_IN_ORDER: [&str; 3] = ["tg", "wa", "max"];

/// Tool ids by the newest schema each reads, from the last `store info` round; tables and checks ask the first.
static RANKED: Mutex<Vec<String>> = Mutex::new(Vec::new());

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
    /// The newest schema the answering tool knows.
    pub speaks: Option<u64>,
    pub writable: Option<bool>,
    /// Row counts per table, whichever tables this store version has.
    pub rows: BTreeMap<String, u64>,
    pub search_ready: Option<bool>,
    /// Absent from tools older than the breakdown in `store info`.
    pub breakdown: Option<Breakdown>,
    /// Absent from tools older than the file facts in `store info`.
    pub facts: Option<FileFacts>,
}

#[derive(Serialize, Debug, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Migration {
    pub version: u64,
    pub min_compatible: u64,
    pub applied_at: String,
}

#[derive(Serialize, Debug, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Backup {
    pub at: String,
    pub file: Option<String>,
    pub checked: Option<String>,
}

#[derive(Serialize, Debug, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct FileFacts {
    pub journal_mode: String,
    pub page_size: u64,
    pub page_count: u64,
    pub free_pages: u64,
    pub migrations: Vec<Migration>,
    /// From the marker a backup job leaves beside the store; `None` when there is none.
    pub backup: Option<Backup>,
}

#[derive(Serialize, Debug, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Table {
    pub name: String,
    pub kind: String,
    pub rows: Option<u64>,
    /// Only when sizes were measured; `None` too for a search index, whose parts hold its pages.
    pub bytes: Option<u64>,
}

#[derive(Serialize, Debug, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct TableList {
    pub answered_by: String,
    /// False when the installed tool predates `store tables list`.
    pub available: bool,
    pub measured: bool,
    pub tables: Vec<Table>,
}

#[derive(Serialize, Debug, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Check {
    pub answered_by: String,
    /// The command word the fixes start with, such as `tg`.
    pub bin: String,
    pub ok: bool,
    /// Set when the file is there but could not be opened.
    pub problem: Option<String>,
    pub schema: Option<u64>,
    pub min_compatible: Option<u64>,
    pub speaks: Option<u64>,
    pub writable: Option<bool>,
    /// Each check by name: schema, integrity, foreign keys, search indexes, disk.
    pub checks: BTreeMap<String, bool>,
    /// `SQLite`'s own lines when the integrity check is not `ok`, at most twenty.
    pub integrity: Vec<String>,
    pub foreign_key_violations: u64,
    pub broken_indexes: Vec<String>,
    pub disk_free: u64,
    pub disk_needed: u64,
    /// Counts only: the chats themselves are personal.
    pub chats_behind: u64,
    pub orphan_pointers: u64,
    /// Command lines the tool itself suggests next.
    pub fixes: Vec<String>,
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
        speaks: item["schema"]["speaks"].as_u64(),
        writable: item["schema"]["writable"].as_bool(),
        rows: item["rows"]
            .as_object()
            .into_iter()
            .flatten()
            .filter_map(|(k, v)| v.as_u64().map(|n| (k.clone(), n)))
            .collect(),
        search_ready: item["word_index"]["ready"].as_bool(),
        breakdown: breakdown(item),
        facts: facts(item),
    }
}

fn facts(item: &Value) -> Option<FileFacts> {
    item.get("migrations")?;
    let backup = &item["backup"];
    Some(FileFacts {
        journal_mode: item["journal_mode"].as_str().unwrap_or("unknown").into(),
        page_size: num(&item["pages"], "size"),
        page_count: num(&item["pages"], "count"),
        free_pages: num(&item["pages"], "free"),
        migrations: list(item, "migrations")
            .map(|m| Migration {
                version: num(m, "version"),
                min_compatible: num(m, "min_compatible"),
                applied_at: m["applied_at"].as_str().unwrap_or("").into(),
            })
            .collect(),
        backup: backup["at"].as_str().map(|at| Backup {
            at: at.into(),
            file: backup["file"].as_str().map(redact::text),
            checked: backup["checked"].as_str().map(redact::text),
        }),
    })
}

fn tables_of(answered_by: &str, items: &[Value], measured: bool) -> TableList {
    TableList {
        answered_by: answered_by.into(),
        available: true,
        measured,
        tables: items
            .iter()
            .map(|t| Table {
                name: t["name"].as_str().unwrap_or("").into(),
                kind: t["kind"].as_str().unwrap_or("data").into(),
                rows: t["rows"].as_u64(),
                bytes: t["bytes"].as_u64(),
            })
            .collect(),
    }
}

/// Keeps counts and names of checks, never the chats behind or the pointers' rows.
fn check_of(tool: &Tool, envelope: &Value) -> Check {
    let item = envelope.get("item").unwrap_or(envelope);
    let integrity: Vec<String> = list(item, "integrity").filter_map(Value::as_str).map(redact::text).collect();
    Check {
        answered_by: tool.id.clone(),
        bin: tool.bin.clone(),
        ok: item["ok"].as_bool().unwrap_or(false),
        problem: item["error"].as_str().map(redact::text),
        schema: item["schema"]["version"].as_u64(),
        min_compatible: item["schema"]["min_compatible"].as_u64(),
        speaks: item["schema"]["speaks"].as_u64(),
        writable: item["schema"]["writable"].as_bool(),
        checks: item["checks"]
            .as_object()
            .into_iter()
            .flatten()
            .filter_map(|(k, v)| v.as_bool().map(|b| (k.clone(), b)))
            .collect(),
        integrity: if integrity == ["ok"] { Vec::new() } else { integrity },
        foreign_key_violations: num(item, "foreign_key_violations"),
        broken_indexes: item["search_indexes"]
            .as_object()
            .into_iter()
            .flatten()
            .filter(|(_, state)| state.as_str() != Some("ok"))
            .map(|(name, _)| name.clone())
            .collect(),
        disk_free: num(&item["disk"], "free"),
        disk_needed: num(&item["disk"], "needed"),
        chats_behind: list(item, "chats_behind").count() as u64,
        orphan_pointers: list(item, "orphan_pointers").map(|p| num(p, "count")).sum(),
        fixes: list(envelope, "next")
            .filter(|step| step["command"].as_str().is_some_and(|c| c.starts_with("store ")))
            .filter_map(|step| step["line"].as_str().map(str::to_string))
            .collect(),
    }
}

pub(crate) type Template = fn(&Tool) -> Option<&Vec<String>>;

/// The first installed messenger tool, as long as it has a store; it answers for the whole shared archive.
fn asked(template: Template) -> Option<&'static Tool> {
    let ranked = RANKED.lock().map(|r| r.clone()).unwrap_or_default();
    ranked.iter().map(String::as_str).chain(ASKED_IN_ORDER).find_map(|id| {
        let tool = catalog::tool(id).ok()?;
        template(tool)?;
        paths::find(&tool.bin).map(|_| tool)
    })
}

fn rank(answers: &[(&'static Tool, Result<Answer, String>)]) {
    let mut by_speaks: Vec<(u64, String)> = answers
        .iter()
        .filter_map(|(tool, answer)| match answer {
            Ok(Answer::Envelope(v)) => {
                Some((v.get("item").unwrap_or(v)["schema"]["speaks"].as_u64()?, tool.id.clone()))
            }
            _ => None,
        })
        .collect();
    by_speaks.sort_by_key(|(speaks, _)| std::cmp::Reverse(*speaks));
    if let Ok(mut ranked) = RANKED.lock() {
        *ranked = by_speaks.into_iter().map(|(_, id)| id).collect();
    }
}

pub(crate) enum Answer {
    Envelope(Value),
    /// The tool is older than the command.
    Unknown,
}

pub(crate) fn ask(tool: &Tool, template: Template, timeout: Duration) -> Result<Answer, String> {
    let Some(args) = template(tool) else { return Ok(Answer::Unknown) };
    let bin = paths::find(&tool.bin).ok_or("the tool is not installed")?;
    let refs: Vec<&str> = args.iter().map(String::as_str).collect();
    let out = run::run(&bin, &refs, Some(&paths::search_path()), timeout).map_err(|e| e.to_string())?;
    let json = out.json();
    match json {
        Some(v) if v["error"]["message"].as_str().is_some_and(|m| m.starts_with("unknown command")) => {
            Ok(Answer::Unknown)
        }
        Some(v) if out.code == Some(0) && v.get("error").is_none() => Ok(Answer::Envelope(v)),
        Some(v) if v["error"]["message"].is_string() => Err(redact::text(v["error"]["message"].as_str().unwrap_or(""))),
        _ => {
            let line = out.stderr.lines().rev().find(|l| !l.trim().is_empty()).unwrap_or("the tool gave no answer");
            Err(redact::text(line.trim()))
        }
    }
}

/// Asks every installed tool and keeps the answer of the one that reads the newest schema; `None` when none has
/// `store info`.
pub fn info() -> Result<Option<StoreInfo>, String> {
    let answers = compat::probe();
    if answers.is_empty() {
        return Ok(None);
    }
    rank(&answers);
    if let Some((tool, v)) = compat::best(&answers) {
        return Ok(Some(shape(&tool.id, v.get("item").unwrap_or(v))));
    }
    Err(answers
        .iter()
        .find_map(|(_, answer)| answer.as_ref().err().cloned())
        .unwrap_or_else(|| "no installed tool knows `store info` yet".into()))
}

/// Without sizes this counts rows only, a few seconds at most; sizes read every page of the file.
pub fn tables(sizes: bool) -> Result<Option<TableList>, String> {
    let template: Template = if sizes { |t| t.store_table_sizes.as_ref() } else { |t| t.store_tables.as_ref() };
    let Some(tool) = asked(template) else { return Ok(None) };
    let timeout = Duration::from_mins(if sizes { 10 } else { 2 });
    Ok(Some(match ask(tool, template, timeout)? {
        Answer::Envelope(v) => tables_of(&tool.id, v["items"].as_array().map_or(&[], Vec::as_slice), sizes),
        Answer::Unknown => {
            TableList { answered_by: tool.id.clone(), available: false, measured: false, tables: Vec::new() }
        }
    }))
}

/// Runs `SQLite`'s integrity check over the whole file: a minute or two on a large archive.
pub fn check() -> Result<Option<Check>, String> {
    let Some(tool) = asked(|t| t.store_check.as_ref()) else { return Ok(None) };
    match ask(tool, |t| t.store_check.as_ref(), Duration::from_mins(10))? {
        Answer::Envelope(v) => Ok(Some(check_of(tool, &v))),
        Answer::Unknown => Err("the tool does not know `store check`".into()),
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

    #[test]
    fn reads_the_file_facts_when_the_tool_has_them() {
        let mut item = plain();
        assert!(shape("tg", &item).facts.is_none());
        item["journal_mode"] = json!("wal");
        item["pages"] = json!({"size": 4096, "count": 1000, "free": 25});
        item["migrations"] = json!([{"version": 1, "min_compatible": 1, "applied_at": "2026-09-01T10:00:00.000Z"}]);
        item["backup"] =
            json!({"at": "2026-10-18T02:16:29.000Z", "file": "wirecat.db.zst", "checked": "quick_check ok"});
        let info = shape("tg", &item);
        assert_eq!(info.speaks, Some(29));
        let facts = info.facts.unwrap();
        assert_eq!((facts.journal_mode.as_str(), facts.free_pages), ("wal", 25));
        assert_eq!(facts.migrations[0].applied_at, "2026-09-01T10:00:00.000Z");
        assert_eq!(facts.backup.unwrap().checked.as_deref(), Some("quick_check ok"));
        item["backup"] = Value::Null;
        assert!(shape("tg", &item).facts.unwrap().backup.is_none());
    }

    #[test]
    fn lists_tables_with_rows_and_only_measured_sizes() {
        let items = [
            json!({"name": "messages", "kind": "data", "rows": 12, "bytes": 8192}),
            json!({"name": "messages_fts", "kind": "search_index", "rows": null, "bytes": null}),
        ];
        let list = tables_of("tg", &items, true);
        assert_eq!(list.tables[0].rows, Some(12));
        assert_eq!(list.tables[0].bytes, Some(8192));
        assert_eq!(list.tables[1].rows, None);
        assert!(list.available && list.measured);
    }

    #[test]
    fn a_check_keeps_counts_and_store_fixes_never_the_chats() {
        let tool = catalog::tool("tg").unwrap();
        let envelope = json!({
            "item": {
                "ok": false,
                "checks": {"schema": false, "integrity": true, "search_indexes": false},
                "schema": {"version": 29, "min_compatible": 1, "speaks": 33, "writable": true},
                "integrity": ["ok"],
                "foreign_key_violations": 0,
                "search_indexes": {"messages_fts": "ok", "message_words": "database disk image is malformed"},
                "disk": {"free": 10, "needed": 5},
                "chats_behind": [{"provider": "telegram", "chat": "77", "title": "Family"}],
                "orphan_pointers": [{"table": "taggings", "count": 3}, {"table": "links", "count": 2}]
            },
            "next": [
                {"kind": "command", "step": "store.migrate", "command": "store migrate", "line": "tg store migrate"},
                {"kind": "command", "step": "messages.sync", "command": "messages sync", "line": "tg personal messages sync --chat 77"}
            ]
        });
        let check = check_of(tool, &envelope);
        assert!(!check.ok);
        assert_eq!(check.broken_indexes, ["message_words"]);
        assert!(check.integrity.is_empty());
        assert_eq!((check.chats_behind, check.orphan_pointers), (1, 5));
        assert_eq!(check.fixes, ["tg store migrate"]);
        assert!(!serde_json::to_string(&check).unwrap().contains("Family"));
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
