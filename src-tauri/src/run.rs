use crate::catalog;
use std::io::{BufRead, BufReader, Read};
use std::path::Path;
use std::process::{Child, Command, Stdio};
use std::sync::mpsc;
use std::thread;
use std::time::{Duration, Instant};

pub struct Output {
    pub code: Option<i32>,
    pub stdout: String,
    pub stderr: String,
}

impl Output {
    /// The tool's JSON answer. Tools print it on stdout, or on stderr for an error, and a runtime warning or a note
    /// for people may come before or after it, so a line that starts a JSON object is accepted too.
    pub fn json(&self) -> Option<serde_json::Value> {
        [&self.stdout, &self.stderr].into_iter().find_map(|s| {
            first_value(s).or_else(|| s.lines().filter(|l| l.trim_start().starts_with('{')).find_map(first_value))
        })
    }
}

fn first_value(s: &str) -> Option<serde_json::Value> {
    serde_json::Deserializer::from_str(s).into_iter::<serde_json::Value>().next()?.ok()
}

#[derive(Debug)]
pub enum RunError {
    NotFound,
    Permission,
    TimedOut,
    Cancelled,
    Other(String),
}

impl std::fmt::Display for RunError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            RunError::NotFound => write!(f, "the program was not found"),
            RunError::Permission => write!(f, "the program is not allowed to run"),
            RunError::TimedOut => write!(f, "the program did not finish in time"),
            RunError::Cancelled => write!(f, "cancelled"),
            RunError::Other(e) => write!(f, "{e}"),
        }
    }
}

const AGENT_ENV: [&str; 11] = [
    "AI_AGENT",
    "CLAUDECODE",
    "CLAUDE_CODE_SESSION_ID",
    "CODEX_THREAD_ID",
    "CODEX_SESSION_ID",
    "CODEX_SANDBOX",
    "GEMINI_CLI",
    "OPENCODE",
    "OPENCODE_SESSION_ID",
    "CURSOR_AGENT",
    "WIRECAT_HOLDER",
];

pub fn command(program: &Path, args: &[&str], path_env: Option<&std::ffi::OsStr>) -> Command {
    let mut cmd = Command::new(program);
    cmd.args(args)
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .env("NO_COLOR", "1")
        .env("FORCE_COLOR", "0")
        .env("npm_config_update_notifier", "false");
    // A `<PREFIX>_PROFILE` in the app's own environment would let a tool pick a profile the owner never chose here.
    for prefix in catalog::catalog().tools.iter().map(|t| t.storage.env.as_str()) {
        cmd.env_remove(format!("{prefix}_PROFILE"));
    }
    // An app started from an agent's terminal would otherwise have its own runs recorded, and its writes authored, as
    // that agent's session (cli-core `agentOf` and `holderOf` read these).
    for name in AGENT_ENV {
        cmd.env_remove(name);
    }
    if let Some(p) = path_env {
        cmd.env("PATH", p);
    }
    #[cfg(unix)]
    {
        use std::os::unix::process::CommandExt;
        cmd.process_group(0);
    }
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x0800_0000;
        cmd.creation_flags(CREATE_NO_WINDOW);
    }
    cmd
}

fn spawn(mut cmd: Command) -> Result<Child, RunError> {
    cmd.spawn().map_err(|e| match e.kind() {
        std::io::ErrorKind::NotFound => RunError::NotFound,
        std::io::ErrorKind::PermissionDenied => RunError::Permission,
        _ => RunError::Other(e.to_string()),
    })
}

/// Runs to completion and captures output; kills the whole process group on timeout.
pub fn run(
    program: &Path,
    args: &[&str],
    path_env: Option<&std::ffi::OsStr>,
    timeout: Duration,
) -> Result<Output, RunError> {
    let mut child = spawn(command(program, args, path_env))?;
    let mut out = child.stdout.take().unwrap();
    let mut err = child.stderr.take().unwrap();
    let out_t = thread::spawn(move || {
        let mut s = String::new();
        let _ = out.read_to_string(&mut s);
        s
    });
    let err_t = thread::spawn(move || {
        let mut s = String::new();
        let _ = err.read_to_string(&mut s);
        s
    });
    let status = wait(&mut child, timeout, || false)?;
    Ok(Output { code: status, stdout: out_t.join().unwrap_or_default(), stderr: err_t.join().unwrap_or_default() })
}

pub enum Line {
    Out(String),
    Err(String),
}

/// Streams output line by line to `on_line` and stops early when `cancelled` turns true.
pub fn stream(
    cmd: Command,
    timeout: Duration,
    cancelled: impl Fn() -> bool,
    mut on_line: impl FnMut(Line),
) -> Result<Option<i32>, RunError> {
    let mut child = spawn(cmd)?;
    let (tx, rx) = mpsc::channel();
    let out = child.stdout.take().unwrap();
    let err = child.stderr.take().unwrap();
    let tx2 = tx.clone();
    thread::spawn(move || {
        BufReader::new(out).lines().map_while(Result::ok).for_each(|l| {
            let _ = tx.send(Line::Out(l));
        });
    });
    thread::spawn(move || {
        BufReader::new(err).lines().map_while(Result::ok).for_each(|l| {
            let _ = tx2.send(Line::Err(l));
        });
    });

    let deadline = Instant::now() + timeout;
    loop {
        while let Ok(line) = rx.try_recv() {
            on_line(line);
        }
        if cancelled() {
            kill(&mut child);
            return Err(RunError::Cancelled);
        }
        if Instant::now() > deadline {
            kill(&mut child);
            return Err(RunError::TimedOut);
        }
        match child.try_wait() {
            Ok(Some(status)) => {
                // A postinstall may leave a child holding the pipes open; waiting for EOF would hang forever.
                let drain_until = Instant::now() + Duration::from_secs(2);
                while let Some(left) = drain_until.checked_duration_since(Instant::now()) {
                    match rx.recv_timeout(left) {
                        Ok(line) => on_line(line),
                        Err(_) => break,
                    }
                }
                return Ok(status.code());
            }
            Ok(None) => thread::sleep(Duration::from_millis(40)),
            Err(e) => return Err(RunError::Other(e.to_string())),
        }
    }
}

fn wait(child: &mut Child, timeout: Duration, cancelled: impl Fn() -> bool) -> Result<Option<i32>, RunError> {
    let deadline = Instant::now() + timeout;
    loop {
        if let Some(status) = child.try_wait().map_err(|e| RunError::Other(e.to_string()))? {
            return Ok(status.code());
        }
        if cancelled() {
            kill(child);
            return Err(RunError::Cancelled);
        }
        if Instant::now() > deadline {
            kill(child);
            return Err(RunError::TimedOut);
        }
        thread::sleep(Duration::from_millis(25));
    }
}

/// npm starts its own children, so killing only the direct child would leave the install running.
#[allow(unsafe_code)] // libc::kill on our own process group; std has no group kill
fn kill(child: &mut Child) {
    #[cfg(unix)]
    if let Ok(pgid) = i32::try_from(child.id()) {
        // SAFETY: plain syscall with a pid we spawned with process_group(0); no memory is touched.
        unsafe {
            libc::kill(-pgid, libc::SIGTERM);
        }
    }
    #[cfg(windows)]
    {
        let _ = Command::new("taskkill").args(["/PID", &child.id().to_string(), "/T", "/F"]).output();
    }
    let _ = child.kill();
    let _ = child.wait();
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn never_hands_a_tool_a_profile_from_the_environment() {
        let cmd = command(Path::new("tg"), &[], None);
        let removed: Vec<_> = cmd.get_envs().filter(|(_, v)| v.is_none()).map(|(k, _)| k.to_owned()).collect();
        for prefix in ["TG", "MAX", "WA", "ZM", "DRIVE", "MEMO"] {
            assert!(removed.contains(&std::ffi::OsString::from(format!("{prefix}_PROFILE"))), "{prefix}_PROFILE");
        }
        for name in ["CLAUDECODE", "CLAUDE_CODE_SESSION_ID", "CODEX_THREAD_ID", "WIRECAT_HOLDER"] {
            assert!(removed.contains(&std::ffi::OsString::from(name)), "{name}");
        }
    }

    #[test]
    fn reads_the_json_answer_around_notes_and_warnings() {
        let out = |stdout: &str, stderr: &str| Output { code: Some(2), stdout: stdout.into(), stderr: stderr.into() };
        assert_eq!(out("{\"items\":[]}\nnothing recorded", "").json().unwrap()["items"], serde_json::json!([]));
        let warned =
            out("", "(node:12) ExperimentalWarning: SQLite\n{\"error\":{\"message\":\"unknown command 'runs'\"}}");
        assert_eq!(warned.json().unwrap()["error"]["message"], "unknown command 'runs'");
        assert!(out("not json", "").json().is_none());
    }
}
