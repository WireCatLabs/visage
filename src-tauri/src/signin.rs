use crate::catalog::{self, Tool};
use crate::paths;
use crate::run::{self, RunError};
use crate::signin_steps::Parser;
pub use crate::signin_steps::SignInEvent;
use std::collections::HashMap;
use std::io::Write;
use std::process::ChildStdin;
use std::sync::{Mutex, OnceLock};
use std::time::Duration;

/// `wa` ends its history wait on SIGTERM and then answers with what it kept; this is its time to do so.
pub const GRACE: Duration = Duration::from_secs(5);
/// The code renews until someone scans it, then the phone's history can take minutes on a large account; a code sent
/// by Telegram or a page approved in the browser fits inside it too.
const TIMEOUT: Duration = Duration::from_mins(15);

pub type Answer = zeroize::Zeroizing<String>;

/// The running sign-in of one tool, in `Running`; its stop removes the key.
pub fn key(id: &str) -> String {
    format!("sign-in:{id}")
}

/// Each running sign-in's stdin, open for its answers; dropped, and so closed, when the run ends.
fn answers() -> &'static Mutex<HashMap<String, ChildStdin>> {
    static A: OnceLock<Mutex<HashMap<String, ChildStdin>>> = OnceLock::new();
    A.get_or_init(Mutex::default)
}

/// The catalog's words for the method with the profile the owner chose or named; never a default one.
pub fn args(tool: &Tool, method: &str, profile: &str) -> Result<Vec<String>, String> {
    let words = tool
        .sign_in
        .as_ref()
        .and_then(|s| s.methods.iter().find(|m| m.id == method))
        .map(|m| &m.words)
        .ok_or_else(|| format!("{} cannot sign in from the app this way", tool.name))?;
    catalog::with_profile(words, Some(profile))
}

/// Writes one answer and a newline to the running sign-in. The error never repeats the answer: it may reach the
/// window's error list.
pub fn answer(id: &str, value: &Answer) -> Result<(), String> {
    let mut kept = answers().lock().unwrap();
    let stdin = kept.get_mut(&key(id)).ok_or("The sign-in has already ended.")?;
    stdin
        .write_all(value.as_bytes())
        .and_then(|()| stdin.write_all(b"\n"))
        .and_then(|()| stdin.flush())
        .map_err(|_| "The tool stopped before it read the answer.".to_string())
}

pub fn run(tool: &Tool, args: &[String], stopped: &dyn Fn() -> bool, send: &dyn Fn(SignInEvent)) {
    let Some(bin) = paths::find(&tool.bin) else {
        return send(failed(format!("{} is not installed.", tool.name)));
    };
    let refs: Vec<&str> = args.iter().map(String::as_str).collect();
    let cmd = run::command(&bin, &refs, Some(&paths::search_path()));
    let mut parser = Parser::default();
    let mut outcome = None;
    let k = key(&tool.id);
    let result = run::stream_stoppable(
        cmd,
        TIMEOUT,
        stopped,
        GRACE,
        |stdin| {
            answers().lock().unwrap().insert(k.clone(), stdin);
        },
        |line| match parser.read(line) {
            Some(e @ (SignInEvent::Done { .. } | SignInEvent::Failed { .. })) => outcome = Some(e),
            Some(e) => send(e),
            None => {}
        },
    );
    answers().lock().unwrap().remove(&k);
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

#[cfg(test)]
mod tests {
    use super::*;

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
    fn runs_the_catalogs_words_for_a_method_and_a_profile_the_owner_named() {
        let wa = catalog::tool("wa").unwrap();
        assert_eq!(args(wa, "qr", "personal").unwrap(), ["personal", "session", "start", "qr", "--json"]);
        let tg = catalog::tool("tg").unwrap();
        assert_eq!(
            args(tg, "phone", "work").unwrap(),
            ["work", "session", "start", "phone", "--json", "--answer-stdin"]
        );
        for bad in ["", "--help", "a;rm -rf ~", "../x y"] {
            assert!(args(wa, "qr", bad).is_err(), "{bad}");
        }
        assert!(args(wa, "phone", "personal").is_err());
        assert!(args(catalog::tool("memo").unwrap(), "qr", "personal").is_err());
        assert!(catalog::tool("nope").is_err());
    }

    #[test]
    fn an_answer_to_no_running_sign_in_fails_without_repeating_it() {
        let error = answer("drive", &Answer::new("not-a-real-password".into())).unwrap_err();
        assert!(!error.contains("not-a-real-password"), "{error}");
    }

    #[cfg(unix)]
    #[test]
    fn answers_reach_the_tool_one_line_each() {
        let tool = catalog::tool("zm").unwrap();
        let k = key(&tool.id);
        let cmd = run::command(
            std::path::Path::new("sh"),
            &[
                "-c",
                r#"echo '{"event":"needs","field":"code","secret":false,"prompt":"code"}' >&2; read a; echo "{\"item\":{\"len\":${#a}}}""#,
            ],
            None,
        );
        let mut seen = Vec::new();
        let result = run::stream_stoppable(
            cmd,
            Duration::from_secs(10),
            || false,
            GRACE,
            |stdin| {
                answers().lock().unwrap().insert(k.clone(), stdin);
            },
            |line| {
                let mut parser = Parser::default();
                if let Some(e) = parser.read(line) {
                    if matches!(e, SignInEvent::Needs { .. }) {
                        answer("zm", &Answer::new("12345".into())).unwrap();
                    }
                    seen.push(e);
                }
            },
        );
        answers().lock().unwrap().remove(&k);
        assert_eq!(result.unwrap(), Some(0));
        assert!(matches!(seen.last(), Some(SignInEvent::Done { .. })), "{seen:?}");
    }
}
