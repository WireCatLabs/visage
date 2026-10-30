use crate::{paths, run};
use serde::Serialize;
use std::path::Path;
use std::time::Duration;
use tauri::ipc::Channel;
use tauri::utils::config::BundleType;
use tauri_plugin_updater::{Error, UpdaterExt};

/// How this copy takes an update. A .deb or .rpm copy can only be replaced with administrator rights, which the app
/// never asks for (rule 6): it downloads the signed package and hands it to the system's installer, which asks for the
/// password itself. The updater plugin's own `install` would run `pkexec` or pipe a password to `sudo -S`.
#[derive(Serialize, Clone, Copy, PartialEq, Eq, Debug)]
#[serde(rename_all = "lowercase")]
pub enum Kind {
    #[serde(rename = "self")]
    SelfUpdate,
    Deb,
    Rpm,
    /// A Linux build the bundler did not mark (`pnpm app`): which file would replace it is unknown.
    Other,
}

pub fn kind(linux: bool, bundle: Option<BundleType>) -> Kind {
    if !linux {
        return Kind::SelfUpdate;
    }
    match bundle {
        Some(BundleType::AppImage) => Kind::SelfUpdate,
        Some(BundleType::Deb) => Kind::Deb,
        Some(BundleType::Rpm) => Kind::Rpm,
        _ => Kind::Other,
    }
}

pub fn current() -> Kind {
    kind(cfg!(target_os = "linux"), tauri::utils::platform::bundle_type())
}

#[derive(Serialize, Clone)]
pub struct Progress {
    pub downloaded: u64,
    pub total: Option<u64>,
}

#[derive(Serialize, Debug, PartialEq, Eq)]
#[serde(tag = "result", rename_all = "camelCase")]
pub enum Outcome {
    #[serde(rename_all = "camelCase")]
    Saved {
        file: String,
        /// `~`-shortened, for the sentence that says where it is.
        path: String,
        /// The system's software installer opened it; otherwise the file manager shows it.
        opened: bool,
        command: String,
    },
    /// Nothing was written: the bytes never left memory.
    BadSignature,
}

/// The release's own file name, so the owner recognises it in Downloads; anything else is refused rather than written.
fn file_name(kind: Kind, url: &tauri::Url) -> Option<String> {
    let name = url.path_segments()?.next_back()?;
    let ext = match kind {
        Kind::Deb => ".deb",
        Kind::Rpm => ".rpm",
        _ => return None,
    };
    let plain = name.bytes().all(|b| b.is_ascii_alphanumeric() || b"._+~-".contains(&b));
    (plain && name.starts_with("wirecat") && name.ends_with(ext)).then(|| name.to_string())
}

fn shell_word(s: &str) -> String {
    if s.bytes().all(|b| b.is_ascii_alphanumeric() || b"._/+~-".contains(&b)) {
        s.to_string()
    } else {
        format!("'{}'", s.replace('\'', r"'\''"))
    }
}

/// The line to paste in a terminal. `~/` stays outside the quotes, or the shell would not expand it.
pub fn install_line(kind: Kind, path: &str) -> String {
    let manager = if kind == Kind::Rpm { "dnf" } else { "apt" };
    let arg = match path.strip_prefix("~/") {
        Some(rest) => format!("~/{}", shell_word(rest)),
        None => shell_word(path),
    };
    format!("sudo {manager} install {arg}")
}

fn bad_signature(e: &Error) -> bool {
    matches!(
        e,
        Error::Minisign(_)
            | Error::Base64(_)
            | Error::SignatureUtf8(_)
            | Error::SignedVersionMismatch { .. }
            | Error::MissingSignedVersion
    )
}

/// Only an installer is trusted to be what `xdg-open` starts: on this Ubuntu .rpm opens in the archive manager, and
/// "the installer opened" must not be said of that. Unknown handlers get the file shown in the file manager instead.
fn is_installer(desktop_id: &str) -> bool {
    const INSTALLERS: [&str; 7] = [
        "snap-store",
        "org.gnome.Software",
        "gnome-software",
        "gdebi",
        "org.kde.discover",
        "io.elementary.appcenter",
        "mintinstall",
    ];
    let id = desktop_id.trim();
    INSTALLERS.iter().any(|name| id.starts_with(name))
}

fn default_handler(kind: Kind) -> Option<String> {
    let mime = if kind == Kind::Rpm { "application/x-rpm" } else { "application/vnd.debian.binary-package" };
    let xdg = which::which("xdg-mime").ok()?;
    let out = run::run(&xdg, &["query", "default", mime], None, Duration::from_secs(5)).ok()?;
    (out.code == Some(0)).then_some(out.stdout)
}

fn hand_over(kind: Kind, path: &Path) -> bool {
    let opened = default_handler(kind).is_some_and(|h| is_installer(&h))
        && tauri_plugin_opener::open_path(path, None::<&str>).is_ok();
    if !opened {
        let _ = tauri_plugin_opener::reveal_item_in_dir(path);
    }
    opened
}

fn save(kind: Kind, file: String, bytes: &[u8]) -> Result<Outcome, String> {
    let dir = paths::downloads().ok_or("No home folder to download into.")?;
    std::fs::create_dir_all(&dir).map_err(|e| format!("Could not create {}: {e}", dir.display()))?;
    let to = dir.join(&file);
    let partial = dir.join(format!(".{file}.partial"));
    let written = std::fs::write(&partial, bytes).and_then(|()| std::fs::rename(&partial, &to));
    if let Err(e) = written {
        let _ = std::fs::remove_file(&partial);
        return Err(format!("Could not write to {}: {e}", paths::tilde(&dir.to_string_lossy())));
    }
    let opened = hand_over(kind, &to);
    let path = paths::tilde(&to.to_string_lossy());
    let command = install_line(kind, &path);
    Ok(Outcome::Saved { file, path, opened, command })
}

/// Downloads the package of the update the dialog named, checked against the app's signing key by the updater plugin
/// before any byte is written, saves it in Downloads and hands it to the system.
pub async fn download<R: tauri::Runtime>(
    app: &tauri::AppHandle<R>,
    version: &str,
    on_event: &Channel<Progress>,
) -> Result<Outcome, String> {
    let kind = current();
    if !matches!(kind, Kind::Deb | Kind::Rpm) {
        return Err("This copy was not installed from a .deb or .rpm package.".into());
    }
    let net = |e: Error| format!("The download stopped: {e}");
    let update = app.updater().map_err(net)?.check().await.map_err(net)?.ok_or("No update was found to download.")?;
    if update.version != version {
        return Err(format!("WireCat {} is out now. Close this window and open the update again.", update.version));
    }
    let file = file_name(kind, &update.download_url)
        .ok_or_else(|| format!("The update's package has an unexpected name: {}", update.download_url))?;
    let mut downloaded = 0u64;
    let bytes = update.download(
        |chunk, total| {
            downloaded += chunk as u64;
            let _ = on_event.send(Progress { downloaded, total });
        },
        || {},
    );
    let bytes = match bytes.await {
        Ok(bytes) => bytes,
        Err(e) if bad_signature(&e) => return Ok(Outcome::BadSignature),
        Err(e) => return Err(net(e)),
    };
    tauri::async_runtime::spawn_blocking(move || save(kind, file, &bytes)).await.map_err(|e| e.to_string())?
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn only_linux_packages_need_the_system_installer() {
        assert_eq!(kind(false, None), Kind::SelfUpdate);
        assert_eq!(kind(false, Some(BundleType::Msi)), Kind::SelfUpdate);
        assert_eq!(kind(true, Some(BundleType::AppImage)), Kind::SelfUpdate);
        assert_eq!(kind(true, Some(BundleType::Deb)), Kind::Deb);
        assert_eq!(kind(true, Some(BundleType::Rpm)), Kind::Rpm);
        assert_eq!(kind(true, None), Kind::Other);
    }

    #[test]
    fn keeps_the_release_file_name_and_refuses_the_rest() {
        let url = |s: &str| tauri::Url::parse(s).unwrap();
        let base = "https://github.com/WireCatLabs/wirecat-desktop/releases/download/v0.1.2";
        assert_eq!(
            file_name(Kind::Deb, &url(&format!("{base}/wirecat_0.1.2_amd64.deb"))).unwrap(),
            "wirecat_0.1.2_amd64.deb"
        );
        assert_eq!(
            file_name(Kind::Rpm, &url(&format!("{base}/wirecat-0.1.2-1.x86_64.rpm"))).unwrap(),
            "wirecat-0.1.2-1.x86_64.rpm"
        );
        assert_eq!(file_name(Kind::Deb, &url(&format!("{base}/wirecat_0.1.2_amd64.AppImage"))), None);
        assert_eq!(file_name(Kind::Rpm, &url(&format!("{base}/wirecat_0.1.2_amd64.deb"))), None);
        assert_eq!(file_name(Kind::Deb, &url(&format!("{base}/.wirecat.deb"))), None);
        assert_eq!(file_name(Kind::Deb, &url(&format!("{base}/wirecat%20x.deb"))), None);
        assert_eq!(file_name(Kind::Other, &url(&format!("{base}/wirecat_0.1.2_amd64.deb"))), None);
    }

    #[test]
    fn builds_the_terminal_line() {
        assert_eq!(
            install_line(Kind::Deb, "~/Downloads/wirecat_0.1.2_amd64.deb"),
            "sudo apt install ~/Downloads/wirecat_0.1.2_amd64.deb"
        );
        assert_eq!(
            install_line(Kind::Rpm, "~/Downloads/wirecat-0.1.2-1.x86_64.rpm"),
            "sudo dnf install ~/Downloads/wirecat-0.1.2-1.x86_64.rpm"
        );
        assert_eq!(
            install_line(Kind::Deb, "~/My Downloads/wirecat_0.1.2_amd64.deb"),
            "sudo apt install ~/'My Downloads/wirecat_0.1.2_amd64.deb'"
        );
        assert_eq!(install_line(Kind::Deb, "/mnt/it's/w.deb"), r"sudo apt install '/mnt/it'\''s/w.deb'");
    }

    #[test]
    fn a_signature_problem_is_told_apart_from_a_network_one() {
        assert!(bad_signature(&Error::MissingSignedVersion));
        assert!(bad_signature(&Error::SignedVersionMismatch { signed: "0.1.1".into(), announced: "0.1.2".into() }));
        assert!(!bad_signature(&Error::Network("connection reset".into())));
        assert!(!bad_signature(&Error::ReleaseNotFound));
    }

    #[test]
    fn trusts_only_known_installers_to_open_a_package() {
        assert!(is_installer("snap-store_snap-store.desktop\n"));
        assert!(is_installer("org.gnome.Software.desktop"));
        assert!(!is_installer("org.gnome.FileRoller.desktop"));
        assert!(!is_installer(""));
    }
}
