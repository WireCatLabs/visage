use crate::catalog::{self, Tool};
use crate::run::{self, Line, RunError};
use crate::{paths, redact};
use serde::Serialize;
use serde_json::Value;
use std::time::Duration;

/// `wa` ends its history wait on SIGTERM and then answers with what it kept; this is its time to do so.
pub const GRACE: Duration = Duration::from_secs(5);
/// The code renews until someone scans it, then the phone's history can take minutes on a large account.
const TIMEOUT: Duration = Duration::from_mins(15);

/// Steps of a sign-in for the window. A QR code is a login token while it is valid: it travels on the Channel only and
/// is never written to a log, an error or a report.
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
    /// A line the tool wrote for people, masked, such as its warning before linking.
    Note {
        text: String,
    },
    Progress {
        step: Progress,
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
#[serde(rename_all = "camelCase")]
pub enum Progress {
    /// Linked; the phone is sending its history.
    History,
    /// The history is slow to come.
    Waiting,
}

#[derive(Serialize, Clone, Copy, Debug, PartialEq, Eq)]
pub struct Received {
    pub chats: u64,
    pub messages: u64,
    pub people: u64,
}

/// The running sign-in of one tool, in `Running`; its stop removes the key.
pub fn key(id: &str) -> String {
    format!("sign-in:{id}")
}

/// The catalog's words with the profile the owner chose or named; never a default one.
pub fn args(tool: &Tool, profile: &str) -> Result<Vec<String>, String> {
    let words = tool
        .sign_in
        .as_ref()
        .and_then(|s| s.qr.as_ref())
        .ok_or_else(|| format!("{} cannot sign in from the app yet", tool.name))?;
    catalog::with_profile(words, Some(profile))
}

pub fn run(tool: &Tool, args: &[String], stopped: &dyn Fn() -> bool, send: &dyn Fn(SignInEvent)) {
    let Some(bin) = paths::find(&tool.bin) else {
        return send(failed(format!("{} is not installed.", tool.name)));
    };
    let refs: Vec<&str> = args.iter().map(String::as_str).collect();
    let cmd = run::command(&bin, &refs, Some(&paths::search_path()));
    let mut parser = Parser::default();
    let mut outcome = None;
    let result = run::stream_stoppable(cmd, TIMEOUT, stopped, GRACE, |line| match parser.read(line) {
        Some(e @ (SignInEvent::Done { .. } | SignInEvent::Failed { .. })) => outcome = Some(e),
        Some(e) => send(e),
        None => {}
    });
    send(finish(&tool.name, result, outcome, stopped()));
}

/// What the run ended with. A stop during the history wait still answers `done` with what was kept; a stop before
/// that, or a kill after the grace, is `stopped`, whatever the tool said on its way out.
fn finish(
    name: &str,
    result: Result<Option<i32>, RunError>,
    outcome: Option<SignInEvent>,
    stopped: bool,
) -> SignInEvent {
    match (result, outcome) {
        (Ok(_), Some(done @ SignInEvent::Done { .. })) => done,
        (Err(RunError::Cancelled) | Ok(_), _) if stopped => SignInEvent::Stopped,
        (Ok(_), Some(failure)) => failure,
        (Ok(code), None) => failed(match code {
            Some(code) => format!("{name} stopped with exit code {code} and said nothing about the sign-in."),
            None => format!("{name} was stopped by the system before the sign-in finished."),
        }),
        (Err(RunError::TimedOut), _) => {
            failed(format!("The sign-in took longer than {} minutes.", TIMEOUT.as_secs() / 60))
        }
        (Err(e), _) => failed(format!("Could not run {name}: {e}.")),
    }
}

fn failed(message: String) -> SignInEvent {
    SignInEvent::Failed { message, code: None }
}

/// Reads the tool's lines into steps. Off a terminal the tool also prints each code as a plain drawing, with a note
/// for agents on pasting it; both are dropped here, so no form of the code reaches anything but a `qr` step.
#[derive(Default)]
pub struct Parser {
    scan: Option<String>,
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
            if value["event"] == "qr" {
                let qr = &value["qr"];
                let text = qr["text"].as_str()?.to_string();
                self.scan = qr["scan"].as_str().map(str::to_string);
                return Some(SignInEvent::Qr {
                    text,
                    expires_at: qr["expires_at"].as_str().map(str::to_string),
                    scan: self.scan.clone(),
                });
            }
            return error(&value);
        }
        if is_drawing(line) || line.starts_with("agents:") || self.scan.as_deref() == Some(line) {
            return None;
        }
        if line.starts_with("receiving history from the phone") {
            return Some(SignInEvent::Progress { step: Progress::History });
        }
        if line.starts_with("still waiting for the phone's history") {
            return Some(SignInEvent::Progress { step: Progress::Waiting });
        }
        Some(SignInEvent::Note { text: redact::text(line) })
    }
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
        return Some(SignInEvent::Done { already_linked: item["already_linked"] == true, received });
    }
    error(&value)
}

fn error(value: &Value) -> Option<SignInEvent> {
    let error = value.get("error")?;
    Some(SignInEvent::Failed {
        message: redact::text(error["message"].as_str().unwrap_or("the sign-in failed")),
        code: error["code"].as_str().map(str::to_string),
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    const DRAWING: &str = "█████████\n██ ▄▄ ▀██\n▀▀▀▀▀▀▀▀▀";
    const SCAN: &str = "scan in WhatsApp → Settings → Linked devices → Link a device";

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
    fn reads_a_whole_sign_in_into_steps() {
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
                SignInEvent::Progress { step: Progress::History },
                SignInEvent::Progress { step: Progress::Waiting },
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

    #[test]
    fn reads_the_tools_refusal_and_a_linked_profile() {
        let mut parser = Parser::default();
        let refusal = r#"{"error":{"code":"validation_error","reason":"input.required","message":"wa x session start asks questions — run it in a terminal"}}"#;
        assert_eq!(
            parser.read(Line::Err(refusal.into())),
            Some(SignInEvent::Failed {
                message: "wa x session start asks questions — run it in a terminal".into(),
                code: Some("validation_error".into())
            })
        );
        let linked = r#"{"item":{"profile":"linked","account":{"id":"1@lid","name":"Owner"},"already_linked":true}}"#;
        assert_eq!(
            parser.read(Line::Out(linked.into())),
            Some(SignInEvent::Done { already_linked: true, received: None })
        );
    }

    #[test]
    fn a_stop_is_done_only_when_the_tool_answered() {
        let done = SignInEvent::Done { already_linked: false, received: None };
        let refused = failed("cancelled".into());
        assert_eq!(finish("wa", Ok(Some(0)), Some(done.clone()), true), done);
        assert_eq!(finish("wa", Ok(Some(143)), Some(refused.clone()), true), SignInEvent::Stopped);
        assert_eq!(finish("wa", Err(RunError::Cancelled), None, true), SignInEvent::Stopped);
        assert_eq!(finish("wa", Ok(Some(2)), Some(refused.clone()), false), refused);
        assert!(matches!(finish("wa", Ok(Some(1)), None, false), SignInEvent::Failed { .. }));
        assert!(matches!(finish("wa", Err(RunError::TimedOut), None, false), SignInEvent::Failed { .. }));
    }

    #[test]
    fn runs_the_catalogs_words_for_a_profile_the_owner_named() {
        let wa = catalog::tool("wa").unwrap();
        assert_eq!(args(wa, "personal").unwrap(), ["personal", "session", "start", "qr", "--json"]);
        for bad in ["", "--help", "a;rm -rf ~", "../x y"] {
            assert!(args(wa, bad).is_err(), "{bad}");
        }
        assert!(args(catalog::tool("tg").unwrap(), "personal").is_err());
        assert!(catalog::tool("nope").is_err());
    }
}
