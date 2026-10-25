use crate::paths;
use serde::Serialize;
use std::path::{Path, PathBuf};

const START: &str = "# Added by WireCat Desktop: Node.js for WireCat tools. Delete this block to undo.";
const END: &str = "# End of WireCat Desktop block";

/// What "Add to PATH" would do, shown in full before anything is written.
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PathPlan {
    /// `bash`, `zsh`, `fish`, `windows`, or the shell's own name when we do not edit its files.
    pub shell: String,
    /// The file the line goes into (`~`-shortened); for Windows, the registry value.
    pub file: Option<String>,
    pub line: String,
    pub added: bool,
    /// False when the user has to add the line themselves (an unknown shell, an unusual folder name).
    pub automatic: bool,
}

#[derive(Debug, PartialEq, Clone, Copy)]
enum Shell {
    Bash,
    Zsh,
    Fish,
    Other,
}

struct Env {
    macos: bool,
    shell: Option<String>,
    home: PathBuf,
    zdotdir: Option<PathBuf>,
    xdg_config: Option<PathBuf>,
}

impl Env {
    fn current() -> Option<Self> {
        let abs = |v: &str| std::env::var_os(v).map(PathBuf::from).filter(|p| p.is_absolute());
        Some(Self {
            macos: cfg!(target_os = "macos"),
            shell: std::env::var("SHELL").ok(),
            home: paths::home()?,
            zdotdir: abs("ZDOTDIR"),
            xdg_config: abs("XDG_CONFIG_HOME"),
        })
    }

    fn shell(&self) -> (Shell, String) {
        let name = self.shell.as_deref().and_then(|s| Path::new(s).file_name()?.to_str()).unwrap_or("sh");
        let kind = match name {
            "bash" => Shell::Bash,
            "zsh" => Shell::Zsh,
            "fish" => Shell::Fish,
            _ => Shell::Other,
        };
        (kind, name.to_string())
    }

    /// Terminal emulators on Linux start interactive non-login shells (`.bashrc`); macOS Terminal starts login shells,
    /// and login bash reads `.bash_profile` instead. zsh reads `.zshrc` in both. fish gets its own file in `conf.d`.
    fn file(&self, shell: Shell) -> Option<PathBuf> {
        match shell {
            Shell::Bash if self.macos => Some(self.home.join(".bash_profile")),
            Shell::Bash => Some(self.home.join(".bashrc")),
            Shell::Zsh => Some(self.zdotdir.as_ref().unwrap_or(&self.home).join(".zshrc")),
            Shell::Fish => Some(
                self.xdg_config
                    .clone()
                    .unwrap_or_else(|| self.home.join(".config"))
                    .join("fish/conf.d/wirecat-desktop.fish"),
            ),
            Shell::Other => None,
        }
    }

    /// `$HOME/...` keeps the line readable and correct if the home folder is ever renamed. `None` when the folder
    /// holds a character that would need escaping inside double quotes; then the user adds it by hand.
    fn line(&self, shell: Shell, bin: &Path) -> (String, bool) {
        let raw = bin.to_string_lossy();
        let shown = match bin.strip_prefix(&self.home) {
            Ok(rest) => format!("$HOME/{}", rest.to_string_lossy()),
            Err(_) => raw.to_string(),
        };
        let safe = !raw.chars().any(|c| matches!(c, '"' | '$' | '`' | '\\' | '\n' | '\r'));
        let line = match shell {
            Shell::Fish => format!("set -gx PATH \"{shown}\" $PATH"),
            _ => format!("export PATH=\"{shown}:$PATH\""),
        };
        (line, safe && shell != Shell::Other)
    }
}

/// The block always goes in front of PATH: tools start with `#!/usr/bin/env node`, and an older Node earlier in
/// PATH would run them and fail.
fn insert_block(content: &str, line: &str) -> String {
    let mut out = remove_block(content);
    if !out.is_empty() && !out.ends_with('\n') {
        out.push('\n');
    }
    if !out.is_empty() {
        out.push('\n');
    }
    out + &[START, line, END, ""].join("\n")
}

fn remove_block(content: &str) -> String {
    let Some(start) = content.find(START) else { return content.to_string() };
    let Some(end_rel) = content[start..].find(END) else { return content.to_string() };
    let mut end = start + end_rel + END.len();
    if content[end..].starts_with('\n') {
        end += 1;
    }
    let before = &content[..start];
    // Drop the blank line insert_block put in front, but nothing the user wrote.
    let before = before.strip_suffix("\n\n").map_or(before.to_string(), |b| format!("{b}\n"));
    format!("{before}{}", &content[end..])
}

pub fn plan(bin: &Path) -> PathPlan {
    if cfg!(windows) {
        return windows::plan(bin);
    }
    let Some(env) = Env::current() else {
        return PathPlan {
            shell: "sh".into(),
            file: None,
            line: format!("export PATH=\"{}:$PATH\"", bin.display()),
            added: false,
            automatic: false,
        };
    };
    let (shell, name) = env.shell();
    let file = env.file(shell);
    let (line, automatic) = env.line(shell, bin);
    let added = file.as_ref().and_then(|f| std::fs::read_to_string(f).ok()).is_some_and(|c| c.contains(START));
    PathPlan { shell: name, file: file.map(|f| paths::tilde(&f.to_string_lossy())), line, added, automatic }
}

pub fn add(bin: &Path) -> Result<PathPlan, String> {
    if cfg!(windows) {
        windows::set(bin, true)?;
        return Ok(plan(bin));
    }
    let env = Env::current().ok_or("Your home folder is unknown.")?;
    let (shell, _) = env.shell();
    let (line, automatic) = env.line(shell, bin);
    let file = env.file(shell).filter(|_| automatic).ok_or("Add the line to your shell's startup file yourself.")?;
    let content = read(&file)?;
    write(&file, &insert_block(&content, &line))?;
    Ok(plan(bin))
}

pub fn remove(bin: &Path) -> Result<PathPlan, String> {
    if cfg!(windows) {
        windows::set(bin, false)?;
        return Ok(plan(bin));
    }
    let env = Env::current().ok_or("Your home folder is unknown.")?;
    let (shell, _) = env.shell();
    let Some(file) = env.file(shell) else { return Ok(plan(bin)) };
    let content = read(&file)?;
    let left = remove_block(&content);
    if shell == Shell::Fish && left.trim().is_empty() {
        // The fish file is ours alone; an empty one would only be clutter.
        std::fs::remove_file(&file).map_err(|e| failed("delete", &file, &e))?;
    } else if left != content {
        write(&file, &left)?;
    }
    Ok(plan(bin))
}

fn read(file: &Path) -> Result<String, String> {
    match std::fs::read_to_string(file) {
        Ok(c) => Ok(c),
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(String::new()),
        Err(e) => Err(failed("read", file, &e)),
    }
}

/// Writes through a symlink to its target (dotfile managers link `~/.zshrc`), via a sibling temp file so a crash
/// never leaves a half-written profile.
fn write(file: &Path, content: &str) -> Result<(), String> {
    let real = std::fs::canonicalize(file).unwrap_or_else(|_| file.to_path_buf());
    if let Some(dir) = real.parent() {
        std::fs::create_dir_all(dir).map_err(|e| failed("create", dir, &e))?;
    }
    let tmp = real.with_extension(format!("wirecat-{}", std::process::id()));
    std::fs::write(&tmp, content).map_err(|e| failed("write", &tmp, &e))?;
    if let Ok(meta) = std::fs::metadata(&real) {
        let _ = std::fs::set_permissions(&tmp, meta.permissions());
    }
    std::fs::rename(&tmp, &real).map_err(|e| {
        let _ = std::fs::remove_file(&tmp);
        failed("write", &real, &e)
    })
}

fn failed(what: &str, path: &Path, e: &std::io::Error) -> String {
    format!("Could not {what} {}: {e}", paths::tilde(&path.to_string_lossy()))
}

/// The user's own PATH in `HKCU\Environment`: no administrator rights, and the value keeps its `REG_EXPAND_SZ` type
/// so entries like `%USERPROFILE%\...` keep working. `setx` is avoided: it cuts values at 1024 characters.
mod windows {
    use super::PathPlan;
    use std::path::Path;

    pub fn entries(value: &str) -> Vec<&str> {
        value.split(';').filter(|e| !e.trim().is_empty()).collect()
    }

    fn same(a: &str, b: &str) -> bool {
        a.trim_end_matches('\\').eq_ignore_ascii_case(b.trim_end_matches('\\'))
    }

    pub fn with(value: &str, dir: &str, add: bool) -> String {
        let mut kept: Vec<&str> = entries(value).into_iter().filter(|e| !same(e, dir)).collect();
        if add {
            kept.insert(0, dir);
        }
        kept.join(";")
    }

    pub fn contains(value: &str, dir: &str) -> bool {
        entries(value).iter().any(|e| same(e, dir))
    }

    pub fn plan(bin: &Path) -> PathPlan {
        let dir = bin.to_string_lossy().to_string();
        PathPlan {
            shell: "windows".into(),
            file: Some(r"HKEY_CURRENT_USER\Environment\Path".into()),
            added: imp::read().is_some_and(|v| contains(&v, &dir)),
            automatic: cfg!(windows) && !dir.contains(';'),
            line: dir,
        }
    }

    pub fn set(bin: &Path, add: bool) -> Result<(), String> {
        let dir = bin.to_string_lossy().to_string();
        if dir.contains(';') {
            return Err("The folder name contains a semicolon; add it to PATH yourself.".into());
        }
        imp::write(&with(&imp::read().unwrap_or_default(), &dir, add))
    }

    #[cfg(windows)]
    mod imp {
        use winreg::RegKey;
        use winreg::enums::{HKEY_CURRENT_USER, KEY_READ, KEY_WRITE, REG_EXPAND_SZ};

        pub fn read() -> Option<String> {
            let env = RegKey::predef(HKEY_CURRENT_USER).open_subkey_with_flags("Environment", KEY_READ).ok()?;
            env.get_value::<String, _>("Path").ok()
        }

        pub fn write(value: &str) -> Result<(), String> {
            let env = RegKey::predef(HKEY_CURRENT_USER)
                .open_subkey_with_flags("Environment", KEY_READ | KEY_WRITE)
                .map_err(|e| format!("Could not open your environment settings: {e}"))?;
            let wide: Vec<u8> = value.encode_utf16().chain(std::iter::once(0)).flat_map(u16::to_le_bytes).collect();
            env.set_raw_value("Path", &winreg::RegValue { bytes: wide.into(), vtype: REG_EXPAND_SZ })
                .map_err(|e| format!("Could not change your PATH: {e}"))?;
            broadcast();
            Ok(())
        }

        /// Tells Explorer the environment changed, so terminals opened from now on see the new PATH without signing out.
        #[allow(unsafe_code)] // one documented Win32 call; the string outlives it
        fn broadcast() {
            use windows_sys::Win32::UI::WindowsAndMessaging::{
                HWND_BROADCAST, SMTO_ABORTIFHUNG, SendMessageTimeoutW, WM_SETTINGCHANGE,
            };
            let name: Vec<u16> = "Environment".encode_utf16().chain(std::iter::once(0)).collect();
            let mut result = 0usize;
            // SAFETY: `name` is a NUL-terminated UTF-16 string alive for the whole call; `result` is a valid out pointer.
            unsafe {
                SendMessageTimeoutW(
                    HWND_BROADCAST,
                    WM_SETTINGCHANGE,
                    0,
                    name.as_ptr() as isize,
                    SMTO_ABORTIFHUNG,
                    5000,
                    &raw mut result,
                );
            }
        }
    }

    #[cfg(not(windows))]
    mod imp {
        pub fn read() -> Option<String> {
            None
        }
        pub fn write(_: &str) -> Result<(), String> {
            Err("The Windows PATH can only be changed on Windows.".into())
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn env(macos: bool, shell: &str) -> Env {
        Env { macos, shell: Some(shell.into()), home: PathBuf::from("/home/u"), zdotdir: None, xdg_config: None }
    }

    #[test]
    fn picks_the_file_each_shell_reads() {
        let file = |macos, shell| {
            let e = env(macos, shell);
            e.file(e.shell().0).map(|p| p.to_string_lossy().to_string())
        };
        assert_eq!(file(false, "/bin/bash").as_deref(), Some("/home/u/.bashrc"));
        assert_eq!(file(true, "/bin/bash").as_deref(), Some("/home/u/.bash_profile"));
        assert_eq!(file(true, "/bin/zsh").as_deref(), Some("/home/u/.zshrc"));
        assert_eq!(file(false, "/usr/bin/fish").as_deref(), Some("/home/u/.config/fish/conf.d/wirecat-desktop.fish"));
        assert_eq!(file(false, "/bin/tcsh"), None);
        let mut z = env(false, "/bin/zsh");
        z.zdotdir = Some("/home/u/.config/zsh".into());
        assert_eq!(z.file(Shell::Zsh), Some(PathBuf::from("/home/u/.config/zsh/.zshrc")));
    }

    #[test]
    fn writes_the_line_relative_to_home_and_refuses_odd_folders() {
        let e = env(false, "/bin/zsh");
        let bin = Path::new("/home/u/.local/share/dev.wirecat.desktop/node/v24.22.1/bin");
        assert_eq!(
            e.line(Shell::Zsh, bin),
            ("export PATH=\"$HOME/.local/share/dev.wirecat.desktop/node/v24.22.1/bin:$PATH\"".into(), true)
        );
        assert_eq!(
            e.line(Shell::Fish, bin).0,
            "set -gx PATH \"$HOME/.local/share/dev.wirecat.desktop/node/v24.22.1/bin\" $PATH"
        );
        assert!(!e.line(Shell::Bash, Path::new("/home/u/we$ird/bin")).1);
        assert!(!e.line(Shell::Other, bin).1);
    }

    #[test]
    fn inserts_once_replaces_in_place_and_removes_cleanly() {
        let original = "alias ll='ls -l'\nexport EDITOR=vim";
        let once = insert_block(original, "export PATH=\"/a:$PATH\"");
        let twice = insert_block(&once, "export PATH=\"/b:$PATH\"");
        assert_eq!(twice.matches(START).count(), 1);
        assert!(twice.contains("/b:$PATH") && !twice.contains("/a:$PATH"));
        assert_eq!(remove_block(&twice), "alias ll='ls -l'\nexport EDITOR=vim\n");
        assert_eq!(remove_block(original), original);
        assert_eq!(remove_block(&insert_block("", "x")), "");
    }

    #[test]
    fn edits_a_real_file_through_a_symlink() {
        let dir = std::env::temp_dir().join(format!("wirecat-profile-{}", std::process::id()));
        std::fs::create_dir_all(&dir).unwrap();
        let real = dir.join("dotfiles-zshrc");
        std::fs::write(&real, "export A=1\n").unwrap();
        let link = dir.join(".zshrc");
        #[cfg(unix)]
        std::os::unix::fs::symlink(&real, &link).unwrap();
        #[cfg(not(unix))]
        std::fs::copy(&real, &link).unwrap();
        write(&link, &insert_block(&read(&link).unwrap(), "export PATH=\"/n:$PATH\"")).unwrap();
        write(&link, &insert_block(&read(&link).unwrap(), "export PATH=\"/n:$PATH\"")).unwrap();
        let target = if cfg!(unix) { &real } else { &link };
        assert_eq!(std::fs::read_to_string(target).unwrap().matches(START).count(), 1);
        #[cfg(unix)]
        assert!(std::fs::symlink_metadata(&link).unwrap().file_type().is_symlink());
        write(&link, &remove_block(&read(&link).unwrap())).unwrap();
        assert_eq!(std::fs::read_to_string(target).unwrap(), "export A=1\n");
        std::fs::remove_dir_all(&dir).unwrap();
    }

    #[test]
    fn windows_path_entries_are_added_in_front_once_and_removed() {
        let v = r"C:\Users\u\AppData\Roaming\npm;%USERPROFILE%\bin;";
        let dir = r"C:\Users\u\AppData\Local\dev.wirecat.desktop\node\v24.22.1";
        let added = windows::with(v, dir, true);
        assert!(added.starts_with(dir));
        assert_eq!(windows::with(&added, dir, true), added);
        assert!(windows::contains(&added, &format!("{}\\", dir.to_lowercase())));
        assert_eq!(windows::with(&added, dir, false), r"C:\Users\u\AppData\Roaming\npm;%USERPROFILE%\bin");
    }
}
