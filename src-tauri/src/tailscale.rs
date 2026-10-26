use crate::{catalog, mcp_server, node, paths, run};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::BTreeSet;
use std::path::PathBuf;
use std::process::Command;
use std::sync::Mutex;
use std::time::Duration;

// Tailscale Funnel in front of a tool's MCP server (step 4 of `docs/dev/plans/2026-10-26-mcp-full-commands.md`).
// Desktop reads Tailscale's state, starts its login, and turns Funnel on and off only for the public ports it set up
// itself, recorded in `tailscale-funnels.json`. It never runs `sudo`, `tailscale up` or `funnel reset`.

/// Only pages on these hosts are opened from the CLI's output: its login and the tailnet's Funnel approval.
const PAGE_HOSTS: [&str; 2] = ["login.tailscale.com", "console.tailscale.com"];
/// Funnel's own list when the tailnet does not send one (<https://tailscale.com/kb/1223/funnel>).
const FUNNEL_PORTS: [u16; 3] = [443, 8443, 10000];
const FUNNEL_PORTS_CAP: &str = "https://tailscale.com/cap/funnel-ports?ports=";
/// A login or a first Funnel approval waits for the person in the browser.
const WAIT: Duration = Duration::from_mins(10);

/// <https://tailscale.com/kb/1031/install-linux>
pub const INSTALL_LINE: &str = "curl -fsSL https://tailscale.com/install.sh | sh";

pub const LOGIN: &str = "tailscale-login";
pub const FUNNEL: &str = "tailscale-funnel";

struct Cli {
    path: PathBuf,
    /// The Mac app's own binary, which acts as the CLI only with `TAILSCALE_BE_CLI=1` (<https://tailscale.com/kb/1080/cli>).
    app_bundle: bool,
}

fn cli() -> Option<Cli> {
    if let Some(path) = paths::find("tailscale") {
        return Some(Cli { path, app_bundle: false });
    }
    if cfg!(target_os = "macos") {
        let path = PathBuf::from("/Applications/Tailscale.app/Contents/MacOS/Tailscale");
        return path.is_file().then_some(Cli { path, app_bundle: true });
    }
    if cfg!(windows) {
        let path = PathBuf::from(std::env::var_os("ProgramFiles")?).join("Tailscale").join("tailscale.exe");
        return path.is_file().then_some(Cli { path, app_bundle: false });
    }
    None
}

fn command(cli: &Cli, args: &[&str]) -> Command {
    let mut cmd = run::command(&cli.path, args, Some(&paths::search_path()));
    if cli.app_bundle {
        cmd.env("TAILSCALE_BE_CLI", "1");
    }
    cmd
}

struct Out {
    code: Option<i32>,
    stdout: String,
    stderr: String,
}

fn exec(cli: &Cli, args: &[&str]) -> Result<Out, String> {
    let (mut stdout, mut stderr) = (String::new(), String::new());
    let code = run::stream(
        command(cli, args),
        Duration::from_secs(20),
        || false,
        |line| {
            let (s, into) = match line {
                run::Line::Out(s) => (s, &mut stdout),
                run::Line::Err(s) => (s, &mut stderr),
            };
            into.push_str(&s);
            into.push('\n');
        },
    )
    .map_err(|e| format!("Could not run tailscale: {e}"))?;
    Ok(Out { code, stdout, stderr })
}

fn json_of(out: &Out) -> Option<Value> {
    serde_json::from_str(out.stdout.trim()).ok()
}

/// tailscaled answers "serve config denied" (`ipn/localapi/serve.go`) or "access denied" to a user who is neither root
/// nor its operator.
fn denied(text: &str) -> bool {
    let t = text.to_ascii_lowercase();
    t.contains("config denied") || t.contains("access denied")
}

fn operator_hint() -> String {
    let user = user().unwrap_or_else(|| "$USER".into());
    format!(
        "Tailscale lets only root change its settings on this computer. Run this once in a terminal, then try again: \
         sudo tailscale set --operator={user}"
    )
}

fn failure(what: &str, out: &Out) -> String {
    let said = [&out.stdout, &out.stderr]
        .into_iter()
        .flat_map(|s| s.lines())
        .map(str::trim)
        .rfind(|l| !l.is_empty() && page_url(l).is_none())
        .unwrap_or("it said nothing")
        .to_string();
    if denied(&said) { operator_hint() } else { format!("{what}: {said}") }
}

/// The user name for the one-time operator command; only a plain Unix name is shown.
fn user() -> Option<String> {
    let name = std::env::var("USER").or_else(|_| std::env::var("LOGNAME")).ok()?;
    let ok = !name.is_empty()
        && name.len() <= 32
        && !name.starts_with('-')
        && name.chars().all(|c| c.is_ascii_alphanumeric() || matches!(c, '_' | '-' | '.'));
    ok.then_some(name)
}

#[derive(Serialize, Debug, PartialEq, Eq, Default)]
#[serde(rename_all = "camelCase")]
#[expect(clippy::struct_excessive_bools, reason = "one answer per step of the guide")]
pub struct Status {
    pub os: &'static str,
    pub installed: bool,
    /// What the app can download for this computer: `pkg`, `exe`, `deb` or `rpm`.
    pub package: Option<&'static str>,
    /// Linux only: whether this user may change Tailscale's settings. None where it does not apply or is not known.
    pub operator: Option<bool>,
    pub user: Option<String>,
    /// tailscaled answered.
    pub daemon: bool,
    /// `running`, `needsLogin`, `needsApproval` (the tailnet's admin approves new devices), `stopped`, `starting`.
    pub backend: String,
    pub https: bool,
    pub funnel: bool,
    pub host: Option<String>,
    pub free_ports: Vec<u16>,
}

fn os() -> &'static str {
    if cfg!(target_os = "macos") {
        "macos"
    } else if cfg!(windows) {
        "windows"
    } else {
        "linux"
    }
}

struct Node {
    backend: String,
    https: bool,
    funnel: bool,
    host: Option<String>,
    ports: Vec<u16>,
}

fn host_ok(h: &str) -> bool {
    !h.is_empty()
        && h.len() <= 253
        && h.contains('.')
        && h.chars().all(|c| c.is_ascii_alphanumeric() || matches!(c, '-' | '.'))
}

fn node_of(v: &Value) -> Node {
    let me = &v["Self"];
    let mut caps: BTreeSet<&str> =
        me["CapMap"].as_object().into_iter().flat_map(|m| m.keys().map(String::as_str)).collect();
    caps.extend(me["Capabilities"].as_array().into_iter().flatten().filter_map(Value::as_str));
    let funnel = caps.contains("funnel");
    let ports = caps.iter().find_map(|c| c.strip_prefix(FUNNEL_PORTS_CAP)).map_or_else(
        || if funnel { FUNNEL_PORTS.to_vec() } else { Vec::new() },
        |list| list.split(',').filter_map(|p| p.parse().ok()).collect(),
    );
    let backend = match v["BackendState"].as_str().unwrap_or("") {
        "Running" => "running",
        "NeedsLogin" | "NoState" => "needsLogin",
        "NeedsMachineAuth" => "needsApproval",
        "Stopped" => "stopped",
        "Starting" => "starting",
        _ => "unknown",
    };
    Node {
        backend: backend.into(),
        https: caps.contains("https"),
        funnel,
        host: me["DNSName"].as_str().map(|s| s.trim_end_matches('.').to_ascii_lowercase()).filter(|h| host_ok(h)),
        ports,
    }
}

fn port_of(host_port: &str) -> Option<u16> {
    host_port.rsplit_once(':')?.1.parse().ok()
}

/// Public ports already taken on this computer, by Funnel or by a tailnet-only `serve`, ours or the owner's. An
/// `AllowFunnel` entry alone serves nothing, so it does not count.
fn used_ports(serve: &Value) -> BTreeSet<u16> {
    let mut used = BTreeSet::new();
    let mut add = |cfg: &Value| {
        used.extend(cfg["TCP"].as_object().into_iter().flat_map(|m| m.keys().filter_map(|k| k.parse::<u16>().ok())));
        used.extend(cfg["Web"].as_object().into_iter().flat_map(|m| m.keys().filter_map(|k| port_of(k))));
    };
    add(serve);
    for fg in serve["Foreground"].as_object().into_iter().flat_map(|m| m.values()) {
        add(fg);
    }
    used
}

/// The public port still sends the internet to this local port, through Funnel.
fn is_live(serve: &Value, host: &str, https: u16, port: u16) -> bool {
    let hp = format!("{host}:{https}");
    let proxy = serve["Web"][&hp]["Handlers"]["/"]["Proxy"].as_str().unwrap_or("");
    let target = proxy.trim_end_matches('/').trim_start_matches("http://");
    serve["AllowFunnel"][&hp].as_bool() == Some(true)
        && (target == format!("127.0.0.1:{port}") || target == format!("localhost:{port}"))
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct Owned {
    pub tool: String,
    pub profile: Option<String>,
    pub host: String,
    pub https: u16,
    pub port: u16,
}

impl Owned {
    fn is(&self, tool: &str, profile: Option<&str>) -> bool {
        self.tool == tool && self.profile.as_deref() == profile
    }
    fn url(&self) -> String {
        url_of(&self.host, self.https)
    }
}

fn url_of(host: &str, https: u16) -> String {
    if https == 443 { format!("https://{host}") } else { format!("https://{host}:{https}") }
}

fn records_file() -> Option<PathBuf> {
    node::app_data().map(|d| d.join("tailscale-funnels.json"))
}

fn load() -> Vec<Owned> {
    records_file().and_then(|f| std::fs::read(f).ok()).and_then(|b| serde_json::from_slice(&b).ok()).unwrap_or_default()
}

fn save(records: &[Owned]) -> Result<(), String> {
    let file = records_file().ok_or("no folder for the app's data")?;
    if let Some(dir) = file.parent() {
        std::fs::create_dir_all(dir).map_err(|e| e.to_string())?;
    }
    let body = serde_json::to_vec_pretty(records).map_err(|e| e.to_string())?;
    std::fs::write(&file, body).map_err(|e| format!("Could not save {}: {e}", paths::tilde(&file.to_string_lossy())))
}

/// The same public port as last time keeps the address, and the browser apps' logins with it (the address is the
/// login's issuer). Otherwise a free one, preferring a port no other server of ours used.
fn choose(records: &[Owned], tool: &str, profile: Option<&str>, used: &BTreeSet<u16>, allowed: &[u16]) -> Option<u16> {
    let free = |p: &u16| !used.contains(p);
    if let Some(mine) = records.iter().find(|r| r.is(tool, profile))
        && allowed.contains(&mine.https)
        && free(&mine.https)
    {
        return Some(mine.https);
    }
    let others: BTreeSet<u16> = records.iter().filter(|r| !r.is(tool, profile)).map(|r| r.https).collect();
    allowed.iter().copied().filter(free).find(|p| !others.contains(p)).or_else(|| allowed.iter().copied().find(free))
}

/// A page to open from the CLI's output: https on Tailscale's own login hosts, nothing else.
fn page_url(line: &str) -> Option<String> {
    line.split_whitespace().find_map(|word| {
        let rest = word.strip_prefix("https://")?;
        let host = rest.split(['/', '?']).next()?;
        let safe = word.chars().all(|c| c.is_ascii_graphic() && !matches!(c, '"' | '\'' | '<' | '>' | '\\' | '`'));
        (PAGE_HOSTS.contains(&host) && safe).then(|| word.to_string())
    })
}

fn package(os_release: &str) -> Option<&'static str> {
    if cfg!(target_os = "macos") {
        return Some("pkg");
    }
    if cfg!(windows) {
        return Some("exe");
    }
    crate::tailscale_install::linux_package(os_release, std::env::consts::ARCH)
}

pub fn status() -> Status {
    let os_release = std::fs::read_to_string("/etc/os-release").unwrap_or_default();
    let mut s = Status {
        os: os(),
        package: package(&os_release),
        user: user(),
        backend: "unknown".into(),
        ..Status::default()
    };
    let Some(cli) = cli() else { return s };
    s.installed = true;
    let Ok(out) = exec(&cli, &["status", "--json"]) else { return s };
    let Some(v) = json_of(&out) else { return s };
    s.daemon = true;
    let node = node_of(&v);
    s.backend = node.backend;
    s.https = node.https;
    s.funnel = node.funnel;
    s.host = node.host;
    if cfg!(target_os = "linux") && !is_root() {
        s.operator = operator(&cli, s.user.as_deref());
    }
    if s.backend == "running"
        && let Ok(out) = exec(&cli, &["funnel", "status", "--json"])
    {
        match json_of(&out) {
            Some(serve) => {
                let used = used_ports(&serve);
                s.free_ports = node.ports.into_iter().filter(|p| !used.contains(p)).collect();
            }
            None if denied(&out.stderr) => s.operator = Some(false),
            None => {}
        }
    }
    s
}

/// The one line the guide offers to run in a terminal: Tailscale's own installer, which asks for the password itself.
/// The operator line is shown to copy only, because a terminal would run its `sudo` at once.
pub fn terminal_line(what: &str) -> Result<String, String> {
    match what {
        "install" => Ok(INSTALL_LINE.to_string()),
        _ => Err(format!("unknown step: {what}")),
    }
}

/// The crate denies `unsafe`, so the effective user id comes from `/proc` instead of `geteuid`.
fn is_root() -> bool {
    std::fs::read_to_string("/proc/self/status").ok().is_some_and(|s| {
        s.lines().find_map(|l| l.strip_prefix("Uid:")).and_then(|ids| ids.split_whitespace().nth(1)) == Some("0")
    })
}

/// `tailscale debug prefs` is not a stable interface, so its answer is only a hint: an unknown shape is "not known",
/// and the refusal of a real write still says what to run.
fn operator(cli: &Cli, user: Option<&str>) -> Option<bool> {
    let v = json_of(&exec(cli, &["debug", "prefs"]).ok()?)?;
    let op = v.get("OperatorUser")?.as_str()?;
    Some(user.is_some_and(|u| u == op))
}

#[derive(Serialize, Clone, Debug, PartialEq, Eq)]
#[serde(rename_all = "camelCase", tag = "event")]
pub enum PageEvent {
    /// A Tailscale page opened in the browser: the login, or the tailnet's first Funnel approval. The address is a
    /// one-time login link while valid: it travels on the Channel only and is never logged.
    Opened { url: String },
}

fn open_page(url: &str, send: &dyn Fn(PageEvent)) {
    let _ = tauri_plugin_opener::open_url(url, None::<&str>);
    send(PageEvent::Opened { url: url.to_string() });
}

/// Streams a waiting CLI command, opens the first Tailscale page it prints, and gives back its exit and its lines.
fn wait_for_browser(
    cli: &Cli,
    args: &[&str],
    stopped: &dyn Fn() -> bool,
    send: &dyn Fn(PageEvent),
) -> Result<Out, String> {
    let (mut stdout, mut stderr) = (String::new(), String::new());
    let mut opened = false;
    let result = run::stream(command(cli, args), WAIT, stopped, |line| {
        let (s, into) = match line {
            run::Line::Out(s) => (s, &mut stdout),
            run::Line::Err(s) => (s, &mut stderr),
        };
        if !opened && let Some(url) = page_url(&s) {
            opened = true;
            open_page(&url, send);
        }
        into.push_str(&s);
        into.push('\n');
    });
    match result {
        Ok(code) => Ok(Out { code, stdout, stderr }),
        Err(run::RunError::Cancelled) => Err("Stopped.".into()),
        Err(run::RunError::TimedOut) => {
            Err(format!("Nothing happened in the browser for {} minutes.", WAIT.as_secs() / 60))
        }
        Err(e) => Err(format!("Could not run tailscale: {e}")),
    }
}

/// `tailscale login`, only for a computer that is logged out: on a logged-in one it would start another account's login.
pub fn login(stopped: &dyn Fn() -> bool, send: &dyn Fn(PageEvent)) -> Result<(), String> {
    let cli = cli().ok_or("Tailscale is not installed.")?;
    let v = json_of(&exec(&cli, &["status", "--json"])?).ok_or("Tailscale is not running on this computer.")?;
    if node_of(&v).backend != "needsLogin" {
        return Ok(());
    }
    let out = wait_for_browser(&cli, &["login"], stopped, send)?;
    if out.code == Some(0) { Ok(()) } else { Err(failure("Tailscale did not log in", &out)) }
}

static FUNNELS: Mutex<()> = Mutex::new(());

fn serve_config(cli: &Cli) -> Result<Value, String> {
    let out = exec(cli, &["funnel", "status", "--json"])?;
    json_of(&out).ok_or_else(|| failure("Could not read Tailscale's Funnel settings", &out))
}

/// Turns Funnel on from a public port to the tool's local port and returns the public address for `mcp server start`.
pub fn funnel_open(
    tool: &str,
    profile: Option<&str>,
    port: u16,
    stopped: &dyn Fn() -> bool,
    send: &dyn Fn(PageEvent),
) -> Result<String, String> {
    catalog::tool(tool)?;
    if let Some(p) = profile {
        catalog::validate_profile(p)?;
    }
    mcp_server::validate_port(port)?;
    let _one = FUNNELS.lock().unwrap_or_else(std::sync::PoisonError::into_inner);
    let cli = cli().ok_or("Tailscale is not installed.")?;
    let v = json_of(&exec(&cli, &["status", "--json"])?).ok_or("Tailscale is not running on this computer.")?;
    let node = node_of(&v);
    if node.backend != "running" {
        return Err("Tailscale is not connected. Finish the steps above first.".into());
    }
    let host = node.host.ok_or("Tailscale gave this computer no name. Turn on MagicDNS in the admin console.")?;
    let mut serve = serve_config(&cli)?;
    let mut records = load();
    if let Some(mine) = records.iter().find(|r| r.is(tool, profile) && r.host == host)
        && is_live(&serve, &host, mine.https, mine.port)
    {
        if mine.port == port {
            return Ok(mine.url());
        }
        // Still ours, pointing at the port this server used before: move it rather than leave it public and untracked.
        off(&cli, mine.https)?;
        serve = serve_config(&cli)?;
    }
    let allowed = if node.ports.is_empty() { FUNNEL_PORTS.to_vec() } else { node.ports };
    let https = choose(&records, tool, profile, &used_ports(&serve), &allowed).ok_or_else(|| {
        format!(
            "Tailscale Funnel allows {} public addresses per computer (ports {}), and all are in use. Stop another server first.",
            allowed.len(),
            allowed.iter().map(u16::to_string).collect::<Vec<_>>().join(", ")
        )
    })?;
    let (https_flag, target) = (format!("--https={https}"), format!("http://127.0.0.1:{port}"));
    // No `--yes`: stdin is closed, so a question about the owner's own settings fails instead of overwriting them.
    let out = wait_for_browser(&cli, &["funnel", "--bg", &https_flag, &target], stopped, send)?;
    if out.code != Some(0) {
        return Err(failure("Tailscale did not turn Funnel on", &out));
    }
    if !is_live(&serve_config(&cli)?, &host, https, port) {
        // The port was free a moment ago, so whatever is on it now came from this call.
        let _ = off(&cli, https);
        return Err("Tailscale answered, but Funnel does not point at this server. Check the admin console.".into());
    }
    records.retain(|r| !r.is(tool, profile));
    let mine = Owned { tool: tool.into(), profile: profile.map(Into::into), host, https, port };
    let url = mine.url();
    records.push(mine);
    save(&records)?;
    Ok(url)
}

fn off(cli: &Cli, https: u16) -> Result<(), String> {
    let out = exec(cli, &["funnel", &format!("--https={https}"), "off"])?;
    if out.code == Some(0) { Ok(()) } else { Err(failure("Tailscale did not turn Funnel off", &out)) }
}

/// Turns off only the port the app turned on, and only while it still points at the port the app recorded: anything
/// the owner changed since is theirs. The record stays, so the next start reuses the address.
pub fn funnel_close(tool: &str, profile: Option<&str>) -> Result<(), String> {
    let _one = FUNNELS.lock().unwrap_or_else(std::sync::PoisonError::into_inner);
    let Some(mine) = load().into_iter().find(|r| r.is(tool, profile)) else { return Ok(()) };
    let Some(cli) = cli() else { return Ok(()) };
    if !is_live(&serve_config(&cli)?, &mine.host, mine.https, mine.port) {
        return Ok(());
    }
    off(&cli, mine.https)
}

#[derive(Serialize, Debug, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct FunnelState {
    pub tool: String,
    pub profile: Option<String>,
    pub url: String,
    pub port: u16,
    pub live: bool,
}

/// The funnels the app set up, each with whether it is still on.
pub fn funnels() -> Vec<FunnelState> {
    let records = load();
    let serve = if records.is_empty() { None } else { cli().and_then(|c| serve_config(&c).ok()) };
    records
        .into_iter()
        .map(|r| FunnelState {
            live: serve.as_ref().is_some_and(|s| is_live(s, &r.host, r.https, r.port)),
            url: r.url(),
            port: r.port,
            tool: r.tool,
            profile: r.profile,
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    fn caps(keys: &[&str]) -> Value {
        Value::Object(keys.iter().map(|k| ((*k).to_string(), Value::Null)).collect())
    }

    #[test]
    fn reads_a_ready_node() {
        let v = json!({"BackendState": "Running", "Self": {"DNSName": "Laptop.tail4c8e.ts.net.",
            "CapMap": caps(&["funnel", "https", "https://tailscale.com/cap/funnel-ports?ports=443,8443,10000"])}});
        let n = node_of(&v);
        assert_eq!(n.backend, "running");
        assert!(n.https && n.funnel);
        assert_eq!(n.host.as_deref(), Some("laptop.tail4c8e.ts.net"));
        assert_eq!(n.ports, [443, 8443, 10000]);
    }

    #[test]
    fn a_tailnet_without_funnel_has_no_ports() {
        let v = json!({"BackendState": "NeedsLogin", "Self": {"DNSName": "", "CapMap": caps(&["https"])}});
        let n = node_of(&v);
        assert_eq!(n.backend, "needsLogin");
        assert!(n.https && !n.funnel && n.ports.is_empty() && n.host.is_none());
        assert_eq!(node_of(&json!({"BackendState": "NeedsMachineAuth"})).backend, "needsApproval");
        assert_eq!(node_of(&json!({"BackendState": "Stopped"})).backend, "stopped");
    }

    #[test]
    fn counts_every_taken_port() {
        let serve = json!({
            "TCP": {"443": {"HTTPS": true}},
            "Web": {"h.ts.net:443": {"Handlers": {"/": {"Proxy": "http://127.0.0.1:3000"}}}},
            "AllowFunnel": {"h.ts.net:8443": true, "h.ts.net:443": true},
            "Foreground": {"abc": {"TCP": {"10000": {"HTTPS": true}}}}
        });
        assert_eq!(used_ports(&serve), BTreeSet::from([443, 10000]), "8443 has a Funnel flag but serves nothing");
        assert!(used_ports(&json!({})).is_empty());
    }

    #[test]
    fn live_only_when_funnel_points_at_our_port() {
        let serve = json!({
            "Web": {"h.ts.net:8443": {"Handlers": {"/": {"Proxy": "http://127.0.0.1:8765"}}},
                    "h.ts.net:443": {"Handlers": {"/": {"Proxy": "http://127.0.0.1:8766"}}}},
            "AllowFunnel": {"h.ts.net:8443": true}
        });
        assert!(is_live(&serve, "h.ts.net", 8443, 8765));
        assert!(!is_live(&serve, "h.ts.net", 8443, 9000));
        assert!(!is_live(&serve, "h.ts.net", 443, 8766), "served in the tailnet only, not through Funnel");
    }

    fn owned(tool: &str, https: u16) -> Owned {
        Owned { tool: tool.into(), profile: Some("work".into()), host: "h.ts.net".into(), https, port: 8765 }
    }

    #[test]
    fn keeps_the_last_address_and_avoids_other_servers() {
        let all = [443, 8443, 10000];
        let records = [owned("tg", 8443), owned("wa", 443)];
        assert_eq!(choose(&records, "tg", Some("work"), &BTreeSet::new(), &all), Some(8443));
        assert_eq!(choose(&records, "max", Some("work"), &BTreeSet::new(), &all), Some(10000));
        assert_eq!(choose(&records, "max", Some("work"), &BTreeSet::from([10000]), &all), Some(443));
        assert_eq!(choose(&records, "tg", Some("work"), &BTreeSet::from([8443]), &all), Some(10000));
        assert_eq!(choose(&[], "tg", None, &BTreeSet::from(all), &all), None);
    }

    #[test]
    fn the_address_has_a_port_unless_443() {
        assert_eq!(url_of("h.ts.net", 443), "https://h.ts.net");
        assert_eq!(url_of("h.ts.net", 8443), "https://h.ts.net:8443");
        assert!(mcp_server::validate_url(&url_of("h.ts.net", 10000)).is_ok());
    }

    #[test]
    fn opens_only_tailscale_pages() {
        let login = "\thttps://login.tailscale.com/a/1a2b3c4d";
        assert_eq!(page_url(login).as_deref(), Some("https://login.tailscale.com/a/1a2b3c4d"));
        assert_eq!(
            page_url("To enable, visit: https://login.tailscale.com/f/funnel?node=nX1").as_deref(),
            Some("https://login.tailscale.com/f/funnel?node=nX1")
        );
        for bad in [
            "https://evil.example/login.tailscale.com",
            "http://login.tailscale.com/a/1",
            "https://login.tailscale.com.evil.example/a",
            "Available on the internet: https://h.ts.net:8443/",
        ] {
            assert_eq!(page_url(bad), None, "{bad}");
        }
    }

    #[test]
    fn a_refusal_says_what_to_run() {
        let out = Out { code: Some(1), stdout: String::new(), stderr: "serve config denied\n".into() };
        assert!(failure("x", &out).contains("sudo tailscale set --operator="));
        let out = Out { code: Some(1), stdout: String::new(), stderr: "port in use\n".into() };
        assert_eq!(failure("Tailscale did not turn Funnel on", &out), "Tailscale did not turn Funnel on: port in use");
    }
}
