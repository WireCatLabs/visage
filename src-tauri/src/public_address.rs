use serde::Serialize;
use serde_json::Value;
use std::net::{IpAddr, SocketAddr};
use std::time::Duration;
use ureq::unversioned::resolver::{ResolvedSocketAddrs, Resolver};
use ureq::unversioned::transport::{DefaultConnector, NextTimeout};

/// Whether the internet can reach the server's address (BUG-15). This computer cannot tell by itself: `MagicDNS`
/// answers its own Tailscale name with the 100.x tailnet address. So the name is looked up through public
/// DNS-over-HTTPS, and the server's metadata is fetched from the public address that lookup gave.
#[derive(Serialize, Debug, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct PublicCheck {
    pub host: String,
    pub dns: Dns,
    pub answer: Answer,
}

#[derive(Serialize, Debug, PartialEq, Eq, Clone, Copy)]
#[serde(rename_all = "camelCase")]
pub enum Dns {
    /// Public DNS has an address for the name.
    Live,
    /// Public DNS says the name does not exist: Tailscale has not published it yet.
    Missing,
    /// Neither resolver answered.
    Unknown,
}

#[derive(Serialize, Debug, PartialEq, Eq)]
#[serde(rename_all = "camelCase", tag = "kind")]
pub enum Answer {
    /// Not tried: the name has no public address.
    NotTried,
    /// The server's metadata came back through the public address.
    Ok,
    /// Something answers on the public address, but not this server: the status and why.
    Wrong { status: u16 },
    /// No answer from here. Often a computer cannot open a connection to its own public address; the app may still.
    Unreached { reason: String },
}

/// When port 53 is closed. Some networks refuse these too: on the owner's (2026-10-27) Google's and Cloudflare's
/// were refused for every program and `NextDNS` stalled ureq's TLS, while plain DNS answered. With no answer at all the
/// check is `Unknown`, and the guide lets the owner go on with a warning.
const RESOLVERS: [&str; 3] =
    ["https://dns.google/resolve", "https://cloudflare-dns.com/dns-query", "https://dns.nextdns.io/dns-query"];

/// A DNS JSON answer (RFC 8484's JSON form, as Google and Cloudflare give it): Status 3 is NXDOMAIN; type 1 is A,
/// 28 is AAAA.
fn addresses(v: &Value) -> Option<Result<Vec<IpAddr>, ()>> {
    match v["Status"].as_u64()? {
        3 => Some(Err(())),
        0 => Some(Ok(v["Answer"]
            .as_array()
            .into_iter()
            .flatten()
            .filter(|a| matches!(a["type"].as_u64(), Some(1 | 28)))
            .filter_map(|a| a["data"].as_str()?.parse().ok())
            .collect())),
        _ => None,
    }
}

/// An agent that connects only to `ips`, whatever this computer's own DNS says; TLS still checks the name.
fn pinned(ips: Vec<IpAddr>, seconds: u64) -> ureq::Agent {
    let config = ureq::Agent::config_builder()
        .timeout_global(Some(Duration::from_secs(seconds)))
        .max_redirects(0)
        .http_status_as_error(false)
        .build();
    ureq::Agent::with_parts(config, DefaultConnector::default(), Pinned(ips))
}

fn agent() -> ureq::Agent {
    ureq::Agent::config_builder().timeout_global(Some(Duration::from_secs(5))).max_redirects(0).build().into()
}

/// Public resolvers asked over plain DNS first: networks that block DNS-over-HTTPS usually let port 53 through.
const UDP_RESOLVERS: [&str; 3] = ["9.9.9.9:53", "8.8.8.8:53", "1.1.1.1:53"];

/// One A query in the DNS wire format (RFC 1035 §4.1), recursion desired.
fn query(host: &str, id: u16) -> Option<Vec<u8>> {
    let mut q = Vec::with_capacity(32 + host.len());
    q.extend_from_slice(&id.to_be_bytes());
    q.extend_from_slice(&[0x01, 0x00, 0, 1, 0, 0, 0, 0, 0, 0]);
    for label in host.trim_end_matches('.').split('.') {
        let len = u8::try_from(label.len()).ok().filter(|n| (1..=63).contains(n))?;
        q.push(len);
        q.extend_from_slice(label.as_bytes());
    }
    q.extend_from_slice(&[0, 0, 1, 0, 1]);
    Some(q)
}

/// Skips a name, compressed or not, and returns the offset after it.
fn skip_name(m: &[u8], mut at: usize) -> Option<usize> {
    loop {
        let len = *m.get(at)?;
        if len & 0xC0 == 0xC0 {
            return Some(at + 2);
        }
        at += 1;
        if len == 0 {
            return Some(at);
        }
        at += usize::from(len);
    }
}

/// The reply's verdict: `Err` for NXDOMAIN, the A records for NOERROR, None for anything else or a reply to another id.
fn parse_reply(m: &[u8], id: u16) -> Option<Result<Vec<IpAddr>, ()>> {
    if m.len() < 12 || u16::from_be_bytes([m[0], m[1]]) != id || m[2] & 0x80 == 0 {
        return None;
    }
    match m[3] & 0x0F {
        3 => return Some(Err(())),
        0 => {}
        _ => return None,
    }
    let answers = u16::from_be_bytes([m[6], m[7]]);
    let mut at = skip_name(m, 12)? + 4;
    let mut ips = Vec::new();
    for _ in 0..answers {
        at = skip_name(m, at)?;
        let head = m.get(at..at + 10)?;
        let kind = u16::from_be_bytes([head[0], head[1]]);
        let len = usize::from(u16::from_be_bytes([head[8], head[9]]));
        let data = m.get(at + 10..at + 10 + len)?;
        if kind == 1 && len == 4 {
            ips.push(IpAddr::from([data[0], data[1], data[2], data[3]]));
        }
        at += 10 + len;
    }
    Some(Ok(ips))
}

fn udp_lookup(host: &str) -> Option<Result<Vec<IpAddr>, ()>> {
    let socket = std::net::UdpSocket::bind("0.0.0.0:0").ok()?;
    socket.set_read_timeout(Some(Duration::from_secs(2))).ok()?;
    for (n, resolver) in UDP_RESOLVERS.iter().enumerate() {
        let id = 0x5743 ^ u16::try_from(n).unwrap_or(0) ^ u16::try_from(std::process::id() & 0xFFFF).unwrap_or(0);
        let packet = query(host, id)?;
        if socket.send_to(&packet, resolver).is_err() {
            continue;
        }
        let mut buf = [0u8; 1500];
        while let Ok((len, from)) = socket.recv_from(&mut buf) {
            if from.to_string() != *resolver {
                continue;
            }
            if let Some(verdict) = parse_reply(&buf[..len], id) {
                return Some(verdict);
            }
            break;
        }
    }
    None
}

fn lookup(host: &str) -> (Dns, Vec<IpAddr>) {
    match udp_lookup(host) {
        Some(Ok(ips)) if !ips.is_empty() => return (Dns::Live, ips),
        Some(Ok(_) | Err(())) => return (Dns::Missing, Vec::new()),
        None => {}
    }
    for resolver in RESOLVERS {
        let answer = agent()
            .get(resolver)
            .query("name", host)
            .query("type", "A")
            .header("accept", "application/dns-json")
            .call()
            .ok()
            .filter(|r| r.status().is_success())
            .and_then(|mut r| r.body_mut().with_config().limit(64 * 1024).read_json::<Value>().ok());
        match answer.as_ref().and_then(addresses) {
            Some(Ok(ips)) if !ips.is_empty() => return (Dns::Live, ips),
            Some(Ok(_) | Err(())) => return (Dns::Missing, Vec::new()),
            None => {}
        }
    }
    (Dns::Unknown, Vec::new())
}

/// Connects to the address public DNS gave, whatever this computer's own DNS says; TLS still checks the name.
#[derive(Debug)]
struct Pinned(Vec<IpAddr>);

impl Resolver for Pinned {
    fn resolve(
        &self,
        uri: &ureq::http::Uri,
        _config: &ureq::config::Config,
        _timeout: NextTimeout,
    ) -> Result<ResolvedSocketAddrs, ureq::Error> {
        let port = uri.port_u16().unwrap_or(443);
        let mut out = self.empty();
        for ip in self.0.iter().take(4) {
            out.push(SocketAddr::new(*ip, port));
        }
        if out.is_empty() { Err(ureq::Error::HostNotFound) } else { Ok(out) }
    }
}

/// Where RFC 9728 puts the resource's metadata: `https://host/tg/mcp` → `https://host/.well-known/oauth-protected-resource/tg/mcp`.
fn metadata_url(connector: &str) -> Option<(String, String)> {
    let rest = connector.strip_prefix("https://")?;
    let (authority, path) = rest.split_once('/').unwrap_or((rest, ""));
    let host = authority.split(':').next()?.to_string();
    let path = path.trim_end_matches('/');
    let suffix = if path.is_empty() { String::new() } else { format!("/{path}") };
    Some((host, format!("https://{authority}/.well-known/oauth-protected-resource{suffix}")))
}

fn fetch(url: &str, ips: Vec<IpAddr>) -> Answer {
    match pinned(ips, 10).get(url).call() {
        Ok(mut r) if r.status().as_u16() == 200 => {
            let ok = r
                .body_mut()
                .with_config()
                .limit(64 * 1024)
                .read_json::<Value>()
                .is_ok_and(|v| v["resource"].is_string());
            if ok { Answer::Ok } else { Answer::Wrong { status: 200 } }
        }
        Ok(r) => Answer::Wrong { status: r.status().as_u16() },
        Err(e) => Answer::Unreached { reason: e.to_string() },
    }
}

/// `connector` comes from the tool's own status and was checked by `mcp_server::validate_url`.
pub fn check(connector: &str) -> Result<PublicCheck, String> {
    let (host, url) = metadata_url(connector).ok_or("the server's address is not an https address")?;
    let (dns, ips) = lookup(&host);
    let answer = if dns == Dns::Live { fetch(&url, ips) } else { Answer::NotTried };
    Ok(PublicCheck { host, dns, answer })
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn reads_a_dns_json_answer() {
        let live = json!({"Status": 0, "Answer": [
            {"name": "h.ts.net.", "type": 5, "data": "x.ts.net."},
            {"name": "x.ts.net.", "type": 1, "data": "203.0.113.7"}
        ]});
        assert_eq!(addresses(&live), Some(Ok(vec!["203.0.113.7".parse().unwrap()])));
        assert_eq!(addresses(&json!({"Status": 3})), Some(Err(())));
        assert_eq!(addresses(&json!({"Status": 0})), Some(Ok(vec![])));
        assert_eq!(addresses(&json!({"Status": 2})), None);
        assert_eq!(addresses(&json!({})), None);
    }

    #[test]
    fn writes_a_query_and_reads_a_reply() {
        let q = query("h.ts.net", 7).unwrap();
        assert_eq!(&q[..4], &[0, 7, 1, 0]);
        assert_eq!(&q[12..], b"\x01h\x02ts\x03net\x00\x00\x01\x00\x01");
        assert_eq!(query(&"a".repeat(64), 1), None);

        // A reply: the question, then a CNAME and an A record, both names compressed.
        let mut reply = vec![0, 7, 0x81, 0x80, 0, 1, 0, 2, 0, 0, 0, 0];
        reply.extend_from_slice(&q[12..]);
        reply.extend_from_slice(&[0xC0, 12, 0, 5, 0, 1, 0, 0, 0, 60, 0, 2, 0xC0, 12]);
        reply.extend_from_slice(&[0xC0, 12, 0, 1, 0, 1, 0, 0, 0, 60, 0, 4, 203, 0, 113, 7]);
        assert_eq!(parse_reply(&reply, 7), Some(Ok(vec![IpAddr::from([203, 0, 113, 7])])));
        assert_eq!(parse_reply(&reply, 8), None);

        let mut missing = reply[..12 + q.len() - 12].to_vec();
        missing[3] = 0x83;
        missing[7] = 0;
        assert_eq!(parse_reply(&missing, 7), Some(Err(())));
    }

    #[test]
    fn finds_the_resource_metadata_under_the_tools_path() {
        assert_eq!(
            metadata_url("https://h.ts.net/tg/mcp"),
            Some(("h.ts.net".into(), "https://h.ts.net/.well-known/oauth-protected-resource/tg/mcp".into()))
        );
        assert_eq!(
            metadata_url("https://h.ts.net:8443/mcp"),
            Some(("h.ts.net".into(), "https://h.ts.net:8443/.well-known/oauth-protected-resource/mcp".into()))
        );
        assert_eq!(metadata_url("http://127.0.0.1:8765/mcp"), None);
    }

    /// Talks to public DNS-over-HTTPS: `cargo test public_address -- --ignored`. Fails where all three are blocked.
    #[test]
    #[ignore = "needs the internet"]
    fn a_name_that_does_not_exist_is_missing() {
        assert_eq!(lookup("no-such-name-wirecat-check.ts.net").0, Dns::Missing);
        assert_eq!(lookup("dns.google").0, Dns::Live);
    }
}
