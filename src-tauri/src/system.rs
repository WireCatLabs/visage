use crate::{paths, run};
use serde::Serialize;
use std::path::PathBuf;
use std::time::Duration;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Readiness {
    pub os: String,
    pub arch: String,
    pub node: Program,
    pub npm: Program,
    pub pnpm: Program,
    /// Where `npm install -g` puts packages, and whether we may write there without admin rights.
    pub npm_prefix: Option<String>,
    pub npm_prefix_writable: Option<bool>,
}

#[derive(Serialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct Program {
    pub path: Option<String>,
    pub version: Option<String>,
    pub ok: bool,
    pub problem: Option<String>,
}

pub fn readiness() -> Readiness {
    let node = std::thread::spawn(|| program("node", Some(node_supported)));
    let npm = std::thread::spawn(|| program("npm", None));
    let pnpm = std::thread::spawn(|| program("pnpm", None));
    let prefix = npm_prefix();
    Readiness {
        os: os_name(),
        arch: std::env::consts::ARCH.to_string(),
        node: node.join().unwrap_or_default(),
        npm: npm.join().unwrap_or_default(),
        pnpm: pnpm.join().unwrap_or_default(),
        npm_prefix_writable: prefix.as_ref().map(|p| writable(p)),
        npm_prefix: prefix.map(|p| paths::tilde(&p.to_string_lossy())),
    }
}

fn os_name() -> String {
    match std::env::consts::OS {
        "macos" => "macOS".into(),
        "linux" => "Linux".into(),
        "windows" => "Windows".into(),
        other => other.into(),
    }
}

type VersionCheck = fn(&semver::Version) -> Result<(), String>;

fn program(bin: &str, check: Option<VersionCheck>) -> Program {
    let Some(path) = paths::find(bin) else {
        return Program { problem: Some("not found".into()), ..Default::default() };
    };
    let shown = Some(paths::tilde(&path.to_string_lossy()));
    let out = match run::run(&path, &["--version"], Some(&paths::search_path()), Duration::from_secs(15)) {
        Ok(o) if o.code == Some(0) => o,
        Ok(o) => return Program { path: shown, problem: Some(first_line(&o.stderr)), ..Default::default() },
        Err(e) => return Program { path: shown, problem: Some(e.to_string()), ..Default::default() },
    };
    let version = out.stdout.trim().trim_start_matches('v').to_string();
    let problem = match (check, semver::Version::parse(&version)) {
        (Some(check), Ok(v)) => check(&v).err(),
        _ => None,
    };
    Program { path: shown, ok: problem.is_none(), version: Some(version), problem }
}

/// `WireCat` tools declare `^22.16.0 || >=24`.
pub fn node_supported(v: &semver::Version) -> Result<(), String> {
    if (v.major == 22 && v.minor >= 16) || v.major >= 24 {
        Ok(())
    } else {
        Err(format!("version {v} is too old; WireCat tools need 22.16 or newer, or 24+"))
    }
}

pub fn npm_prefix() -> Option<PathBuf> {
    let npm = paths::find("npm")?;
    let out = run::run(&npm, &["prefix", "-g"], Some(&paths::search_path()), Duration::from_secs(15)).ok()?;
    let p = out.stdout.trim();
    (out.code == Some(0) && !p.is_empty()).then(|| PathBuf::from(p))
}

/// The folder npm links executables into: `<prefix>/bin` on Unix, the prefix itself on Windows.
pub fn npm_bin_dir(prefix: &std::path::Path) -> PathBuf {
    if cfg!(windows) { prefix.to_path_buf() } else { prefix.join("bin") }
}

fn writable(prefix: &std::path::Path) -> bool {
    let dir = if cfg!(windows) { prefix.to_path_buf() } else { prefix.join("lib") };
    let probe = dir.join(format!(".wirecat-write-test-{}", std::process::id()));
    match std::fs::write(&probe, b"") {
        Ok(()) => {
            let _ = std::fs::remove_file(&probe);
            true
        }
        Err(_) => false,
    }
}

fn first_line(s: &str) -> String {
    s.lines().find(|l| !l.trim().is_empty()).unwrap_or("failed").trim().to_string()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn node_range_matches_tool_engines() {
        let v = |s| semver::Version::parse(s).unwrap();
        assert!(node_supported(&v("22.16.0")).is_ok());
        assert!(node_supported(&v("22.15.9")).is_err());
        assert!(node_supported(&v("23.4.0")).is_err());
        assert!(node_supported(&v("24.0.0")).is_ok());
    }
}
