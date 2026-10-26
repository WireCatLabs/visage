# Tailscale Funnel without an administrator password

Research for TASK-25 (NEED-70 A, journal `docs/journal/2026-10-25-desktop-mvp.md`). Question: can WireCat Desktop give a
local MCP server on `127.0.0.1:<port>` a public HTTPS address through Tailscale Funnel, with no `sudo`, nothing
installed into a system folder, and everything kept in the user's home folder?

Source read: `tailscale/tailscale` at tag **v1.104.2** (commit `e26db7a5797683ec99ad1516c40b628c7f2dfd71`), the same
version as the binary run below. Links point at that tag.

## Verdict

| OS | Run `tailscaled` as the user (userspace) | Embedded `tsnet` helper |
| --- | --- | --- |
| Linux | **Works** (run here, see below). Official static tarball, no root, no capabilities. | Works by code reading; not built. |
| macOS | **Works with caveats.** Code allows it, but Tailscale ships no standalone `tailscaled` for macOS: we would build it ourselves. | Works by code reading; not built or run on a Mac. |
| Windows | **Works with caveats.** Only with `--windows-mode=dev`, a mode named for developers. No standalone `tailscaled.exe` download either. | Works by code reading; not built or run on Windows. |

**Recommendation: a small `tsnet` helper** (Go, BSD-3), not a user-run `tailscaled`. On macOS and Windows both paths
mean we build and ship Tailscale code ourselves; `tsnet` does it in one binary with no socket, no second CLI and no
text output to parse, and it is the shape Tailscale documents for "embed Tailscale in a program". Decision: NEED-73.

## What was run (Linux, 2026-10-27)

Official tarball `tailscale_1.104.2_amd64.tgz` from pkgs.tailscale.com, SHA-256 matched the published `.sha256`.

```sh
TS_LOGS_DIR=<scratch>/logs nice -n 10 tailscaled --tun=userspace-networking \
  --statedir=<scratch>/state --socket=/run/user/1000/wirecat-ts-test.sock --port=0
tailscale --socket=/run/user/1000/wirecat-ts-test.sock up --hostname=wirecat-test   # stopped after 20 s
```

Seen:

- The daemon ran as `leemour` with **no capabilities**: `CapEff: 0000000000000000` in `/proc/<pid>/status`.
- It reached state `NeedsLogin`, and `tailscale up` printed `To authenticate, visit: https://login.tailscale.com/a/…`.
  Not opened; no node was added. Process stopped by its PID.
- `--port=0` picked random UDP ports (46916, 46207), so no clash with the system daemon on 41641. The system
  `tailscaled` stayed `active` and `tailscale status` was unchanged throughout.
- Idle before login: 0 CPU ticks over 10 s, ~38 MB resident memory. **Connected idle was not measured.**
- Harmless warnings only: no TPM access, cannot raise UDP buffer sizes ("impacts throughput only").

Three traps found on the way:

1. **Socket path length.** The first try put the socket in the scratch folder and failed with
   `safesocket.Listen: … bind: invalid argument`. A Unix socket path must be under ~108 bytes on Linux (104 on
   macOS). Desktop must use a short path, e.g. `$XDG_RUNTIME_DIR/wirecat-ts.sock`.
2. **Logs go outside `--statedir`.** Without `TS_LOGS_DIR`, the daemon wrote `tailscaled.log.conf` (a private log
   id) and log buffers to `~/.local/share/tailscale/` ([`logpolicy/logpolicy.go#L210-L259`](https://github.com/tailscale/tailscale/blob/v1.104.2/logpolicy/logpolicy.go#L210-L259):
   `TS_LOGS_DIR` first, then the default state dir's parent, created with `MkdirAll`). That folder is unknown to
   `storage.rs`. (Created by this test and removed again.)
3. **Logs are uploaded by default.** Both runs got a `LogID`, so logs (including the list of network interfaces) are
   sent to Tailscale's log server unless `--no-logs-no-support` / `TS_NO_LOGS_NO_SUPPORT=true` is set
   ([`cmd/tailscaled/tailscaled.go#L234`](https://github.com/tailscale/tailscale/blob/v1.104.2/cmd/tailscaled/tailscaled.go#L234),
   [`logpolicy/logpolicy.go#L895-L896`](https://github.com/tailscale/tailscale/blob/v1.104.2/logpolicy/logpolicy.go#L895-L896)). Turning it off also turns off support.

## 1. `tailscaled` as a normal user

- Flags: `--tun=userspace-networking`, `--state`, `--statedir`, `--socket`, `--port`
  ([`tailscaled.go#L216-L223`](https://github.com/tailscale/tailscale/blob/v1.104.2/cmd/tailscaled/tailscaled.go#L216-L223)). Certificates live in the state dir
  ([`tailscaled.go#L434`](https://github.com/tailscale/tailscale/blob/v1.104.2/cmd/tailscaled/tailscaled.go#L434)).
- Userspace mode skips creating a TUN device and turns off socket marking: `onlyNetstack = name ==
  "userspace-networking"`, `netns.SetEnabled(!onlyNetstack)`
  ([`tailscaled.go#L861-L882`](https://github.com/tailscale/tailscale/blob/v1.104.2/cmd/tailscaled/tailscaled.go#L861-L882)). Linux run above: no capabilities needed.
- **macOS:** the root check is skipped in userspace mode — `tailscaled requires root; use sudo tailscaled (or use
  --tun=userspace-networking)` ([`tailscaled.go#L289-L291`](https://github.com/tailscale/tailscale/blob/v1.104.2/cmd/tailscaled/tailscaled.go#L289-L291)). The default
  socket is `/var/run/tailscaled.socket` ([`paths/paths.go#L59-L60`](https://github.com/tailscale/tailscale/blob/v1.104.2/paths/paths.go#L59-L60)), not writable by a
  user, so `--socket` is required. This is the open-source `tailscaled`, not the App Store or Standalone app, which use
  Apple's network/system extensions ([macOS variants](https://tailscale.com/kb/1065/macos-variants)). The Funnel
  page says Funnel on macOS needs one of the open-source variants ([Funnel](https://tailscale.com/kb/1223/funnel)).
- **Windows:** the default socket is a pipe under `\\.\pipe\ProtectedPrefix\Administrators\`, which only
  administrators can create ([`paths/paths.go#L24-L28`](https://github.com/tailscale/tailscale/blob/v1.104.2/paths/paths.go#L24-L28)). Any other `--socket` is refused
  unless `--windows-mode=dev`, which uses a per-user pipe `\\.\pipe\tailscale-<SID>` open to that user only
  ([`tailscaled.go#L356-L386`](https://github.com/tailscale/tailscale/blob/v1.104.2/cmd/tailscaled/tailscaled.go#L356-L386),
  [`#L603-L608`](https://github.com/tailscale/tailscale/blob/v1.104.2/cmd/tailscaled/tailscaled.go#L603-L608)). Works by code, but the mode is described as "a
  developer running tailscaled by hand", so I think Tailscale may change it without notice.
- **Downloads:** pkgs.tailscale.com (`/stable/?mode=json`) ships static tarballs for Linux only. macOS gets the GUI
  `.zip`/`.pkg`, Windows the `.msi`/`.exe` installers (which need admin). The kb page on variants does not say where a
  macOS `tailscaled` binary comes from; in practice it is built from source.
- The kb page on userspace mode ([kb/1112](https://tailscale.com/kb/1112/userspace-networking)) says nothing about
  root, capabilities, Serve or Funnel.

## 2. Serve and Funnel in userspace mode

No TUN dependency in the Funnel path:

- Funnel traffic arrives from Tailscale's ingress node over the tailnet as a POST to the node's peer API
  `/v0/ingress`, which is hijacked into a TCP stream
  ([`ipn/ipnlocal/serve.go#L1497-L1562`](https://github.com/tailscale/tailscale/blob/v1.104.2/ipn/ipnlocal/serve.go#L1497-L1562)) and handed to
  `HandleIngressTCPConn` ([`serve.go#L461`](https://github.com/tailscale/tailscale/blob/v1.104.2/ipn/ipnlocal/serve.go#L461)).
- The peer API and serve ports are always handled in netstack (Tailscale's userspace TCP/IP stack), TUN or not
  ([`wgengine/netstack/netstack.go#L1255-L1281`](https://github.com/tailscale/tailscale/blob/v1.104.2/wgengine/netstack/netstack.go#L1255-L1281)). In userspace mode
  netstack handles every packet to the node's own address anyway
  ([`cmd/tailscaled/netstack.go#L41`](https://github.com/tailscale/tailscale/blob/v1.104.2/cmd/tailscaled/netstack.go#L41),
  [`netstack.go#L1326`](https://github.com/tailscale/tailscale/blob/v1.104.2/wgengine/netstack/netstack.go#L1326)).
- The reverse proxy to `http://127.0.0.1:<port>` dials with `SystemDial`, the host's own network
  ([`serve.go#L1023`](https://github.com/tailscale/tailscale/blob/v1.104.2/ipn/ipnlocal/serve.go#L1023)), so localhost backends work.
- TLS is terminated in the daemon with a certificate stored in the state dir.

Not run end to end here: that needs a login (NEED-74).

## 3. `tsnet` helper

`tsnet` is the same `LocalBackend` and netstack as `tailscaled`, as a Go library
([kb/1244](https://tailscale.com/kb/1244/tsnet)).

- **Funnel:** `Server.ListenFunnel("tcp", ":443")` ([`tsnet/tsnet.go#L1512`](https://github.com/tailscale/tailscale/blob/v1.104.2/tsnet/tsnet.go#L1512)) brings the
  node up, checks the `https` and `funnel` node attributes
  ([`ipn/serve.go#L647-L669`](https://github.com/tailscale/tailscale/blob/v1.104.2/ipn/serve.go#L647-L669)), sets `AllowFunnel` for `<CertDomains[0]>:443`, and returns a
  TLS listener. The helper then copies each connection to `127.0.0.1:<port>` (or uses `httputil.ReverseProxy`). It
  removes `AllowFunnel` on close. It does **not** run the interactive "enable Funnel" flow (TODO at
  [`tsnet.go#L1553-L1556`](https://github.com/tailscale/tailscale/blob/v1.104.2/tsnet/tsnet.go#L1553-L1556)); the helper can call `LocalClient().QueryFeature(ctx,
  "funnel")` ([`client/local/local.go#L1420`](https://github.com/tailscale/tailscale/blob/v1.104.2/client/local/local.go#L1420)), the call the CLI uses, to get the
  approval URL.
- **No TUN, no root:** with no `Tun` set, netstack handles all local packets
  ([`tsnet.go#L914-L917`](https://github.com/tailscale/tailscale/blob/v1.104.2/tsnet/tsnet.go#L914-L917)).
- **Login:** with no auth key the server logs a login URL (`To start this tsnet server, restart with TS_AUTHKEY set, or
  go to: …`, [`tsnet.go#L1156-L1183`](https://github.com/tailscale/tailscale/blob/v1.104.2/tsnet/tsnet.go#L1156-L1183)); the helper reads `AuthURL` from
  `LocalClient().Status` and prints it as JSON for Desktop to open. Auth keys and OAuth are also supported
  ([`tsnet.go#L45-L72`](https://github.com/tailscale/tailscale/blob/v1.104.2/tsnet/tsnet.go#L45-L72)).
- **State:** `Server.Dir`, defaulting to a folder under the OS config dir named after the binary
  ([`tsnet.go#L224-L234`](https://github.com/tailscale/tailscale/blob/v1.104.2/tsnet/tsnet.go#L224-L234)). Desktop sets it explicitly (e.g. under its own data folder),
  so `storage.rs` can list it. Log config and buffer go into the same folder
  ([`tsnet.go#L1091-L1110`](https://github.com/tailscale/tailscale/blob/v1.104.2/tsnet/tsnet.go#L1091-L1110)) — no stray `~/.local/share/tailscale`. Log upload is on
  unless `TS_NO_LOGS_NO_SUPPORT=true`.
- **Ephemeral:** `Ephemeral: true` registers with the ephemeral login flag
  ([`tsnet.go#L967-L968`](https://github.com/tailscale/tailscale/blob/v1.104.2/tsnet/tsnet.go#L967-L968)). The docs say ephemeral nodes come from ephemeral auth keys or
  `--state=mem:` and are removed 30–60 min after last activity ([kb/1111](https://tailscale.com/kb/1111/ephemeral-nodes)).
  I think an interactive login with the ephemeral flag works the same way; not verified.
- **License:** BSD 3-Clause ([`LICENSE`](https://github.com/tailscale/tailscale/blob/v1.104.2/LICENSE)) — ship the notice with Desktop.
- **Size:** not measured. The build needs Go 1.27.3 (`go.mod`) and this machine has 1.26.5; a cold build with a new
  toolchain does not fit the one-minute cap. Ceiling for comparison: official static `tailscaled` 43 MB, `tailscale`
  34 MB. I expect the helper to be noticeably smaller than `tailscaled`, as it drops the CLI-facing features, but that
  is a guess.
- **Shipping:** a Tauri sidecar (`bundle.externalBin`) built per target in CI, signed with Desktop. Alternative that
  fits rule 1 ("the CLIs stay first") better: publish it as its own npm package with prebuilt binaries, the way the
  tools are installed — see NEED-75.

## 4. How the second node looks

- It is a separate device in the owner's tailnet. Its name comes from the hostname (`Hostname`, e.g.
  `wirecat-tbooku`); a clash gets `-1` ([kb/1098](https://tailscale.com/kb/1098/machine-names)). Funnel URL:
  `https://wirecat-tbooku.<tailnet>.ts.net` ([kb/1223](https://tailscale.com/kb/1223/funnel)).
- Funnel limits are per node: the allowed ports come from the node's own `funnel-ports` attribute
  ([`ipn/serve.go#L669`](https://github.com/tailscale/tailscale/blob/v1.104.2/ipn/serve.go#L669)), the serve config belongs to that node's backend, and the certificate
  name is that node's `CertDomains[0]`. So the helper node can use **443** (URL without a port) even if the
  system node already uses 443.
- Policy: the default `nodeAttrs` gives `funnel` to `autogroup:member`
  ([kb/1223](https://tailscale.com/kb/1223/funnel)). A node logged in interactively by a member gets it
  automatically. A node created with a **tagged** auth key does not match `autogroup:member` and needs its own rule.
  MagicDNS and HTTPS must be on for the tailnet — already true for the owner (NEED-68).

## 5. Downsides

- **Key expiry.** An interactively logged-in node's key expires (default 180 days, [kb/1028](https://tailscale.com/kb/1028/key-expiry));
  the public URL stops working until a new login or until expiry is disabled for that node in the admin console.
- **Updates.** With `tsnet`, every Tailscale release, including security fixes, means a WireCat rebuild. With a
  user-run `tailscaled` on Linux we could download new tarballs; on macOS and Windows we build either way.
- **Lifecycle.** Funnel lives only while the helper runs. Desktop starts it with the MCP server and stops it by PID
  when the server stops or Desktop quits. Keeping Funnel up with Desktop closed needs a per-user login item
  (`systemd --user`, LaunchAgent, Run key) — no admin, but more moving parts.
- **Coexistence.** Separate state, socket (or none for `tsnet`) and random UDP port: no conflict with a system
  `tailscaled` (seen on Linux). Two devices appear in the admin console for one computer.
- **Battery/CPU.** Idle before login was zero; a logged-in node keeps a connection to Tailscale's servers and the
  netstack path costs more CPU per byte than the kernel path. Not measured here.
- **Logs.** Uploaded by default (see above); a privacy choice — NEED-76.

## What a test login needs from the owner

One browser login to the owner's tailnet from the helper (or the user-run `tailscaled`), on this Linux machine.
Ephemeral if possible so the node removes itself; otherwise remove it in the admin console afterwards. If device
approval is on, approve it once. HTTPS, MagicDNS and the `funnel` attribute are already in place (NEED-68).

## Open decisions (journal)

- NEED-73 — `tsnet` helper or user-run `tailscaled`.
- NEED-74 — one test login (ephemeral node) on this machine.
- NEED-75 — ship the helper inside Desktop (Tauri sidecar) or as its own npm package.
- NEED-76 — Tailscale log upload on (support possible) or off (`TS_NO_LOGS_NO_SUPPORT`).
