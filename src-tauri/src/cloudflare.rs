use crate::{catalog, cloudflare_install, mcp_server, node, paths, run};
use serde::{Deserialize, Serialize};
use std::fmt::Write;
use std::net::TcpListener;
use std::path::{Path, PathBuf};
use std::process::Stdio;
use std::sync::Mutex;
use std::time::{Duration, Instant};

// A Cloudflare Tunnel on the owner's own Cloudflare account and domain, the fallback when Tailscale Funnel cannot give
// an address (NEED-101 A; plan `docs/dev/plans/2026-10-27-cloudflare-fallback.md`). One locally managed tunnel, one
// hostname, a path per tool as with Funnel. cloudflared is cloudflared's own release in the app's data folder, run as
// the user. Secrets live in the OS keyring only: the login certificate until the tunnel exists, then the tunnel's
// credentials, handed to cloudflared in its environment (`TUNNEL_CRED_CONTENTS`), never in an argument.

const KEYRING: &str = "dev.wirecat.desktop";
const CERT: &str = "cloudflare-cert";
const CREDENTIALS: &str = "cloudflare-tunnel-credentials";
/// Only the login page on Cloudflare's dashboard is opened from cloudflared's output.
const PAGE_HOST: &str = "dash.cloudflare.com";
/// The login waits for the person in the browser.
const WAIT: Duration = Duration::from_mins(10);
/// cloudflared registers its first connection to Cloudflare within seconds; a slow network gets this long.
const READY: Duration = Duration::from_secs(30);

pub const LOGIN: &str = "cloudflare-login";
pub const INSTALL: &str = "cloudflare-install";

fn dir() -> Result<PathBuf, String> {
    node::app_data().map(|d| d.join("cloudflared")).ok_or_else(|| "no folder for the app's data".into())
}

fn program() -> Result<PathBuf, String> {
    Ok(dir()?.join(if cfg!(windows) { "cloudflared.exe" } else { "cloudflared" }))
}

fn secret(name: &str) -> Result<keyring::Entry, String> {
    keyring::Entry::new(KEYRING, name).map_err(|e| format!("Could not open the system keyring: {e}"))
}

fn read_secret(name: &str) -> Result<Option<String>, String> {
    match secret(name)?.get_password() {
        Ok(s) => Ok(Some(s)),
        Err(keyring::Error::NoEntry) => Ok(None),
        Err(e) => Err(format!("Could not read the system keyring: {e}")),
    }
}

fn write_secret(name: &str, value: &str) -> Result<(), String> {
    secret(name)?.set_password(value).map_err(|e| format!("Could not save to the system keyring: {e}"))
}

fn forget_secret(name: &str) -> Result<(), String> {
    match secret(name)?.delete_credential() {
        Ok(()) | Err(keyring::Error::NoEntry) => Ok(()),
        Err(e) => Err(format!("Could not remove it from the system keyring: {e}")),
    }
}

/// A secret cloudflared can only read from a file (the login certificate), for the length of one command: owner-only,
/// in the app's folder, and gone when this drops.
struct Scratch(PathBuf);

impl Scratch {
    fn new(name: &str, body: Option<&str>) -> Result<Scratch, String> {
        let path = dir()?.join(name);
        std::fs::create_dir_all(path.parent().ok_or("no folder")?).map_err(|e| e.to_string())?;
        let _ = std::fs::remove_file(&path);
        if let Some(body) = body {
            let mut options = std::fs::OpenOptions::new();
            options.write(true).create_new(true);
            #[cfg(unix)]
            {
                use std::os::unix::fs::OpenOptionsExt;
                options.mode(0o600);
            }
            let mut file = options.open(&path).map_err(|e| e.to_string())?;
            std::io::Write::write_all(&mut file, body.as_bytes()).map_err(|e| e.to_string())?;
        }
        Ok(Scratch(path))
    }

    fn arg(&self) -> String {
        self.0.to_string_lossy().into_owned()
    }
}

impl Drop for Scratch {
    fn drop(&mut self) {
        let _ = std::fs::remove_file(&self.0);
    }
}

/// What the app keeps about the tunnel: no secret, only where it goes and what runs.
#[derive(Serialize, Deserialize, Clone, Debug, Default, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
struct Record {
    hostname: String,
    tunnel_id: String,
    #[serde(default)]
    routes: Vec<Route>,
    /// The cloudflared the app started, and the local port of its readiness page.
    #[serde(default)]
    pid: Option<u32>,
    #[serde(default)]
    metrics: Option<u16>,
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
struct Route {
    tool: String,
    port: u16,
}

fn record_file() -> Result<PathBuf, String> {
    Ok(dir()?.join("tunnel.json"))
}

fn load() -> Option<Record> {
    serde_json::from_slice(&std::fs::read(record_file().ok()?).ok()?).ok()
}

fn save(r: &Record) -> Result<(), String> {
    let file = record_file()?;
    std::fs::create_dir_all(file.parent().ok_or("no folder")?).map_err(|e| e.to_string())?;
    let body = serde_json::to_vec_pretty(r).map_err(|e| e.to_string())?;
    std::fs::write(&file, body).map_err(|e| format!("Could not save {}: {e}", paths::tilde(&file.to_string_lossy())))
}

/// A name on the owner's domain for the address: a subdomain (the domain itself usually serves a website), in the
/// plain letters DNS allows, lowercased.
pub fn validate_hostname(name: &str) -> Result<String, String> {
    let h = name.trim().trim_end_matches('.').to_ascii_lowercase();
    let label_ok = |l: &str| {
        (1..=63).contains(&l.len())
            && !l.starts_with('-')
            && !l.ends_with('-')
            && l.chars().all(|c| c.is_ascii_alphanumeric() || c == '-')
    };
    let labels: Vec<&str> = h.split('.').collect();
    let tld_ok = labels.last().is_some_and(|t| t.chars().any(|c| c.is_ascii_alphabetic()));
    if h.len() > 253 || labels.len() < 3 || !labels.iter().all(|l| label_ok(l)) || !tld_ok {
        return Err(format!(
            "“{}” is not a name on a domain. Use a new name under your domain, such as wirecat.example.com.",
            name.trim()
        ));
    }
    Ok(h)
}

/// The paths a tool takes on the shared address, as in `tailscale::mounts`: its own and the two places RFC 8414 and
/// RFC 9728 put the login metadata of an issuer under a path. cloudflared matches `path` as a regular expression and
/// passes the whole path on.
fn path_rules(tool: &str) -> [String; 3] {
    let t = regex::escape(tool);
    [
        format!("^/{t}(/|$)"),
        format!(r"^/\.well-known/oauth-authorization-server/{t}(/|$)"),
        format!(r"^/\.well-known/oauth-protected-resource/{t}(/|$)"),
    ]
}

/// cloudflared's configuration: the tool paths of the one hostname, everything else 404. Values are quoted for YAML;
/// the hostname and tool ids were checked before, so nothing here needs escaping beyond that.
fn config_of(r: &Record) -> String {
    let mut yaml =
        String::from("# Written by WireCat Desktop; changes here are replaced on the next start.\ningress:\n");
    for route in &r.routes {
        for path in path_rules(&route.tool) {
            let _ = write!(
                yaml,
                "  - hostname: \"{}\"\n    path: '{path}'\n    service: \"http://127.0.0.1:{}\"\n",
                r.hostname, route.port
            );
        }
    }
    yaml.push_str("  - service: \"http_status:404\"\n");
    yaml
}

fn url_of(r: &Record, tool: &str) -> String {
    format!("https://{}/{tool}", r.hostname)
}

#[derive(Serialize, Debug, PartialEq, Eq, Default)]
#[serde(rename_all = "camelCase")]
#[expect(clippy::struct_excessive_bools, reason = "one answer per step of the guide")]
pub struct Status {
    pub os: &'static str,
    /// cloudflared publishes a build for this computer.
    pub supported: bool,
    pub installed: bool,
    pub version: Option<String>,
    /// The login certificate is in the keyring: the next step is the address.
    pub signed_in: bool,
    /// The tunnel exists and its credentials are in the keyring.
    pub hostname: Option<String>,
    pub running: bool,
}

fn version(program: &Path) -> Option<String> {
    let out = run::run(program, &["--version"], None, Duration::from_secs(10)).ok()?;
    let line = out.stdout.lines().next()?.trim().strip_prefix("cloudflared version ")?;
    let v = line.split_whitespace().next()?;
    v.chars().all(|c| c.is_ascii_digit() || c == '.').then(|| v.to_string())
}

pub fn status() -> Status {
    let os = cloudflare_install::os();
    let mut s =
        Status { os, supported: cloudflare_install::asset(os, std::env::consts::ARCH).is_some(), ..Status::default() };
    let Ok(program) = program() else { return s };
    s.version = program.is_file().then(|| version(&program)).flatten();
    s.installed = s.version.is_some();
    s.signed_in = read_secret(CERT).ok().flatten().is_some();
    if let Some(r) = load()
        && read_secret(CREDENTIALS).ok().flatten().is_some()
    {
        s.running = ready(&r);
        s.hostname = Some(r.hostname);
    }
    s
}

pub fn install(cancelled: &dyn Fn() -> bool) -> Result<String, String> {
    let to = program()?;
    let _one = TUNNEL.lock().unwrap_or_else(std::sync::PoisonError::into_inner);
    // Replaced under a running cloudflared, Windows refuses the file and Linux shows the old one as deleted, so it could
    // no longer be recognised and stopped. The tunnel starts again with the next server start.
    if let Some(mut r) = load() {
        stop_running(Some(&r));
        r.pid = None;
        r.metrics = None;
        save(&r)?;
    }
    cloudflare_install::download(&to, cancelled)
}

/// A login page from cloudflared's output: https on Cloudflare's dashboard, nothing else.
fn page_url(line: &str) -> Option<String> {
    line.split_whitespace().find_map(|word| {
        let rest = word.strip_prefix("https://")?;
        let host = rest.split(['/', '?']).next()?;
        let safe = word.chars().all(|c| c.is_ascii_graphic() && !matches!(c, '"' | '\'' | '<' | '>' | '\\' | '`'));
        (host == PAGE_HOST && safe).then(|| word.to_string())
    })
}

#[derive(Serialize, Clone, Debug, PartialEq, Eq)]
#[serde(rename_all = "camelCase", tag = "event")]
pub enum PageEvent {
    /// The Cloudflare login page opened in the browser. The address is a one-time link; never logged.
    Opened { url: String },
}

struct Out {
    code: Option<i32>,
    text: String,
}

/// Runs cloudflared with the certificate given by path; output is gathered, never logged, since it can name the
/// account's domains.
fn exec(args: &[&str], timeout: Duration) -> Result<Out, String> {
    let mut text = String::new();
    let code = run::stream(
        run::command(&program()?, args, None),
        timeout,
        || false,
        |line| {
            let (run::Line::Out(s) | run::Line::Err(s)) = line;
            text.push_str(&s);
            text.push('\n');
        },
    )
    .map_err(|e| format!("Could not run cloudflared: {e}"))?;
    Ok(Out { code, text })
}

/// The last thing cloudflared said, without its log prefix (`2026-10-27T12:00:00Z ERR`).
fn said(text: &str) -> String {
    let line = text.lines().map(str::trim).rfind(|l| !l.is_empty()).unwrap_or("it said nothing");
    let mut words = line.splitn(3, ' ');
    match (words.next(), words.next(), words.next()) {
        (Some(t), Some(level), Some(rest)) if t.contains('T') && matches!(level, "ERR" | "INF" | "WRN" | "DBG") => {
            rest.to_string()
        }
        _ => line.to_string(),
    }
}

/// `cloudflared tunnel login` writes the certificate to `~/.cloudflared/cert.pem` whatever `--origincert` says, and
/// exits 0 without logging in when one is there. So it runs with a home folder of its own, never touching the owner's
/// `~/.cloudflared`, and with a PATH that has no browser opener: it then prints the page instead of opening it, and
/// the app opens it in the owner's own browser (a browser started with that home would be a new, empty profile).
pub fn login(stopped: &dyn Fn() -> bool, send: &dyn Fn(PageEvent)) -> Result<(), String> {
    let home = dir()?.join("login-home");
    let no_browser = dir()?.join("no-browser");
    for d in [&home, &no_browser] {
        std::fs::create_dir_all(d).map_err(|e| e.to_string())?;
    }
    let cert = Scratch(home.join(".cloudflared").join("cert.pem"));
    let _ = std::fs::remove_file(&cert.0);
    let mut cmd = run::command(&program()?, &["tunnel", "login"], Some(no_browser.as_os_str()));
    cmd.env("HOME", &home).env("USERPROFILE", &home).env_remove("DISPLAY").env_remove("WAYLAND_DISPLAY");
    let mut opened = false;
    let mut text = String::new();
    let result = run::stream(cmd, WAIT, stopped, |line| {
        let (run::Line::Out(s) | run::Line::Err(s)) = line;
        if !opened && let Some(url) = page_url(&s) {
            opened = true;
            let _ = tauri_plugin_opener::open_url(&url, None::<&str>);
            send(PageEvent::Opened { url });
        } else {
            text.push_str(&s);
            text.push('\n');
        }
    });
    match result {
        Ok(Some(0)) => {}
        Ok(_) => return Err(format!("Cloudflare did not log in: {}", said(&text))),
        Err(run::RunError::Cancelled) => return Err("Stopped.".into()),
        Err(run::RunError::TimedOut) => {
            return Err(format!("Nothing happened in the browser for {} minutes.", WAIT.as_secs() / 60));
        }
        Err(e) => return Err(format!("Could not run cloudflared: {e}")),
    }
    let pem = std::fs::read_to_string(&cert.0).map_err(|_| "cloudflared logged in but saved no certificate.")?;
    write_secret(CERT, &pem)
}

/// The name `tunnel route dns` actually added (`cfapi/hostname.go`: "Added CNAME <name> which will route to this
/// tunnel", or "<name> is already configured to route to your tunnel"). Given a name outside the domain chosen at
/// login, cloudflared adds it under that domain instead (`wirecat.other.com.example.com`, cloudflared#1295).
fn routed_name(text: &str) -> Option<String> {
    let name = text.lines().find_map(|l| {
        if let Some((_, rest)) = l.split_once("Added CNAME ") {
            rest.split_whitespace().next()
        } else {
            l.split_once(" is already configured to route").and_then(|(before, _)| before.split_whitespace().last())
        }
    })?;
    Some(name.trim_end_matches('.').to_ascii_lowercase())
}

/// The tunnel's id from its credentials, the JSON `tunnel create --cred-file` writes.
fn tunnel_id(credentials: &str) -> Option<String> {
    let v: serde_json::Value = serde_json::from_str(credentials).ok()?;
    let id = v["TunnelID"].as_str()?;
    let uuid = id.len() == 36 && id.chars().all(|c| c.is_ascii_hexdigit() || c == '-');
    (uuid && v["TunnelSecret"].is_string()).then(|| id.to_ascii_lowercase())
}

fn tunnel_name(hostname: &str) -> String {
    format!("wirecat-{}", hostname.replace('.', "-"))
}

/// Makes the tunnel and its DNS record on the owner's domain, then keeps the tunnel's credentials in the keyring and the
/// certificate no longer: from here on `WireCat` can run this one tunnel and nothing else in the account.
pub fn create(hostname: &str) -> Result<String, String> {
    let host = validate_hostname(hostname)?;
    let _one = TUNNEL.lock().unwrap_or_else(std::sync::PoisonError::into_inner);
    let pem = read_secret(CERT)?.ok_or("Connect your Cloudflare account first.")?;
    let cert = Scratch::new("cert.pem", Some(&pem))?;
    let creds = Scratch::new("credentials.json", None)?;
    let (cert_arg, creds_arg) = (cert.arg(), creds.arg());
    let name = tunnel_name(&host);
    let base = ["tunnel", "--origincert", cert_arg.as_str()];
    let minute = Duration::from_mins(1);
    let made = exec(&[&base[..], &["create", "--cred-file", &creds_arg, &name]].concat(), minute)?;
    if made.code != Some(0) {
        if !made.text.contains("tunnel with name already exists") {
            return Err(format!("Cloudflare did not make the tunnel: {}", said(&made.text)));
        }
        // An earlier try made it; its credentials are all that is needed.
        let again = exec(&[&base[..], &["token", "--cred-file", &creds_arg, &name]].concat(), minute)?;
        if again.code != Some(0) {
            return Err(format!("Cloudflare did not give the tunnel {name}: {}", said(&again.text)));
        }
    }
    let credentials =
        std::fs::read_to_string(&creds.0).map_err(|_| "cloudflared wrote no credentials for the tunnel.")?;
    let id = tunnel_id(&credentials).ok_or("cloudflared wrote credentials WireCat cannot read.")?;
    let routed = exec(&[&base[..], &["route", "dns", &id, &host]].concat(), minute)?;
    if routed.code != Some(0) {
        return Err(format!(
            "Cloudflare did not add {host}: {}. If the name already has a DNS record, choose another name.",
            said(&routed.text)
        ));
    }
    if let Some(added) = routed_name(&routed.text)
        && added != host
    {
        return Err(format!(
            "{host} is not on the domain you chose when you connected Cloudflare, so Cloudflare added {added} \
             instead. Delete that record on Cloudflare's DNS page, then choose a name under the domain you connected."
        ));
    }
    write_secret(CREDENTIALS, &credentials)?;
    let old = load();
    stop_running(old.as_ref());
    let kept = old.filter(|r| r.hostname == host).map(|r| r.routes).unwrap_or_default();
    save(&Record { hostname: host.clone(), tunnel_id: id, routes: kept, pid: None, metrics: None })?;
    forget_secret(CERT)?;
    Ok(host)
}

static TUNNEL: Mutex<()> = Mutex::new(());

fn free_port() -> Result<u16, String> {
    let l = TcpListener::bind("127.0.0.1:0").map_err(|e| e.to_string())?;
    l.local_addr().map(|a| a.port()).map_err(|e| e.to_string())
}

/// cloudflared's readiness page answers 200 once it holds a connection to Cloudflare.
fn ready(r: &Record) -> bool {
    let Some(port) = r.metrics else { return false };
    if !r.pid.is_some_and(is_ours) {
        return false;
    }
    let agent: ureq::Agent = ureq::Agent::config_builder().timeout_global(Some(Duration::from_secs(2))).build().into();
    agent.get(&format!("http://127.0.0.1:{port}/ready")).call().is_ok()
}

/// The process is the cloudflared in the app's folder, not another program that got its number since.
fn is_ours(pid: u32) -> bool {
    let Ok(program) = program() else { return false };
    if cfg!(target_os = "linux") {
        return std::fs::read_link(format!("/proc/{pid}/exe")).is_ok_and(|exe| exe == program);
    }
    let pid = pid.to_string();
    if cfg!(windows) {
        let out = run::run(
            Path::new("tasklist"),
            &["/FI", &format!("PID eq {pid}"), "/FO", "CSV", "/NH"],
            None,
            Duration::from_secs(10),
        );
        return out.is_ok_and(|o| o.stdout.to_ascii_lowercase().starts_with("\"cloudflared.exe\""));
    }
    let out = run::run(Path::new("/bin/ps"), &["-p", &pid, "-o", "comm="], None, Duration::from_secs(10));
    out.is_ok_and(|o| Path::new(o.stdout.trim()) == program)
}

#[allow(unsafe_code)] // libc::kill with SIGTERM on a pid checked to be our cloudflared; std cannot signal a non-child
fn terminate(pid: u32) {
    #[cfg(unix)]
    if let Ok(pid) = i32::try_from(pid) {
        // SAFETY: plain syscall; no memory is touched.
        unsafe {
            libc::kill(pid, libc::SIGTERM);
        }
    }
    #[cfg(windows)]
    {
        let _ = run::run(Path::new("taskkill"), &["/PID", &pid.to_string(), "/F"], None, Duration::from_secs(10));
    }
}

/// Stops the cloudflared the app started, by its recorded number and only while it is still that program.
fn stop_running(r: Option<&Record>) {
    let Some(pid) = r.and_then(|r| r.pid).filter(|p| is_ours(*p)) else { return };
    terminate(pid);
    let until = Instant::now() + Duration::from_secs(5);
    while is_ours(pid) && Instant::now() < until {
        std::thread::sleep(Duration::from_millis(100));
    }
}

/// Starts cloudflared in the background with the routes of `r`, and waits until it holds a connection. It outlives
/// the app, as the tools' servers do.
fn start(r: &mut Record, credentials: &str) -> Result<(), String> {
    let dir = dir()?;
    let config = dir.join("config.yml");
    std::fs::write(&config, config_of(r)).map_err(|e| format!("Could not write cloudflared's settings: {e}"))?;
    let log = std::fs::File::create(dir.join("cloudflared.log")).map_err(|e| e.to_string())?;
    let metrics = free_port()?;
    let (config_arg, metrics_arg) = (config.to_string_lossy().into_owned(), format!("127.0.0.1:{metrics}"));
    // `--config` always: without it cloudflared would also read `~/.cloudflared` and `/etc/cloudflared`.
    // `--no-autoupdate`: a binary not from a package updates itself and exits with 11 for something else to restart.
    let args = ["tunnel", "--no-autoupdate", "--config", &config_arg, "--metrics", &metrics_arg, "run", &r.tunnel_id];
    let mut cmd = run::command(&program()?, &args, None);
    cmd.stdout(Stdio::null()).stderr(log).env("TUNNEL_CRED_CONTENTS", credentials);
    let mut child = cmd.spawn().map_err(|e| format!("Could not start cloudflared: {e}"))?;
    r.pid = Some(child.id());
    r.metrics = Some(metrics);
    save(r)?;
    let until = Instant::now() + READY;
    let log = || std::fs::read_to_string(dir.join("cloudflared.log")).unwrap_or_default();
    loop {
        if let Ok(Some(_)) = child.try_wait() {
            return Err(format!("cloudflared stopped: {}", said(&log())));
        }
        if ready(r) {
            // Reaped in the background, so a cloudflared that ends later leaves no zombie behind.
            std::thread::spawn(move || child.wait());
            return Ok(());
        }
        let refused = refusal(&log());
        if refused.is_some() || Instant::now() > until {
            let _ = child.kill();
            let _ = child.wait();
            r.pid = None;
            r.metrics = None;
            save(r)?;
            return Err(refused.unwrap_or_else(|| {
                format!(
                    "cloudflared did not reach Cloudflare in {} seconds. Check the internet connection and try again.",
                    READY.as_secs()
                )
            }));
        }
        std::thread::sleep(Duration::from_millis(250));
    }
}

/// cloudflared retries for ever when Cloudflare does not know the tunnel ("Failed to get tunnel", seen 2026-10-27 with
/// made-up credentials), so that answer ends the wait at once with what to do.
fn refusal(log: &str) -> Option<String> {
    log.contains("Failed to get tunnel").then(|| {
        "Cloudflare does not know this tunnel any more; it may have been deleted in the dashboard. Connect Cloudflare \
         again and choose the address."
            .to_string()
    })
}

/// Routes the tool's paths of the tunnel's hostname to its local port, (re)starts cloudflared with them, and returns
/// the public address for `mcp server start`: `https://<hostname>/<tool>`.
pub fn open(tool: &str, port: u16) -> Result<String, String> {
    catalog::tool(tool)?;
    mcp_server::validate_port(port)?;
    let _one = TUNNEL.lock().unwrap_or_else(std::sync::PoisonError::into_inner);
    let mut r = load().ok_or("Choose the address on your domain first.")?;
    let credentials = read_secret(CREDENTIALS)?.ok_or(
        "The tunnel's credentials are not in the system keyring. Connect Cloudflare and choose the address again.",
    )?;
    let had = r.routes.iter().any(|x| x.tool == tool && x.port == port);
    if had && ready(&r) {
        return Ok(url_of(&r, tool));
    }
    r.routes.retain(|x| x.tool != tool);
    r.routes.push(Route { tool: tool.into(), port });
    stop_running(Some(&r));
    start(&mut r, &credentials)?;
    Ok(url_of(&r, tool))
}

/// Takes the tool's paths off the tunnel; cloudflared restarts with the others, or stops when none is left.
pub fn close(tool: &str) -> Result<(), String> {
    let _one = TUNNEL.lock().unwrap_or_else(std::sync::PoisonError::into_inner);
    let Some(mut r) = load() else { return Ok(()) };
    if !r.routes.iter().any(|x| x.tool == tool) {
        return Ok(());
    }
    let was_running = ready(&r);
    r.routes.retain(|x| x.tool != tool);
    stop_running(Some(&r));
    r.pid = None;
    r.metrics = None;
    if was_running && !r.routes.is_empty() {
        let credentials = read_secret(CREDENTIALS)?.ok_or("The tunnel's credentials are not in the system keyring.")?;
        return start(&mut r, &credentials);
    }
    save(&r)
}

#[derive(Serialize, Debug, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct RouteState {
    pub tool: String,
    pub url: String,
    pub port: u16,
    /// cloudflared runs and holds a connection to Cloudflare.
    pub live: bool,
}

/// The tools the tunnel carries, each with whether it is up now.
pub fn routes() -> Vec<RouteState> {
    let Some(r) = load() else { return Vec::new() };
    let live = ready(&r);
    r.routes.iter().map(|x| RouteState { tool: x.tool.clone(), url: url_of(&r, &x.tool), port: x.port, live }).collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn takes_only_a_new_name_under_a_domain() {
        assert_eq!(validate_hostname(" WireCat.Example.com. ").unwrap(), "wirecat.example.com");
        assert_eq!(validate_hostname("mcp.home.example.co.uk").unwrap(), "mcp.home.example.co.uk");
        assert_eq!(validate_hostname("xn--80ak6aa92e.example.com").unwrap(), "xn--80ak6aa92e.example.com");
        for bad in [
            "example.com",
            "https://wirecat.example.com",
            "wirecat.example.com/tg",
            "-x.example.com",
            "a..example.com",
            "wire cat.example.com",
            "1.2.3.4",
            "",
        ] {
            assert!(validate_hostname(bad).is_err(), "{bad}");
        }
    }

    #[test]
    fn routes_each_tools_three_paths_and_nothing_else() {
        let r = Record {
            hostname: "wirecat.example.com".into(),
            tunnel_id: "x".into(),
            routes: vec![Route { tool: "tg".into(), port: 8765 }, Route { tool: "max".into(), port: 8766 }],
            ..Record::default()
        };
        let yaml = config_of(&r);
        assert_eq!(yaml.matches("hostname: \"wirecat.example.com\"").count(), 6);
        assert!(yaml.contains("path: '^/tg(/|$)'\n    service: \"http://127.0.0.1:8765\""), "{yaml}");
        assert!(yaml.contains(r"path: '^/\.well-known/oauth-protected-resource/max(/|$)'"), "{yaml}");
        assert!(yaml.ends_with("  - service: \"http_status:404\"\n"), "the catch-all comes last");
        let rule = regex::Regex::new(&path_rules("tg")[0]).unwrap();
        assert!(rule.is_match("/tg") && rule.is_match("/tg/mcp"));
        assert!(!rule.is_match("/tgx/mcp") && !rule.is_match("/max/tg"));
        let meta = regex::Regex::new(&path_rules("tg")[2]).unwrap();
        assert!(meta.is_match("/.well-known/oauth-protected-resource/tg/mcp"));
        assert!(!meta.is_match("/.well-known/oauth-protected-resourceXtg"), "the dot is a dot");
    }

    #[test]
    fn opens_only_cloudflares_login_page() {
        let line = "https://dash.cloudflare.com/argotunnel?aud=&callback=https%3A%2F%2Flogin.cloudflareaccess.org%2Fx";
        assert_eq!(page_url(line).as_deref(), Some(line));
        for bad in [
            "https://dash.cloudflare.com.evil.example/argotunnel",
            "http://dash.cloudflare.com/argotunnel",
            "https://evil.example/dash.cloudflare.com",
        ] {
            assert_eq!(page_url(bad), None, "{bad}");
        }
    }

    #[test]
    fn reads_what_cloudflared_made() {
        let creds =
            r#"{"AccountTag":"abc","TunnelSecret":"c2VjcmV0","TunnelID":"6FF42AE2-765D-4ADF-8112-31C55C1551EF"}"#;
        assert_eq!(tunnel_id(creds).as_deref(), Some("6ff42ae2-765d-4adf-8112-31c55c1551ef"));
        assert_eq!(tunnel_id(r#"{"TunnelID":"6ff42ae2-765d-4adf-8112-31c55c1551ef"}"#), None, "no secret");
        assert_eq!(tunnel_id(r#"{"TunnelID":"x","TunnelSecret":"s"}"#), None);
        let added = "2026-10-27T12:00:00Z INF Added CNAME wirecat.example.com which will route to this tunnel \
                     tunnelID=6ff42ae2-765d-4adf-8112-31c55c1551ef\n";
        assert_eq!(routed_name(added).as_deref(), Some("wirecat.example.com"));
        let elsewhere =
            "2026-10-27T12:00:00Z INF Added CNAME wirecat.other.com.example.com which will route to this tunnel";
        assert_eq!(routed_name(elsewhere).as_deref(), Some("wirecat.other.com.example.com"));
        let again = "2026-10-27T12:00:00Z INF wirecat.example.com is already configured to route to your tunnel";
        assert_eq!(routed_name(again).as_deref(), Some("wirecat.example.com"));
        assert_eq!(said("2026-10-27T12:00:00Z ERR Unauthorized: Tunnel not found\n"), "Unauthorized: Tunnel not found");
        assert_eq!(tunnel_name("wirecat.example.com"), "wirecat-wirecat-example-com");
        let unknown = "2026-10-27T16:51:07Z ERR Register tunnel error from server side error=\"Failed to get tunnel\"";
        assert!(refusal(unknown).is_some_and(|m| m.contains("deleted in the dashboard")));
        assert_eq!(refusal("2026-10-27T16:51:07Z INF Registered tunnel connection connIndex=0"), None);
    }
}
