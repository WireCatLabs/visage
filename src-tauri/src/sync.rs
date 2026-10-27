use crate::catalog::{self, Tool};
use crate::run::{self, Line, RunError};
use crate::{paths, redact};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::time::Duration;

/// The tool's own `--timeout` (two hours in the catalog) ends a sync first and keeps what it fetched; this limit only
/// catches a tool that ignores it.
const LIMIT: Duration = Duration::from_hours(3);
/// Time for the tool to finish its page and close the store after SIGTERM; then the whole group is killed.
const GRACE: Duration = Duration::from_secs(5);
const LAST_TIMEOUT: Duration = Duration::from_secs(20);

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SyncSource {
    /// `None` when the tool has no sync to start (`WhatsApp` syncs while `wa serve` runs); `note` says so.
    pub run: Option<Vec<String>>,
    pub last: Option<Vec<String>>,
    pub last_shape: LastShape,
    pub what: String,
}

#[derive(Debug, Deserialize, Clone, Copy, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum LastShape {
    /// `runs list` of the sync command: the newest successful run of the profile.
    Runs,
    /// drive's `status`: `item.last_sync`, set only when nothing is left, and `item.pending`.
    DriveStatus,
}

/// Counts only: titles, chat keys and account names in the tool's answer stay in Rust.
#[derive(Debug, Serialize, Clone, PartialEq, Eq, Default)]
#[serde(rename_all = "camelCase")]
pub struct Summary {
    /// New messages, files, meetings, emails or changed notes.
    pub new: u64,
    /// How many chats, accounts or folders brought something new.
    pub places: u64,
    pub failed: u64,
    /// Files the tool will fetch on the next run.
    pub left: u64,
    pub complete: bool,
}

#[derive(Debug, Serialize, Clone, PartialEq, Eq)]
#[serde(tag = "event", rename_all = "camelCase")]
pub enum SyncEvent {
    /// A stage from a fixed list, read from the tool's notes; never the note itself.
    Stage {
        stage: String,
    },
    /// cli-core's `progress` line, from the release that prints one: counts only, never a chat.
    #[serde(rename_all = "camelCase")]
    Progress {
        chats: Option<u64>,
        chats_done: Option<u64>,
        fetched: u64,
    },
    Done {
        summary: Summary,
    },
    Stopped,
    /// `code` and `reason` are the tool's own (`timeout`, `profile.locked`…); the interface says what to do.
    Failed {
        message: String,
        code: Option<String>,
        reason: Option<String>,
    },
}

#[derive(Debug, Serialize, Clone, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct LastSync {
    /// When the newest successful sync ended, as the tool printed it.
    pub at: Option<String>,
    pub left: Option<u64>,
    /// False when the tool cannot say (too old for `runs list`, or its answer did not parse).
    pub known: bool,
}

fn source(tool: &Tool) -> Result<&SyncSource, String> {
    tool.sync.as_ref().ok_or_else(|| format!("{} has no sync", tool.name))
}

fn per_profile(words: &[String]) -> bool {
    words.iter().any(|w| w == "{profile}")
}

/// One sync per package and profile. memo keeps one lock for every account, so its key has no profile.
pub fn key(tool: &'static Tool, profile: Option<&str>) -> String {
    let owner = &catalog::owner(tool).id;
    match profile {
        Some(p) if tool.sync.as_ref().and_then(|s| s.run.as_deref()).is_some_and(per_profile) => {
            format!("sync:{owner}:{p}")
        }
        _ => format!("sync:{owner}"),
    }
}

/// The prefix every sync of a package's keys starts with, so an install can refuse while one runs.
pub fn package_prefix(owner: &str) -> String {
    format!("sync:{owner}")
}

/// The catalog's words with the profile the owner chose; a tool that syncs per profile never gets a default one.
pub fn args(tool: &Tool, profile: Option<&str>) -> Result<Vec<String>, String> {
    let words = source(tool)?.run.as_ref().ok_or_else(|| format!("{} has no sync to start", tool.name))?;
    catalog::with_profile(words, profile)
}

pub fn run(tool: &Tool, args: &[String], stopped: &dyn Fn() -> bool, send: &dyn Fn(SyncEvent)) {
    let Some(bin) = paths::find(&tool.bin) else {
        return send(failed(format!("{} is not installed.", tool.name), None, None));
    };
    let what = source(tool).map(|s| s.what.clone()).unwrap_or_default();
    let refs: Vec<&str> = args.iter().map(String::as_str).collect();
    let cmd = run::command(&bin, &refs, Some(&paths::search_path()));
    let mut stdout = String::new();
    let mut error = None;
    let mut last_stage = None;
    let result = run::stream_stoppable(cmd, LIMIT, stopped, GRACE, drop, |line| match line {
        Line::Out(l) => {
            stdout.push_str(&l);
            stdout.push('\n');
        }
        Line::Err(l) => {
            if let Some(e) = error_of(&l) {
                error = Some(e);
            } else if let Some(p) = progress_of(&l) {
                send(p);
            } else if let Some(stage) = stage_of(&l)
                && last_stage != Some(stage)
            {
                last_stage = Some(stage);
                send(SyncEvent::Stage { stage: stage.into() });
            }
        }
    });
    send(finish(&tool.name, &what, result, &stdout, error, stopped()));
}

/// The tool's notes, read into a stage. Notes name chats and accounts, so only the stage leaves.
fn stage_of(line: &str) -> Option<&'static str> {
    let l = line.trim_start_matches(['·', ' ']);
    if l.contains("messages so far") {
        Some("Fetching messages")
    } else if l.contains("FloodWait") || l.contains("rate limit") || l.contains("waiting ") {
        Some("Waiting for the service's rate limit")
    } else if l.starts_with("mail ") {
        Some("Reading mail")
    } else if l.contains("embedding") || l.contains("search by meaning") {
        Some("Preparing search")
    } else {
        None
    }
}

/// `{"event":"progress","step":"sync","chats","chats_done","fetched"}`; any other field is dropped.
fn progress_of(line: &str) -> Option<SyncEvent> {
    let v: Value = serde_json::from_str(line.trim()).ok()?;
    if v.get("event")?.as_str()? != "progress" || v.get("step")?.as_str()? != "sync" {
        return None;
    }
    Some(SyncEvent::Progress {
        chats: v.get("chats").and_then(Value::as_u64),
        chats_done: v.get("chats_done").and_then(Value::as_u64),
        fetched: v.get("fetched").and_then(Value::as_u64)?,
    })
}

/// The error envelope a failing tool prints on stderr, with its message masked.
fn error_of(line: &str) -> Option<SyncEvent> {
    let value: Value = serde_json::from_str(line.trim()).ok()?;
    let e = value.get("error")?;
    let text = |k: &str| e.get(k).and_then(Value::as_str).map(str::to_string);
    Some(failed(redact::text(&text("message")?), text("code"), text("reason")))
}

fn finish(
    name: &str,
    what: &str,
    result: Result<Option<i32>, RunError>,
    stdout: &str,
    error: Option<SyncEvent>,
    stopped: bool,
) -> SyncEvent {
    let answer = run::Output { code: None, stdout: stdout.into(), stderr: String::new() }.json();
    let summary = answer.as_ref().and_then(|v| v.get("item")).map(|item| summary_of(what, item));
    match (result, summary, error) {
        (Err(RunError::Cancelled) | Ok(_), _, _) if stopped => SyncEvent::Stopped,
        (Ok(Some(0)), Some(summary), _) | (Ok(_), Some(summary), None) => SyncEvent::Done { summary },
        (Ok(_), _, Some(e)) => e,
        (Ok(Some(code)), None, None) => failed(format!("{name} stopped with exit code {code}."), None, None),
        (Ok(None), None, None) => failed(format!("{name} was stopped by the system."), None, None),
        (Err(RunError::TimedOut), _, _) => {
            failed(format!("The sync ran longer than {} hours.", LIMIT.as_secs() / 3600), Some("timeout".into()), None)
        }
        (Err(e), _, _) => failed(format!("Could not run {name}: {e}."), None, None),
    }
}

fn failed(message: String, code: Option<String>, reason: Option<String>) -> SyncEvent {
    SyncEvent::Failed { message, code, reason }
}

fn count(v: &Value, key: &str) -> u64 {
    v.get(key).and_then(Value::as_u64).unwrap_or(0)
}

fn list<'a>(v: &'a Value, key: &str) -> &'a [Value] {
    v.get(key).and_then(Value::as_array).map_or(&[], Vec::as_slice)
}

/// Each tool's own result, in counts. Unknown shapes give zeros rather than an error: the sync itself succeeded.
fn summary_of(what: &str, item: &Value) -> Summary {
    let flag = |v: &Value, k: &str| v.get(k).and_then(Value::as_bool);
    match what {
        "messages" => {
            let chats = list(item, "items");
            let failed = item.get("batch").map(|b| count(b, "failed")).filter(|n| *n > 0);
            Summary {
                new: count(item, "fetched"),
                places: chats.iter().filter(|c| count(c, "fetched") > 0).count() as u64,
                failed: failed.unwrap_or_else(|| chats.iter().filter(|c| c.get("error").is_some()).count() as u64),
                left: 0,
                complete: flag(item, "complete").unwrap_or(true),
            }
        }
        "files" => {
            let left = count(item, "pending");
            Summary {
                new: count(item, "saved"),
                places: 0,
                failed: list(item, "errors").len() as u64,
                left,
                complete: left == 0,
            }
        }
        "meetings" => {
            let failed = list(item, "warnings").len() as u64;
            Summary { new: count(item, "meetings"), places: 0, failed, left: 0, complete: failed == 0 }
        }
        _ => {
            let mail = list(item, "mail");
            let notes = list(item, "notes");
            let saved = |m: &&Value| count(m, "saved") > 0;
            let changed = |n: &&Value| count(n, "changed") > 0;
            Summary {
                new: mail.iter().map(|m| count(m, "saved")).sum::<u64>()
                    + notes.iter().map(|n| count(n, "changed")).sum::<u64>(),
                places: (mail.iter().filter(saved).count() + notes.iter().filter(changed).count()) as u64,
                failed: list(item, "failed").len() as u64,
                left: 0,
                complete: mail.iter().all(|m| flag(m, "complete").unwrap_or(true)),
            }
        }
    }
}

/// When the profile last synced, from the tool's own answer: never the database.
pub fn last(tool: &Tool, profile: Option<&str>) -> Result<LastSync, String> {
    let src = source(tool)?;
    let unknown = LastSync { at: None, left: None, known: false };
    let Some(words) = &src.last else { return Ok(unknown) };
    let args = catalog::with_profile(words, profile)?;
    let bin = paths::find(&tool.bin).ok_or("the tool is not installed")?;
    let refs: Vec<&str> = args.iter().map(String::as_str).collect();
    let out = run::run(&bin, &refs, Some(&paths::search_path()), LAST_TIMEOUT).map_err(|e| e.to_string())?;
    Ok(match out.json() {
        Some(v) if v.get("error").is_none() => read_last(src.last_shape, &v, profile),
        _ => unknown,
    })
}

fn read_last(shape: LastShape, v: &Value, profile: Option<&str>) -> LastSync {
    let text = |v: &Value, k: &str| v.get(k).and_then(Value::as_str).map(str::to_string);
    match shape {
        LastShape::Runs => {
            // A run without a profile is the tool's own (memo); with one, only the chosen profile's counts.
            let mine = |r: &&Value| match (profile, r.get("profile").and_then(Value::as_str)) {
                (Some(p), Some(of)) => p == of,
                _ => true,
            };
            let at = list(v, "items").iter().find(mine).and_then(|r| text(r, "completed_at"));
            LastSync { at, left: None, known: true }
        }
        LastShape::DriveStatus => {
            let item = v.get("item").unwrap_or(&Value::Null);
            LastSync { at: text(item, "last_sync"), left: item.get("pending").and_then(Value::as_u64), known: true }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn runs_the_catalogs_words_for_a_profile_the_owner_named() {
        let tg = catalog::tool("tg").unwrap();
        assert_eq!(
            args(tg, Some("work")).unwrap(),
            ["work", "messages", "sync", "--all", "--timeout", "2h", "--record", "--json"]
        );
        assert!(args(tg, None).is_err());
        for bad in ["", "--help", "a;rm -rf ~", "../x y"] {
            assert!(args(tg, Some(bad)).is_err(), "{bad}");
        }
        assert!(args(catalog::tool("wa").unwrap(), Some("personal")).is_err());
        assert_eq!(args(catalog::tool("memo").unwrap(), None).unwrap(), ["sync", "--record", "--json"]);
    }

    #[test]
    fn memo_and_email_share_one_key_and_messengers_have_one_per_profile() {
        let memo = catalog::tool("memo").unwrap();
        let email = catalog::tool("email").unwrap();
        assert_eq!(key(memo, None), key(email, None));
        let tg = catalog::tool("tg").unwrap();
        assert_ne!(key(tg, Some("a")), key(tg, Some("b")));
        assert!(key(tg, Some("a")).starts_with(&package_prefix("tg")));
    }

    #[test]
    fn a_summary_keeps_counts_and_drops_titles() {
        let item = json!({"chats": 4, "fetched": 1240, "complete": true, "items": [
            {"chat": "1", "title": "Family", "fetched": 1000, "complete": true},
            {"chat": "2", "title": "Work", "fetched": 240, "complete": true},
            {"chat": "3", "title": "Old", "fetched": 0, "complete": true, "current": true},
            {"chat": "4", "title": "Broken", "fetched": 0, "complete": false, "error": "provider_error"}
        ]});
        let s = summary_of("messages", &item);
        assert_eq!(s, Summary { new: 1240, places: 2, failed: 1, left: 0, complete: true });
        let text = serde_json::to_string(&SyncEvent::Done { summary: s }).unwrap();
        assert!(!text.contains("Family"), "{text}");
    }

    #[test]
    fn reads_drive_memo_and_zoom_answers() {
        let drive = json!({"saved": 12, "pending": 30, "errors": [{"id": "x", "code": "c", "message": "m"}]});
        assert_eq!(summary_of("files", &drive), Summary { new: 12, places: 0, failed: 1, left: 30, complete: false });
        let memo = json!({"notes": [{"folder": "~/n", "changed": 2}], "mail": [
            {"account": "me@example.com", "saved": 5, "complete": true},
            {"account": "work", "saved": 0, "complete": false}
        ], "failed": []});
        assert_eq!(
            summary_of("notes and mail", &memo),
            Summary { new: 7, places: 2, failed: 0, left: 0, complete: false }
        );
        let zm = json!({"meetings": 3, "warnings": []});
        assert_eq!(summary_of("meetings", &zm), Summary { new: 3, places: 0, failed: 0, left: 0, complete: true });
    }

    #[test]
    fn stages_come_from_known_notes_only() {
        assert_eq!(stage_of("340 messages so far, back to 1234567"), Some("Fetching messages"));
        assert_eq!(stage_of("mail me@example.com: 20 emails' HTML text read again"), Some("Reading mail"));
        assert_eq!(stage_of("something about Family chat"), None);
    }

    #[test]
    fn a_progress_line_keeps_its_counts_only() {
        let line = r#"{"event":"progress","step":"sync","chats":40,"chats_done":3,"fetched":1240,"chat":"Family"}"#;
        assert_eq!(
            progress_of(line),
            Some(SyncEvent::Progress { chats: Some(40), chats_done: Some(3), fetched: 1240 })
        );
        let text = serde_json::to_string(&progress_of(line).unwrap()).unwrap();
        assert!(!text.contains("Family") && text.contains("chatsDone"), "{text}");
        assert_eq!(progress_of(r#"{"event":"progress","step":"history","fetched":1}"#), None);
        assert_eq!(progress_of("12 messages so far"), None);
    }

    #[test]
    fn an_error_envelope_becomes_a_masked_failure() {
        let line =
            r#"{"error":{"code":"provider_unavailable","reason":"profile.locked","message":"held by me@example.com"}}"#;
        let SyncEvent::Failed { message, code, reason } = error_of(line).unwrap() else { panic!() };
        assert_eq!((code.as_deref(), reason.as_deref()), (Some("provider_unavailable"), Some("profile.locked")));
        assert!(!message.contains("me@example.com"), "{message}");
    }

    #[test]
    fn a_stop_wins_and_a_time_limit_keeps_its_code() {
        let timeout = failed("too long".into(), Some("timeout".into()), None);
        assert_eq!(finish("tg", "messages", Ok(Some(143)), "", Some(timeout.clone()), true), SyncEvent::Stopped);
        assert_eq!(finish("tg", "messages", Ok(Some(9)), "", Some(timeout.clone()), false), timeout);
        let done = finish("tg", "messages", Ok(Some(0)), r#"{"item":{"fetched":3,"items":[]}}"#, None, false);
        assert!(matches!(done, SyncEvent::Done { .. }), "{done:?}");
        assert!(matches!(finish("tg", "messages", Ok(Some(1)), "", None, false), SyncEvent::Failed { .. }));
    }

    #[test]
    fn last_sync_is_the_chosen_profiles_newest_run() {
        let runs = json!({"items": [
            {"profile": "work", "completed_at": "2026-10-27T10:00:00Z"},
            {"profile": "personal", "completed_at": "2026-10-27T09:00:00Z"}
        ]});
        assert_eq!(read_last(LastShape::Runs, &runs, Some("personal")).at.as_deref(), Some("2026-10-27T09:00:00Z"));
        assert_eq!(read_last(LastShape::Runs, &json!({"items": []}), Some("personal")).at, None);
        let status = json!({"item": {"last_sync": null, "pending": 4}});
        let last = read_last(LastShape::DriveStatus, &status, Some("p"));
        assert_eq!((last.at, last.left), (None, Some(4)));
    }

    #[cfg(unix)]
    #[test]
    fn stop_ends_a_running_sync_by_its_own_pid() {
        use std::sync::atomic::{AtomicBool, Ordering};
        let stop = AtomicBool::new(false);
        let cmd = run::command(
            std::path::Path::new("sh"),
            &["-c", "echo '5 messages so far, back to 9' >&2; sleep 30"],
            None,
        );
        let started = std::time::Instant::now();
        let mut seen = Vec::new();
        let result = run::stream_stoppable(
            cmd,
            LIMIT,
            || stop.load(Ordering::Relaxed),
            GRACE,
            drop,
            |line| {
                if let Line::Err(l) = line {
                    seen.push(stage_of(&l));
                    stop.store(true, Ordering::Relaxed);
                }
            },
        );
        assert!(started.elapsed() < Duration::from_secs(10));
        assert_eq!(finish("tg", "messages", result, "", None, true), SyncEvent::Stopped);
        assert_eq!(seen, [Some("Fetching messages")]);
    }
}
