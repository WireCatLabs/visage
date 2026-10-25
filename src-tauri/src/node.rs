use crate::install::Reason;
use crate::{paths, profile, run, system, tools};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::io::{Read, Write};
use std::path::{Path, PathBuf};
use std::time::{Duration, Instant};

const DIST: &str = "https://nodejs.org/dist";
/// The Tauri identifier from tauri.conf.json, so the runtime sits beside the app's own data and outside the
/// shared archive (`~/.local/share/WireCat`), which Storage may delete as a whole.
const APP_ID: &str = "dev.wirecat.desktop";
/// The key `install::Running` tracks a setup under; no catalog tool may use it.
pub const OPERATION: &str = "node";

/// Where the app's own Node.js lives: `<app local data>/node/v<version>/`. `WIRECAT_NODE_DIR` moves it for tests.
pub fn root() -> Option<PathBuf> {
    if let Some(dir) = std::env::var_os("WIRECAT_NODE_DIR") {
        return Some(PathBuf::from(dir));
    }
    let home = paths::home();
    let base = if cfg!(windows) {
        std::env::var_os("LOCALAPPDATA").map(PathBuf::from).or_else(|| home.map(|h| h.join("AppData/Local")))
    } else if cfg!(target_os = "macos") {
        home.map(|h| h.join("Library/Application Support"))
    } else {
        std::env::var_os("XDG_DATA_HOME")
            .map(PathBuf::from)
            .filter(|p| p.is_absolute())
            .or_else(|| home.map(|h| h.join(".local/share")))
    }?;
    Some(base.join(APP_ID).join("node"))
}

pub struct Installed {
    pub version: semver::Version,
    pub dir: PathBuf,
}

/// The newest complete runtime under `root()`; a folder only gets its final name once it is fully unpacked.
pub fn installed() -> Option<Installed> {
    let entries = std::fs::read_dir(root()?).ok()?;
    entries
        .flatten()
        .filter_map(|e| {
            let version = parse_version(&e.file_name().to_string_lossy())?;
            let dir = e.path();
            node_exe(&dir).is_file().then_some(Installed { version, dir })
        })
        .max_by(|a, b| a.version.cmp(&b.version))
}

/// Where `node`, `npm` and every tool installed with this runtime's npm are linked.
pub fn bin_dir(dir: &Path) -> PathBuf {
    if cfg!(windows) { dir.to_path_buf() } else { dir.join("bin") }
}

fn node_exe(dir: &Path) -> PathBuf {
    if cfg!(windows) { dir.join("node.exe") } else { dir.join("bin/node") }
}

/// The runtime folder a program belongs to, when it is one of ours.
pub fn owner_of(program: &Path) -> Option<PathBuf> {
    let found = installed()?;
    let bin = canonical(&bin_dir(&found.dir));
    canonical(program.parent()?).starts_with(&bin).then_some(found.dir)
}

/// The runtime the app actually runs tools with: ours only when `node` on the search path resolves to it.
pub fn in_use() -> Option<Installed> {
    let found = installed()?;
    let node = paths::find("node")?;
    canonical(&node).starts_with(canonical(&bin_dir(&found.dir))).then_some(found)
}

fn canonical(p: &Path) -> PathBuf {
    std::fs::canonicalize(p).unwrap_or_else(|_| p.to_path_buf())
}

/// Only `v<major>.<minor>.<patch>`: the version ends up in a URL and in a folder name.
fn parse_version(s: &str) -> Option<semver::Version> {
    let digits = s.strip_prefix('v')?;
    let parts: Vec<&str> = digits.split('.').collect();
    let plain = parts.len() == 3 && parts.iter().all(|p| !p.is_empty() && p.bytes().all(|b| b.is_ascii_digit()));
    plain.then(|| semver::Version::parse(digits).ok()).flatten()
}

#[derive(Debug, PartialEq, Clone, Copy)]
enum Archive {
    TarGz,
    Zip,
}

#[derive(Debug, PartialEq)]
struct Asset {
    /// The name `index.json` lists under `files`; not the same as the file name.
    index_key: &'static str,
    /// `<platform>` in `node-v24.1.0-<platform>.<ext>`, which is also the folder inside the archive.
    platform: &'static str,
    archive: Archive,
}

impl Asset {
    fn file(&self, version: &str) -> String {
        let ext = match self.archive {
            Archive::TarGz => "tar.gz",
            Archive::Zip => "zip",
        };
        format!("node-{version}-{}.{ext}", self.platform)
    }
}

/// `.tar.gz` rather than the smaller `.tar.xz`: gzip decoding is already in the dependency tree (flate2), xz
/// would add a decoder for 25 MB less download.
fn asset_for(os: &str, arch: &str) -> Option<Asset> {
    let (index_key, platform, archive) = match (os, arch) {
        ("linux", "x86_64") => ("linux-x64", "linux-x64", Archive::TarGz),
        ("linux", "aarch64") => ("linux-arm64", "linux-arm64", Archive::TarGz),
        ("macos", "x86_64") => ("osx-x64-tar", "darwin-x64", Archive::TarGz),
        ("macos", "aarch64") => ("osx-arm64-tar", "darwin-arm64", Archive::TarGz),
        ("windows", "x86_64") => ("win-x64-zip", "win-x64", Archive::Zip),
        ("windows", "aarch64") => ("win-arm64-zip", "win-arm64", Archive::Zip),
        _ => return None,
    };
    Some(Asset { index_key, platform, archive })
}

#[derive(Deserialize)]
struct Release {
    version: String,
    lts: serde_json::Value,
    files: Vec<String>,
}

/// The newest LTS release the tools accept that has a build for this computer.
fn pick(releases: &[Release], asset: &Asset) -> Option<semver::Version> {
    releases
        .iter()
        .filter(|r| !matches!(r.lts, serde_json::Value::Bool(false) | serde_json::Value::Null))
        .filter(|r| r.files.iter().any(|f| f == asset.index_key))
        .filter_map(|r| parse_version(&r.version))
        .filter(|v| system::node_supported(v).is_ok())
        .max()
}

fn checksum_for(shasums: &str, file: &str) -> Option<String> {
    shasums.lines().find_map(|line| {
        let mut parts = line.split_whitespace();
        let (hash, name) = (parts.next()?, parts.next()?);
        (name == file && hash.len() == 64 && hash.bytes().all(|b| b.is_ascii_hexdigit()))
            .then(|| hash.to_ascii_lowercase())
    })
}

fn agent() -> ureq::Agent {
    ureq::Agent::config_builder()
        .timeout_connect(Some(Duration::from_secs(30)))
        .timeout_recv_response(Some(Duration::from_mins(1)))
        // A stalled connection fails; a slow but moving download of 50 MB does not.
        .timeout_per_read(Some(Duration::from_mins(1)))
        .user_agent(concat!("WireCatDesktop/", env!("CARGO_PKG_VERSION")))
        .build()
        .into()
}

fn get_text(agent: &ureq::Agent, url: &str) -> Result<String, Failure> {
    agent
        .get(url)
        .call()
        .map_err(network)?
        .body_mut()
        .with_config()
        .limit(16 * 1024 * 1024)
        .read_to_string()
        .map_err(network)
}

struct Target {
    version: semver::Version,
    asset: Asset,
}

impl Target {
    fn tag(&self) -> String {
        format!("v{}", self.version)
    }
    fn file(&self) -> String {
        self.asset.file(&self.tag())
    }
    fn url(&self) -> String {
        format!("{DIST}/{}/{}", self.tag(), self.file())
    }
}

fn target(agent: &ureq::Agent) -> Result<Target, Failure> {
    let asset = asset_for(std::env::consts::OS, std::env::consts::ARCH).ok_or_else(|| {
        Failure::new(
            Reason::Requirements,
            format!("nodejs.org has no build for {} on {}.", std::env::consts::OS, std::env::consts::ARCH),
            Some("Install Node.js yourself from nodejs.org or your system's package manager.".into()),
        )
    })?;
    let index = get_text(agent, &format!("{DIST}/index.json"))?;
    let releases: Vec<Release> = serde_json::from_str(&index).map_err(|e| {
        Failure::new(Reason::Failed, format!("nodejs.org sent a release list we cannot read: {e}"), None)
    })?;
    let version = pick(&releases, &asset).ok_or_else(|| {
        Failure::new(Reason::Failed, "nodejs.org lists no LTS release WireCat tools can use.".into(), None)
    })?;
    Ok(Target { version, asset })
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Offer {
    pub version: String,
    pub bytes: Option<u64>,
    /// Where it will be unpacked, shortened with `~`.
    pub dir: String,
}

/// What "Set up Node.js for me" would download, so the button can name the version and size before anything starts.
pub fn offer() -> Result<Offer, String> {
    let agent = agent();
    let target = target(&agent).map_err(|f| f.message)?;
    let bytes = agent
        .head(&target.url())
        .call()
        .ok()
        .and_then(|r| r.headers().get("content-length")?.to_str().ok()?.parse().ok());
    let dir = root().ok_or("Your home folder is unknown.")?.join(target.tag());
    Ok(Offer { version: target.version.to_string(), bytes, dir: paths::tilde(&dir.to_string_lossy()) })
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase", rename_all_fields = "camelCase", tag = "event")]
pub enum NodeEvent {
    Step { step: Step },
    Progress { received: u64, total: Option<u64> },
    Done { version: String, path: String },
    Failed { reason: Reason, message: String, hint: Option<String> },
}

#[derive(Serialize, Clone, Copy, Debug, PartialEq)]
#[serde(rename_all = "camelCase")]
pub enum Step {
    Check,
    Download,
    Verify,
    Unpack,
}

#[derive(Debug)]
pub struct Failure {
    reason: Reason,
    message: String,
    hint: Option<String>,
}

impl Failure {
    fn new(reason: Reason, message: String, hint: Option<String>) -> Self {
        Self { reason, message, hint }
    }
    pub fn no_home() -> Self {
        Self::new(Reason::Failed, "Your home folder is unknown, so there is nowhere to put Node.js.".into(), None)
    }
}

impl From<Failure> for NodeEvent {
    fn from(f: Failure) -> Self {
        NodeEvent::Failed { reason: f.reason, message: f.message, hint: f.hint }
    }
}

fn network(e: impl std::fmt::Display) -> Failure {
    Failure::new(
        Reason::Network,
        format!("Could not download from nodejs.org: {e}"),
        Some("Check your internet connection or proxy, then try again.".into()),
    )
}

fn disk(what: &str, path: &Path, e: &std::io::Error) -> Failure {
    let reason = if e.kind() == std::io::ErrorKind::PermissionDenied { Reason::Permission } else { Reason::Failed };
    Failure::new(reason, format!("Could not {what} {}: {e}", paths::tilde(&path.to_string_lossy())), None)
}

fn cancelled_failure() -> Failure {
    Failure::new(Reason::Cancelled, "Node.js setup cancelled.".into(), None)
}

/// Deletes the half-finished download and unpack folder however setup ends.
struct Scratch(PathBuf);

impl Drop for Scratch {
    fn drop(&mut self) {
        let _ = std::fs::remove_dir_all(&self.0);
    }
}

/// Downloads the newest usable LTS build from nodejs.org into `root`, checks it against the published SHA-256,
/// and unpacks it. Nothing outside `root` is touched; the folder appears under its final name only when complete.
pub fn setup(root: &Path, emit: &dyn Fn(NodeEvent), cancelled: &dyn Fn() -> bool) -> Result<Installed, Failure> {
    emit(NodeEvent::Step { step: Step::Check });
    let agent = agent();
    let target = target(&agent)?;
    let final_dir = root.join(target.tag());
    if node_exe(&final_dir).is_file() {
        return Ok(Installed { version: target.version, dir: final_dir });
    }
    std::fs::create_dir_all(root).map_err(|e| disk("create", root, &e))?;
    let nanos = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).map_or(0, |d| d.subsec_nanos());
    let scratch = Scratch(root.join(format!(".partial-{}-{nanos}", std::process::id())));
    std::fs::create_dir(&scratch.0).map_err(|e| disk("create", &scratch.0, &e))?;

    emit(NodeEvent::Step { step: Step::Download });
    let archive = scratch.0.join(target.file());
    let digest = download(&agent, &target.url(), &archive, emit, cancelled)?;

    emit(NodeEvent::Step { step: Step::Verify });
    let shasums = get_text(&agent, &format!("{DIST}/{}/SHASUMS256.txt", target.tag()))?;
    let expected = checksum_for(&shasums, &target.file()).ok_or_else(|| {
        Failure::new(Reason::Verify, format!("nodejs.org publishes no checksum for {}.", target.file()), None)
    })?;
    if digest != expected {
        return Err(Failure::new(
            Reason::Verify,
            "The download does not match the checksum nodejs.org publishes, so it was thrown away.".into(),
            Some("Try again. If it keeps failing, something between you and nodejs.org changes downloads.".into()),
        ));
    }
    if cancelled() {
        return Err(cancelled_failure());
    }

    emit(NodeEvent::Step { step: Step::Unpack });
    let unpacked = scratch.0.join("unpacked");
    extract(target.asset.archive, &archive, &unpacked)?;
    let inner = unpacked.join(format!("node-{}-{}", target.tag(), target.asset.platform));
    if !node_exe(&inner).is_file() {
        return Err(Failure::new(Reason::Verify, "The archive does not contain Node.js where expected.".into(), None));
    }
    std::fs::rename(&inner, &final_dir).map_err(|e| disk("move Node.js into", &final_dir, &e))?;
    drop(scratch);

    let out = run::run(&node_exe(&final_dir), &["--version"], None, Duration::from_secs(15));
    match out {
        Ok(o) if o.code == Some(0) && o.stdout.trim() == target.tag() => {}
        _ => {
            let _ = std::fs::remove_dir_all(&final_dir);
            return Err(Failure::new(
                Reason::Verify,
                "The downloaded Node.js does not start on this computer.".into(),
                Some("Install Node.js yourself from nodejs.org or your system's package manager.".into()),
            ));
        }
    }
    Ok(Installed { version: target.version, dir: final_dir })
}

/// Streams to disk and hashes on the way, so the archive is never held in memory.
fn download(
    agent: &ureq::Agent,
    url: &str,
    to: &Path,
    emit: &dyn Fn(NodeEvent),
    cancelled: &dyn Fn() -> bool,
) -> Result<String, Failure> {
    let mut response = agent.get(url).call().map_err(network)?;
    let total = response.body().content_length();
    let mut reader = response.body_mut().as_reader();
    let mut file = std::fs::File::create(to).map_err(|e| disk("write", to, &e))?;
    let mut hasher = Sha256::new();
    let mut buf = vec![0u8; 64 * 1024];
    let mut received = 0u64;
    let mut last = Instant::now();
    emit(NodeEvent::Progress { received, total });
    loop {
        if cancelled() {
            return Err(cancelled_failure());
        }
        let n = reader.read(&mut buf).map_err(network)?;
        if n == 0 {
            break;
        }
        hasher.update(&buf[..n]);
        file.write_all(&buf[..n]).map_err(|e| disk("write", to, &e))?;
        received += n as u64;
        if last.elapsed() >= Duration::from_millis(100) {
            emit(NodeEvent::Progress { received, total });
            last = Instant::now();
        }
    }
    file.flush().map_err(|e| disk("write", to, &e))?;
    emit(NodeEvent::Progress { received, total });
    Ok(format!("{:x}", hasher.finalize()))
}

/// Both archive kinds are compiled everywhere so the Windows path is built and tested on every platform.
fn extract(kind: Archive, archive: &Path, into: &Path) -> Result<(), Failure> {
    let unpack = |e: &dyn std::fmt::Display| {
        Failure::new(
            Reason::Verify,
            format!("Could not unpack {}: {e}", paths::tilde(&archive.to_string_lossy())),
            None,
        )
    };
    let file = std::fs::File::open(archive).map_err(|e| disk("read", archive, &e))?;
    match kind {
        Archive::TarGz => {
            let mut tar = tar::Archive::new(flate2::read::GzDecoder::new(std::io::BufReader::new(file)));
            tar.set_preserve_permissions(true);
            // `unpack` refuses entries that would land outside `into`.
            tar.unpack(into).map_err(|e| unpack(&e))
        }
        Archive::Zip => {
            let mut zip = zip::ZipArchive::new(file).map_err(|e| unpack(&e))?;
            // `extract` only writes entries whose names stay inside `into` (`enclosed_name`).
            zip.extract(into).map_err(|e| unpack(&e))
        }
    }
}

/// Deletes the app's Node.js once no installed tool runs on it. The PATH block goes with it, since it would point
/// at nothing.
pub fn remove() -> Result<(), String> {
    let found = installed().ok_or("WireCat has not set up Node.js on this computer.")?;
    let bin = canonical(&bin_dir(&found.dir));
    let using: Vec<String> = tools::detect_owners(false)
        .into_iter()
        .filter(|t| t.installs.iter().any(|i| canonical(&expand(&i.path)).starts_with(&bin)))
        .map(|t| t.id)
        .collect();
    if !using.is_empty() {
        return Err(format!("These tools run on it: {}. Uninstall them first.", using.join(", ")));
    }
    ensure_runtime(&found.dir)?;
    if profile::plan(&bin_dir(&found.dir)).added {
        profile::remove(&bin_dir(&found.dir))?;
    }
    std::fs::remove_dir_all(&found.dir)
        .map_err(|e| format!("Could not delete {}: {e}", paths::tilde(&found.dir.to_string_lossy())))?;
    if let Some(root) = root() {
        let _ = std::fs::remove_dir(root);
    }
    paths::refresh(&[]);
    Ok(())
}

/// `tools::detect` reports paths with `~`; turn them back into real ones.
fn expand(shown: &str) -> PathBuf {
    match (shown.strip_prefix('~'), paths::home()) {
        (Some(rest), Some(home)) => home.join(rest.trim_start_matches(['/', '\\'])),
        _ => PathBuf::from(shown),
    }
}

/// A last check before `remove_dir_all`: only a `v<semver>` folder that holds a Node.js binary, never the root
/// itself, so a `WIRECAT_NODE_DIR` pointing at the home folder cannot turn into deleting it.
fn ensure_runtime(dir: &Path) -> Result<(), String> {
    let named = dir.file_name().and_then(|n| parse_version(&n.to_string_lossy())).is_some();
    let under_root = root().is_some_and(|r| dir.parent() == Some(r.as_path()));
    if named && under_root && node_exe(dir).is_file() && dir.is_absolute() {
        Ok(())
    } else {
        Err(format!("Refusing to delete {}: it does not look like WireCat's Node.js.", dir.display()))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn release(version: &str, lts: serde_json::Value, files: &[&str]) -> Release {
        Release { version: version.into(), lts, files: files.iter().map(|s| (*s).to_string()).collect() }
    }

    #[test]
    fn names_the_asset_for_each_platform() {
        let file = |os, arch| asset_for(os, arch).map(|a| a.file("v24.22.1"));
        assert_eq!(file("linux", "x86_64").as_deref(), Some("node-v24.22.1-linux-x64.tar.gz"));
        assert_eq!(file("macos", "aarch64").as_deref(), Some("node-v24.22.1-darwin-arm64.tar.gz"));
        assert_eq!(file("windows", "x86_64").as_deref(), Some("node-v24.22.1-win-x64.zip"));
        assert_eq!(asset_for("macos", "x86_64").unwrap().index_key, "osx-x64-tar");
        assert_eq!(asset_for("freebsd", "x86_64"), None);
    }

    #[test]
    fn picks_the_newest_supported_lts_with_a_build() {
        let lts = |s: &str| serde_json::Value::String(s.into());
        let releases = vec![
            release("v26.1.0", serde_json::Value::Bool(false), &["linux-x64", "win-arm64-zip"]),
            release("v24.22.1", lts("Krypton"), &["linux-x64"]),
            release("v24.22.0", lts("Krypton"), &["linux-x64", "win-arm64-zip"]),
            release("v22.20.0", lts("Jod"), &["linux-x64", "win-arm64-zip"]),
            release("v22.15.0", lts("Jod"), &["linux-x64"]),
            release("v24.99.0-rc.1", lts("Krypton"), &["linux-x64"]),
        ];
        let v = |os, arch| pick(&releases, &asset_for(os, arch).unwrap()).map(|v| v.to_string());
        assert_eq!(v("linux", "x86_64").as_deref(), Some("24.22.1"));
        assert_eq!(v("windows", "aarch64").as_deref(), Some("24.22.0"));
        assert_eq!(v("macos", "aarch64"), None);
    }

    #[test]
    fn reads_only_exact_checksum_lines() {
        let sums = "\
89c682593d76cd44233fa53b1563264e7de9cbb189cad169135c5b4fadfbc0a7  node-v24.22.1-darwin-arm64.tar.gz
9b250d29d6ab8ae38dd23019e2c04a6d6b2916ab1dad721c5f6e1da2b2901c6a  node-v24.22.1-linux-x64-musl.tar.gz
EB6728E77C576A35162C122C45CCADF224D89FF00ABC8DAE46CC2897C6002D7C  node-v24.22.1-linux-x64.tar.gz
nothex  node-v24.22.1-win-x64.zip
";
        assert_eq!(
            checksum_for(sums, "node-v24.22.1-linux-x64.tar.gz").as_deref(),
            Some("eb6728e77c576a35162c122c45ccadf224d89ff00abc8dae46cc2897c6002d7c")
        );
        assert_eq!(checksum_for(sums, "node-v24.22.1-win-x64.zip"), None);
        assert_eq!(checksum_for(sums, "linux-x64.tar.gz"), None);
    }

    #[test]
    fn accepts_only_plain_release_versions() {
        assert!(parse_version("v24.22.1").is_some());
        assert!(parse_version("24.22.1").is_none());
        assert!(parse_version("v24.22.1-rc.1").is_none());
        assert!(parse_version("v24.22.1/../x").is_none());
        assert!(parse_version(".partial-1-2").is_none());
    }

    #[test]
    fn unpacks_a_zip_inside_the_target_only() {
        let dir = std::env::temp_dir().join(format!("wirecat-zip-{}", std::process::id()));
        std::fs::create_dir_all(&dir).unwrap();
        let archive = dir.join("a.zip");
        {
            let mut zip = zip::ZipWriter::new(std::fs::File::create(&archive).unwrap());
            let opts = zip::write::SimpleFileOptions::default().compression_method(zip::CompressionMethod::Deflated);
            zip.start_file("node-v1.0.0-win-x64/node.exe", opts).unwrap();
            zip.write_all(b"MZ").unwrap();
            zip.start_file("../escape.txt", opts).unwrap();
            zip.write_all(b"no").unwrap();
            zip.finish().unwrap();
        }
        let out = dir.join("out");
        let _ = extract(Archive::Zip, &archive, &out);
        assert!(out.join("node-v1.0.0-win-x64/node.exe").is_file());
        assert!(!dir.join("escape.txt").exists());
        std::fs::remove_dir_all(&dir).unwrap();
    }

    /// One real download, checksum and unpack from nodejs.org into a throwaway folder:
    /// `WIRECAT_NODE_TEST_DIR=/some/tmp cargo test node::tests::real_setup -- --ignored --nocapture`
    #[test]
    #[ignore = "downloads about 60 MB from nodejs.org"]
    fn real_setup() {
        let root = PathBuf::from(std::env::var("WIRECAT_NODE_TEST_DIR").expect("WIRECAT_NODE_TEST_DIR"));
        let empty = std::fs::read_dir(&root).map_or(true, |mut d| d.next().is_none());
        assert!(empty, "WIRECAT_NODE_TEST_DIR must be empty, or setup finds the runtime and downloads nothing");
        let steps = std::sync::Mutex::new(Vec::new());
        let emit = |e: NodeEvent| {
            if let NodeEvent::Step { step } = e {
                steps.lock().unwrap().push(step);
            }
        };
        let done = setup(&root, &emit, &|| false).expect("setup");
        assert_eq!(*steps.lock().unwrap(), vec![Step::Check, Step::Download, Step::Verify, Step::Unpack]);
        let npm = bin_dir(&done.dir).join(if cfg!(windows) { "npm.cmd" } else { "npm" });
        let path = std::env::join_paths([bin_dir(&done.dir)]).unwrap();
        let out = run::run(&npm, &["--version"], Some(&path), Duration::from_secs(30)).unwrap();
        println!("node {} at {}, npm {}", done.version, done.dir.display(), out.stdout.trim());
        assert_eq!(out.code, Some(0));
        let leftovers: Vec<_> = std::fs::read_dir(&root).unwrap().flatten().map(|e| e.file_name()).collect();
        assert_eq!(leftovers.len(), 1, "only the finished runtime is left: {leftovers:?}");
    }
}
