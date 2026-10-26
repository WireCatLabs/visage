use crate::redact;
use crate::run::Line;
use serde::Serialize;
use serde_json::Value;

/// Steps of a sign-in for the window. A QR code, a pairing code and a sign-in link are login tokens while they are
/// valid: they travel on the Channel only and are never written to a log, an error or a report. Answers never pass
/// through here at all: they go from `sign_in_answer` straight to the tool's stdin.
#[derive(Serialize, Clone, Debug, PartialEq)]
#[serde(rename_all = "camelCase", rename_all_fields = "camelCase", tag = "event")]
pub enum SignInEvent {
    /// A new code replaces the one before it. `text` is the tool's half-block drawing; `expires_at` is null when the
    /// tool does not say.
    Qr {
        text: String,
        expires_at: Option<String>,
        scan: Option<String>,
    },
    /// A code the owner types into the phone.
    PairingCode {
        code: String,
        place: Option<String>,
        expires_at: Option<String>,
    },
    /// A page the owner approves in the browser; the tool has usually opened it already.
    OpenUrl {
        url: String,
        purpose: Option<String>,
    },
    /// The tool waits for one answer, sent with `sign_in_answer`. `secret` answers are masked in the window.
    Needs {
        field: String,
        secret: bool,
        prompt: String,
        hint: Option<String>,
    },
    /// A line the tool wrote for people, masked, such as its warning before linking.
    Note {
        text: String,
    },
    /// `history` and `waiting` are `wa`'s wait for the phone's history; other steps come with the tool's message.
    Progress {
        step: String,
        message: Option<String>,
    },
    /// The account's id and name stay in Rust.
    Done {
        already_linked: bool,
        received: Option<Received>,
    },
    Failed {
        message: String,
        code: Option<String>,
    },
    Stopped,
}

#[derive(Serialize, Clone, Copy, Debug, PartialEq, Eq)]
pub struct Received {
    pub chats: u64,
    pub messages: u64,
    pub people: u64,
}

pub const NEEDS_UPDATE: &str = "needs_update";

/// Reads the tool's lines into steps. Off a terminal the tool also prints each code as a plain drawing, with a note
/// for agents on pasting it, and the sign-in link as plain text; all are dropped here, so no form of a code or link
/// reaches anything but its own step.
#[derive(Default)]
pub struct Parser {
    scan: Option<String>,
    url: Option<String>,
}

impl Parser {
    pub fn read(&mut self, line: Line) -> Option<SignInEvent> {
        match line {
            Line::Out(l) => answer(&l),
            Line::Err(l) => self.diagnostic(&l),
        }
    }

    fn diagnostic(&mut self, line: &str) -> Option<SignInEvent> {
        // A progress line rewrites itself with carriage returns; the last state is the one that counts.
        let line = line.rsplit('\r').map(str::trim).find(|s| !s.is_empty())?;
        if line.starts_with('{') {
            let value: Value = serde_json::from_str(line).ok()?;
            return self.event(&value).or_else(|| error(&value));
        }
        if is_drawing(line)
            || line.starts_with("agents:")
            || self.scan.as_deref() == Some(line)
            || self.url.as_deref().is_some_and(|url| line.contains(url))
            // max's success line names the account, which stays in Rust.
            || line.starts_with("logged in as ")
        {
            return None;
        }
        if line.starts_with("receiving history from the phone") {
            return Some(progress("history"));
        }
        if line.starts_with("still waiting for the phone's history") {
            return Some(progress("waiting"));
        }
        Some(SignInEvent::Note { text: redact::text(line) })
    }

    fn event(&mut self, value: &Value) -> Option<SignInEvent> {
        let text = |k: &str| value[k].as_str().map(str::to_string);
        match value["event"].as_str()? {
            "qr" => {
                let qr = &value["qr"];
                self.scan = qr["scan"].as_str().map(str::to_string);
                Some(SignInEvent::Qr {
                    text: qr["text"].as_str()?.to_string(),
                    expires_at: qr["expires_at"].as_str().map(str::to_string),
                    scan: self.scan.clone(),
                })
            }
            "pairing_code" => Some(SignInEvent::PairingCode {
                code: text("code")?,
                place: text("where"),
                expires_at: text("expires_at"),
            }),
            "open_url" => {
                let url = text("url").filter(|u| u.starts_with("https://"))?;
                self.url = Some(url.clone());
                Some(SignInEvent::OpenUrl { url, purpose: text("purpose").map(|p| redact::text(&p)) })
            }
            "needs" => Some(SignInEvent::Needs {
                field: text("field")?,
                secret: value["secret"] != false,
                prompt: text("prompt")?,
                hint: text("hint"),
            }),
            "progress" => {
                Some(SignInEvent::Progress { step: text("step")?, message: text("message").map(|m| redact::text(&m)) })
            }
            _ => None,
        }
    }
}

fn progress(step: &str) -> SignInEvent {
    SignInEvent::Progress { step: step.into(), message: None }
}

fn is_drawing(line: &str) -> bool {
    line.chars().all(|c| matches!(c, '█' | '▀' | '▄' | ' '))
}

fn answer(line: &str) -> Option<SignInEvent> {
    let value: Value = serde_json::from_str(line.trim()).ok()?;
    let item = &value["item"];
    if item.is_object() {
        let count = |k: &str| item["received"][k].as_u64().unwrap_or(0);
        let received = item["received"].is_object().then(|| Received {
            chats: count("chats"),
            messages: count("messages"),
            people: count("people"),
        });
        let already = item["already_linked"] == true || item["already_logged_in"] == true;
        return Some(SignInEvent::Done { already_linked: already, received });
    }
    error(&value)
}

fn error(value: &Value) -> Option<SignInEvent> {
    let error = value.get("error")?;
    let message = error["message"].as_str().unwrap_or("the sign-in failed");
    // A tool from before cli-core's sign-in steps does not know the flag the app passes.
    if message.contains("unknown option") {
        return Some(SignInEvent::Failed {
            message: "This version cannot sign in here yet. Update it on the Tools page, or use Open terminal.".into(),
            code: Some(NEEDS_UPDATE.into()),
        });
    }
    Some(SignInEvent::Failed { message: redact::text(message), code: error["code"].as_str().map(str::to_string) })
}

#[cfg(test)]
mod tests {
    use super::*;

    const DRAWING: &str = "█████████\n██ ▄▄ ▀██\n▀▀▀▀▀▀▀▀▀";
    const SCAN: &str = "scan in WhatsApp → Settings → Linked devices → Link a device";

    fn err(lines: &[&str]) -> Vec<SignInEvent> {
        let mut parser = Parser::default();
        lines.iter().filter_map(|l| parser.read(Line::Err((*l).to_string()))).collect()
    }

    /// The stderr and stdout of `wa fresh session start qr --json` on whatsapp-cli's own fake engine.
    fn transcript() -> Vec<Line> {
        let qr = serde_json::json!({ "event": "qr", "qr": { "text": DRAWING, "expires_at": null, "scan": SCAN } });
        let mut lines: Vec<Line> = [
            "Before you link: wa is not an official WhatsApp app, and WhatsApp may ban an account that uses one.",
            "",
        ]
        .into_iter()
        .chain(DRAWING.lines())
        .chain([
            "",
            &qr.to_string(),
            "agents: paste the QR code above into the chat as a code block, exactly as printed; when a new one is printed, paste it and say the old one expired",
            SCAN,
            "receiving history from the phone; keep WhatsApp open on it. Ctrl+C stops — `serve` picks up the rest.",
            "still waiting for the phone's history — keep WhatsApp open on the phone; it can take a minute",
            "agents: `wa skill install` installs this tool's guide",
        ])
        .map(|l| Line::Err(l.to_string()))
        .collect();
        lines.push(Line::Out(
            r#"{"item":{"profile":"fresh","account":{"id":"100000000000001@lid","name":"Owner"},"already_linked":false,"received":{"chats":4,"messages":14,"people":2}},"meta":{"run_id":"r","complete":true}}"#.into(),
        ));
        lines
    }

    #[test]
    fn reads_a_whole_whatsapp_sign_in_into_steps() {
        let mut parser = Parser::default();
        let steps: Vec<_> = transcript().into_iter().filter_map(|l| parser.read(l)).collect();
        assert_eq!(
            steps,
            vec![
                SignInEvent::Note {
                    text: "Before you link: wa is not an official WhatsApp app, and WhatsApp may ban an account that uses one."
                        .into()
                },
                SignInEvent::Qr { text: DRAWING.into(), expires_at: None, scan: Some(SCAN.into()) },
                progress("history"),
                progress("waiting"),
                SignInEvent::Done {
                    already_linked: false,
                    received: Some(Received { chats: 4, messages: 14, people: 2 })
                },
            ]
        );
    }

    #[test]
    fn the_code_reaches_only_the_qr_step() {
        let mut parser = Parser::default();
        for step in transcript().into_iter().filter_map(|l| parser.read(l)) {
            let json = serde_json::to_string(&step).unwrap();
            let carries = json.contains("██ ▄▄ ▀██");
            assert_eq!(carries, matches!(step, SignInEvent::Qr { .. }), "{json}");
            assert!(!json.contains("Owner") && !json.contains("@lid"), "{json}");
        }
    }

    /// `tg x session start phone --json --answer-stdin` the first time, as the cli-core helper prints it.
    #[test]
    fn reads_telegrams_questions_and_the_link_it_opened() {
        let steps = err(&[
            r#"{"event":"open_url","url":"https://my.telegram.org/apps","purpose":"copy App api_id and App api_hash."}"#,
            r#"{"event":"needs","field":"api_id","secret":false,"prompt":"App api_id","hint":null}"#,
            r#"{"event":"needs","field":"password","secret":true,"prompt":"2FA password (not shown)","hint":"the cat"}"#,
        ]);
        assert_eq!(
            steps,
            vec![
                SignInEvent::OpenUrl {
                    url: "https://my.telegram.org/apps".into(),
                    purpose: Some("copy App api_id and App api_hash.".into())
                },
                SignInEvent::Needs { field: "api_id".into(), secret: false, prompt: "App api_id".into(), hint: None },
                SignInEvent::Needs {
                    field: "password".into(),
                    secret: true,
                    prompt: "2FA password (not shown)".into(),
                    hint: Some("the cat".into())
                },
            ]
        );
    }

    #[test]
    fn the_link_reaches_only_its_step_and_only_https_opens() {
        let url = "https://accounts.google.com/o/oauth2/v2/auth?client_id=1&state=abc";
        let steps = err(&[
            &serde_json::json!({ "event": "open_url", "url": url, "purpose": "choose the account" }).to_string(),
            &format!("Open Google sign-in: {url}"),
            r#"{"event":"open_url","url":"file:///etc/passwd","purpose":"x"}"#,
            "logged in as Owner Name",
        ]);
        assert_eq!(steps.len(), 1, "{steps:?}");
        assert!(matches!(&steps[0], SignInEvent::OpenUrl { url: u, .. } if u == url));
    }

    #[test]
    fn reads_a_pairing_code_and_the_helpers_progress() {
        let steps = err(&[
            r#"{"event":"pairing_code","code":"ABCD-EFGH","where":"WhatsApp → Linked devices","expires_at":null}"#,
            r#"{"event":"progress","step":"login","message":"logging in"}"#,
        ]);
        assert_eq!(
            steps,
            vec![
                SignInEvent::PairingCode {
                    code: "ABCD-EFGH".into(),
                    place: Some("WhatsApp → Linked devices".into()),
                    expires_at: None
                },
                SignInEvent::Progress { step: "login".into(), message: Some("logging in".into()) },
            ]
        );
    }

    #[test]
    fn reads_the_tools_refusal_a_tool_too_old_and_a_profile_already_signed_in() {
        let refusal = r#"{"error":{"code":"validation_error","reason":"input.required","message":"wa x session start asks questions — run it in a terminal"}}"#;
        assert_eq!(
            err(&[refusal]),
            vec![SignInEvent::Failed {
                message: "wa x session start asks questions — run it in a terminal".into(),
                code: Some("validation_error".into())
            }]
        );
        let old = r#"{"error":{"code":"validation_error","message":"unknown option '--answer-stdin'"}}"#;
        assert!(matches!(&err(&[old])[0], SignInEvent::Failed { code: Some(c), .. } if c == NEEDS_UPDATE));
        let mut parser = Parser::default();
        let linked = r#"{"item":{"profile":"linked","account":{"id":"1@lid","name":"Owner"},"already_linked":true}}"#;
        assert_eq!(
            parser.read(Line::Out(linked.into())),
            Some(SignInEvent::Done { already_linked: true, received: None })
        );
        let tg = r#"{"item":{"profile":"p","account":{"id":"1","name":"Owner"},"already_logged_in":true}}"#;
        assert_eq!(parser.read(Line::Out(tg.into())), Some(SignInEvent::Done { already_linked: true, received: None }));
    }
}
