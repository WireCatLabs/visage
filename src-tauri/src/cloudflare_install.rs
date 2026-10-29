use serde_json::Value;
use sha2::{Digest, Sha256};
use std::io::Read;
use std::path::{Path, PathBuf};
use std::time::Duration;

/// cloudflared's own release on GitHub, the standalone binary for this computer, kept in the app's data folder and run
/// as the user: no installer, no service, no administrator rights (rule 6). GitHub states each file's SHA-256 in the
/// release's `digest`; the copy in the release notes is not used, because for the macOS archives it differs from the
/// files (2026.10.5).
const LATEST: &str = "https://api.github.com/repos/cloudflare/cloudflared/releases/latest";
const DOWNLOADS: &str = "https://github.com/cloudflare/cloudflared/releases/download/";
const MAX_BYTES: u64 = 200 * 1024 * 1024;

/// The release file for an OS and CPU, or None where cloudflared publishes none. Windows on ARM runs the x64 build.
pub fn asset(os: &str, arch: &str) -> Option<&'static str> {
    Some(match (os, arch) {
        ("linux", "x86_64") => "cloudflared-linux-amd64",
        ("linux", "aarch64") => "cloudflared-linux-arm64",
        ("macos", "x86_64") => "cloudflared-darwin-amd64.tgz",
        ("macos", "aarch64") => "cloudflared-darwin-arm64.tgz",
        ("windows", "x86_64" | "aarch64") => "cloudflared-windows-amd64.exe",
        _ => return None,
    })
}

pub fn os() -> &'static str {
    if cfg!(target_os = "macos") {
        "macos"
    } else if cfg!(windows) {
        "windows"
    } else {
        "linux"
    }
}

#[derive(Debug, PartialEq, Eq)]
struct Source {
    version: String,
    url: String,
    sha256: String,
}

/// The file's address and checksum from the release's JSON; only an address under cloudflared's own releases.
fn source_of(release: &Value, name: &str) -> Option<Source> {
    let version = release["tag_name"].as_str().filter(|v| v.chars().all(|c| c.is_ascii_digit() || c == '.'))?;
    let file = release["assets"].as_array()?.iter().find(|a| a["name"].as_str() == Some(name))?;
    let url = file["browser_download_url"].as_str().filter(|u| u.starts_with(DOWNLOADS))?;
    let sha256 = file["digest"].as_str()?.strip_prefix("sha256:")?;
    (sha256.len() == 64 && sha256.bytes().all(|b| b.is_ascii_hexdigit())).then(|| Source {
        version: version.to_string(),
        url: url.to_string(),
        sha256: sha256.to_ascii_lowercase(),
    })
}

fn agent() -> ureq::Agent {
    ureq::Agent::config_builder()
        .timeout_connect(Some(Duration::from_secs(30)))
        .timeout_recv_response(Some(Duration::from_mins(1)))
        .timeout_per_read(Some(Duration::from_mins(1)))
        .max_redirects(5)
        .user_agent(concat!("WireCatDesktop/", env!("CARGO_PKG_VERSION")))
        .build()
        .into()
}

fn net(e: impl std::fmt::Display) -> String {
    format!("Could not download cloudflared from GitHub: {e}. Check your internet connection and try again.")
}

fn fetch(url: &str, cancelled: &dyn Fn() -> bool) -> Result<Vec<u8>, String> {
    let mut response = agent().get(url).call().map_err(net)?;
    let mut reader = response.body_mut().as_reader().take(MAX_BYTES);
    let mut body = Vec::new();
    let mut chunk = vec![0u8; 64 * 1024];
    loop {
        if cancelled() {
            return Err("Stopped.".into());
        }
        let n = reader.read(&mut chunk).map_err(net)?;
        if n == 0 {
            return Ok(body);
        }
        body.extend_from_slice(&chunk[..n]);
    }
}

/// The macOS archives hold the one program; nothing else in them is written.
fn unpack(tgz: &[u8]) -> Result<Vec<u8>, String> {
    let mut archive = tar::Archive::new(flate2::read::GzDecoder::new(tgz));
    for entry in archive.entries().map_err(|e| e.to_string())? {
        let entry = entry.map_err(|e| e.to_string())?;
        let path = entry.path().map_err(|e| e.to_string())?;
        if path.file_name().is_some_and(|n| n == "cloudflared") && entry.header().entry_type().is_file() {
            let mut bytes = Vec::new();
            entry.take(MAX_BYTES).read_to_end(&mut bytes).map_err(|e| e.to_string())?;
            return Ok(bytes);
        }
    }
    Err("the archive from GitHub has no cloudflared in it".into())
}

/// Downloads the newest cloudflared into `to`, checked against GitHub's checksum, and gives back its version.
pub fn download(to: &Path, cancelled: &dyn Fn() -> bool) -> Result<String, String> {
    let name = asset(os(), std::env::consts::ARCH).ok_or("cloudflared has no build for this computer's processor.")?;
    let release: Value = agent()
        .get(LATEST)
        .header("Accept", "application/vnd.github+json")
        .call()
        .map_err(net)?
        .body_mut()
        .read_json()
        .map_err(net)?;
    let src = source_of(&release, name).ok_or_else(|| net(format!("the newest release has no {name}")))?;
    let body = fetch(&src.url, cancelled)?;
    if hex(&Sha256::digest(&body)) != src.sha256 {
        return Err(format!("The download of {name} does not match GitHub's checksum, so it was not kept. Try again."));
    }
    let program =
        if Path::new(name).extension().is_some_and(|e| e.eq_ignore_ascii_case("tgz")) { unpack(&body)? } else { body };
    write_program(to, &program)?;
    Ok(src.version)
}

fn hex(bytes: &[u8]) -> String {
    use std::fmt::Write;
    bytes.iter().fold(String::with_capacity(64), |mut s, b| {
        let _ = write!(s, "{b:02x}");
        s
    })
}

/// Written beside its place and renamed, so a cloudflared that is running or half-written is never the one started.
fn write_program(to: &Path, bytes: &[u8]) -> Result<(), String> {
    let dir = to.parent().ok_or("no folder for cloudflared")?;
    std::fs::create_dir_all(dir).map_err(|e| e.to_string())?;
    let partial: PathBuf = to.with_extension("partial");
    std::fs::write(&partial, bytes).map_err(|e| format!("Could not save cloudflared: {e}"))?;
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        std::fs::set_permissions(&partial, std::fs::Permissions::from_mode(0o755)).map_err(|e| e.to_string())?;
    }
    std::fs::rename(&partial, to).map_err(|e| format!("Could not save cloudflared: {e}"))
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn picks_the_standalone_program_for_each_computer() {
        assert_eq!(asset("linux", "x86_64"), Some("cloudflared-linux-amd64"));
        assert_eq!(asset("macos", "aarch64"), Some("cloudflared-darwin-arm64.tgz"));
        assert_eq!(asset("windows", "aarch64"), Some("cloudflared-windows-amd64.exe"));
        assert_eq!(asset("linux", "riscv64"), None);
    }

    #[test]
    fn takes_the_checksum_github_states_and_only_cloudflareds_own_files() {
        let digest = "e1bc0cf084fd9e590554fe769a86b1db46701c3f847a43d902f7b974a4e16298";
        let url = format!("{DOWNLOADS}2026.10.5/cloudflared-linux-amd64");
        let release = json!({"tag_name": "2026.10.5", "assets": [
            {"name": "cloudflared-linux-amd64", "browser_download_url": url, "digest": format!("sha256:{digest}")},
            {"name": "cloudflared-linux-arm64", "browser_download_url": "https://evil.example/x", "digest": format!("sha256:{digest}")},
            {"name": "cloudflared-darwin-arm64.tgz", "browser_download_url": url, "digest": null}
        ]});
        assert_eq!(
            source_of(&release, "cloudflared-linux-amd64"),
            Some(Source { version: "2026.10.5".into(), url, sha256: digest.into() })
        );
        assert_eq!(source_of(&release, "cloudflared-linux-arm64"), None, "not on GitHub's release downloads");
        assert_eq!(source_of(&release, "cloudflared-darwin-arm64.tgz"), None, "no checksum, no download");
    }

    #[test]
    fn takes_only_the_program_out_of_the_archive() {
        let mut tgz = Vec::new();
        {
            let gz = flate2::write::GzEncoder::new(&mut tgz, flate2::Compression::fast());
            let mut tar = tar::Builder::new(gz);
            for (name, body) in [("README", &b"hi"[..]), ("cloudflared", &b"\x7fELF"[..])] {
                let mut header = tar::Header::new_gnu();
                header.set_size(body.len() as u64);
                header.set_mode(0o755);
                header.set_cksum();
                tar.append_data(&mut header, name, body).unwrap();
            }
            tar.into_inner().unwrap().finish().unwrap();
        }
        assert_eq!(unpack(&tgz).unwrap(), b"\x7fELF");
    }

    #[test]
    #[ignore = "downloads cloudflared from GitHub"]
    fn downloads_and_runs_the_newest_release() {
        let dir = std::env::temp_dir().join(format!("wirecat-cloudflared-{}", std::process::id()));
        let to = dir.join("cloudflared");
        let version = download(&to, &|| false).unwrap();
        let out = std::process::Command::new(&to).arg("--version").output().unwrap();
        assert!(String::from_utf8_lossy(&out.stdout).contains(&version), "{out:?}");
        std::fs::remove_dir_all(dir).unwrap();
    }
}
