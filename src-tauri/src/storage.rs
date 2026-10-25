use crate::catalog::{self, Storage};
use crate::{paths, tools};
use serde::Serialize;
use std::path::{Path, PathBuf};

pub const SHARED: &str = "shared";

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Folder {
    pub kind: &'static str,
    pub path: String,
    pub bytes: u64,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Area {
    /// A tool id, or `shared` for the archive every tool reads.
    pub id: String,
    /// Only folders that exist; an empty list means nothing is left on disk.
    pub folders: Vec<Folder>,
    /// Installed tools that still use this data; deleting is refused while any are listed.
    pub used_by: Vec<String>,
}

/// Mirrors cli-base's `resolvePaths` (src/paths.ts): `<PREFIX>_{CONFIG,STATE,CACHE}_DIR` win, then the XDG
/// layout on Linux and macOS, then `%APPDATA%`/`%LOCALAPPDATA%` on Windows. Keep the two in step.
fn folders(s: &Storage) -> Vec<(&'static str, PathBuf)> {
    let over = |kind: &str| std::env::var_os(format!("{}_{kind}_DIR", s.env)).map(PathBuf::from);
    let home = paths::home().unwrap_or_default();
    let base: [(&'static str, PathBuf); 3] = if cfg!(windows) {
        let roaming = std::env::var_os("APPDATA").map_or_else(|| home.join("AppData/Roaming"), PathBuf::from);
        let local = std::env::var_os("LOCALAPPDATA").map_or_else(|| home.join("AppData/Local"), PathBuf::from);
        [
            ("config", roaming.join(&s.app).join("Config")),
            ("state", local.join(&s.app).join("Data")),
            ("cache", local.join(&s.app).join("Cache")),
        ]
    } else {
        let xdg = |var: &str, fallback: &str| std::env::var_os(var).map_or_else(|| home.join(fallback), PathBuf::from);
        [
            ("config", xdg("XDG_CONFIG_HOME", ".config").join(&s.app)),
            ("state", xdg("XDG_DATA_HOME", ".local/share").join(&s.app)),
            ("cache", xdg("XDG_CACHE_HOME", ".cache").join(&s.app)),
        ]
    };
    base.into_iter().map(|(kind, p)| (kind, over(&kind.to_uppercase()).unwrap_or(p))).collect()
}

pub fn report() -> Vec<Area> {
    let installed: Vec<String> =
        tools::detect_all().into_iter().filter(|t| !t.installs.is_empty()).map(|t| t.id).collect();
    let mut areas: Vec<Area> = catalog::catalog()
        .tools
        .iter()
        .map(|t| Area {
            id: t.id.clone(),
            folders: existing(&t.storage),
            used_by: installed.iter().filter(|i| **i == t.id).cloned().collect(),
        })
        .collect();
    areas.push(Area { id: SHARED.into(), folders: existing(&catalog::catalog().shared_storage), used_by: installed });
    areas
}

fn existing(s: &Storage) -> Vec<Folder> {
    folders(s)
        .into_iter()
        .filter(|(_, p)| p.is_dir())
        .map(|(kind, p)| Folder { kind, bytes: size(&p), path: paths::tilde(&p.to_string_lossy()) })
        .collect()
}

/// Symlinks are counted as themselves, never followed: a link to the user's documents is not our data.
fn size(path: &Path) -> u64 {
    let Ok(entries) = std::fs::read_dir(path) else { return 0 };
    entries
        .flatten()
        .map(|e| match e.file_type() {
            Ok(t) if t.is_dir() => size(&e.path()),
            Ok(_) => e.metadata().map(|m| m.len()).unwrap_or(0),
            Err(_) => 0,
        })
        .sum()
}

/// Deletes a tool's folders, or the shared archive, once nothing installed uses them.
pub fn clear(id: &str) -> Result<(), String> {
    let installed: Vec<String> =
        tools::detect_all().into_iter().filter(|t| !t.installs.is_empty()).map(|t| t.id).collect();
    let storage = if id == SHARED {
        if !installed.is_empty() {
            return Err(format!("Still installed: {}. Uninstall them first.", installed.join(", ")));
        }
        &catalog::catalog().shared_storage
    } else {
        let tool = catalog::tool(id)?;
        if installed.iter().any(|i| i == id) {
            return Err("Uninstall the tool before deleting its data.".into());
        }
        &tool.storage
    };
    for (_, path) in folders(storage) {
        if !path.exists() {
            continue;
        }
        ensure_ours(&path, &storage.app)?;
        std::fs::remove_dir_all(&path)
            .map_err(|e| format!("Could not delete {}: {e}", paths::tilde(&path.to_string_lossy())))?;
        // Windows keeps Config/Data/Cache under one folder per app; drop it once it is empty.
        if cfg!(windows) {
            if let Some(parent) = path.parent() {
                let _ = std::fs::remove_dir(parent);
            }
        }
    }
    Ok(())
}

/// A last check before `remove_dir_all`: an override pointing at `~` or `/` must never be deleted.
fn ensure_ours(path: &Path, app: &str) -> Result<(), String> {
    let named =
        path.file_name().is_some_and(|n| n == app) || path.parent().and_then(Path::file_name).is_some_and(|n| n == app);
    let deep = path.is_absolute() && path.components().count() >= 4;
    let not_home = paths::home().is_none_or(|h| path != h);
    if named && deep && not_home {
        Ok(())
    } else {
        Err(format!("Refusing to delete {}: it does not look like WireCat data.", path.display()))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn deletes_only_folders_named_for_the_tool() {
        assert!(ensure_ours(Path::new("/home/u/.config/tg-cli"), "tg-cli").is_ok());
        assert!(ensure_ours(Path::new("/home/u/AppData/Roaming/tg-cli/Config"), "tg-cli").is_ok());
        assert!(ensure_ours(Path::new("/home/u"), "tg-cli").is_err());
        assert!(ensure_ours(Path::new("/tmp/elsewhere"), "tg-cli").is_err());
        assert!(ensure_ours(Path::new("tg-cli"), "tg-cli").is_err());
    }

    #[test]
    fn resolves_the_xdg_layout() {
        let s = Storage { app: "zm".into(), env: "ZM_TEST_NONE".into() };
        let kinds: Vec<_> = folders(&s).into_iter().map(|(k, p)| (k, p.ends_with("zm"))).collect();
        assert_eq!(kinds, vec![("config", true), ("state", true), ("cache", true)]);
    }

    #[test]
    fn sums_nested_file_sizes() {
        let dir = std::env::temp_dir().join(format!("wirecat-size-{}", std::process::id()));
        std::fs::create_dir_all(dir.join("a")).unwrap();
        std::fs::write(dir.join("x"), [0u8; 10]).unwrap();
        std::fs::write(dir.join("a/y"), [0u8; 5]).unwrap();
        assert_eq!(size(&dir), 15);
        std::fs::remove_dir_all(&dir).unwrap();
    }
}
