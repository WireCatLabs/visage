use crate::{catalog, redact, runs, system, tools};
use serde::{Deserialize, Serialize};
use serde_json::{Value, json};
use std::time::Duration;

// The contract lives in docs/dev/report-api.md; keep both in step.
const DEFAULT_API: &str = "https://api.wirecat.dev";
const RUNS_PER_TOOL: u32 = 20;
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

pub fn context(attach_logs: bool) -> Context {
    let readiness = system::readiness();
    let tools: Vec<Value> = tools::detect_all()
        .into_iter()
        .filter_map(|t| {
            let first = t.installs.first()?;
            Some(json!({ "id": t.id, "version": first.version, "manager": first.manager }))
        })
        .collect();
    let attachments = attach_logs.then(|| json!({ "runs": recent_failures(&tools) }));
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
    installed
        .iter()
        .filter_map(|t| catalog::tool(t["id"].as_str()?).ok())
        .filter(|tool| tool.runs.is_some())
        .filter_map(|tool| {
            let page = runs::list(tool, Some("status:failed"), RUNS_PER_TOOL, 1).ok()?;
            Some(json!({ "tool": tool.id, "runs": page["items"] }))
        })
        .collect()
}

pub fn send(draft: Draft, mut context: Context) -> Result<Sent, String> {
    let body = body(draft, &mut context)?;
    let key = body["idempotencyKey"].as_str().unwrap_or_default().to_string();
    let payload = json!({ "report": body["report"] });
    let bytes = serde_json::to_vec(&payload).map_err(|e| e.to_string())?;
    if bytes.len() > MAX_BODY {
        return Err("The report is too large. Send it without logs.".into());
    }

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

fn body(draft: Draft, context: &mut Context) -> Result<Value, String> {
    let summary = redact::text(draft.summary.trim());
    let details = redact::text(draft.details.trim());
    if summary.is_empty() || summary.chars().count() > 120 {
        return Err("The summary needs 1 to 120 characters.".into());
    }
    if details.is_empty() || details.chars().count() > 10_000 {
        return Err("The description needs 1 to 10 000 characters.".into());
    }
    if let Some(tool) = &draft.tool {
        catalog::tool(tool)?;
    }
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
            "tool": draft.tool,
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
    fn reads_created_queued_and_failed_answers() {
        let created = json!({ "report": { "id": "r1", "issue": { "number": 12, "url": "https://github.com/WireCatLabs/visage/issues/12" } } });
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
