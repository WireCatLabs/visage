//! Searching what one tool stored for one profile, through the tool's own Lucene search (`search` in the catalog).
//! Every template reads the local store only: `--offline` where the tool has it, `--backend archive` where the
//! messenger could also ask its server, and never `--sync-first`. The query goes after `--`, so `-chat:x` (NOT) is a
//! query and never a flag. Hits are the owner's own data shown on the owner's own page, so they are not masked; they
//! are never logged or put in a report.

use crate::cache::REFUSED;
use crate::catalog::{self, SearchShape, SearchSource, Tool, ValuesSource};
use crate::{paths, run};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::time::Duration;

pub const MAX_LIMIT: u32 = 100;
const MAX_QUERY: usize = 1000;
const SEARCH: &str = "search";
// Longer than the `--timeout 60s` in the templates, so the tool's own time-limit answer comes back, not a kill.
const TIMEOUT: Duration = Duration::from_secs(90);

/// Elasticsearch's `hits.total`: `gte` means the tool stopped counting at `value`.
#[derive(Debug, Serialize, Deserialize, PartialEq)]
pub struct Total {
    value: u64,
    relation: Relation,
}

#[derive(Debug, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
enum Relation {
    Eq,
    Gte,
}

#[derive(Debug, Serialize, PartialEq)]
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum Answer {
    #[serde(rename_all = "camelCase")]
    Hits {
        hits: Vec<Value>,
        has_more: bool,
        /// Whether the template pages at all; memo's `search mail` answers its best hits only.
        paged: bool,
        /// What the tool says it did not cover (`missing[].why`) and its other notes on stderr.
        notes: Vec<String>,
        /// Every match, not only this page (cli-core 0.501.0+); older tools print none.
        total: Option<Total>,
    },
    /// A closed `query.*` reason; `span` counts UTF-16 units of the query as typed, as JavaScript does.
    #[serde(rename_all = "camelCase")]
    QueryError { reason: String, message: String, span: Option<Span> },
    /// The installed version has no such search, or no `--offline`: the answer is "update it".
    Old { message: String },
    /// `candidates` are what an ambiguous name could mean (`details.candidates`), each named by its id.
    Failed {
        message: String,
        #[serde(skip_serializing_if = "Vec::is_empty")]
        candidates: Vec<Candidate>,
    },
}

#[derive(Debug, Serialize, PartialEq, Clone)]
pub struct Candidate {
    pub id: String,
    pub label: Option<String>,
    /// `chat` for a chat (it has a title), `from` for a person (a name or username).
    pub field: Option<&'static str>,
}

#[derive(Debug, Serialize, PartialEq, Clone)]
pub struct ValueItem {
    pub value: String,
    pub label: Option<String>,
    pub detail: Option<String>,
}

#[derive(Debug, Serialize, PartialEq, Clone, Copy)]
pub struct Span {
    pub start: u32,
    pub end: u32,
}

fn source(tool: &Tool) -> Result<&SearchSource, String> {
    tool.search.as_ref().ok_or_else(|| "This tool cannot search its local data.".into())
}

pub fn validate_query(query: &str) -> Result<(), String> {
    let ok = !query.trim().is_empty() && query.len() <= MAX_QUERY && !query.chars().any(char::is_control);
    if ok { Ok(()) } else { Err("not a valid search query".into()) }
}

/// `{profile}` may sit inside a word (`email:{profile}`), so it is replaced here rather than by `with_profile`.
pub fn args(
    src: &SearchSource,
    profile: Option<&str>,
    query: &str,
    limit: u32,
    page: u32,
) -> Result<Vec<String>, String> {
    validate_query(query)?;
    if !(1..=MAX_LIMIT).contains(&limit) || page == 0 {
        return Err(format!("limit must be 1 to {MAX_LIMIT} and page at least 1"));
    }
    let wants_profile = src.args.iter().any(|a| a.contains("{profile}"));
    match (wants_profile, profile) {
        (true, Some(p)) => catalog::validate_profile(p)?,
        (true, None) => return Err("this search needs a profile".into()),
        (false, Some(_)) => return Err("this tool has no profiles".into()),
        (false, None) => {}
    }
    if page > 1 && !paged(src) {
        return Err("this search has no further pages".into());
    }
    Ok(src
        .args
        .iter()
        .map(|a| match a.as_str() {
            "{query}" => query.to_string(),
            "{limit}" => limit.to_string(),
            "{page}" => page.to_string(),
            _ => a.replace("{profile}", profile.unwrap_or_default()),
        })
        .collect())
}

/// `--exact` for a version older than `below`, or one that cannot say: a filter that does not hold is worse than no
/// search by meaning.
fn with_exact(mut args: Vec<String>, below: Option<&str>, version: Option<&str>) -> Vec<String> {
    let Some(below) = below.and_then(|b| semver::Version::parse(b).ok()) else { return args };
    let old = version.and_then(|v| semver::Version::parse(v).ok()).is_none_or(|v| v < below);
    if old && let Some(at) = args.iter().position(|a| a == "--no-record") {
        args.insert(at, "--exact".into());
    }
    args
}

pub fn paged(src: &SearchSource) -> bool {
    src.args.iter().any(|a| a == "{page}")
}

pub fn search(tool: &Tool, profile: Option<&str>, query: &str, limit: u32, page: u32) -> Result<Answer, String> {
    let src = source(tool)?;
    let args = args(src, profile, query, limit, page)?;
    let bin = paths::find(&tool.bin).ok_or("the tool is not installed")?;
    let args = with_exact(args, src.exact_below.as_deref(), crate::tools::version_of(&bin).as_deref());
    if let Some(message) = REFUSED.known(&tool.id, SEARCH, &bin) {
        return Ok(Answer::Old { message });
    }
    let refs: Vec<&str> = args.iter().map(String::as_str).collect();
    let out = run::run(&bin, &refs, Some(&paths::search_path()), TIMEOUT).map_err(|e| e.to_string())?;
    let answer = read(src, &out, limit);
    if let Answer::Old { message } = &answer {
        REFUSED.remember(&tool.id, SEARCH, &bin, message);
    }
    Ok(answer)
}

const MAX_VALUES: usize = 2000;

fn values_args(src: &ValuesSource, profile: Option<&str>) -> Result<Vec<String>, String> {
    let wants_profile = src.args.iter().any(|a| a.contains("{profile}"));
    match (wants_profile, profile) {
        (true, Some(p)) => catalog::validate_profile(p)?,
        (true, None) => return Err("these values need a profile".into()),
        (false, _) => {}
    }
    Ok(src.args.iter().map(|a| a.replace("{profile}", profile.unwrap_or_default())).collect())
}

/// The values a field takes, from one of the tool's own read-only lists (`search.values` in the catalog): only the
/// named field of each item leaves, deduplicated, in the tool's order. A tool that cannot list them gives none.
pub fn values(tool: &Tool, profile: Option<&str>, source: &str) -> Result<Vec<ValueItem>, String> {
    let src = self::source(tool)?.values.get(source).ok_or_else(|| format!("no value list named {source}"))?;
    let args = values_args(src, profile)?;
    let bin = paths::find(&tool.bin).ok_or("the tool is not installed")?;
    let refs: Vec<&str> = args.iter().map(String::as_str).collect();
    let out = run::run(&bin, &refs, Some(&paths::search_path()), Duration::from_mins(1)).map_err(|e| e.to_string())?;
    if out.code != Some(0) {
        return Ok(Vec::new());
    }
    Ok(out.json().map(|body| pick(&body, src)).unwrap_or_default())
}

fn text_at(item: &Value, pointer: &str) -> Option<String> {
    let v = if pointer.starts_with('/') { item.pointer(pointer)? } else { item.get(pointer)? };
    let s = match v {
        Value::String(s) => s.trim().to_string(),
        Value::Number(n) => n.to_string(),
        _ => return None,
    };
    (!s.is_empty()).then_some(s)
}

fn pick(body: &Value, src: &ValuesSource) -> Vec<ValueItem> {
    let mut seen = std::collections::HashSet::new();
    body["items"]
        .as_array()
        .into_iter()
        .flatten()
        .filter_map(|item| {
            let value = text_at(item, &src.key)?;
            seen.insert(value.clone()).then(|| ValueItem {
                label: src.label.as_deref().and_then(|p| text_at(item, p)),
                detail: src.detail.as_deref().and_then(|p| text_at(item, p)),
                value,
            })
        })
        .take(MAX_VALUES)
        .collect()
}

fn read(src: &SearchSource, out: &run::Output, limit: u32) -> Answer {
    let notes = stderr_notes(&out.stderr);
    if out.code != Some(0) {
        return error_of(&out.stderr, &out.stdout);
    }
    let Some(body) = out.json() else {
        return Answer::Failed { message: last_line(&out.stderr, &out.stdout), candidates: Vec::new() };
    };
    let (hits, total) = match src.shape {
        SearchShape::Items => (&body["items"], &body["page"]["total"]),
        SearchShape::ItemHits => (&body["item"]["hits"], &body["item"]["total"]),
    };
    let hits = hits.as_array().cloned().unwrap_or_default();
    let total = Total::deserialize(total).ok();
    // zm reports a query its meeting search refused as a note and an incomplete, empty answer with exit 0.
    if hits.is_empty() && body["meta"]["complete"] == Value::Bool(false) {
        if let Some(refused) = notes.iter().find_map(|n| refused_note(n)) {
            return refused;
        }
        if let Some(note) = notes.first() {
            return Answer::Failed { message: note.clone(), candidates: Vec::new() };
        }
    }
    let has_more = paged(src)
        && match src.shape {
            SearchShape::Items => body["page"]["has_more"].as_bool().unwrap_or(false),
            // drive says nothing about more pages; a full page may have one.
            SearchShape::ItemHits => hits.len() as u64 >= u64::from(limit),
        };
    let mut all: Vec<String> = body["missing"]
        .as_array()
        .into_iter()
        .flatten()
        .filter_map(|m| m["why"].as_str().map(str::to_string))
        .collect();
    for note in notes {
        if !all.contains(&note) {
            all.push(note);
        }
    }
    Answer::Hits { hits, has_more, paged: paged(src), notes: all, total }
}

/// Plain lines on stderr are the tool's notes to the reader; its JSON error line is not one.
fn stderr_notes(stderr: &str) -> Vec<String> {
    stderr.lines().map(str::trim).filter(|l| !l.is_empty() && !l.starts_with('{')).map(str::to_string).collect()
}

fn last_line(stderr: &str, stdout: &str) -> String {
    let text = if stderr.trim().is_empty() { stdout } else { stderr };
    text.lines().rev().map(str::trim).find(|l| !l.is_empty()).unwrap_or("the tool gave no answer").to_string()
}

/// The error is the last JSON line on stderr; a warning line may come before it.
fn error_of(stderr: &str, stdout: &str) -> Answer {
    let error = stderr
        .lines()
        .rev()
        .chain(stdout.lines().rev())
        .find_map(|l| serde_json::from_str::<Value>(l.trim()).ok().filter(|v| v["error"].is_object()));
    let Some(error) = error else {
        let message = last_line(stderr, stdout);
        return if too_old(&message) {
            Answer::Old { message }
        } else {
            Answer::Failed { message, candidates: Vec::new() }
        };
    };
    let e = &error["error"];
    let reason = e["reason"].as_str().unwrap_or_default();
    let message = e["message"].as_str().unwrap_or("the tool gave no answer").to_string();
    if reason.starts_with("query.") {
        let span = span_of(&e["details"]["span"]);
        return Answer::QueryError { reason: reason.to_string(), message, span };
    }
    if too_old(&message) {
        Answer::Old { message }
    } else {
        Answer::Failed { message, candidates: candidates_of(&e["details"]["candidates"]) }
    }
}

fn candidates_of(v: &Value) -> Vec<Candidate> {
    v.as_array()
        .into_iter()
        .flatten()
        .filter_map(|c| {
            let id = match &c["id"] {
                Value::String(s) => s.clone(),
                Value::Number(n) => n.to_string(),
                _ => return None,
            };
            let text = |k: &str| c[k].as_str().map(str::trim).filter(|t| !t.is_empty()).map(str::to_string);
            let username = text("username").map(|u| format!("@{}", u.trim_start_matches('@')));
            let (label, field) = match (text("title"), text("name"), username) {
                (Some(t), _, _) => (Some(t), Some("chat")),
                (None, Some(n), u) => (Some(u.map_or(n.clone(), |u| format!("{n} · {u}"))), Some("from")),
                (None, None, Some(u)) => (Some(u), Some("from")),
                _ => (None, None),
            };
            Some(Candidate { id, label, field })
        })
        .collect()
}

fn span_of(v: &Value) -> Option<Span> {
    let start = u32::try_from(v["start"].as_u64()?).ok()?;
    let end = u32::try_from(v["end"].as_u64()?).ok()?;
    (start <= end).then_some(Span { start, end })
}

/// "meetings not searched: search: query.invalid-syntax at position 8" — the position counts from 1.
fn refused_note(note: &str) -> Option<Answer> {
    let at = note.find("query.")?;
    let rest = &note[at..];
    let reason: String = rest.chars().take_while(|c| c.is_ascii_lowercase() || matches!(c, '.' | '-')).collect();
    let span = rest
        .split("at position ")
        .nth(1)
        .and_then(|p| p.split(|c: char| !c.is_ascii_digit()).next())
        .and_then(|p| p.parse::<u32>().ok())
        .map(|p| Span { start: p.saturating_sub(1), end: p.saturating_sub(1) });
    Some(Answer::QueryError { reason, message: note.to_string(), span })
}

fn too_old(message: &str) -> bool {
    message.starts_with("unknown command")
        || message.starts_with("unknown option")
        || message.starts_with("too many arguments")
}

#[cfg(test)]
mod tests {
    use super::*;

    fn src(id: &str) -> &'static SearchSource {
        source(catalog::tool(id).unwrap()).unwrap()
    }

    fn output(code: i32, stdout: &str, stderr: &str) -> run::Output {
        run::Output { code: Some(code), stdout: stdout.into(), stderr: stderr.into() }
    }

    #[test]
    fn every_template_reads_only_the_local_store() {
        for tool in &catalog::catalog().tools {
            let src = source(tool).unwrap();
            let a = &src.args;
            let id = &tool.id;
            assert_eq!(a.last().map(String::as_str), Some("{query}"), "{id}: the query comes last");
            assert_eq!(a[a.len() - 2], "--", "{id}: the query follows --");
            assert!(a.iter().any(|x| x == "--no-record"), "{id}: a search is not kept in the tool's history");
            assert!(a.iter().any(|x| x == "--json"), "{id}");
            assert!(!a.iter().any(|x| x == "--sync-first" || x == "server" || x == "both"), "{id}");
            // memo has no --offline; it never connects to anything to search.
            if tool.bin != "memo" {
                assert!(a.iter().any(|x| x == "--offline"), "{id}: --offline");
            }
        }
        for id in ["tg", "max"] {
            let a = &src(id).args;
            let at = a.iter().position(|x| x == "--backend").unwrap();
            assert_eq!(a[at + 1], "archive", "{id}");
        }
    }

    #[test]
    fn search_by_meaning_only_where_its_filters_hold() {
        for (id, below, fixed) in [("drive", "0.50.9", "0.51.0"), ("memo", "0.124.3", "0.125.0")] {
            let src = src(id);
            let profile = (id == "drive").then_some("personal");
            let plain = args(src, profile, "x", 10, 1).unwrap();
            assert!(!plain.iter().any(|a| a == "--exact"), "{id}");
            let gate = src.exact_below.as_deref();
            assert!(with_exact(plain.clone(), gate, Some(below)).iter().any(|a| a == "--exact"), "{id} {below}");
            assert!(with_exact(plain.clone(), gate, None).iter().any(|a| a == "--exact"), "{id} unknown");
            assert!(!with_exact(plain.clone(), gate, Some(fixed)).iter().any(|a| a == "--exact"), "{id} {fixed}");
            assert!(!with_exact(plain, gate, Some("1.0.0")).iter().any(|a| a == "--exact"), "{id} 1.0.0");
        }
        let tg = args(src("tg"), Some("p"), "x", 10, 1).unwrap();
        assert_eq!(with_exact(tg.clone(), None, Some("0.1.0")), tg);
    }

    #[test]
    fn a_negated_term_stays_one_query_argument() {
        let a = args(src("tg"), Some("personal"), "-chat:x hello", 50, 2).unwrap();
        assert_eq!(a[0], "personal");
        assert_eq!(&a[a.len() - 2..], ["--", "-chat:x hello"]);
        assert!(a.windows(2).any(|w| w == ["--page", "2"]));
        assert!(a.windows(2).any(|w| w == ["--limit", "50"]));
    }

    #[test]
    fn the_query_is_sent_as_typed() {
        let a = args(src("wa"), Some("personal"), "  text:(hello ", 10, 1).unwrap();
        assert_eq!(a.last().unwrap(), "  text:(hello ");
    }

    #[test]
    fn email_names_the_mailbox_inside_a_word() {
        let a = args(src("email"), Some("personal"), "budget", 50, 1).unwrap();
        assert!(a.windows(2).any(|w| w == ["--source", "email:personal"]), "{a:?}");
        assert!(!a.iter().any(|x| x.contains('{')), "{a:?}");
        assert!(!paged(src("email")));
        assert!(args(src("email"), Some("personal"), "budget", 50, 2).is_err());
    }

    #[test]
    fn a_profile_is_never_picked_or_invented() {
        assert!(args(src("tg"), None, "x", 10, 1).is_err());
        assert!(args(src("tg"), Some("--json"), "x", 10, 1).is_err());
        assert!(args(src("tg"), Some("a b"), "x", 10, 1).is_err());
        assert!(args(src("memo"), Some("personal"), "x", 10, 1).is_err());
        assert!(args(src("memo"), None, "x", 10, 1).is_ok());
    }

    #[test]
    fn rejects_empty_huge_or_control_queries_and_bad_pages() {
        assert!(args(src("tg"), Some("p"), "  ", 10, 1).is_err());
        assert!(args(src("tg"), Some("p"), "a\nb", 10, 1).is_err());
        assert!(args(src("tg"), Some("p"), &"a".repeat(MAX_QUERY + 1), 10, 1).is_err());
        assert!(args(src("tg"), Some("p"), "a", 0, 1).is_err());
        assert!(args(src("tg"), Some("p"), "a", MAX_LIMIT + 1, 1).is_err());
        assert!(args(src("tg"), Some("p"), "a", 10, 0).is_err());
    }

    #[test]
    fn reads_items_with_notes_and_coverage() {
        let body = r#"{"items":[{"ref":"msg:1"}],"page":{"has_more":true},"missing":[{"why":"searched 3 chats"}]}"#;
        let answer = read(src("wa"), &output(0, body, "no serve keeps it\nsearched 3 chats\n"), 50);
        assert_eq!(
            answer,
            Answer::Hits {
                hits: vec![serde_json::json!({"ref": "msg:1"})],
                has_more: true,
                paged: true,
                notes: vec!["searched 3 chats".into(), "no serve keeps it".into()],
                total: None,
            }
        );
    }

    #[test]
    fn reads_the_total_under_page_or_under_item_for_drive() {
        let body = r#"{"items":[],"page":{"has_more":false,"total":{"value":10000,"relation":"gte"}}}"#;
        let Answer::Hits { total, .. } = read(src("wa"), &output(0, body, ""), 50) else { panic!() };
        assert_eq!(total, Some(Total { value: 10000, relation: Relation::Gte }));
        let body = r#"{"item":{"hits":[],"total":{"value":144,"relation":"eq"}}}"#;
        let Answer::Hits { total, .. } = read(src("drive"), &output(0, body, ""), 20) else { panic!() };
        assert_eq!(total, Some(Total { value: 144, relation: Relation::Eq }));
    }

    #[test]
    fn drive_hits_sit_under_item_and_a_full_page_may_have_more() {
        let body = r#"{"item":{"hits":[{"ref":"document:1"},{"ref":"document:2"}]}}"#;
        let Answer::Hits { hits, has_more, .. } = read(src("drive"), &output(0, body, ""), 2) else { panic!() };
        assert_eq!(hits.len(), 2);
        assert!(has_more);
        let Answer::Hits { has_more, .. } = read(src("drive"), &output(0, body, ""), 3) else { panic!() };
        assert!(!has_more);
    }

    #[test]
    fn unpaged_search_never_offers_a_next_page() {
        let body = r#"{"items":[{"ref":"msg:1"}],"page":{"has_more":true}}"#;
        let Answer::Hits { has_more, paged, .. } = read(src("email"), &output(0, body, ""), 1) else { panic!() };
        assert!(!has_more && !paged);
    }

    #[test]
    fn a_query_error_keeps_its_reason_and_span_after_a_warning_line() {
        let err = r#"{"error":{"code":"validation_error","reason":"query.unknown-field","message":"no field \"bogus\"","details":{"span":{"start":0,"end":7}}}}"#;
        let answer = read(src("wa"), &output(2, "", &format!("no serve keeps profile up to date\n{err}\n")), 50);
        assert_eq!(
            answer,
            Answer::QueryError {
                reason: "query.unknown-field".into(),
                message: "no field \"bogus\"".into(),
                span: Some(Span { start: 0, end: 7 }),
            }
        );
    }

    #[test]
    fn a_zero_width_span_is_kept() {
        let err = r#"{"error":{"reason":"query.invalid-syntax","message":"at position 12","details":{"span":{"start":11,"end":11}}}}"#;
        let Answer::QueryError { span, .. } = read(src("tg"), &output(2, "", err), 50) else { panic!() };
        assert_eq!(span, Some(Span { start: 11, end: 11 }));
    }

    #[test]
    fn zm_refusal_in_a_note_becomes_a_query_error() {
        let body = r#"{"items":[],"page":{"has_more":false},"meta":{"complete":false}}"#;
        let note = "meetings not searched: search: query.invalid-syntax at position 8";
        let answer = read(src("zm"), &output(0, body, note), 50);
        assert_eq!(
            answer,
            Answer::QueryError {
                reason: "query.invalid-syntax".into(),
                message: note.into(),
                span: Some(Span { start: 7, end: 7 }),
            }
        );
    }

    #[test]
    fn zm_words_only_refusal_is_its_own_note() {
        let body = r#"{"items":[],"meta":{"complete":false}}"#;
        let note = "meetings not searched: meetings support letter/digit words joined by AND";
        assert_eq!(
            read(src("zm"), &output(0, body, note), 50),
            Answer::Failed { message: note.into(), candidates: vec![] }
        );
    }

    #[test]
    fn an_unknown_option_means_the_tool_is_too_old() {
        let err =
            r#"{"error":{"code":"validation_error","reason":"input.invalid","message":"unknown option '--offline'"}}"#;
        assert!(matches!(read(src("tg"), &output(2, "", err), 50), Answer::Old { .. }));
        assert!(matches!(read(src("tg"), &output(1, "", "unknown command 'search'"), 50), Answer::Old { .. }));
    }

    #[test]
    fn other_refusals_are_the_tools_own_words() {
        let err = r#"{"error":{"code":"not_found","reason":"item.not-found","message":"nothing recorded for profile \"personal\" yet"}}"#;
        assert_eq!(
            read(src("max"), &output(6, "", err), 50),
            Answer::Failed { message: "nothing recorded for profile \"personal\" yet".into(), candidates: vec![] }
        );
    }

    /// The interface parses these exact shapes (`src/platform/search-schemas.test.ts`); a renamed key breaks every search.
    #[test]
    fn answers_serialize_as_the_interface_reads_them() {
        use serde_json::json;
        let hits = Answer::Hits {
            hits: vec![json!({"ref": "msg:1"})],
            has_more: true,
            paged: true,
            notes: vec!["n".into()],
            total: Some(Total { value: 144, relation: Relation::Gte }),
        };
        assert_eq!(
            serde_json::to_value(hits).unwrap(),
            json!({"kind": "hits", "hits": [{"ref": "msg:1"}], "hasMore": true, "paged": true, "notes": ["n"],
                "total": {"value": 144, "relation": "gte"}})
        );
        let error = Answer::QueryError { reason: "query.invalid-syntax".into(), message: "m".into(), span: None };
        assert_eq!(
            serde_json::to_value(error).unwrap(),
            json!({"kind": "queryError", "reason": "query.invalid-syntax", "message": "m", "span": null})
        );
        let spanned =
            Answer::QueryError { reason: "r".into(), message: "m".into(), span: Some(Span { start: 0, end: 7 }) };
        assert_eq!(serde_json::to_value(spanned).unwrap()["span"], json!({"start": 0, "end": 7}));
        assert_eq!(
            serde_json::to_value(Answer::Old { message: "m".into() }).unwrap(),
            json!({"kind": "old", "message": "m"})
        );
        assert_eq!(
            serde_json::to_value(Answer::Failed { message: "m".into(), candidates: vec![] }).unwrap(),
            json!({"kind": "failed", "message": "m"})
        );
        let ambiguous = Answer::Failed {
            message: "m".into(),
            candidates: vec![Candidate { id: "-1001".into(), label: Some("@kyrillic".into()), field: Some("chat") }],
        };
        assert_eq!(
            serde_json::to_value(ambiguous).unwrap(),
            json!({"kind": "failed", "message": "m", "candidates": [{"id": "-1001", "label": "@kyrillic", "field": "chat"}]})
        );
    }

    #[test]
    fn value_lists_read_only_the_local_store() {
        for tool in &catalog::catalog().tools {
            for (name, src) in &source(tool).unwrap().values {
                let a = &src.args;
                let id = &tool.id;
                assert!(a.iter().any(|x| x == "--offline"), "{id} {name}: --offline");
                assert!(a.iter().any(|x| x == "--no-record") && a.iter().any(|x| x == "--json"), "{id} {name}");
            }
        }
        let chats = &source(catalog::tool("tg").unwrap()).unwrap().values["chats"];
        assert_eq!(values_args(chats, Some("personal")).unwrap()[0], "personal");
        assert!(values_args(chats, None).is_err());
        assert!(values_args(chats, Some("-x")).is_err());
    }

    #[test]
    fn picks_one_field_once_in_the_tools_order() {
        let body =
            serde_json::json!({"items": [{"tag": "work"}, {"tag": " home "}, {"tag": "work"}, {"tag": ""}, {"x": 1}]});
        let src = ValuesSource { args: vec![], key: "tag".into(), label: None, detail: None };
        let got: Vec<_> = pick(&body, &src).into_iter().map(|v| v.value).collect();
        assert_eq!(got, ["work", "home"]);
    }

    #[test]
    fn a_chat_is_named_by_its_id_and_shown_by_title_and_username() {
        let body = serde_json::json!({"items": [
            {"id": "-1001762030832", "title": "kyrillic", "provider_metadata": {"username": "kyrillic"}},
            {"id": "-1001334573228", "title": "kyrillic", "provider_metadata": {}},
        ]});
        let src = &source(catalog::tool("tg").unwrap()).unwrap().values["chats"];
        let item = |v: &str, d: Option<&str>| ValueItem {
            value: v.into(),
            label: Some("kyrillic".into()),
            detail: d.map(str::to_string),
        };
        assert_eq!(pick(&body, src), [item("-1001762030832", Some("kyrillic")), item("-1001334573228", None)]);
    }

    #[test]
    fn an_ambiguous_chat_carries_its_candidates() {
        let err = r#"{"error":{"code":"validation_error","reason":"input.invalid","message":"2 chats","details":{"candidates":[{"id":"-1001762030832","title":"@kyrillic"},{"id":"-1001334573228","title":"kyrillic"}]}}}"#;
        let Answer::Failed { candidates, .. } = read(src("tg"), &output(2, "", err), 50) else { panic!() };
        assert_eq!(candidates.len(), 2);
        assert_eq!(
            candidates[0],
            Candidate { id: "-1001762030832".into(), label: Some("@kyrillic".into()), field: Some("chat") }
        );
        let people = serde_json::json!([{"id": "7", "name": "Ana", "username": "ana"}, {"id": 8, "name": "Ana B"}]);
        let got = candidates_of(&people);
        assert_eq!(got[0].label.as_deref(), Some("Ana · @ana"));
        assert_eq!(got[1], Candidate { id: "8".into(), label: Some("Ana B".into()), field: Some("from") });
    }

    /// `cargo test -- --ignored real_values` against the installed tools; prints counts, never values.
    #[test]
    #[ignore = "needs the tools installed and signed in"]
    fn real_values() {
        for (id, profile) in [("tg", "personal"), ("wa", "personal"), ("max", "mila")] {
            let tool = catalog::tool(id).unwrap();
            for name in ["chats", "contacts", "tags"] {
                let found = values(tool, Some(profile), name).unwrap();
                println!("{id} {name}: {}", found.len());
            }
        }
    }

    /// The engine of `scripts/search-fields-check.mjs`: runs each request in `SEARCH_BATCH_IN` (JSON lines of
    /// `{kind: "values" | "search", tool, profile, source | query}`) through `values` or `search` and writes one
    /// answer per line to `SEARCH_BATCH_OUT`. Run by the script only; it reads the owner's real stores.
    #[test]
    #[ignore = "run by scripts/search-fields-check.mjs"]
    fn real_batch() {
        use std::io::Write;
        let (Ok(input), Ok(output)) = (std::env::var("SEARCH_BATCH_IN"), std::env::var("SEARCH_BATCH_OUT")) else {
            return;
        };
        let mut out = std::fs::File::create(output).unwrap();
        for line in std::fs::read_to_string(input).unwrap().lines().filter(|l| !l.trim().is_empty()) {
            let req: Value = serde_json::from_str(line).unwrap();
            let tool = catalog::tool(req["tool"].as_str().unwrap()).unwrap();
            let profile = req["profile"].as_str();
            let answer = if req["kind"] == "version" {
                Ok(serde_json::json!(paths::find(&tool.bin).and_then(|b| crate::tools::version_of(&b))))
            } else if req["kind"] == "values" {
                values(tool, profile, req["source"].as_str().unwrap()).map(|v| serde_json::to_value(v).unwrap())
            } else {
                search(tool, profile, req["query"].as_str().unwrap(), 20, 1).map(|a| serde_json::to_value(a).unwrap())
            };
            let row = match answer {
                Ok(v) => serde_json::json!({"ok": v}),
                Err(e) => serde_json::json!({"err": e}),
            };
            writeln!(out, "{row}").unwrap();
        }
    }

    /// `cargo test -- --ignored real_search` against the installed tools; prints shapes and counts, never values.
    #[test]
    #[ignore = "needs the tools installed and signed in"]
    fn real_search() {
        let runs = [
            ("tg", Some("personal")),
            ("wa", Some("personal")),
            ("zm", Some("personal")),
            ("drive", Some("personal")),
            ("memo", None),
            ("email", Some("personal")),
        ];
        for (id, profile) in runs {
            let tool = catalog::tool(id).unwrap();
            for query in ["hello", "bogus:x"] {
                match search(tool, profile, query, 5, 1).unwrap() {
                    Answer::Hits { hits, has_more, notes, .. } => {
                        println!("{id} {query}: {} hits, has_more={has_more}, {} notes", hits.len(), notes.len());
                    }
                    other => println!("{id} {query}: {other:?}"),
                }
            }
        }
    }
}
