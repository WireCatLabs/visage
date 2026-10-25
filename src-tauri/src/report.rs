use crate::{catalog, redact, runs, system, tools};
use serde::{Deserialize, Serialize};
use serde_json::{Value, json};
use std::sync::mpsc;
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
    let tools: Vec<Value> = tools::detect_owners()
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

fn recent_failures(installed: &[Value]) -> Vec<Value> {
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
    found
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
        redact::json(a);
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
            attachments: Some(json!({ "runs": [{ "tool": "tg", "runs": [{ "phone": "+34 600 000 000" }] }] })),
        }
    }

    #[test]
    fn masks_the_text_and_the_attachments() {
        let body = body(draft("Install fails", "mail me at a@b.com"), &mut context()).unwrap();
        assert_eq!(body["report"]["details"], "mail me at [email]");
        assert_eq!(body["report"]["expected"], Value::Null);
        assert_eq!(body["report"]["attachments"]["runs"][0]["runs"][0]["phone"], "•••");
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
