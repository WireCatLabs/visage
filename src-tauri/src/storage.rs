use crate::catalog::{self, Storage};
use crate::{paths, redact, tools};
use serde::Serialize;
use std::path::{Path, PathBuf};

pub const SHARED: &str = "shared";

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Folder {
    pub kind: &'static str,
    pub path: String,
    pub bytes: u64,
    /// The folder's own entries, largest first, so the interface can say what each one is.
    pub entries: Vec<Entry>,
}

/// Names and sizes only: nothing inside is opened, so sign-in sessions stay unread.
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Entry {
    pub name: String,
    pub dir: bool,
    pub bytes: u64,
}

const MAX_ENTRIES: usize = 40;

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
    let installed: Vec<String> = tools::owners().filter(|t| tools::installed(t)).map(|t| t.id.clone()).collect();
    let mut areas: Vec<Area> = tools::owners()
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
        .map(|(kind, p)| {
            let mut entries = entries(&p);
            let bytes = entries.iter().map(|e| e.bytes).sum();
            entries.sort_by_key(|e| std::cmp::Reverse(e.bytes));
            entries.truncate(MAX_ENTRIES);
            Folder { kind, bytes, entries, path: paths::tilde(&p.to_string_lossy()) }
        })
        .collect()
}

fn entries(path: &Path) -> Vec<Entry> {
    let Ok(read) = std::fs::read_dir(path) else { return Vec::new() };
    read.flatten()
        .filter_map(|e| {
            let t = e.file_type().ok()?;
            let bytes = if t.is_dir() { size(&e.path()) } else { e.metadata().map_or(0, |m| m.len()) };
            Some(Entry { name: redact::text(&e.file_name().to_string_lossy()), dir: t.is_dir(), bytes })
        })
        .collect()
}

/// Symlinks are counted as themselves, never followed: a link to the user's documents is not our data.
fn size(path: &Path) -> u64 {
    let Ok(entries) = std::fs::read_dir(path) else { return 0 };
    entries
        .flatten()
        .map(|e| match e.file_type() {
            Ok(t) if t.is_dir() => size(&e.path()),
            Ok(_) => e.metadata().map_or(0, |m| m.len()),
            Err(_) => 0,
        })
        .sum()
}

/// The interface names a folder by area and kind; the path itself is always computed here.
/// Opens a folder, or one entry directly inside it. The path is built here from the catalog; the interface only
/// names the entry, and a name that is not a plain child of the folder is refused.
pub fn open(id: &str, kind: &str, entry: Option<&str>) -> Result<(), String> {
    let storage = if id == SHARED { &catalog::catalog().shared_storage } else { &area(id)?.storage };
    let (_, path) = folders(storage).into_iter().find(|(k, _)| *k == kind).ok_or("unknown folder kind")?;
    if !path.is_dir() {
        return Err("That folder no longer exists.".into());
    }
    let Some(name) = entry else {
        return tauri_plugin_opener::open_path(&path, None::<&str>).map_err(|e| e.to_string());
    };
    let child = child_of(&path, name)?;
    let meta = std::fs::symlink_metadata(&child).map_err(|_| "That entry no longer exists.".to_string())?;
    // A file would open in whatever app claims it, and a link could lead anywhere: show those in their folder.
    if meta.is_dir() {
        tauri_plugin_opener::open_path(&child, None::<&str>).map_err(|e| e.to_string())
    } else {
        tauri_plugin_opener::reveal_item_in_dir(&child).map_err(|e| e.to_string())
    }
}

fn child_of(folder: &Path, name: &str) -> Result<PathBuf, String> {
    let plain = !name.is_empty()
        && name != "."
        && name != ".."
        && !name.contains(['/', '\\', '\0'])
        && Path::new(name).components().count() == 1;
    if plain { Ok(folder.join(name)) } else { Err("Not an entry of that folder.".into()) }
}

/// Deletes a tool's folders, or the shared archive, once nothing installed uses them.
pub fn clear(id: &str) -> Result<(), String> {
    let installed: Vec<String> = tools::owners().filter(|t| tools::installed(t)).map(|t| t.id.clone()).collect();
    let storage = if id == SHARED {
        if !installed.is_empty() {
            return Err(format!("Still installed: {}. Uninstall them first.", installed.join(", ")));
        }
        &catalog::catalog().shared_storage
    } else {
        let tool = area(id)?;
        if installed.iter().any(|i| i == id) {
            return Err("Uninstall the tool before deleting its data.".into());
        }
        let mine: Vec<PathBuf> = folders(&tool.storage).into_iter().map(|(_, p)| p).collect();
        if let Some(user) = shared_with(&mine, &in_use(&installed)) {
            return Err(format!("{user} still uses this data, so it stays."));
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
        if cfg!(windows)
            && let Some(parent) = path.parent()
        {
            let _ = std::fs::remove_dir(parent);
        }
    }
    Ok(())
}

/// Every folder an installed tool reads, named by who reads it: its own, and the shared store while any is installed.
fn in_use(installed: &[String]) -> Vec<(String, PathBuf)> {
    let own = tools::owners()
        .filter(|t| installed.contains(&t.id))
        .flat_map(|t| folders(&t.storage).into_iter().map(|(_, p)| (t.name.clone(), p)));
    let store = if installed.is_empty() { Vec::new() } else { folders(&catalog::catalog().shared_storage) };
    own.chain(store.into_iter().map(|(_, p)| ("The shared storage".to_string(), p))).collect()
}

/// An override can point one tool's folder into another's, or into the shared store; deleting it would take theirs.
fn shared_with<'a>(mine: &[PathBuf], used: &'a [(String, PathBuf)]) -> Option<&'a str> {
    used.iter().find(|(_, u)| mine.iter().any(|m| m.starts_with(u) || u.starts_with(m))).map(|(who, _)| who.as_str())
}

/// A part's folders are its owner's area, so they are never offered, opened or deleted twice.
fn area(id: &str) -> Result<&'static catalog::Tool, String> {
    let tool = catalog::tool(id)?;
    if tool.part_of.is_some() { Err(format!("{id} keeps its data with {}", catalog::owner(tool).id)) } else { Ok(tool) }
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
    fn opens_only_a_plain_entry_of_the_folder() {
        let folder = Path::new("/home/u/.local/share/tg-cli");
        assert_eq!(child_of(folder, "sessions").unwrap(), folder.join("sessions"));
        assert_eq!(child_of(folder, ".env").unwrap(), folder.join(".env"));
        for bad in ["", ".", "..", "../x", "a/b", "/etc", "a\\b", "nul\0"] {
            assert!(child_of(folder, bad).is_err(), "{bad:?}");
        }
    }

    #[test]
    fn deletes_only_folders_named_for_the_tool() {
        assert!(ensure_ours(Path::new("/home/u/.config/tg-cli"), "tg-cli").is_ok());
        assert!(ensure_ours(Path::new("/home/u/AppData/Roaming/tg-cli/Config"), "tg-cli").is_ok());
        assert!(ensure_ours(Path::new("/home/u"), "tg-cli").is_err());
        assert!(ensure_ours(Path::new("/tmp/elsewhere"), "tg-cli").is_err());
        assert!(ensure_ours(Path::new("tg-cli"), "tg-cli").is_err());
    }

    #[test]
    fn refuses_a_folder_another_installed_tool_or_the_shared_store_uses() {
        let used = vec![
            ("Telegram".to_string(), PathBuf::from("/home/u/.local/share/tg-cli")),
            ("The shared storage".to_string(), PathBuf::from("/home/u/.local/share/WireCat")),
        ];
        let own = [PathBuf::from("/home/u/.config/zm"), PathBuf::from("/home/u/.local/share/zm")];
        assert_eq!(shared_with(&own, &used), None);
        let inside = [PathBuf::from("/home/u/.local/share/WireCat/zm")];
        assert_eq!(shared_with(&inside, &used), Some("The shared storage"));
        let around = [PathBuf::from("/home/u/.local/share")];
        assert_eq!(shared_with(&around, &used), Some("Telegram"));
        assert_eq!(shared_with(&[PathBuf::from("/home/u/.local/share/tg-cli")], &used), Some("Telegram"));
    }

    #[test]
    fn a_tools_folders_are_its_own_three_and_never_the_shared_store() {
        let memo = Storage { app: "cli-memo".into(), env: "MEMO_TEST_NONE".into() };
        let shared = Storage { app: "WireCat".into(), env: "WIRECAT_TEST_NONE".into() };
        let mine: Vec<PathBuf> = folders(&memo).into_iter().map(|(_, p)| p).collect();
        assert_eq!(mine.len(), 3);
        assert!(mine.iter().all(|p| p.ends_with("cli-memo")));
        let used: Vec<_> = folders(&shared).into_iter().map(|(_, p)| ("The shared storage".to_string(), p)).collect();
        assert_eq!(shared_with(&mine, &used), None);
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
