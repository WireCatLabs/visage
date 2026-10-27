use crate::catalog;
use std::io::{BufRead, BufReader, Read, Write};
use std::path::Path;
use std::process::{Child, ChildStdin, Command, Stdio};
use std::sync::atomic::{AtomicUsize, Ordering};
use std::sync::{Condvar, Mutex, OnceLock, mpsc};
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

const AGENT_ENV: [&str; 16] = [
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
    "HERMES_AGENT",
    "OPENCLAW_SHELL",
    "OPENCLAW_CHANNEL_CONTEXT",
    "OPENCLAW_SUBAGENT_EXEC",
    "OPENCLAW_CLI",
    "WIRECAT_HOLDER",
];

/// Hermes passes each chat's session to its commands as a family (`HERMES_SESSION_ID`, `_PLATFORM`, `_CHAT_ID`,
/// `_TOKEN__…`), and new members appear between releases.
const AGENT_ENV_PREFIXES: [&str; 1] = ["HERMES_SESSION_"];

fn agent_env(names: impl Iterator<Item = std::ffi::OsString>) -> Vec<std::ffi::OsString> {
    let by_prefix = names.filter(|n| n.to_str().is_some_and(|n| AGENT_ENV_PREFIXES.iter().any(|p| n.starts_with(p))));
    AGENT_ENV.iter().map(std::ffi::OsString::from).chain(by_prefix).collect()
}

/// cli-core records a run with `via: "desktop"` and keeps it only when it fails, so the app's own reads (runs list,
/// doctor, status) do not fill the owner's logs.
pub const CALLER_ENV: &str = "WIRECAT_CALLER";

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
    for name in agent_env(std::env::vars_os().map(|(k, _)| k)) {
        cmd.env_remove(name);
    }
    cmd.env(CALLER_ENV, "desktop");
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

static STARTED: AtomicUsize = AtomicUsize::new(0);

/// Each tool spends most of its start loading its program, so thirty at once only make all of them slow; a page's
/// first answers come sooner when the rest wait. Installs stream and are never held back.
struct Slot;

static SLOTS: (Mutex<usize>, Condvar) = (Mutex::new(0), Condvar::new());

fn slots() -> usize {
    static N: OnceLock<usize> = OnceLock::new();
    *N.get_or_init(|| (thread::available_parallelism().map_or(8, std::num::NonZero::get) / 2).max(4))
}

impl Slot {
    fn take() -> Slot {
        let (busy, freed) = &SLOTS;
        let mut n = freed.wait_while(busy.lock().unwrap(), |n| *n >= slots()).unwrap();
        *n += 1;
        Slot
    }
}

impl Drop for Slot {
    fn drop(&mut self) {
        let (busy, freed) = &SLOTS;
        *busy.lock().unwrap() -= 1;
        freed.notify_one();
    }
}

/// Processes `run` has started since launch; what the page-load measurements count.
#[cfg(test)]
pub fn started() -> usize {
    STARTED.load(Ordering::Relaxed)
}

/// `WIRECAT_TIMING=1` prints each run's program and duration to stderr. Arguments are left out: the first one is
/// often a profile name.
fn timing() -> bool {
    static ON: OnceLock<bool> = OnceLock::new();
    *ON.get_or_init(|| std::env::var_os("WIRECAT_TIMING").is_some_and(|v| v == "1"))
}

/// Runs to completion and captures output; kills the whole process group on timeout.
pub fn run(
    program: &Path,
    args: &[&str],
    path_env: Option<&std::ffi::OsStr>,
    timeout: Duration,
) -> Result<Output, RunError> {
    run_command(command(program, args, path_env), timeout)
}

/// `run`, for a `command()` the caller adjusted first.
pub fn run_command(cmd: Command, timeout: Duration) -> Result<Output, RunError> {
    let started = Instant::now();
    let name = Path::new(cmd.get_program()).file_name().unwrap_or_default().to_string_lossy().into_owned();
    let args = cmd.get_args().len();
    let result = run_inner(cmd, timeout);
    if timing() {
        eprintln!("[wirecat timing] {name} ({args} args) {} ms", started.elapsed().as_millis());
    }
    result
}

fn run_inner(cmd: Command, timeout: Duration) -> Result<Output, RunError> {
    let _slot = Slot::take();
    STARTED.fetch_add(1, Ordering::Relaxed);
    let mut child = spawn(cmd)?;
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
    on_line: impl FnMut(Line),
) -> Result<Option<i32>, RunError> {
    stream_with_input(cmd, None, timeout, cancelled, on_line)
}

/// `stream`, with `input` written to the program's stdin and stdin then closed, so a tool reading to the end gets all
/// of it. The way to hand a tool a secret: arguments show in the process list, and children inherit the environment.
pub fn stream_with_input(
    cmd: Command,
    input: Option<&[u8]>,
    timeout: Duration,
    cancelled: impl Fn() -> bool,
    on_line: impl FnMut(Line),
) -> Result<Option<i32>, RunError> {
    stream_inner(cmd, input.map_or(Stdin::Closed, Stdin::Bytes), timeout, cancelled, None, on_line)
}

/// `stream`, where a stop asks before it kills: SIGTERM to the program alone, then `grace` for it to finish and give
/// its answer, whose lines still arrive; only then the whole group is killed. The program's own children (the
/// `WhatsApp` engine) are left to it, so it closes them cleanly. `Ok` with the exit code when it ended within the grace.
/// `answers` receives the program's stdin, open, to write answers to while it runs.
pub fn stream_stoppable(
    cmd: Command,
    timeout: Duration,
    stopped: impl Fn() -> bool,
    grace: Duration,
    answers: impl FnOnce(ChildStdin),
    on_line: impl FnMut(Line),
) -> Result<Option<i32>, RunError> {
    stream_inner(cmd, Stdin::Kept(Box::new(answers)), timeout, stopped, Some(grace), on_line)
}

enum Stdin<'a> {
    Closed,
    Bytes(&'a [u8]),
    Kept(Box<dyn FnOnce(ChildStdin) + 'a>),
}

fn stream_inner(
    mut cmd: Command,
    input: Stdin<'_>,
    timeout: Duration,
    cancelled: impl Fn() -> bool,
    grace: Option<Duration>,
    mut on_line: impl FnMut(Line),
) -> Result<Option<i32>, RunError> {
    if !matches!(input, Stdin::Closed) {
        cmd.stdin(Stdio::piped());
    }
    let mut child = spawn(cmd)?;
    match (input, child.stdin.take()) {
        // A tool that exits before reading closes the pipe; its own answer says why.
        (Stdin::Bytes(bytes), Some(mut stdin)) => {
            let _ = stdin.write_all(bytes);
        }
        (Stdin::Kept(keep), Some(stdin)) => keep(stdin),
        _ => {}
    }
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

    let mut deadline = Instant::now() + timeout;
    let mut stopping = false;
    loop {
        while let Ok(line) = rx.try_recv() {
            on_line(line);
        }
        if !stopping && cancelled() {
            let Some(grace) = grace else {
                kill(&mut child);
                return Err(RunError::Cancelled);
            };
            stopping = true;
            deadline = Instant::now() + if terminate(&child) { grace } else { Duration::ZERO };
        }
        if Instant::now() > deadline {
            kill(&mut child);
            return Err(if stopping { RunError::Cancelled } else { RunError::TimedOut });
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
                // A launcher that ran the program as its child, not in its place, ends on SIGTERM and leaves it running.
                if stopping {
                    kill(&mut child);
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

/// Asks the program itself to stop. False where no such request exists (Windows), so the caller kills at once.
#[allow(unsafe_code)] // libc::kill with SIGTERM on our own child; std only sends SIGKILL
fn terminate(child: &Child) -> bool {
    #[cfg(unix)]
    if let Ok(pid) = i32::try_from(child.id()) {
        // SAFETY: plain syscall with the pid of a child we spawned; no memory is touched.
        unsafe {
            libc::kill(pid, libc::SIGTERM);
        }
        return true;
    }
    let _ = child;
    false
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
        for name in ["CLAUDECODE", "CLAUDE_CODE_SESSION_ID", "CODEX_THREAD_ID", "WIRECAT_HOLDER", "OPENCLAW_SHELL"] {
            assert!(removed.contains(&std::ffi::OsString::from(name)), "{name}");
        }
    }

    #[test]
    fn tells_the_tool_the_run_is_desktops_own_and_still_drops_the_agents_variables() {
        let cmd = command(Path::new("tg"), &[], None);
        let envs: Vec<_> = cmd.get_envs().collect();
        assert!(envs.contains(&(std::ffi::OsStr::new(CALLER_ENV), Some(std::ffi::OsStr::new("desktop")))));
        for name in ["CLAUDE_CODE_SESSION_ID", "CODEX_THREAD_ID", "OPENCODE_SESSION_ID"] {
            assert!(envs.contains(&(std::ffi::OsStr::new(name), None)), "{name}");
        }
    }

    #[test]
    fn drops_every_hermes_session_variable_and_nothing_else() {
        let present = ["HERMES_SESSION_ID", "HERMES_SESSION_TOKEN__X", "HERMES_HOME", "PATH", "HERMES_AGENT_TIMEOUT"];
        let removed = agent_env(present.iter().map(std::ffi::OsString::from));
        for name in ["HERMES_SESSION_ID", "HERMES_SESSION_TOKEN__X", "HERMES_AGENT", "OPENCLAW_CLI", "AI_AGENT"] {
            assert!(removed.contains(&std::ffi::OsString::from(name)), "{name}");
        }
        for name in ["HERMES_HOME", "PATH", "HERMES_AGENT_TIMEOUT"] {
            assert!(!removed.contains(&std::ffi::OsString::from(name)), "{name}");
        }
    }

    #[cfg(unix)]
    #[test]
    fn hands_the_input_on_stdin_and_closes_it() {
        let mut lines = Vec::new();
        let code = stream_with_input(
            command(Path::new("cat"), &[], None),
            Some(b"secret words"),
            Duration::from_secs(10),
            || false,
            |l| {
                if let Line::Out(l) = l {
                    lines.push(l);
                }
            },
        )
        .unwrap();
        assert_eq!((code, lines), (Some(0), vec!["secret words".to_string()]));
    }

    #[cfg(unix)]
    #[test]
    fn keeps_stdin_open_for_answers_written_while_the_program_runs() {
        let kept = Mutex::new(None);
        let mut lines = Vec::new();
        let code = stream_stoppable(
            command(Path::new("sh"), &["-c", "echo asks; read a; echo got:$a; echo asks; read b; echo got:$b"], None),
            Duration::from_secs(10),
            || false,
            Duration::from_secs(1),
            |stdin| *kept.lock().unwrap() = Some(stdin),
            |l| {
                if let Line::Out(l) = l {
                    if l == "asks" {
                        let mut stdin = kept.lock().unwrap();
                        let _ = writeln!(stdin.as_mut().unwrap(), "answer{}", lines.len() / 2 + 1);
                    }
                    lines.push(l);
                }
            },
        )
        .unwrap();
        assert_eq!(code, Some(0));
        assert_eq!(lines, ["asks", "got:answer1", "asks", "got:answer2"]);
    }

    #[cfg(unix)]
    fn stop_after_ready(script: &str, grace: Duration) -> (Result<Option<i32>, RunError>, Vec<String>, Duration) {
        let ready = std::sync::atomic::AtomicBool::new(false);
        let mut lines = Vec::new();
        let started = Instant::now();
        let result = stream_stoppable(
            command(Path::new("sh"), &["-c", script], None),
            Duration::from_secs(20),
            || ready.load(Ordering::Relaxed),
            grace,
            drop,
            |l| {
                if let Line::Out(l) = l {
                    ready.store(true, Ordering::Relaxed);
                    lines.push(l);
                }
            },
        );
        (result, lines, started.elapsed())
    }

    #[cfg(unix)]
    #[test]
    fn a_stop_lets_the_program_answer_before_it_ends() {
        let (result, lines, _) = stop_after_ready(
            "trap 'echo kept; exit 0' TERM; echo ready; while :; do sleep 0.05; done",
            Duration::from_secs(10),
        );
        assert_eq!(result.unwrap(), Some(0));
        assert_eq!(lines, vec!["ready", "kept"]);
    }

    #[cfg(unix)]
    #[test]
    #[allow(unsafe_code)]
    fn a_stop_leaves_nothing_behind_a_launcher_that_did_not_exec() {
        let (result, lines, _) = stop_after_ready(
            "sleep 30 & echo $!; trap 'exit 0' TERM; while :; do sleep 0.05; done",
            Duration::from_secs(10),
        );
        assert_eq!(result.unwrap(), Some(0));
        let child: i32 = lines[0].parse().unwrap();
        thread::sleep(Duration::from_millis(200));
        // SAFETY: signal 0 only asks whether the pid exists.
        assert_eq!(unsafe { libc::kill(child, 0) }, -1, "the launcher's child still runs");
    }

    #[cfg(unix)]
    #[test]
    fn a_stop_kills_a_program_that_ignores_it_after_the_grace() {
        let (result, _, took) =
            stop_after_ready("trap '' TERM; echo ready; while :; do sleep 0.05; done", Duration::from_millis(300));
        assert!(matches!(result, Err(RunError::Cancelled)));
        assert!(took < Duration::from_secs(5), "{took:?}");
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
