use crate::paths;
use regex::Regex;
use serde::Serialize;
use sha2::{Digest, Sha256};
use std::io::{Read, Write};
use std::path::Path;
use std::time::Duration;

/// Tailscale's official installer, downloaded into the user's Downloads folder and handed to the system: the macOS
/// Installer, Windows' setup or the Linux software app asks for the password itself, never the app (rule 6). The files
/// are the ones tailscale.com/download links to (`Tailscale-latest-macos.pkg`, `tailscale-setup-latest.exe`) and,
/// on Linux, the newest package in Tailscale's own apt and yum repositories, each checked against the checksum
/// Tailscale publishes beside it.
const PKGS: &str = "https://pkgs.tailscale.com/stable";

/// Debian and Ubuntu packages share one pool; bookworm's list names the newest.
const DEB_LIST: &str = "debian/dists/bookworm/main";

#[derive(Serialize, Debug, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct Downloaded {
    /// `~`-shortened, for the sentence that says where it is.
    pub path: String,
    pub file: String,
    /// The installer opened by itself (macOS, Windows); on Linux the file manager shows it, to double-click.
    pub opened: bool,
}

fn os_release_ids(os_release: &str) -> Vec<String> {
    os_release
        .lines()
        .filter_map(|l| l.strip_prefix("ID=").or_else(|| l.strip_prefix("ID_LIKE=")))
        .flat_map(|v| v.trim_matches('"').split_whitespace().map(str::to_ascii_lowercase).collect::<Vec<_>>())
        .collect()
}

/// `deb` for the Debian family, `rpm` for the Fedora family, on the two architectures Tailscale builds both for.
pub fn linux_package(os_release: &str, arch: &str) -> Option<&'static str> {
    if !matches!(arch, "x86_64" | "aarch64") {
        return None;
    }
    let ids = os_release_ids(os_release);
    let any = |names: &[&str]| ids.iter().any(|id| names.contains(&id.as_str()));
    if any(&["debian", "ubuntu"]) {
        Some("deb")
    } else if any(&["fedora", "rhel", "centos"]) {
        Some("rpm")
    } else {
        None
    }
}

fn agent(redirects: u32) -> ureq::Agent {
    ureq::Agent::config_builder()
        .timeout_connect(Some(Duration::from_secs(30)))
        .timeout_recv_response(Some(Duration::from_mins(1)))
        .timeout_per_read(Some(Duration::from_mins(1)))
        .max_redirects(redirects)
        .user_agent(concat!("WireCatDesktop/", env!("CARGO_PKG_VERSION")))
        .build()
        .into()
}

fn net(e: impl std::fmt::Display) -> String {
    format!(
        "Could not download from pkgs.tailscale.com: {e}. Check your internet connection, or use the download page."
    )
}

fn text(url: &str) -> Result<String, String> {
    agent(5)
        .get(url)
        .call()
        .map_err(net)?
        .body_mut()
        .with_config()
        .limit(32 * 1024 * 1024)
        .read_to_string()
        .map_err(net)
}

fn sha(s: &str) -> Option<String> {
    let s = s.trim();
    (s.len() == 64 && s.bytes().all(|b| b.is_ascii_hexdigit())).then(|| s.to_ascii_lowercase())
}

struct Source {
    url: String,
    file: String,
    sha256: String,
}

/// The `-latest` name answers with a redirect to the versioned file; its `.sha256` sits beside that one only.
fn latest(alias: &str, shape: &Regex) -> Result<Source, String> {
    let response = agent(0).get(&format!("{PKGS}/{alias}")).call().map_err(net)?;
    let location = response.headers().get("location").and_then(|v| v.to_str().ok()).unwrap_or("");
    let file = location.rsplit('/').next().unwrap_or("");
    if !shape.is_match(file) {
        return Err(net(format!("an unexpected answer for {alias}")));
    }
    let sha256 = sha(&text(&format!("{PKGS}/{file}.sha256"))?).ok_or_else(|| net("no checksum"))?;
    Ok(Source { url: format!("{PKGS}/{file}"), file: file.to_string(), sha256 })
}

fn newest<'a>(found: impl Iterator<Item = (semver::Version, &'a str, String)>) -> Option<(&'a str, String)> {
    found.max_by(|a, b| a.0.cmp(&b.0)).map(|(_, f, s)| (f, s))
}

/// The newest `tailscale` stanza of an apt `Packages` list: its `Filename` and `SHA256`.
fn from_packages(list: &str, arch: &str) -> Option<(String, String)> {
    let shape = Regex::new(&format!(r"^pool/tailscale_[0-9.]+_{arch}\.deb$")).ok()?;
    let found = list.split("\n\n").filter_map(|stanza| {
        let field = |name: &str| stanza.lines().find_map(|l| l.strip_prefix(name)).map(str::trim);
        (field("Package:")? == "tailscale").then_some(())?;
        let version = semver::Version::parse(field("Version:")?).ok()?;
        let file = field("Filename:").filter(|f| shape.is_match(f))?;
        Some((version, file, sha(field("SHA256:")?)?))
    });
    newest(found).map(|(f, s)| (f.to_string(), s))
}

/// The newest `tailscale` package of a yum `primary.xml`: its location and checksum.
fn from_primary(xml: &str, arch: &str) -> Option<(String, String)> {
    let block = Regex::new(r#"(?s)<package type="rpm">(.*?)</package>"#).ok()?;
    let name = Regex::new(r"<name>tailscale</name>").ok()?;
    let arch_re = Regex::new(&format!(r"<arch>{arch}</arch>")).ok()?;
    let ver = Regex::new(r#"<version [^>]*ver="([0-9.]+)""#).ok()?;
    let sum = Regex::new(r#"<checksum type="sha256"[^>]*>([0-9a-fA-F]{64})</checksum>"#).ok()?;
    let loc = Regex::new(&format!(r#"<location href="(tailscale_[0-9.]+(?:-[0-9]+)?_{arch}\.rpm)"/>"#)).ok()?;
    let found = block.captures_iter(xml).filter_map(|c| {
        let b = c.get(1)?.as_str();
        (name.is_match(b) && arch_re.is_match(b)).then_some(())?;
        let version = semver::Version::parse(ver.captures(b)?.get(1)?.as_str()).ok()?;
        let file = loc.captures(b)?.get(1)?.as_str();
        Some((version, file, sha(sum.captures(b)?.get(1)?.as_str())?))
    });
    newest(found).map(|(f, s)| (f.to_string(), s))
}

fn source(kind: &str) -> Result<Source, String> {
    let arch = std::env::consts::ARCH;
    match kind {
        "pkg" => latest("Tailscale-latest-macos.pkg", &Regex::new(r"^Tailscale-[0-9.]+-macos\.pkg$").unwrap()),
        "exe" => latest("tailscale-setup-latest.exe", &Regex::new(r"^tailscale-setup-[0-9.]+\.exe$").unwrap()),
        "deb" => {
            let deb_arch = if arch == "aarch64" { "arm64" } else { "amd64" };
            let list = text(&format!("{PKGS}/{DEB_LIST}/binary-{deb_arch}/Packages"))?;
            let (file, sha256) = from_packages(&list, deb_arch).ok_or_else(|| net("no package in the list"))?;
            let name = file.rsplit('/').next().unwrap_or(&file).to_string();
            Ok(Source { url: format!("{PKGS}/debian/{file}"), file: name, sha256 })
        }
        "rpm" => {
            let base = format!("{PKGS}/fedora/{arch}");
            let index = text(&format!("{base}/repodata/repomd.xml"))?;
            let primary =
                Regex::new(r#"(?s)<data type="primary">.*?<location href="(repodata/[0-9a-f]+-primary\.xml\.gz)"/>"#)
                    .unwrap()
                    .captures(&index)
                    .and_then(|c| c.get(1))
                    .map(|m| m.as_str().to_string())
                    .ok_or_else(|| net("no package list"))?;
            let mut gz = Vec::new();
            agent(5)
                .get(&format!("{base}/{primary}"))
                .call()
                .map_err(net)?
                .body_mut()
                .as_reader()
                .take(64 * 1024 * 1024)
                .read_to_end(&mut gz)
                .map_err(net)?;
            let mut xml = String::new();
            flate2::read::GzDecoder::new(&gz[..]).read_to_string(&mut xml).map_err(net)?;
            let (file, sha256) = from_primary(&xml, arch).ok_or_else(|| net("no package in the list"))?;
            Ok(Source { url: format!("{base}/{file}"), file: file.clone(), sha256 })
        }
        _ => Err("WireCat cannot download Tailscale for this system; use the command below.".into()),
    }
}

fn fetch(src: &Source, to: &Path, cancelled: &dyn Fn() -> bool) -> Result<(), String> {
    let partial = to.with_extension("partial");
    let result = (|| {
        let mut response = agent(5).get(&src.url).call().map_err(net)?;
        let mut reader = response.body_mut().as_reader();
        let mut file = std::fs::File::create(&partial).map_err(|e| format!("Could not write to Downloads: {e}"))?;
        let mut hasher = Sha256::new();
        let mut buf = vec![0u8; 64 * 1024];
        loop {
            if cancelled() {
                return Err("Stopped.".to_string());
            }
            let n = reader.read(&mut buf).map_err(net)?;
            if n == 0 {
                break;
            }
            hasher.update(&buf[..n]);
            file.write_all(&buf[..n]).map_err(|e| format!("Could not write to Downloads: {e}"))?;
        }
        file.flush().map_err(|e| e.to_string())?;
        if format!("{:x}", hasher.finalize()) != src.sha256 {
            return Err("The download does not match Tailscale's checksum. Try again, or use the download page.".into());
        }
        std::fs::rename(&partial, to).map_err(|e| e.to_string())
    })();
    if result.is_err() {
        let _ = std::fs::remove_file(&partial);
    }
    result
}

/// Downloads the installer for this computer, then opens it (macOS, Windows) or shows it selected in the file
/// manager (Linux: a double-click hands it to the software app).
pub fn download(kind: &str, cancelled: &dyn Fn() -> bool) -> Result<Downloaded, String> {
    let src = source(kind)?;
    let dir = paths::downloads().ok_or("no home folder")?;
    std::fs::create_dir_all(&dir).map_err(|e| format!("Could not create {}: {e}", dir.display()))?;
    let to = dir.join(&src.file);
    fetch(&src, &to, cancelled)?;
    let opened = matches!(kind, "pkg" | "exe") && tauri_plugin_opener::open_path(&to, None::<&str>).is_ok();
    if !opened {
        let _ = tauri_plugin_opener::reveal_item_in_dir(&to);
    }
    Ok(Downloaded { path: paths::tilde(&to.to_string_lossy()), file: src.file, opened })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn knows_the_two_linux_families() {
        let ubuntu = "NAME=\"Ubuntu\"\nID=ubuntu\nID_LIKE=debian\n";
        let mint = "ID=linuxmint\nID_LIKE=\"ubuntu debian\"\n";
        let fedora = "ID=fedora\n";
        let rocky = "ID=\"rocky\"\nID_LIKE=\"rhel centos fedora\"\n";
        let arch = "ID=arch\n";
        assert_eq!(linux_package(ubuntu, "x86_64"), Some("deb"));
        assert_eq!(linux_package(mint, "aarch64"), Some("deb"));
        assert_eq!(linux_package(fedora, "x86_64"), Some("rpm"));
        assert_eq!(linux_package(rocky, "x86_64"), Some("rpm"));
        assert_eq!(linux_package(arch, "x86_64"), None);
        assert_eq!(linux_package(ubuntu, "riscv64"), None);
    }

    #[test]
    fn picks_the_newest_deb() {
        let list = "Package: tailscale\nVersion: 1.38.4\nFilename: pool/tailscale_1.38.4_amd64.deb\nSHA256: \
            b34960c55dbad4f3203a6655871eeca3ca1a07dbe7e2e2825e0e2ce594902540\n\n\
            Package: tailscale\nVersion: 1.104.2\nFilename: pool/tailscale_1.104.2_amd64.deb\nSHA256: \
            00dc5514042c75f6702c6378db27ac27cd89c48829e5f341a1fd91abdc060059\n\n\
            Package: tailscale\nVersion: 1.104.1\nFilename: ../../etc/passwd\nSHA256: \
            00dc5514042c75f6702c6378db27ac27cd89c48829e5f341a1fd91abdc060059\n";
        let (file, sum) = from_packages(list, "amd64").unwrap();
        assert_eq!(file, "pool/tailscale_1.104.2_amd64.deb");
        assert!(sum.starts_with("00dc55"));
    }

    #[test]
    fn picks_the_newest_rpm() {
        let pkg = |ver: &str, arch: &str, sum: &str| {
            format!(
                "<package type=\"rpm\">\n  <name>tailscale</name>\n  <arch>{arch}</arch>\n  <version epoch=\"0\" ver=\"{ver}\" \
                 rel=\"1\"/>\n  <checksum type=\"sha256\" pkgid=\"YES\">{sum}</checksum>\n  <location \
                 href=\"tailscale_{ver}_{arch}.rpm\"/>\n</package>\n"
            )
        };
        let a = "a".repeat(64);
        let b = "b".repeat(64);
        let xml = format!(
            "<metadata>{}{}{}</metadata>",
            pkg("1.38.4", "x86_64", &a),
            pkg("1.104.2", "x86_64", &b),
            pkg("1.200.0", "aarch64", &a)
        );
        assert_eq!(from_primary(&xml, "x86_64"), Some(("tailscale_1.104.2_x86_64.rpm".into(), b)));
    }
}
