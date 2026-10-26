use std::ffi::OsString;
use std::path::{Path, PathBuf};
use std::sync::RwLock;
use std::time::Duration;

static SEARCH_PATH: RwLock<Option<OsString>> = RwLock::new(None);

/// The PATH a terminal would have. Apps started from a desktop launcher miss what shell
/// profiles add (nvm, pnpm, Volta), so we merge the login shell's PATH and known folders.
pub fn search_path() -> OsString {
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
    if let Some(p) = login_shell_path() {
        dirs.extend(std::env::split_paths(&p));
    }
    dirs.extend(extra.iter().cloned());
    dirs.extend(known_dirs());

    let mut seen = std::collections::HashSet::new();
    dirs.retain(|d| !d.as_os_str().is_empty() && seen.insert(d.clone()));
    std::env::join_paths(dirs).unwrap_or_default()
}

#[cfg(unix)]
fn login_shell_path() -> Option<OsString> {
    let shell = std::env::var("SHELL").unwrap_or_else(|_| "/bin/sh".into());
    let out = crate::run::run(
        Path::new(&shell),
        &["-lic", "printf '__WIRECAT_PATH__%s' \"$PATH\""],
        None,
        Duration::from_secs(5),
    )
    .ok()?;
    let (_, path) = out.stdout.rsplit_once("__WIRECAT_PATH__")?;
    Some(OsString::from(path.trim()))
}

#[cfg(windows)]
fn login_shell_path() -> Option<OsString> {
    None
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
        for sub in [".local/share/pnpm", "Library/pnpm", ".volta/bin", ".npm-global/bin", ".bun/bin", ".local/bin"] {
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
}
