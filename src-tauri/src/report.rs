use crate::{catalog, redact, runs, system, tools};
use regex::Regex;
use serde::{Deserialize, Serialize};
use serde_json::{Map, Value, json};
use std::sync::{OnceLock, mpsc};
use std::time::{Duration, Instant};

// The contract lives in docs/dev/report-api.md; keep both in step.
const DEFAULT_API: &str = "https://api.wirecat.dev";
const RUNS_PER_TOOL: u32 = 20;
// The dialog waits for this; a tool that answers later is left out rather than holding the report up.
const RUNS_WAIT: Duration = Duration::from_secs(10);
const MAX_BODY: usize = 1024 * 1024;

/// Everything about this computer a report carries, masked, so the dialog can show it before anything is sent.
#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Context {
    pub app: Value,
    pub system: Value,
    pub tools: Vec<Value>,
    /// Private: stored by the server, never copied into the public issue.
    pub attachments: Option<Value>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Draft {
    pub summary: String,
    pub details: String,
    pub expected: Option<String>,
    pub tool: Option<String>,
    pub idempotency_key: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Sent {
    pub id: String,
    pub issue_number: Option<u64>,
    pub issue_url: Option<String>,
}

pub fn context() -> Context {
    let readiness = system::readiness();
    let tools: Vec<Value> = tools::detect_owners(false)
        .into_iter()
        .filter_map(|t| {
            let first = t.installs.first()?;
            Some(json!({ "id": t.id, "version": first.version, "manager": first.manager }))
        })
        .collect();
    let attachments = Some(json!({ "runs": recent_failures(&tools) }));
    Context {
        app: json!({ "name": "wirecat-desktop", "version": env!("CARGO_PKG_VERSION") }),
        system: json!({
            "os": readiness.os,
            "arch": readiness.arch,
            "node": readiness.node.version,
            "npm": readiness.npm.version,
        }),
        tools,
        attachments,
    }
}

fn recent_failures(installed: &[Value]) -> Value {
    let (tx, rx) = mpsc::channel();
    let mut asked = 0;
    for tool in installed
        .iter()
        .filter_map(|t| catalog::tool(t["id"].as_str()?).ok())
        .filter(|tool| tool.runs.is_some() && tool.part_of.is_none())
    {
        asked += 1;
        let tx = tx.clone();
        std::thread::spawn(move || {
            let page = runs::list(tool, Some("status:failed"), RUNS_PER_TOOL, 1).ok();
            let _ = tx.send(page.map(|p| json!({ "tool": tool.id, "runs": p["items"] })));
        });
    }
    let deadline = Instant::now() + RUNS_WAIT;
    let mut found = Vec::new();
    for _ in 0..asked {
        let Some(left) = deadline.checked_duration_since(Instant::now()) else { break };
        match rx.recv_timeout(left) {
            Ok(Some(v)) => found.push(v),
            Ok(None) => {}
            Err(_) => break,
        }
    }
    safe_runs(&Value::Array(found))
}

pub fn send(draft: Draft, mut context: Context) -> Result<Sent, String> {
    let body = body(draft, &mut context)?;
    let key = body["idempotencyKey"].as_str().unwrap_or_default().to_string();
    let bytes = payload(body["report"].clone())?;

    let url = format!("{}/v1/reports", api_base()?);
    let agent: ureq::Agent = ureq::Agent::config_builder()
        .http_status_as_error(false)
        .timeout_global(Some(Duration::from_secs(30)))
        .build()
        .into();
    let mut response = agent
        .post(&url)
        .header("Content-Type", "application/json")
        .header("Idempotency-Key", &key)
        .header("User-Agent", &user_agent(&context))
        .send(&bytes[..])
        .map_err(|e| format!("Could not reach the WireCat server: {e}"))?;
    let status = response.status().as_u16();
    let answer: Value = response.body_mut().read_json().unwrap_or(Value::Null);
    accepted(status, &answer)
}

/// Logs are always attached, so a report that outgrows the limit sheds the failed runs before it gives up.
fn payload(mut report: Value) -> Result<Vec<u8>, String> {
    let bytes = serde_json::to_vec(&json!({ "report": report })).map_err(|e| e.to_string())?;
    if bytes.len() <= MAX_BODY {
        return Ok(bytes);
    }
    if let Some(a) = report["attachments"].as_object_mut() {
        a.remove("runs");
    }
    let bytes = serde_json::to_vec(&json!({ "report": report })).map_err(|e| e.to_string())?;
    if bytes.len() > MAX_BODY {
        return Err("The report is too large. Shorten the description.".into());
    }
    Ok(bytes)
}

fn body(draft: Draft, context: &mut Context) -> Result<Value, String> {
    let summary = redact::text(draft.summary.trim());
    let details = redact::text(draft.details.trim());
    if summary.is_empty() || summary.chars().count() > 120 {
        return Err("The summary needs 1 to 120 characters.".into());
    }
    if details.is_empty() || details.chars().count() > 10_000 {
        return Err("The description needs 1 to 10 000 characters.".into());
    }
    // Email is part of memo's package: the server and the issue tracker know the package, so the report goes there
    // and the details say which part it is about.
    let (tool, details) = match &draft.tool {
        Some(id) => {
            let chosen = catalog::tool(id)?;
            let owner = catalog::owner(chosen);
            let details = if owner.id == chosen.id { details } else { format!("About: {}\n\n{details}", chosen.name) };
            (Some(owner.id.clone()), details)
        }
        None => (None, details),
    };
    if !is_uuid(&draft.idempotency_key) {
        return Err("The report has no valid id.".into());
    }
    // The interface may have held this for a while; mask again so nothing it carries leaves unmasked.
    if let Some(a) = context.attachments.as_mut() {
        let runs = a.as_object_mut().and_then(|o| o.remove("runs"));
        redact::json(a);
        if let (Some(runs), Some(o)) = (runs, a.as_object_mut()) {
            o.insert("runs".into(), safe_runs(&runs));
        }
    }
    let expected = draft.expected.map(|e| redact::text(e.trim())).filter(|e| !e.is_empty());
    Ok(json!({
        "idempotencyKey": draft.idempotency_key,
        "report": {
            "summary": summary,
            "details": details,
            "expected": expected,
            "tool": tool,
            "app": context.app,
            "system": context.system,
            "tools": context.tools,
            "attachments": context.attachments,
        }
    }))
}

const MASKED: &str = "•••";

/// Fields of a run that say what happened and on what, never to whom or where.
const SAFE_FIELDS: [&str; 18] = [
    "run_id",
    "command",
    "cli_command",
    "status",
    "started_at",
    "completed_at",
    "duration_ms",
    "requests",
    "error_code",
    "provider_error",
    "cli_version",
    "runtime",
    "platform",
    "arch",
    "operations",
    "codes",
    "kept_because_failed",
    "events_dropped",
];

/// Locally a run keeps chat and person ids, paths and its caller's ids (TASK-31); a report carries only the fields
/// above, plus masked markers where an id existed, so the team sees which conversation key the run had and nothing of
/// it. A field a newer tool adds stays on this computer until it is named here.
fn safe_runs(attachment: &Value) -> Value {
    let tools = attachment.as_array().map_or(&[][..], Vec::as_slice);
    Value::Array(
        tools
            .iter()
            .filter_map(|t| {
                let tool = t["tool"].as_str().filter(|id| catalog::tool(id).is_ok())?;
                let runs = t["runs"].as_array().map_or(&[][..], Vec::as_slice);
                Some(json!({ "tool": tool, "runs": runs.iter().map(safe_run).collect::<Vec<_>>() }))
            })
            .collect(),
    )
}

fn safe_run(run: &Value) -> Value {
    let mut out = Map::new();
    for key in SAFE_FIELDS {
        if let Some(v) = scalar(&run[key]) {
            out.insert(key.into(), v);
        }
    }
    if let Some(via) = run["via"].as_str() {
        out.insert("via".into(), via.into());
    }
    if let Some(unknown) = run["unknown_command"].as_str() {
        out.insert("unknown_command".into(), free_text(unknown).into());
    }
    // A profile is a name the owner chose, and may be a person's; argv already hides it.
    if run["profile"].is_string() {
        out.insert("profile".into(), MASKED.into());
    }
    if run["argv"].is_array() {
        let mut argv = json!({ "command": run["command"], "argv": run["argv"] });
        mask_typed_words(&mut argv);
        out.insert("argv".into(), argv["argv"].take());
    }
    if run["trace_id"].is_string() {
        out.insert("trace_id".into(), MASKED.into());
    }
    if let Some(agent) = run["agent"].as_object() {
        out.insert("agent".into(), safe_agent(agent));
    }
    if let Some(mcp) = run["mcp"].as_object() {
        let mut m = pick(mcp, &["tool", "proxied"]);
        mark(&mut m, mcp, &["connection_id", "request_id"]);
        out.insert("mcp".into(), Value::Object(m));
    }
    if let Some(partial) = run["partial"].as_object() {
        let mut p = pick(partial, &["failed", "stop_reason"]);
        if let Some(failures) = partial.get("failures").and_then(Value::as_array) {
            let kept =
                failures.iter().filter_map(Value::as_object).map(|f| Value::Object(pick(f, &["stage", "error_code"])));
            p.insert("failures".into(), Value::Array(kept.collect()));
        }
        out.insert("partial".into(), Value::Object(p));
    }
    if let Some(error) = run["error"].as_object() {
        out.insert("error".into(), safe_error(error));
    }
    Value::Object(out)
}

fn safe_agent(agent: &Map<String, Value>) -> Value {
    let mut a = pick(agent, &["kind", "from_chat"]);
    if agent.get("session_id").is_some_and(Value::is_null) {
        a.insert("session_id".into(), Value::Null);
    }
    mark(&mut a, agent, &["session_id"]);
    if let Some(client) = agent.get("client").and_then(Value::as_object) {
        let mut c = pick(client, &["name", "version"]);
        mark(&mut c, client, &["id"]);
        a.insert("client".into(), Value::Object(c));
    }
    Value::Object(a)
}

fn safe_error(error: &Map<String, Value>) -> Value {
    let mut e = pick(error, &["class", "code"]);
    for key in ["message", "operation"] {
        if let Some(s) = error.get(key).and_then(Value::as_str) {
            e.insert(key.into(), free_text(s).into());
        }
    }
    if let Some(http) = error.get("http").and_then(Value::as_object) {
        let mut h = pick(http, &["method", "status"]);
        if let Some(t) = http.get("endpoint_template").and_then(Value::as_str) {
            h.insert("endpoint_template".into(), free_text(t).into());
        }
        e.insert("http".into(), Value::Object(h));
    }
    if let Some(provider) = error.get("provider").and_then(Value::as_object) {
        e.insert("provider".into(), Value::Object(pick(provider, &["key", "code"])));
    }
    if let Some(causes) = error.get("causes").and_then(Value::as_array) {
        let kept = causes.iter().filter_map(Value::as_object).map(|c| {
            let mut k = pick(c, &["class"]);
            if let Some(m) = c.get("message").and_then(Value::as_str) {
                k.insert("message".into(), free_text(m).into());
            }
            Value::Object(k)
        });
        e.insert("causes".into(), Value::Array(kept.collect()));
    }
    if let Some(stack) = error.get("stack").and_then(Value::as_array) {
        let frames = stack.iter().filter_map(Value::as_str).map(|f| Value::String(free_text(f)));
        e.insert("stack".into(), Value::Array(frames.collect()));
    }
    Value::Object(e)
}

/// Scalars and lists of scalars only; an object under a safe name is not trusted to be safe.
fn scalar(v: &Value) -> Option<Value> {
    match v {
        Value::String(s) => Some(Value::String(redact::text(s))),
        Value::Number(_) | Value::Bool(_) => Some(v.clone()),
        Value::Array(items) if items.iter().all(|x| x.is_string() || x.is_number()) => {
            Some(Value::Array(items.iter().map(|x| scalar(x).unwrap_or(Value::Null)).collect()))
        }
        _ => None,
    }
}

fn pick(from: &Map<String, Value>, keys: &[&str]) -> Map<String, Value> {
    keys.iter().filter_map(|k| Some(((*k).to_string(), scalar(from.get(*k)?)?))).collect()
}

/// Says an id was there without saying which.
fn mark(to: &mut Map<String, Value>, from: &Map<String, Value>, keys: &[&str]) {
    for key in keys {
        if from.get(*key).is_some_and(|v| v.is_string() || v.is_number()) {
            to.insert((*key).to_string(), MASKED.into());
        }
    }
}

fn free_text_rules() -> &'static [(Regex, &'static str)] {
    static R: OnceLock<Vec<(Regex, &'static str)>> = OnceLock::new();
    R.get_or_init(|| {
        vec![
            // Any user's home, not only this one's: `paths::tilde` knows only the home of the account running the app.
            (Regex::new(r#"(?i)(?:/home|/Users|\b[a-z]:[\\/]Users)[\\/][^\\/\s"'`:;,)]+"#).unwrap(), "~"),
            (Regex::new(r"\b[A-Za-z0-9_\-]{32,}\b").unwrap(), "[token]"),
            // Chat, user and message ids are long numbers; times and line numbers are shorter.
            (Regex::new(r"-?\b\d{6,}\b").unwrap(), "[number]"),
        ]
    })
}

/// Text a tool wrote about a failure, which may name a chat, a person, a file or a secret.
fn free_text(s: &str) -> String {
    let mut out = redact::text(s);
    for (re, with) in free_text_rules() {
        out = re.replace_all(&out, *with).into_owned();
    }
    out
}

/// Runs keep `argv` as typed (cli-core 0.439.0), so chat titles and message text are in it. Without the tool's
/// command tree the app cannot tell an option's value from a flag, so it keeps only the command words and flag names,
/// stricter than cli-core's own `doctor reports create`.
fn mask_typed_words(run: &mut Value) {
    let command: Vec<String> =
        run["command"].as_str().unwrap_or_default().split_whitespace().map(String::from).collect();
    let Some(argv) = run["argv"].as_array_mut() else { return };
    let mut words = command.iter().peekable();
    for arg in argv.iter_mut() {
        let Some(s) = arg.as_str() else { continue };
        let kept = if words.peek().is_some_and(|w| *w == s) {
            words.next();
            s.to_string()
        } else if s.starts_with('-') && s.len() > 1 {
            s.split('=').next().unwrap_or(s).to_string()
        } else {
            "[redacted]".to_string()
        };
        *arg = Value::String(kept);
    }
}

fn accepted(status: u16, answer: &Value) -> Result<Sent, String> {
    let report = &answer["report"];
    match status {
        200..=202 => Ok(Sent {
            id: report["id"].as_str().unwrap_or_default().to_string(),
            issue_number: report["issue"]["number"].as_u64(),
            issue_url: report["issue"]["url"]
                .as_str()
                .filter(|u| u.starts_with("https://github.com/"))
                .map(String::from),
        }),
        429 => Err("Too many reports from this computer. Try again in a few minutes.".into()),
        _ => {
            let message = answer["error"]["message"].as_str().map(redact::text);
            Err(message.unwrap_or_else(|| format!("The WireCat server answered {status}.")))
        }
    }
}

fn api_base() -> Result<String, String> {
    let base = std::env::var("WIRECAT_API_URL").unwrap_or_else(|_| DEFAULT_API.into());
    let base = base.trim_end_matches('/').to_string();
    let local = base.starts_with("http://localhost") || base.starts_with("http://127.0.0.1");
    if base.starts_with("https://") || local { Ok(base) } else { Err("WIRECAT_API_URL must use https.".into()) }
}

fn user_agent(context: &Context) -> String {
    format!(
        "WireCatDesktop/{} ({}; {})",
        env!("CARGO_PKG_VERSION"),
        context.system["os"].as_str().unwrap_or("unknown"),
        context.system["arch"].as_str().unwrap_or("unknown")
    )
}

fn is_uuid(s: &str) -> bool {
    s.len() == 36
        && s.char_indices().all(|(i, c)| if matches!(i, 8 | 13 | 18 | 23) { c == '-' } else { c.is_ascii_hexdigit() })
}

#[cfg(test)]
mod tests {
    use super::*;

    fn draft(summary: &str, details: &str) -> Draft {
        Draft {
            summary: summary.into(),
            details: details.into(),
            expected: Some("  ".into()),
            tool: Some("tg".into()),
            idempotency_key: "00000000-0000-4000-8000-000000000000".into(),
        }
    }

    fn context() -> Context {
        Context {
            app: json!({ "name": "wirecat-desktop", "version": "0.1.0" }),
            system: json!({ "os": "Linux", "arch": "x86_64", "node": null, "npm": null }),
            tools: vec![],
            attachments: Some(json!({ "runs": [{ "tool": "tg", "runs": [
                { "phone": "+34 600 000 000", "agent": { "kind": "claude-code", "session_id": "3b8e51d2-7c4a-4f0e" } },
                { "agent": { "kind": "codex", "session_id": null } }
            ] }] })),
        }
    }

    #[test]
    fn keeps_only_command_words_and_flag_names_of_typed_runs() {
        let mut ctx = context();
        ctx.attachments = Some(json!({ "runs": [{ "tool": "tg", "runs": [{
            "command": "messages send",
            "argv": ["personal", "messages", "send", "Mom", "SYNTHETIC-CONTENT", "--limit", "5", "--chat=Family"]
        }] }] }));
        let body = body(draft("Send fails", "it fails"), &mut ctx).unwrap();
        assert_eq!(
            body["report"]["attachments"]["runs"][0]["runs"][0]["argv"],
            json!(["[redacted]", "messages", "send", "[redacted]", "[redacted]", "--limit", "[redacted]", "--chat"])
        );
    }

    #[test]
    fn masks_the_text_and_the_attachments() {
        let body = body(draft("Install fails", "mail me at a@b.com"), &mut context()).unwrap();
        assert_eq!(body["report"]["details"], "mail me at [email]");
        assert_eq!(body["report"]["expected"], Value::Null);
        assert_eq!(body["report"]["attachments"]["runs"][0]["runs"][0].get("phone"), None);
        assert_eq!(body["report"]["attachments"]["runs"][0]["runs"][0]["agent"]["session_id"], "•••");
        assert_eq!(body["report"]["attachments"]["runs"][0]["runs"][0]["agent"]["kind"], "claude-code");
        assert_eq!(body["report"]["attachments"]["runs"][0]["runs"][1]["agent"]["session_id"], Value::Null);
    }

    // Built at run time so the secret scanner does not read the fixture as a real token.
    fn fake_bot_token() -> String {
        format!("{}:{}", "123456789", ["AAH8aB3xZ", "0123456789abcdefghijklmnopq"].join("-"))
    }

    fn identifying_run() -> Value {
        json!({
            "run_id": "20261027T101500Z-messages-send-a1b2c3",
            "command": "messages send",
            "cli_command": "tg messages send",
            "status": "partial",
            "started_at": "2026-10-27T10:15:00.000Z",
            "duration_ms": 3410,
            "requests": 3,
            "events_dropped": 412,
            "error_code": "rate_limited",
            "provider_error": "FLOOD_WAIT",
            "cli_version": "0.89.0",
            "operations": ["messages.sendMessage"],
            "codes": ["rate_limited"],
            "via": "mcp-http",
            "profile": "anna-private",
            "argv": ["anna-private", "messages", "send", "Mom", "SYNTHETIC-CONTENT", "--chat=Family", "--limit", "5"],
            "directory": "/home/someone/.local/state/tg-cli/runs/2026-10-27",
            "ids": { "chat": "-1001873246510", "user_id": "555666777" },
            "trace_id": "4bf92f3577b34da6a3ce929d0e0e4736",
            "agent": {
                "kind": "mcp-client",
                "session_id": "sess-abc-123",
                "from_chat": true,
                "client": { "name": "claude-ai", "version": "1.0", "id": "3f9a1c2e" }
            },
            "mcp": { "tool": "tg_send", "connection_id": "conn-77aa", "request_id": "req-9911", "proxied": true },
            "partial": {
                "failed": 1,
                "stop_reason": "rate_limited",
                "failures": [{ "id": "-1001873246510", "stage": "send", "error_code": "rate_limited", "title": "Mom" }]
            },
            "error": {
                "class": "CliError",
                "code": "rate_limited",
                "message": "user 987654321 not in chat -1001873246510, see /home/someone/.cache/tg-cli/x.log, call +34 600 123 456",
                "http": { "method": "POST", "endpoint_template": "/bot:token/sendMessage", "status": 429, "url": "https://x/1001873246510" },
                "provider": { "key": "FLOOD_WAIT", "code": 420 },
                "causes": [{ "class": "Error", "message": format!("token {} refused", fake_bot_token()) }],
                "stack": [
                    "send (/home/someone/.local/share/pnpm/node_modules/@wirecat/tg-cli/dist/send.js:64)",
                    "run (/Users/someone/lib/node_modules/@wirecat/cli-core/dist/program.js:580)",
                    "main (C:\\Users\\someone\\AppData\\Roaming\\npm\\tg.js:9)"
                ]
            }
        })
    }

    #[test]
    fn a_report_carries_no_id_path_typed_word_or_secret_of_a_run() {
        let mut ctx = context();
        ctx.attachments = Some(json!({ "runs": [{ "tool": "tg", "runs": [identifying_run()] }] }));
        let body = body(draft("Send fails", "it fails"), &mut ctx).unwrap();
        let sent = serde_json::to_string(&body).unwrap();
        for leak in [
            "1001873246510",
            "555666777",
            "987654321",
            "someone",
            "600 123",
            "123456789:AAH",
            "3f9a1c2e",
            "conn-77aa",
            "req-9911",
            "4bf92f35",
            "sess-abc-123",
            "anna-private",
            "Mom",
            "SYNTHETIC-CONTENT",
            "Family",
        ] {
            assert!(!sent.contains(leak), "{leak} reached the report");
        }

        let run = &body["report"]["attachments"]["runs"][0]["runs"][0];
        assert_eq!(
            run["agent"],
            json!({ "kind": "mcp-client", "from_chat": true, "session_id": "•••",
            "client": { "name": "claude-ai", "version": "1.0", "id": "•••" } })
        );
        assert_eq!(
            run["mcp"],
            json!({ "tool": "tg_send", "proxied": true, "connection_id": "•••", "request_id": "•••" })
        );
        assert_eq!(run["partial"]["failures"], json!([{ "stage": "send", "error_code": "rate_limited" }]));
        assert_eq!(run["argv"][1], "messages");
        assert_eq!(run["argv"][5], "--chat");
        for (key, value) in [
            ("run_id", json!("20261027T101500Z-messages-send-a1b2c3")),
            ("status", json!("partial")),
            ("via", json!("mcp-http")),
            ("events_dropped", json!(412)),
            ("requests", json!(3)),
            ("profile", json!("•••")),
            ("trace_id", json!("•••")),
        ] {
            assert_eq!(run[key], value, "{key}");
        }
        assert_eq!(run.get("directory"), None);
        assert_eq!(
            run["error"]["http"],
            json!({ "method": "POST", "status": 429, "endpoint_template": "/bot:token/sendMessage" })
        );
        assert!(run["error"]["stack"][0].as_str().unwrap().contains("(~/.local/share/pnpm"));
        assert!(run["error"]["stack"][2].as_str().unwrap().starts_with("main (~"));
    }

    #[test]
    fn shows_in_the_dialog_the_same_runs_it_sends() {
        let shown =
            safe_runs(&json!([{ "tool": "tg", "runs": [identifying_run()] }, { "tool": "rm -rf", "runs": [] }]));
        let mut ctx = context();
        ctx.attachments = Some(json!({ "runs": shown.clone() }));
        let body = body(draft("Send fails", "it fails"), &mut ctx).unwrap();
        assert_eq!(body["report"]["attachments"]["runs"], shown);
        assert_eq!(shown.as_array().unwrap().len(), 1);
    }

    #[test]
    fn files_a_report_about_email_under_memo_and_says_so() {
        let mut d = draft("Mail import stops", "It stops after the first folder.");
        d.tool = Some("email".into());
        let body = body(d, &mut context()).unwrap();
        assert_eq!(body["report"]["tool"], "memo");
        assert!(body["report"]["details"].as_str().unwrap().starts_with("About: Email"));
    }

    #[test]
    fn refuses_empty_or_oversized_fields_and_unknown_tools() {
        assert!(body(draft("", "x"), &mut context()).is_err());
        assert!(body(draft(&"x".repeat(121), "x"), &mut context()).is_err());
        let mut d = draft("x", "x");
        d.tool = Some("rm".into());
        assert!(body(d, &mut context()).is_err());
        let mut d = draft("x", "x");
        d.idempotency_key = "--help".into();
        assert!(body(d, &mut context()).is_err());
    }

    #[test]
    fn drops_failed_runs_before_refusing_a_large_report() {
        let big =
            json!({ "summary": "x", "attachments": { "runs": ["x".repeat(MAX_BODY)], "installLog": ["npm ERR!"] } });
        let sent: Value = serde_json::from_slice(&payload(big).unwrap()).unwrap();
        assert_eq!(sent["report"]["attachments"], json!({ "installLog": ["npm ERR!"] }));
        assert!(payload(json!({ "details": "x".repeat(MAX_BODY) })).is_err());
    }

    #[test]
    fn reads_created_queued_and_failed_answers() {
        let created = json!({ "report": { "id": "r1", "issue": { "number": 12, "url": "https://github.com/WireCatLabs/wirecat-desktop/issues/12" } } });
        let sent = accepted(201, &created).unwrap();
        assert_eq!(sent.issue_number, Some(12));
        let queued = accepted(202, &json!({ "report": { "id": "r2", "issue": null } })).unwrap();
        assert_eq!(queued.issue_url, None);
        let foreign = json!({ "report": { "id": "r3", "issue": { "number": 1, "url": "https://evil.example/x" } } });
        assert_eq!(accepted(201, &foreign).unwrap().issue_url, None);
        assert!(
            accepted(422, &json!({ "error": { "message": "summary is too long" } })).unwrap_err().contains("too long")
        );
        assert!(accepted(429, &Value::Null).is_err());
    }
}
