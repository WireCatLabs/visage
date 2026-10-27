use crate::catalog::{self, McpServerSource, Tool};
use crate::skills::{body, call, failure};
use serde::Serialize;
use serde_json::Value;
use std::time::Duration;

/// The tool's HTTP MCP server, for browser apps behind the owner's tunnel: the tool's own `mcp server start|stop|status`
/// and `mcp --revoke`, with no profile, so one server serves every profile and each call names one (TASK-26). The login code, the address and the apps' names leave Rust unmasked, as the sign-in QR does: the
/// owner needs them as they are. None of it is logged or put in a report.
#[derive(Serialize, Debug, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
#[expect(clippy::struct_excessive_bools, reason = "the tool's own answer, field for field")]
pub struct ServerStatus {
    /// False for a tool from before `mcp server`: the row says it arrives with the next update.
    pub available: bool,
    pub running: bool,
    pub listening: bool,
    /// Started by `mcp server start`, so Stop may end it; one started in a terminal is stopped there.
    pub started_here: bool,
    pub started_at: Option<String>,
    pub port: Option<u16>,
    pub connector_url: Option<String>,
    pub login_code: Option<LoginCode>,
    /// It runs the code of an earlier version than the one installed.
    pub outdated: bool,
    pub clients: Vec<Client>,
}

#[derive(Serialize, Debug, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct LoginCode {
    pub code: String,
    pub expires_at: String,
}

#[derive(Serialize, Debug, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct Client {
    /// What the app called itself when it registered. Anyone may register, so the interface says "calls itself".
    pub claimed_name: Option<String>,
    pub last_login_at: String,
    /// From cli-core 0.454: the app's last MCP request of any kind, so it reached the server after logging in.
    pub last_request_at: Option<String>,
    /// Its last `tools/call`: the tool's name and when. Never its arguments; the tool does not keep them.
    pub last_tool: Option<String>,
    pub last_tool_at: Option<String>,
    /// None from a tool too old to report activity, so the interface can say to check the answer in the app.
    pub tool_calls_today: Option<u32>,
}

/// The issuer's metadata, for typing into a browser app that cannot find it itself (BUG-15).
#[derive(Serialize, Debug, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct OAuthSettings {
    pub issuer: String,
    pub authorization_endpoint: String,
    pub token_endpoint: String,
    pub registration_endpoint: Option<String>,
}

fn source(tool: &Tool) -> Result<&McpServerSource, String> {
    tool.mcp_server.as_ref().ok_or_else(|| format!("{} has no MCP server for browser apps yet", tool.name))
}

/// A tool from before `mcp server` reads `server` as an unknown command, or as one argument too many; one from before
/// the server of every profile asks for a profile.
fn unsupported(json: Option<&Value>) -> bool {
    json.and_then(|v| v["error"]["message"].as_str()).is_some_and(|m| {
        m.contains("unknown command 'server'")
            || m.starts_with("too many arguments")
            || m.contains("unknown option")
            || m.starts_with("name a profile")
            || m.starts_with("no profiles here yet")
    })
}

fn too_old(tool: &Tool) -> String {
    format!(
        "This version of {} cannot run its MCP server in the background yet. Update it on the Tools page.",
        tool.name
    )
}

/// The tunnel's address as cli-core's `publicUrlOf` takes it: https, or http on this computer; no login or query, and
/// at most one plain path segment, the tool's share of an address several tools use (`https://name.ts.net/tg`).
pub fn validate_url(url: &str) -> Result<(), String> {
    let bad =
        || Err(format!("not a tunnel address: {url}. It looks like https://name.ts.net or https://name.ts.net/tg"));
    if url.len() > 200 {
        return bad();
    }
    let (local, rest) = if let Some(r) = url.strip_prefix("https://") {
        (false, r)
    } else if let Some(r) = url.strip_prefix("http://") {
        (true, r)
    } else {
        return bad();
    };
    let rest = rest.strip_suffix('/').unwrap_or(rest);
    let (authority, path) = rest.split_once('/').unwrap_or((rest, ""));
    let path_ok = path.is_empty()
        || (!path.starts_with(['.', '-'])
            && path.len() <= 40
            && path.chars().all(|c| c.is_ascii_alphanumeric() || matches!(c, '-' | '_' | '.')));
    if !path_ok {
        return bad();
    }
    let (host, port) = authority.rsplit_once(':').map_or((authority, None), |(h, p)| (h, Some(p)));
    let host_ok = !host.is_empty()
        && !host.starts_with(['-', '.'])
        && host.chars().all(|c| c.is_ascii_alphanumeric() || matches!(c, '-' | '.'));
    let port_ok = port.is_none_or(|p| p.parse::<u16>().is_ok_and(|n| n > 0));
    if !host_ok || !port_ok || (local && !matches!(host, "localhost" | "127.0.0.1")) {
        return bad();
    }
    Ok(())
}

/// Below 1024 a port needs administrator rights (rule 6).
pub fn validate_port(port: u16) -> Result<(), String> {
    if port >= 1024 { Ok(()) } else { Err(format!("port {port} needs administrator rights; choose 1024 or above")) }
}

fn plain(s: &str) -> bool {
    !s.is_empty() && s.len() <= 300 && !s.chars().any(char::is_control)
}

/// Bidirectional and invisible marks could make a name read as another; they go, with control characters.
fn readable_name(s: &str) -> Option<String> {
    let kept: String = s
        .chars()
        .filter(|c| {
            !c.is_control() && !matches!(*c as u32, 0x200B..=0x200F | 0x202A..=0x202E | 0x2060..=0x2069 | 0xFEFF)
        })
        .take(100)
        .collect();
    let trimmed = kept.trim();
    (!trimmed.is_empty()).then(|| trimmed.to_string())
}

/// Any app may call any name; cli-core keeps only names of this shape, and so does the interface.
fn tool_name(s: &str) -> bool {
    (1..=64).contains(&s.len()) && s.chars().all(|c| c.is_ascii_alphanumeric() || matches!(c, '_' | '.' | '-'))
}

fn code(v: &Value) -> Option<LoginCode> {
    let code = v["code"].as_str()?;
    let shape = code.len() == 9
        && code
            .char_indices()
            .all(|(i, c)| if i == 4 { c == '-' } else { c.is_ascii_uppercase() || c.is_ascii_digit() });
    shape.then(|| LoginCode { code: code.to_string(), expires_at: v["expires_at"].as_str().unwrap_or("").to_string() })
}

fn status_of(v: &Value) -> Option<ServerStatus> {
    let item = body(v);
    let running = item["running"].as_bool()?;
    let text = |key: &str| item[key].as_str().filter(|s| plain(s)).map(str::to_string);
    let clients = item["clients"]
        .as_array()
        .into_iter()
        .flatten()
        .filter_map(|c| {
            let time = |key: &str| c[key].as_str().filter(|s| plain(s) && s.len() <= 40).map(str::to_string);
            Some(Client {
                claimed_name: c["claimed_name"].as_str().and_then(readable_name),
                last_login_at: time("last_login_at")?,
                last_request_at: time("last_request_at"),
                last_tool: c["last_tool"].as_str().filter(|s| tool_name(s)).map(str::to_string),
                last_tool_at: time("last_tool_at"),
                tool_calls_today: c["tool_calls_today"].as_u64().and_then(|n| u32::try_from(n).ok()),
            })
        })
        .collect();
    Some(ServerStatus {
        available: true,
        running,
        listening: running && item["listening"].as_bool().unwrap_or(false),
        started_here: running && item["by"].as_str() == Some("server"),
        started_at: text("started_at").filter(|_| running),
        port: item["port"].as_u64().and_then(|p| u16::try_from(p).ok()).filter(|_| running),
        connector_url: text("connector_url").filter(|u| running && validate_url(u.trim_end_matches("/mcp")).is_ok()),
        login_code: if running { code(&item["login_code"]) } else { None },
        outdated: item["outdated"].as_bool().unwrap_or(false),
        clients,
    })
}

fn args(spec: &[String], port: u16, url: &str) -> Result<Vec<String>, String> {
    Ok(catalog::with_profile(spec, None)?
        .into_iter()
        .map(|a| match a.as_str() {
            "{port}" => port.to_string(),
            "{url}" => url.to_string(),
            _ => a,
        })
        .collect())
}

fn answer(tool: &Tool, args: &[String], timeout: Duration) -> Result<Value, String> {
    let (out, json) = call(tool, args, timeout)?;
    if unsupported(json.as_ref()) {
        return Err(too_old(tool));
    }
    match json {
        Some(v) if out.code == Some(0) => Ok(v),
        _ => Err(failure(&out, json.as_ref())),
    }
}

fn unavailable() -> ServerStatus {
    ServerStatus {
        available: false,
        running: false,
        listening: false,
        started_here: false,
        started_at: None,
        port: None,
        connector_url: None,
        login_code: None,
        outdated: false,
        clients: Vec::new(),
    }
}

/// Asked on every Manage panel, so a tool too old to answer is a state, not a failure.
pub fn status(tool: &Tool) -> Result<ServerStatus, String> {
    let args = catalog::with_profile(&source(tool)?.status, None)?;
    let (out, json) = call(tool, &args, Duration::from_secs(30))?;
    if unsupported(json.as_ref()) {
        return Ok(unavailable());
    }
    match json {
        Some(v) if out.code == Some(0) => {
            status_of(&v).ok_or_else(|| format!("{} answered in a shape WireCat does not know", tool.name))
        }
        _ => Err(failure(&out, json.as_ref())),
    }
}

/// The CLI waits up to about 30 seconds for the server to listen.
pub fn start(tool: &Tool, port: u16, url: &str) -> Result<ServerStatus, String> {
    validate_port(port)?;
    validate_url(url)?;
    answer(tool, &args(&source(tool)?.start, port, url)?, Duration::from_mins(1))?;
    status(tool)
}

/// The tool itself refuses a server it did not start; its words say where to stop that one.
pub fn stop(tool: &Tool) -> Result<(), String> {
    answer(tool, &catalog::with_profile(&source(tool)?.stop, None)?, Duration::from_mins(1)).map(|_| ())
}

/// `mcp --revoke`: every browser app must log in again.
pub fn revoke(tool: &Tool) -> Result<(), String> {
    answer(tool, &catalog::with_profile(&source(tool)?.revoke, None)?, Duration::from_secs(30)).map(|_| ())
}

/// Every address must be on the connector's own origin: the server builds them from its public address.
fn oauth_settings(v: &Value, origin: &str) -> Option<OAuthSettings> {
    let on_origin = |key: &str| {
        v[key]
            .as_str()
            .filter(|u| plain(u) && (*u == origin || u.starts_with(&format!("{origin}/"))))
            .map(str::to_string)
    };
    Some(OAuthSettings {
        issuer: on_origin("issuer")?,
        authorization_endpoint: on_origin("authorization_endpoint")?,
        token_endpoint: on_origin("token_endpoint")?,
        registration_endpoint: on_origin("registration_endpoint"),
    })
}

fn origin_of(url: &str) -> Option<&str> {
    let scheme = url.find("://")? + 3;
    Some(url[scheme..].find('/').map_or(url, |slash| &url[..scheme + slash]))
}

/// Read from the running server on this computer, not through the tunnel: a computer often cannot reach its own
/// Funnel address. The document's addresses are the public ones all the same, built from `--public-url`.
pub fn oauth(tool: &Tool) -> Result<OAuthSettings, String> {
    let s = status(tool)?;
    let (Some(port), Some(url)) = (s.port.filter(|_| s.listening), s.connector_url) else {
        return Err(format!("The MCP server for {} is not running.", tool.name));
    };
    let origin = origin_of(&url).ok_or("the server's address has no origin")?.to_string();
    let agent: ureq::Agent =
        ureq::Agent::config_builder().timeout_global(Some(Duration::from_secs(5))).max_redirects(0).build().into();
    let read = |e: ureq::Error| format!("Could not read the server's login settings: {e}");
    let body = agent
        .get(&format!("http://127.0.0.1:{port}/.well-known/oauth-authorization-server"))
        .call()
        .map_err(read)?
        .body_mut()
        .with_config()
        .limit(64 * 1024)
        .read_to_string()
        .map_err(read)?;
    let v: Value = serde_json::from_str(&body).map_err(|e| format!("The server's login settings are not JSON: {e}"))?;
    oauth_settings(&v, &origin).ok_or_else(|| "The server's login settings do not match its address.".to_string())
}

/// `mcp config`: the entry desktop apps (Claude Desktop, Cursor) paste, with full paths and no credentials.
pub fn config(tool: &Tool) -> Result<String, String> {
    let spec = source(tool)?.config.as_ref().ok_or_else(|| format!("{} prints no desktop-app config", tool.name))?;
    let v = answer(tool, &catalog::with_profile(spec, None)?, Duration::from_secs(30))?;
    let entry = body(&v).get("config").filter(|c| c["mcpServers"].is_object()).ok_or("the tool printed no config")?;
    serde_json::to_string_pretty(entry).map_err(|e| e.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn takes_only_a_tunnel_address() {
        for ok in [
            "https://laptop.tail1234.ts.net",
            "https://a-b.trycloudflare.com/",
            "http://127.0.0.1:8765",
            "https://laptop.tail1234.ts.net/tg",
            "https://laptop.tail1234.ts.net:8443/drive/",
        ] {
            assert!(validate_url(ok).is_ok(), "{ok}");
        }
        for bad in [
            "http://laptop.ts.net",
            "https://x.ts.net/tg/mcp",
            "https://x.ts.net/.well-known",
            "https://x.ts.net/a b",
            "https://u:p@x.ts.net",
            "https://x.ts.net?a=1",
            "https://x.ts.net#f",
            "https://-x.ts.net",
            "https://x.ts.net:0",
            "https://x .ts.net",
            "ftp://x.ts.net",
            "https://",
            "--public-url",
        ] {
            assert!(validate_url(bad).is_err(), "{bad}");
        }
    }

    #[test]
    fn a_low_port_needs_admin() {
        assert!(validate_port(80).is_err());
        assert!(validate_port(8765).is_ok());
    }

    #[test]
    fn fills_the_catalog_words_only() {
        let spec: Vec<String> = ["mcp", "server", "start", "--port", "{port}", "--public-url", "{url}"]
            .iter()
            .map(ToString::to_string)
            .collect();
        assert_eq!(
            args(&spec, 9000, "https://x.ts.net/tg").unwrap(),
            ["mcp", "server", "start", "--port", "9000", "--public-url", "https://x.ts.net/tg"]
        );
        assert!(start(catalog::tool("tg").unwrap(), 9000, "https://x.ts.net/tg/mcp").is_err());
    }

    #[test]
    fn reads_a_running_server() {
        let v = json!({"item": {
            "profile": "personal", "running": true, "pid": 4242, "started_at": "2026-10-26T10:00:00Z",
            "listening": true, "by": "server", "port": 8765, "public_url": "https://x.ts.net/",
            "connector_url": "https://x.ts.net/mcp",
            "login_code": {"code": "ABCD-EF23", "expires_at": "2026-10-26T10:10:00Z"},
            "version": "1", "outdated": false,
            "clients": [
                {"claimed_name": "Claude\u{202E}gnp.exe", "last_login_at": "2026-10-26T10:05:00Z"},
                {"claimed_name": null, "last_login_at": "2026-10-26T09:00:00Z"},
                {"claimed_name": "no time"}
            ]
        }});
        let s = status_of(&v).unwrap();
        assert!(s.running && s.listening && s.started_here && !s.outdated);
        assert_eq!(s.port, Some(8765));
        assert_eq!(s.connector_url.as_deref(), Some("https://x.ts.net/mcp"));
        assert_eq!(
            s.login_code,
            Some(LoginCode { code: "ABCD-EF23".into(), expires_at: "2026-10-26T10:10:00Z".into() })
        );
        assert_eq!(s.clients.len(), 2);
        assert_eq!(s.clients[0].claimed_name.as_deref(), Some("Claudegnp.exe"));
        assert_eq!(s.clients[1].claimed_name, None);
    }

    #[test]
    fn reads_what_each_app_last_called_and_drops_a_name_that_is_not_a_tool() {
        let v = json!({"item": {"running": true, "clients": [
            {"claimed_name": "ChatGPT", "last_login_at": "2026-10-27T10:00:00Z", "last_request_at": "2026-10-27T10:02:00Z",
             "last_tool": "tg_read", "last_tool_at": "2026-10-27T10:02:00Z", "tool_calls_today": 3},
            {"claimed_name": "x", "last_login_at": "2026-10-27T10:00:00Z", "last_tool": "<img src=x>", "tool_calls_today": -1},
            {"claimed_name": "old cli-core", "last_login_at": "2026-10-27T10:00:00Z"}
        ]}});
        let s = status_of(&v).unwrap();
        assert_eq!(s.clients[0].last_tool.as_deref(), Some("tg_read"));
        assert_eq!(s.clients[0].last_request_at.as_deref(), Some("2026-10-27T10:02:00Z"));
        assert_eq!(s.clients[0].tool_calls_today, Some(3));
        assert_eq!((s.clients[1].last_tool.as_deref(), s.clients[1].tool_calls_today), (None, None));
        assert_eq!(s.clients[2].tool_calls_today, None);
        assert_eq!((s.clients[2].last_request_at.as_deref(), s.clients[2].last_tool_at.as_deref()), (None, None));
    }

    #[test]
    fn takes_login_settings_only_on_the_connectors_origin() {
        let origin = origin_of("https://x.ts.net/tg/mcp").unwrap();
        assert_eq!(origin, "https://x.ts.net");
        let v = json!({
            "issuer": "https://x.ts.net/tg",
            "authorization_endpoint": "https://x.ts.net/tg/authorize",
            "token_endpoint": "https://x.ts.net/tg/token",
            "registration_endpoint": "https://x.ts.net/tg/register"
        });
        let s = oauth_settings(&v, origin).unwrap();
        assert_eq!(s.issuer, "https://x.ts.net/tg");
        assert_eq!(s.registration_endpoint.as_deref(), Some("https://x.ts.net/tg/register"));
        let elsewhere = json!({"issuer": "https://x.ts.net/tg", "authorization_endpoint": "https://evil.example/authorize",
            "token_endpoint": "https://x.ts.net/tg/token"});
        assert_eq!(oauth_settings(&elsewhere, origin), None);
        let lookalike = json!({"issuer": "https://x.ts.net.evil.example", "authorization_endpoint": "https://x.ts.net/a",
            "token_endpoint": "https://x.ts.net/t"});
        assert_eq!(oauth_settings(&lookalike, origin), None);
    }

    #[test]
    fn a_stopped_server_has_no_code_or_address() {
        let v = json!({"item": {"running": false, "stale": {"pid": 1}, "login_code": {"code": "ABCD-EFGH"}, "clients": []}});
        let s = status_of(&v).unwrap();
        assert!(!s.running && !s.started_here);
        assert_eq!((s.login_code, s.connector_url, s.port), (None, None, None));
    }

    #[test]
    fn drops_a_code_or_address_of_an_unknown_shape() {
        let v = json!({"item": {"running": true, "by": "hand", "connector_url": "javascript:alert(1)",
            "login_code": {"code": "<script>"}}});
        let s = status_of(&v).unwrap();
        assert!(!s.started_here);
        assert_eq!((s.login_code, s.connector_url), (None, None));
        assert_eq!(status_of(&json!({"item": {}})), None);
    }

    #[test]
    fn an_old_cli_says_update() {
        assert!(unsupported(Some(&json!({"error": {"message": "unknown command 'server'"}}))));
        // tg 0.93.0, measured: `tg x mcp server status --json` before cli-core 0.445.
        let old = "too many arguments for 'mcp'. Expected 0 arguments but got 2: server, status.";
        assert!(unsupported(Some(&json!({"error": {"message": old}}))));
        // tg 0.96.0 and drive 0.41.1, from before the server of every profile: `tg mcp server status --json`.
        let unnamed = "name a profile: `tg <profile> …` — profiles here: personal (or set TG_PROFILE)";
        assert!(unsupported(Some(&json!({"error": {"message": unnamed}}))));
        assert!(!unsupported(Some(&json!({"error": {"message": "port 8765 is in use"}}))));
    }

    #[test]
    fn every_tool_with_a_server_names_its_commands() {
        for tool in &catalog::catalog().tools {
            let Some(src) = &tool.mcp_server else { continue };
            assert!(
                src.start.contains(&"{port}".to_string()) && src.start.contains(&"{url}".to_string()),
                "{}",
                tool.id
            );
            // One server for every profile: nothing here names one.
            for spec in [&src.start, &src.stop, &src.status, &src.revoke] {
                assert!(!spec.contains(&"{profile}".to_string()), "{}", tool.id);
                assert_eq!(spec.last().map(String::as_str), Some("--json"), "{}", tool.id);
            }
        }
        assert!(catalog::tool("zm").unwrap().mcp_server.is_none());
    }
}
