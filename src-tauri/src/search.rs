//! Searching what one tool stored for one profile, through the tool's own Lucene search (`search` in the catalog).
//! Every template reads the local store only: `--offline` where the tool has it, `--backend archive` where the
//! messenger could also ask its server, and never `--sync-first`. The query goes after `--`, so `-chat:x` (NOT) is a
//! query and never a flag. Hits are the owner's own data shown on the owner's own page, so they are not masked; they
//! are never logged or put in a report.

use crate::cache::REFUSED;
use crate::catalog::{self, SearchShape, SearchSource, Tool};
use crate::{paths, run};
use serde::Serialize;
use serde_json::Value;
use std::time::Duration;

pub const MAX_LIMIT: u32 = 100;
const MAX_QUERY: usize = 1000;
const SEARCH: &str = "search";
// Longer than the `--timeout 60s` in the templates, so the tool's own time-limit answer comes back, not a kill.
const TIMEOUT: Duration = Duration::from_secs(90);

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
    },
    /// A closed `query.*` reason; `span` counts UTF-16 units of the query as typed, as JavaScript does.
    #[serde(rename_all = "camelCase")]
    QueryError {
        reason: String,
        message: String,
        span: Option<Span>,
    },
    /// The installed version has no such search, or no `--offline`: the answer is "update it".
    Old {
        message: String,
    },
    Failed {
        message: String,
    },
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

pub fn paged(src: &SearchSource) -> bool {
    src.args.iter().any(|a| a == "{page}")
}

pub fn search(tool: &Tool, profile: Option<&str>, query: &str, limit: u32, page: u32) -> Result<Answer, String> {
    let src = source(tool)?;
    let args = args(src, profile, query, limit, page)?;
    let bin = paths::find(&tool.bin).ok_or("the tool is not installed")?;
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

fn read(src: &SearchSource, out: &run::Output, limit: u32) -> Answer {
    let notes = stderr_notes(&out.stderr);
    if out.code != Some(0) {
        return error_of(&out.stderr, &out.stdout);
    }
    let Some(body) = out.json() else {
        return Answer::Failed { message: last_line(&out.stderr, &out.stdout) };
    };
    let hits = match src.shape {
        SearchShape::Items => body["items"].as_array(),
        SearchShape::ItemHits => body["item"]["hits"].as_array(),
    }
    .cloned()
    .unwrap_or_default();
    // zm reports a query its meeting search refused as a note and an incomplete, empty answer with exit 0.
    if hits.is_empty() && body["meta"]["complete"] == Value::Bool(false) {
        if let Some(refused) = notes.iter().find_map(|n| refused_note(n)) {
            return refused;
        }
        if let Some(note) = notes.first() {
            return Answer::Failed { message: note.clone() };
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
    Answer::Hits { hits, has_more, paged: paged(src), notes: all }
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
        return if too_old(&message) { Answer::Old { message } } else { Answer::Failed { message } };
    };
    let e = &error["error"];
    let reason = e["reason"].as_str().unwrap_or_default();
    let message = e["message"].as_str().unwrap_or("the tool gave no answer").to_string();
    if reason.starts_with("query.") {
        let span = span_of(&e["details"]["span"]);
        return Answer::QueryError { reason: reason.to_string(), message, span };
    }
    if too_old(&message) { Answer::Old { message } } else { Answer::Failed { message } }
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
            }
        );
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
        assert_eq!(read(src("zm"), &output(0, body, note), 50), Answer::Failed { message: note.into() });
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
            Answer::Failed { message: "nothing recorded for profile \"personal\" yet".into() }
        );
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
