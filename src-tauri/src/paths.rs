use std::ffi::OsString;
use std::path::{Path, PathBuf};
use std::sync::{Mutex, OnceLock, RwLock};
use std::time::Duration;

static SEARCH_PATH: RwLock<Option<OsString>> = RwLock::new(None);
/// Building starts node and npm; a page that asks while the launch warm-up builds waits for it instead.
static BUILDING: Mutex<()> = Mutex::new(());

/// The PATH a terminal would have. Apps started from a desktop launcher miss what shell
/// profiles add (nvm, pnpm, Volta), so we merge the login shell's PATH and known folders.
pub fn search_path() -> OsString {
    if let Some(p) = SEARCH_PATH.read().unwrap().as_ref() {
        return p.clone();
    }
    let _one = BUILDING.lock().unwrap();
    if let Some(p) = SEARCH_PATH.read().unwrap().as_ref() {
        return p.clone();
    }
    let p = build_search_path(&[]);
    *SEARCH_PATH.write().unwrap() = Some(p.clone());
    p
}

/// Re-resolves after an install, adding folders npm reported (its global bin may be new).
pub fn refresh(extra: &[PathBuf]) -> OsString {
    let p = build_search_path(extra);
    *SEARCH_PATH.write().unwrap() = Some(p.clone());
    p
}

fn build_search_path(extra: &[PathBuf]) -> OsString {
    let mut dirs: Vec<PathBuf> = Vec::new();
    if let Some(p) = std::env::var_os("PATH") {
        dirs.extend(std::env::split_paths(&p));
    }
    if let Some(p) = &login_shell().path {
        dirs.extend(std::env::split_paths(p));
    }
    dirs.extend(extra.iter().cloned());
    dirs.extend(known_dirs());

    let mut seen = std::collections::HashSet::new();
    dirs.retain(|d| !d.as_os_str().is_empty() && seen.insert(d.clone()));
    if let Some(found) = crate::node::installed() {
        place_managed(&mut dirs, crate::node::bin_dir(&found.dir));
    }
    std::env::join_paths(dirs).unwrap_or_default()
}

/// The app's Node.js goes first only when the user's own setup cannot install tools, so a working nvm, Volta or
/// Homebrew Node keeps winning. It still stays on the path, so tools installed with it are found either way.
fn place_managed(dirs: &mut Vec<PathBuf>, bin: PathBuf) {
    let canonical = |p: &Path| std::fs::canonicalize(p).unwrap_or_else(|_| p.to_path_buf());
    let ours = canonical(&bin);
    dirs.retain(|d| canonical(d) != ours);
    let own = std::env::join_paths(dirs.iter()).unwrap_or_default();
    if crate::system::own_setup_usable(&own) {
        dirs.push(bin);
    } else {
        dirs.insert(0, bin);
    }
}

#[derive(Default)]
struct ShellEnv {
    path: Option<OsString>,
    pnpm_home: Option<OsString>,
}

/// Asked once: an interactive login shell is slow and its rc files do not change while the app runs.
fn login_shell() -> &'static ShellEnv {
    static ENV: OnceLock<ShellEnv> = OnceLock::new();
    ENV.get_or_init(read_login_shell)
}

#[cfg(unix)]
fn read_login_shell() -> ShellEnv {
    let shell = std::env::var("SHELL").unwrap_or_else(|_| "/bin/sh".into());
    let script = "printf '__WIRECAT_PATH__%s__WIRECAT_PNPM__%s' \"$PATH\" \"$PNPM_HOME\"";
    let Ok(out) = crate::run::run(Path::new(&shell), &["-lic", script], None, Duration::from_secs(5)) else {
        return ShellEnv::default();
    };
    let Some((_, rest)) = out.stdout.rsplit_once("__WIRECAT_PATH__") else { return ShellEnv::default() };
    let (path, pnpm) = rest.split_once("__WIRECAT_PNPM__").unwrap_or((rest, ""));
    let non_empty = |s: &str| (!s.trim().is_empty()).then(|| OsString::from(s.trim()));
    ShellEnv { path: non_empty(path), pnpm_home: non_empty(pnpm) }
}

#[cfg(windows)]
fn read_login_shell() -> ShellEnv {
    ShellEnv::default()
}

/// pnpm refuses global commands when its home is unknown, which is the case for an app started from a launcher.
pub fn pnpm_home() -> Option<OsString> {
    std::env::var_os("PNPM_HOME").or_else(|| login_shell().pnpm_home.clone())
}

pub fn home() -> Option<PathBuf> {
    std::env::var_os(if cfg!(windows) { "USERPROFILE" } else { "HOME" }).map(PathBuf::from)
}

fn known_dirs() -> Vec<PathBuf> {
    let mut dirs = Vec::new();
    if cfg!(windows) {
        for (var, sub) in [("APPDATA", "npm"), ("LOCALAPPDATA", "pnpm"), ("ProgramFiles", "nodejs")] {
            if let Some(base) = std::env::var_os(var) {
                dirs.push(PathBuf::from(base).join(sub));
            }
        }
        return dirs;
    }
    if let Some(home) = home() {
        for sub in [
            ".local/share/pnpm",
            ".local/share/pnpm/bin",
            "Library/pnpm",
            ".volta/bin",
            ".npm-global/bin",
            ".bun/bin",
            ".local/bin",
        ] {
            dirs.push(home.join(sub));
        }
        dirs.extend(nvm_bins(&home.join(".nvm/versions/node")));
    }
    dirs.push("/opt/homebrew/bin".into());
    dirs.push("/usr/local/bin".into());
    dirs.push("/usr/bin".into());
    dirs
}

/// Newest Node first, so a tool installed under the current nvm version wins over old ones.
fn nvm_bins(root: &Path) -> Vec<PathBuf> {
    let Ok(entries) = std::fs::read_dir(root) else { return vec![] };
    let mut versions: Vec<(semver::Version, PathBuf)> = entries
        .flatten()
        .filter_map(|e| {
            let name = e.file_name().to_string_lossy().trim_start_matches('v').to_string();
            Some((semver::Version::parse(&name).ok()?, e.path().join("bin")))
        })
        .collect();
    versions.sort_by(|a, b| b.0.cmp(&a.0));
    versions.into_iter().map(|(_, p)| p).collect()
}

/// Every executable with this name, in PATH order; the first one is the one a terminal runs.
pub fn find_all(bin: &str) -> Vec<PathBuf> {
    let cwd = std::env::temp_dir();
    let mut found: Vec<PathBuf> =
        which::which_in_all(bin, Some(search_path()), cwd).map(Iterator::collect).unwrap_or_default();
    let mut seen = std::collections::HashSet::new();
    found.retain(|p| seen.insert(std::fs::canonicalize(p).unwrap_or_else(|_| p.clone())));
    found
}

pub fn find(bin: &str) -> Option<PathBuf> {
    find_all(bin).into_iter().next()
}

/// Whether a terminal finds `bin` on its own PATH, without the folders this app adds to find tools. A coding agent
/// runs commands in such a shell, so a tool only the app can find is one the agent cannot run.
pub fn in_terminal(bin: &str) -> bool {
    let path = login_shell().path.clone().or_else(|| std::env::var_os("PATH"));
    path.is_some_and(|p| which::which_in(bin, Some(p), std::env::temp_dir()).is_ok())
}

pub fn manager_for(path: &Path) -> &'static str {
    let s = path.to_string_lossy().replace('\\', "/").to_lowercase();
    if s.contains("/pnpm/") {
        "pnpm"
    } else if s.contains("/.bun/") {
        "bun"
    } else if s.contains("/.volta/") {
        "volta"
    } else {
        "npm"
    }
}

pub fn tilde(s: &str) -> String {
    match home() {
        Some(h) => s.replace(&*h.to_string_lossy(), "~"),
        None => s.to_string(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn manager_from_install_location() {
        assert_eq!(manager_for(Path::new("/home/u/.local/share/pnpm/bin/tg")), "pnpm");
        assert_eq!(manager_for(Path::new("/home/u/.nvm/versions/node/v24.1.0/bin/zm")), "npm");
        assert_eq!(manager_for(Path::new(r"C:\Users\u\AppData\Local\pnpm\tg.cmd")), "pnpm");
    }

    /// `cargo test -- --ignored real_terminal`: which tools a terminal finds, names and booleans only.
    #[test]
    #[ignore = "reads this computer's shell"]
    fn real_terminal() {
        for bin in ["tg", "max", "wa", "zm", "drive", "memo"] {
            println!("{bin}: app finds {}, terminal finds {}", find(bin).is_some(), in_terminal(bin));
        }
    }
}
