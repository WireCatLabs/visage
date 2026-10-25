use crate::catalog::Tool;
use crate::{archive, paths, redact, run};
use serde::Serialize;
use serde_json::Value;
use std::fs::{self, File};
use std::io::{Read, Write};
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, Ordering};
use std::thread;
use std::time::{Duration, Instant, UNIX_EPOCH};

pub const BACKUP: &str = "store-backup";
pub const RESET: &str = "store-reset";
/// In the home folder rather than Documents: macOS and Windows often sync Documents to a cloud drive, and a backup is
/// every message in the store, unencrypted.
const FOLDER: &str = "WireCat backups";
const PREFIX: &str = "wirecat-store-";
const ENTRY: &str = "wirecat.db";

#[derive(Serialize, Clone, Debug, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct BackupFile {
    pub name: String,
    pub bytes: u64,
    /// Milliseconds since the Unix epoch.
    pub modified: u64,
}

#[derive(Serialize, Debug, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Backups {
    pub folder: String,
    /// Newest first.
    pub files: Vec<BackupFile>,
}

#[derive(Serialize, Clone, Debug, PartialEq)]
#[serde(rename_all = "camelCase", rename_all_fields = "camelCase", tag = "event")]
pub enum BackupEvent {
    Copying { done: u64, total: u64 },
    Compressing { done: u64, total: u64 },
    Done { file: BackupFile, folder: String, store_bytes: u64, millis: u64 },
    Cancelled,
    Failed { message: String },
}

#[derive(Debug, PartialEq)]
enum Stop {
    Cancelled,
    Failed(String),
}

impl From<String> for Stop {
    fn from(message: String) -> Self {
        Stop::Failed(message)
    }
}

impl From<&str> for Stop {
    fn from(message: &str) -> Self {
        Stop::Failed(message.into())
    }
}

pub fn folder() -> Result<PathBuf, String> {
    paths::home().map(|h| h.join(FOLDER)).ok_or_else(|| "The home folder is not known.".into())
}

pub fn list() -> Result<Backups, String> {
    let dir = folder()?;
    Ok(Backups { folder: paths::tilde(&dir.to_string_lossy()), files: files_in(&dir) })
}

fn files_in(dir: &Path) -> Vec<BackupFile> {
    let mut files: Vec<BackupFile> = fs::read_dir(dir)
        .into_iter()
        .flatten()
        .flatten()
        .filter_map(|e| {
            let name = e.file_name().into_string().ok()?;
            let meta = e.metadata().ok()?;
            (is_backup_name(&name) && meta.is_file()).then(|| BackupFile {
                name,
                bytes: meta.len(),
                modified: millis_of(&meta),
            })
        })
        .collect();
    files.sort_by(|a, b| b.name.cmp(&a.name));
    files
}

fn millis_of(meta: &fs::Metadata) -> u64 {
    meta.modified()
        .ok()
        .and_then(|t| t.duration_since(UNIX_EPOCH).ok())
        .and_then(|d| u64::try_from(d.as_millis()).ok())
        .unwrap_or(0)
}

/// A finished backup only: the copy and the zip being written start with a dot.
fn is_backup_name(name: &str) -> bool {
    name.starts_with(PREFIX)
        && Path::new(name).extension().is_some_and(|x| x == "zip")
        && !name.contains(['/', '\\', '\0'])
}

/// The folder, or one backup shown in it. Only names the list would show are accepted.
pub fn open(name: Option<&str>) -> Result<(), String> {
    let dir = folder()?;
    if !dir.is_dir() {
        return Err("There are no backups yet.".into());
    }
    let Some(name) = name else {
        return tauri_plugin_opener::open_path(&dir, None::<&str>).map_err(|e| e.to_string());
    };
    if !is_backup_name(name) {
        return Err("Not a backup in that folder.".into());
    }
    let file = dir.join(name);
    if !file.is_file() {
        return Err("That backup no longer exists.".into());
    }
    tauri_plugin_opener::reveal_item_in_dir(&file).map_err(|e| e.to_string())
}

/// `wirecat-store-2026-10-25-1750.zip`, in local time; `-2`, `-3`… when a backup in the same minute exists.
fn free_name(dir: &Path, stamp: &str) -> String {
    let taken = |name: &str| dir.join(name).exists() || dir.join(format!(".{name}.partial")).exists();
    let first = format!("{PREFIX}{stamp}.zip");
    if !taken(&first) {
        return first;
    }
    (2..10_000).map(|n| format!("{PREFIX}{stamp}-{n}.zip")).find(|name| !taken(name)).unwrap_or(first)
}

/// The copy and the zip are on disk together until the copy is removed; `SQLite` text usually compresses to well under
/// half.
fn needed_for(store_bytes: u64) -> u64 {
    store_bytes + store_bytes / 2
}

/// The same units as the interface's `formatBytes`.
fn size(bytes: u64) -> String {
    const UNITS: [&str; 5] = ["bytes", "KB", "MB", "GB", "TB"];
    #[allow(clippy::cast_precision_loss)] // a size shown to one decimal
    let mut value = bytes as f64;
    let mut unit = 0;
    while value >= 1024.0 && unit < UNITS.len() - 1 {
        value /= 1024.0;
        unit += 1;
    }
    if unit == 0 {
        format!("{bytes} bytes")
    } else if value < 10.0 {
        format!("{value:.1} {}", UNITS[unit])
    } else {
        format!("{value:.0} {}", UNITS[unit])
    }
}

fn template(args: &[String], file: &Path) -> Vec<String> {
    args.iter().map(|a| if a == "{file}" { file.to_string_lossy().into_owned() } else { a.clone() }).collect()
}

/// Runs the tool's own `store backup` into a hidden copy beside the backups, zips it, then removes the copy.
pub fn backup(cancelled: &(dyn Fn() -> bool + Sync), send: &(dyn Fn(BackupEvent) + Sync)) {
    let started = Instant::now();
    send(match make(cancelled, send) {
        Ok((file, folder, store_bytes)) => BackupEvent::Done {
            file,
            folder,
            store_bytes,
            millis: u64::try_from(started.elapsed().as_millis()).unwrap_or(u64::MAX),
        },
        Err(Stop::Cancelled) => BackupEvent::Cancelled,
        Err(Stop::Failed(message)) => BackupEvent::Failed { message },
    });
}

fn make(
    cancelled: &(dyn Fn() -> bool + Sync),
    send: &(dyn Fn(BackupEvent) + Sync),
) -> Result<(BackupFile, String, u64), Stop> {
    let info = archive::info()?.ok_or("Install Telegram, WhatsApp or MAX: the backup is made by a messenger tool.")?;
    let tool = archive::asked(|t| t.store_backup.as_ref()).ok_or("No installed tool can back up storage.")?;
    let args = tool.store_backup.as_ref().ok_or("No installed tool can back up storage.")?;
    if !info.exists {
        return Err("Storage is not created yet, so there is nothing to back up.".into());
    }
    let store_bytes = info.file_bytes + info.wal_bytes;
    let dir = folder()?;
    create_private_dir(&dir).map_err(|e| format!("Could not create {}: {e}", paths::tilde(&dir.to_string_lossy())))?;
    let free = fs4::available_space(&dir).map_err(|e| format!("Could not read the free disk space: {e}"))?;
    if free < needed_for(store_bytes) {
        return Err(format!(
            "Not enough free disk space. The backup needs about {} free in {}, and there is {}. Free some space and \
             try again.",
            size(needed_for(store_bytes)),
            paths::tilde(&dir.to_string_lossy()),
            size(free)
        )
        .into());
    }

    let name = free_name(&dir, &chrono::Local::now().format("%Y-%m-%d-%H%M").to_string());
    let copy = dir.join(format!(".{name}.db.partial"));
    let partial = dir.join(format!(".{name}.partial"));
    let result = copy_then_zip(tool, args, &copy, &partial, store_bytes, cancelled, send).and_then(|()| {
        let target = dir.join(&name);
        fs::rename(&partial, &target).map_err(|e| Stop::Failed(format!("Could not name the backup: {e}")))?;
        let meta = fs::metadata(&target).map_err(|e| Stop::Failed(e.to_string()))?;
        Ok(BackupFile { name: name.clone(), bytes: meta.len(), modified: millis_of(&meta) })
    });
    let _ = fs::remove_file(&copy);
    let _ = fs::remove_file(&partial);
    result.map(|file| (file, paths::tilde(&dir.to_string_lossy()), store_bytes))
}

fn copy_then_zip(
    tool: &Tool,
    args: &[String],
    copy: &Path,
    partial: &Path,
    store_bytes: u64,
    cancelled: &(dyn Fn() -> bool + Sync),
    send: &(dyn Fn(BackupEvent) + Sync),
) -> Result<(), Stop> {
    let bin = paths::find(&tool.bin).ok_or("The tool is not installed.")?;
    let args = template(args, copy);
    let refs: Vec<&str> = args.iter().map(String::as_str).collect();
    let copied = AtomicBool::new(false);
    let mut lines = (String::new(), String::new());
    let code = thread::scope(|s| {
        // `VACUUM INTO` prints nothing while it runs, so the copy's growth is the progress.
        s.spawn(|| {
            while !copied.load(Ordering::Relaxed) {
                let done = fs::metadata(copy).map_or(0, |m| m.len()).min(store_bytes);
                send(BackupEvent::Copying { done, total: store_bytes });
                thread::sleep(Duration::from_millis(300));
            }
        });
        let code = run::stream(
            run::command(&bin, &refs, Some(&paths::search_path())),
            Duration::from_hours(3),
            cancelled,
            |line| match line {
                run::Line::Out(l) => lines.0.push_str(&(l + "\n")),
                run::Line::Err(l) => lines.1.push_str(&(l + "\n")),
            },
        );
        copied.store(true, Ordering::Relaxed);
        code
    });
    let code = match code {
        Ok(code) => code,
        Err(run::RunError::Cancelled) => return Err(Stop::Cancelled),
        Err(e) => return Err(Stop::Failed(format!("The copy did not finish: {e}"))),
    };
    let output = run::Output { code, stdout: lines.0, stderr: lines.1 };
    if code != Some(0) || !copy.is_file() {
        return Err(Stop::Failed(format!("{} store backup failed: {}", tool.bin, failure_of(&output))));
    }
    send(BackupEvent::Copying { done: store_bytes, total: store_bytes });
    compress(copy, partial, ENTRY, cancelled, &mut |done, total| send(BackupEvent::Compressing { done, total }))
}

/// The tool's own error message, masked; its last line on stderr when it printed no JSON.
fn failure_of(out: &run::Output) -> String {
    out.json()
        .and_then(|v| v["error"]["message"].as_str().map(redact::text))
        .or_else(|| out.stderr.lines().rev().find(|l| !l.trim().is_empty()).map(|l| redact::text(l.trim())))
        .unwrap_or_else(|| "the tool gave no answer".into())
}

fn create_private_dir(dir: &Path) -> std::io::Result<()> {
    if dir.is_dir() {
        return Ok(());
    }
    let mut builder = fs::DirBuilder::new();
    builder.recursive(true);
    #[cfg(unix)]
    {
        use std::os::unix::fs::DirBuilderExt;
        builder.mode(0o700);
    }
    builder.create(dir)
}

fn create_private_file(path: &Path) -> std::io::Result<File> {
    let mut options = fs::OpenOptions::new();
    options.write(true).create_new(true);
    #[cfg(unix)]
    {
        use std::os::unix::fs::OpenOptionsExt;
        options.mode(0o600);
    }
    options.open(path)
}

/// One deflated entry. Progress is reported once per percent, and cancelling stops between reads.
fn compress(
    src: &Path,
    dest: &Path,
    entry: &str,
    cancelled: &dyn Fn() -> bool,
    progress: &mut dyn FnMut(u64, u64),
) -> Result<(), Stop> {
    let failed = |e: &dyn std::fmt::Display| Stop::Failed(format!("Could not write the zip: {e}"));
    let total = fs::metadata(src).map_err(|e| failed(&e))?.len();
    let mut input = File::open(src).map_err(|e| failed(&e))?;
    let mut zip = zip::ZipWriter::new(create_private_file(dest).map_err(|e| failed(&e))?);
    let options = zip::write::SimpleFileOptions::default()
        .compression_method(zip::CompressionMethod::Deflated)
        .large_file(total > u64::from(u32::MAX))
        .unix_permissions(0o600);
    zip.start_file(entry, options).map_err(|e| failed(&e))?;
    let mut buf = vec![0u8; 1 << 20];
    let (mut done, mut shown) = (0u64, u64::MAX);
    progress(0, total);
    loop {
        if cancelled() {
            return Err(Stop::Cancelled);
        }
        let n = input.read(&mut buf).map_err(|e| failed(&e))?;
        if n == 0 {
            break;
        }
        zip.write_all(&buf[..n]).map_err(|e| failed(&e))?;
        done += n as u64;
        let percent = done * 100 / total.max(1);
        if percent != shown {
            shown = percent;
            progress(done, total);
        }
    }
    zip.finish().map_err(|e| failed(&e))?.sync_all().map_err(|e| failed(&e))?;
    Ok(())
}

#[derive(Serialize, Debug, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct TableRows {
    pub name: String,
    pub rows: u64,
}

#[derive(Serialize, Debug, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct ResetPreview {
    pub answered_by: String,
    pub bin: String,
    /// False while the installed tool is older than `store reset --dry-run`; nothing else is filled then.
    pub supported: bool,
    pub exists: bool,
    /// The store's files, `~` for the home folder.
    pub files: Vec<String>,
    pub bytes: u64,
    pub schema: Option<u64>,
    pub tables: Vec<TableRows>,
    /// Whether a sync, an import or a server has the file open now; `None` when the system cannot say.
    pub in_use: Option<bool>,
}

/// `None` when no messenger tool is installed to ask.
pub fn reset_preview() -> Result<Option<ResetPreview>, String> {
    let Some(tool) = archive::asked(|t| t.store_reset_preview.as_ref()) else { return Ok(None) };
    let Some(args) = tool.store_reset_preview.as_ref() else { return Ok(Some(preview_of(tool, None))) };
    let bin = paths::find(&tool.bin).ok_or("the tool is not installed")?;
    let refs: Vec<&str> = args.iter().map(String::as_str).collect();
    let out = run::run(&bin, &refs, Some(&paths::search_path()), Duration::from_mins(5)).map_err(|e| e.to_string())?;
    let json = out.json();
    let item = json.as_ref().map(|v| v.get("item").unwrap_or(v));
    if let Some(item) = item.filter(|i| i["tables"].is_array() || i["exists"] == Value::Bool(false)) {
        return Ok(Some(preview_of(tool, Some(item))));
    }
    if older_than_preview(json.as_ref()) {
        return Ok(Some(preview_of(tool, None)));
    }
    Err(failure_of(&out))
}

/// Before `store reset --dry-run`, the shared `--dry-run` asked for a profile; before that, it was an unknown option.
fn older_than_preview(json: Option<&Value>) -> bool {
    let message = json.and_then(|v| v["error"]["message"].as_str()).unwrap_or("");
    let preview = json.is_some_and(|v| v.get("error").is_none());
    preview || message.starts_with("name a profile") || message.contains("unknown option")
}

fn preview_of(tool: &Tool, item: Option<&Value>) -> ResetPreview {
    let Some(item) = item else {
        return ResetPreview {
            answered_by: tool.id.clone(),
            bin: tool.bin.clone(),
            supported: false,
            exists: false,
            files: Vec::new(),
            bytes: 0,
            schema: None,
            tables: Vec::new(),
            in_use: None,
        };
    };
    ResetPreview {
        answered_by: tool.id.clone(),
        bin: tool.bin.clone(),
        supported: true,
        exists: item["exists"].as_bool().unwrap_or(false),
        files: item["files"].as_array().into_iter().flatten().filter_map(Value::as_str).map(paths::tilde).collect(),
        bytes: item["bytes"].as_u64().unwrap_or(0),
        schema: item["schema"].as_u64(),
        tables: item["tables"]
            .as_array()
            .into_iter()
            .flatten()
            .filter_map(|t| Some(TableRows { name: t["name"].as_str()?.into(), rows: t["rows"].as_u64()? }))
            .collect(),
        in_use: item["in_use"].as_bool(),
    }
}

/// Empties the store with the tool's own `store reset`. The app's own backup, when the owner keeps one, comes first.
pub fn reset() -> Result<Option<u64>, String> {
    let tool = archive::asked(|t| t.store_reset.as_ref()).ok_or("No installed tool can clear storage.")?;
    let args = tool.store_reset.as_ref().ok_or("No installed tool can clear storage.")?;
    let bin = paths::find(&tool.bin).ok_or("the tool is not installed")?;
    let refs: Vec<&str> = args.iter().map(String::as_str).collect();
    let out = run::run(&bin, &refs, Some(&paths::search_path()), Duration::from_mins(10)).map_err(|e| e.to_string())?;
    match out.json() {
        Some(v) if out.code == Some(0) && v.get("error").is_none() => Ok(v["item"]["schema"].as_u64()),
        _ => Err(reset_failure(&failure_of(&out))),
    }
}

fn reset_failure(message: &str) -> String {
    let busy = ["is open in process", "a write to the store is under way", "serve is running"];
    if busy.iter().any(|b| message.contains(b)) {
        format!(
            "Storage is in use: a sync, an import or a server has it open. Nothing was deleted. Try again when it \
             finishes. ({message})"
        )
    } else {
        format!("Storage was not cleared: {message}")
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;
    use std::cell::RefCell;

    struct Scratch(PathBuf);

    impl std::ops::Deref for Scratch {
        type Target = Path;
        fn deref(&self) -> &Path {
            &self.0
        }
    }

    impl Drop for Scratch {
        fn drop(&mut self) {
            let _ = fs::remove_dir_all(&self.0);
        }
    }

    fn scratch(name: &str) -> Scratch {
        let dir = std::env::temp_dir().join(format!("wirecat-backup-test-{name}-{}", std::process::id()));
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(&dir).unwrap();
        Scratch(dir)
    }

    #[test]
    fn names_a_backup_by_the_minute_and_never_reuses_one() {
        let dir = scratch("names");
        assert_eq!(free_name(&dir, "2026-10-25-1750"), "wirecat-store-2026-10-25-1750.zip");
        fs::write(dir.join("wirecat-store-2026-10-25-1750.zip"), "x").unwrap();
        assert_eq!(free_name(&dir, "2026-10-25-1750"), "wirecat-store-2026-10-25-1750-2.zip");
        fs::write(dir.join(".wirecat-store-2026-10-25-1750-2.zip.partial"), "x").unwrap();
        assert_eq!(free_name(&dir, "2026-10-25-1750"), "wirecat-store-2026-10-25-1750-3.zip");
    }

    #[test]
    fn lists_only_finished_backups_newest_first() {
        let dir = scratch("list");
        for name in [
            "wirecat-store-2026-10-24-0900.zip",
            "wirecat-store-2026-10-25-1750.zip",
            ".wirecat-store-2026-10-25-1800.zip.partial",
            ".wirecat-store-2026-10-25-1800.zip.db.partial",
            "notes.zip",
            "wirecat-store-2026-10-25-1750.db",
        ] {
            fs::write(dir.join(name), "abc").unwrap();
        }
        let names: Vec<String> = files_in(&dir).into_iter().map(|f| f.name).collect();
        assert_eq!(names, ["wirecat-store-2026-10-25-1750.zip", "wirecat-store-2026-10-24-0900.zip"]);
        assert!(files_in(&dir.join("absent")).is_empty());
    }

    #[test]
    fn refuses_to_open_anything_but_a_backup_name() {
        assert!(!is_backup_name("../wirecat-store-x.zip"));
        assert!(!is_backup_name("wirecat-store-x.db"));
        assert!(!is_backup_name(".wirecat-store-x.zip.partial"));
        assert!(is_backup_name("wirecat-store-2026-10-25-1750.zip"));
    }

    #[test]
    fn zips_the_copy_into_one_private_deflated_entry() {
        let dir = scratch("zip");
        let src = dir.join("copy.db");
        let body: Vec<u8> = (0..3_000_000u32).map(|i| b"wirecat "[(i % 8) as usize]).collect();
        fs::write(&src, &body).unwrap();
        let dest = dir.join("out.zip");
        let seen = RefCell::new(Vec::new());
        compress(&src, &dest, ENTRY, &|| false, &mut |done, total| seen.borrow_mut().push((done, total))).unwrap();

        let seen = seen.into_inner();
        assert_eq!(seen.first(), Some(&(0, 3_000_000)));
        assert_eq!(seen.last(), Some(&(3_000_000, 3_000_000)));
        assert!(seen.len() <= 102);
        assert!(fs::metadata(&dest).unwrap().len() < 100_000);
        let mut archive = zip::ZipArchive::new(File::open(&dest).unwrap()).unwrap();
        assert_eq!(archive.len(), 1);
        let mut entry = archive.by_index(0).unwrap();
        assert_eq!(entry.name().unwrap(), ENTRY);
        assert_eq!(entry.compression(), zip::CompressionMethod::Deflated);
        let mut back = Vec::new();
        entry.read_to_end(&mut back).unwrap();
        assert_eq!(back, body);
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            assert_eq!(fs::metadata(&dest).unwrap().permissions().mode() & 0o777, 0o600);
        }
    }

    #[test]
    fn a_cancelled_zip_stops_and_never_overwrites() {
        let dir = scratch("cancel");
        let src = dir.join("copy.db");
        fs::write(&src, vec![7u8; 3 << 20]).unwrap();
        let dest = dir.join("out.zip");
        let reads = RefCell::new(0);
        let cancel = || {
            *reads.borrow_mut() += 1;
            *reads.borrow() > 1
        };
        assert_eq!(compress(&src, &dest, ENTRY, &cancel, &mut |_, _| {}), Err(Stop::Cancelled));
        assert!(matches!(compress(&src, &dest, ENTRY, &|| false, &mut |_, _| {}), Err(Stop::Failed(_))));
    }

    #[test]
    fn asks_for_half_again_the_store_and_says_sizes_like_the_interface() {
        assert_eq!(needed_for(2_000), 3_000);
        assert_eq!(size(512), "512 bytes");
        assert_eq!(size(3_435_973_837), "3.2 GB");
        assert_eq!(size(52_428_800), "50 MB");
    }

    #[test]
    fn puts_the_copy_in_place_of_the_file_word() {
        let tool = crate::catalog::tool("tg").unwrap();
        let args = tool.store_backup.clone().unwrap();
        let built = template(&args, Path::new("/x/.copy.db.partial"));
        assert_eq!(built, ["store", "backup", "/x/.copy.db.partial", "--json"]);
    }

    #[test]
    fn reads_a_reset_preview_and_tells_an_older_tool_from_a_failure() {
        let tool = crate::catalog::tool("tg").unwrap();
        let item = json!({
            "path": "/home/u/.local/share/WireCat/wirecat.db", "exists": true, "reset": false, "dry_run": true,
            "files": ["/home/u/.local/share/WireCat/wirecat.db", "/home/u/.local/share/WireCat/wirecat.db-wal"],
            "bytes": 4096, "schema": 33, "backup_first": false, "in_use": null,
            "tables": [{"name": "messages", "rows": 12}, {"name": "chats", "rows": 3}]
        });
        let p = preview_of(tool, Some(&item));
        assert!(p.supported && p.exists);
        assert_eq!(p.tables[0], TableRows { name: "messages".into(), rows: 12 });
        assert_eq!((p.schema, p.in_use, p.files.len()), (Some(33), None, 2));
        assert!(!preview_of(tool, None).supported);

        assert!(older_than_preview(Some(&json!({"error": {"message": "name a profile: `tg <profile> …`"}}))));
        assert!(older_than_preview(Some(&json!({"error": {"message": "error: unknown option '--dry-run'"}}))));
        assert!(older_than_preview(Some(&json!({"dry_run": true, "command": ["store", "reset"]}))));
        assert!(!older_than_preview(Some(&json!({"error": {"message": "database disk image is malformed"}}))));
    }

    #[test]
    fn a_busy_store_says_nothing_was_deleted() {
        let busy = reset_failure("the store is open in process 4242 — stop it first");
        assert!(busy.starts_with("Storage is in use") && busy.contains("Nothing was deleted"));
        assert!(reset_failure("disk I/O error").starts_with("Storage was not cleared"));
    }

    /// `MESSAGING_STORE=/tmp/x.db cargo test -- --ignored real_copy_then_zip`: the installed tg copies a sandbox store.
    #[test]
    #[ignore = "needs tg installed and MESSAGING_STORE pointing at a sandbox store"]
    fn real_copy_then_zip() {
        let store = std::env::var("MESSAGING_STORE").expect("MESSAGING_STORE");
        assert!(!store.ends_with("WireCat/wirecat.db"), "never the owner's store");
        let tool = crate::catalog::tool("tg").unwrap();
        let dir = scratch("real");
        let (copy, partial) = (dir.join(".copy.db.partial"), dir.join(".out.zip.partial"));
        let events = std::sync::Mutex::new(Vec::new());
        let bytes = fs::metadata(&store).unwrap().len();
        let send = |e: BackupEvent| events.lock().unwrap().push(e);
        copy_then_zip(tool, tool.store_backup.as_ref().unwrap(), &copy, &partial, bytes, &|| false, &send).unwrap();
        let events = events.into_inner().unwrap();
        assert!(events.iter().any(|e| matches!(e, BackupEvent::Copying { done, total } if done == total)));
        assert!(matches!(events.last(), Some(BackupEvent::Compressing { done, total }) if done == total));
        let archive = zip::ZipArchive::new(File::open(&partial).unwrap()).unwrap();
        println!("store {bytes} bytes, zip {} bytes, {} events", fs::metadata(&partial).unwrap().len(), events.len());
        assert_eq!(archive.len(), 1);
    }
}
