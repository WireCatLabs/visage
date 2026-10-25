use crate::paths;
use std::path::Path;
use std::process::{Command, Stdio};

/// Setup flows (QR codes, phone codes, browser sign-in) belong to the CLI, so we open them
/// in the user's terminal instead of re-implementing them.
pub fn open(bin: &Path, args: &[String]) -> Result<(), String> {
    let mut line = format!("{} {}", quote(&bin.to_string_lossy()), args.join(" "));
    // The new terminal reads the user's own PATH, where an older Node may come first; a tool installed with
    // WireCat's Node.js would then start under it and fail. `env` works the same from sh, zsh and fish.
    if cfg!(unix) && crate::node::in_use().is_some() {
        line = format!("env PATH={} {line}", quote(&paths::search_path().to_string_lossy()));
    }
    launch(&line).map_err(|_| {
        format!(
            "Could not open a terminal. Run this yourself: {} {}",
            bin.file_name().unwrap_or_default().to_string_lossy(),
            args.join(" ")
        )
    })
}

/// Arguments are validated catalog words and profile names; only the binary path can hold spaces.
fn quote(s: &str) -> String {
    if cfg!(windows) { format!("\"{s}\"") } else { format!("'{}'", s.replace('\'', r"'\''")) }
}

#[cfg(target_os = "linux")]
fn launch(line: &str) -> std::io::Result<()> {
    let script = format!("{line}; echo; printf 'Press Enter to close. '; read _");
    let path = paths::search_path();
    let mut candidates: Vec<(String, Vec<&str>)> = Vec::new();
    if let Ok(t) = std::env::var("TERMINAL") {
        candidates.push((t, vec!["-e"]));
    }
    for (term, flag) in [
        ("x-terminal-emulator", vec!["-e"]),
        ("gnome-terminal", vec!["--"]),
        ("ptyxis", vec!["--"]),
        ("konsole", vec!["-e"]),
        ("xfce4-terminal", vec!["-x"]),
        ("kitty", vec![]),
        ("alacritty", vec!["-e"]),
        ("wezterm", vec!["start", "--"]),
        ("foot", vec![]),
        ("xterm", vec!["-e"]),
    ] {
        candidates.push((term.to_string(), flag));
    }
    for (term, flag) in candidates {
        let Some(exe) = paths::find(&term) else { continue };
        let spawned = Command::new(exe)
            .args(flag)
            .args(["sh", "-c", &script])
            .env("PATH", &path)
            .stdin(Stdio::null())
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .spawn();
        if spawned.is_ok() {
            return Ok(());
        }
    }
    Err(std::io::Error::other("no terminal found"))
}

#[cfg(target_os = "macos")]
fn launch(line: &str) -> std::io::Result<()> {
    let escaped = line.replace('\\', "\\\\").replace('"', "\\\"");
    Command::new("osascript")
        .args([
            "-e",
            &format!("tell application \"Terminal\" to do script \"{escaped}\""),
            "-e",
            "tell application \"Terminal\" to activate",
        ])
        .spawn()
        .map(|_| ())
}

// `start` reads its first quoted argument as the window title, and cmd does not understand Rust's
// backslash-escaped quotes, so the command line is passed raw.
#[cfg(windows)]
fn launch(line: &str) -> std::io::Result<()> {
    use std::os::windows::process::CommandExt;
    Command::new("cmd")
        .raw_arg(format!("/c start \"WireCat\" cmd /k {line}"))
        .env("PATH", paths::search_path())
        .spawn()
        .map(|_| ())
}
