# Cloudflare tunnel as the second way to a public address

TASK-30, journal `docs/journal/2026-10-25-desktop-mvp.md`. The owner chose on 2026-10-27: the tunnel runs on the
user's own Cloudflare account and domain, and Desktop runs cloudflared (NEED-101 A); it is acceptable when the user
chooses it and is warned that Cloudflare decrypts the traffic (NEED-102 A, "I'd warn about this"). Background and the
other options: `docs/dev/research/2026-10-27-public-address-fallbacks.md`.

"Verified" below means seen in output on this computer (Linux, cloudflared 2026.10.5). "Docs" means Cloudflare's own
pages say it; that is not a test. Nothing was created in any Cloudflare account.

## Shape

Same as Funnel (plan `2026-10-27-one-mcp-entry.md` section 10): one public name, a path per tool, no WireCat router.

```
https://wirecat.<user's domain>/tg/...                                  -> http://127.0.0.1:<tg port>
https://wirecat.<user's domain>/.well-known/oauth-authorization-server/tg -> same port, path kept
https://wirecat.<user's domain>/.well-known/oauth-protected-resource/tg   -> same port, path kept
... the same three for max, wa ...
anything else                                                           -> 404
```

One **locally managed** tunnel (its routes live in a config file Desktop writes), not a dashboard tunnel. The guide's
"Public address" step offers two choices; the Cloudflare one carries the privacy warning on its card, before it is
picked. The per-app instructions do not change: the address still comes from the server's `connector_url`.

## The user's steps

1. **Download cloudflared.** Desktop fetches the standalone binary from cloudflared's GitHub release into
   `<app data>/dev.wirecat.desktop/cloudflared/`, checked against the SHA-256 GitHub states for the file (`digest`).
   No installer, no service, no password (rule 6).
2. **Connect your Cloudflare account.** `cloudflared tunnel login`; the browser opens Cloudflare, the user logs in,
   picks the domain and presses Authorize. The certificate goes into the OS keyring.
3. **Choose the address.** The user types a new name under that domain (`wirecat.example.com`). Desktop runs
   `tunnel create` and `tunnel route dns`, keeps the tunnel's credentials in the keyring and drops the certificate.
4. **Start the server** (the guide's existing step). Desktop writes the ingress for the tool, starts cloudflared in
   the background, waits for its readiness page, then runs `mcp server start` with `https://<name>/<tool>`.
5. **Check the address** (existing step): public DNS, then the protected-resource metadata through the public address.

## Why this route

| | CLI login, locally managed (chosen) | Dashboard tunnel and token |
| --- | --- | --- |
| Browser steps | One: log in, pick the domain, Authorize | Create the tunnel, then add three routes per tool by hand, copy the token |
| Adding a tool | Desktop rewrites the config | The user adds three more routes in the dashboard |
| Run with | Credentials in `TUNNEL_CRED_CONTENTS` + `--config` | `--token`, which the docs say is "for remotely-managed tunnels only" |

Docs: login asks the user to "select your hostname" and writes `cert.pem`
([create a locally-managed tunnel](https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/do-more-with-tunnels/local-management/create-local-tunnel/));
the dashboard route is under Networking > Tunnels
([create a remotely-managed tunnel](https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/get-started/create-remote-tunnel/));
`--token` "for remotely-managed tunnels only"
([run parameters](https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/configure-tunnels/run-parameters/)).

## Facts the code depends on

- **Login ignores `--origincert`** and always writes `~/.cloudflared/cert.pem`; with a certificate already there it
  prints "You have an existing certificate at … which login would overwrite" and **exits 0** without logging in
  (cloudflared `cmd/cloudflared/tunnel/login.go`, `checkForExistingCert`). Verified: with `HOME` set to another
  folder it reports that folder's `.cloudflared/cert.pem`. So Desktop runs login with a home folder of its own and
  never touches the user's `~/.cloudflared`.
- **cloudflared opens the browser itself** (`xdg-open`, `open`, `cmd /c start`, found on PATH). A browser started with
  Desktop's private home would be a new, empty profile. Verified: with an empty PATH it prints "Please open the
  following URL" and a `https://dash.cloudflare.com/argotunnel?…` link; Desktop opens that link itself.
- **`route dns` adds the name under the domain picked at login** when the typed name is outside it
  (`tunnel.example.com.x.com`, [cloudflared#1295](https://github.com/cloudflare/cloudflared/issues/1295)). It prints
  "Added CNAME <name> which will route to this tunnel" (`cfapi/hostname.go`); Desktop compares the name and says
  which record to delete.
- **Ingress `path` is a regular expression and the full path is passed on**; a catch-all rule must come last
  ([configuration file](https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/do-more-with-tunnels/local-management/configuration-file/)).
  Verified with `cloudflared tunnel ingress validate` and `ingress rule`: `/tg`, `/tg/mcp`,
  `/.well-known/oauth-protected-resource/tg/mcp` and `/.well-known/oauth-authorization-server/tg` reach tg's port;
  `/tgx`, another host and `/.well-known/oauth-protected-resourceXtg` get 404.
- **Credentials from the environment.** Verified: `TUNNEL_CRED_CONTENTS` with made-up credentials makes cloudflared
  register that tunnel id; Cloudflare answers "Failed to get tunnel" and cloudflared **retries for ever**, so Desktop
  stops waiting at the first such line and says the tunnel may have been deleted.
- **Readiness:** `/ready` next to `/metrics` answers 200 with at least one connection, 503 otherwise
  (`metrics/readiness.go`); the docs name only `/metrics` and a default port of 20241–20245 or random
  ([metrics](https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/monitor-tunnels/metrics/)).
  Desktop passes `--metrics 127.0.0.1:<free port>`.
- **`--no-autoupdate`**: a binary not installed by a package updates itself and exits with code 11 for something else
  to restart it (`updater/update.go`). Desktop passes it and `--config` (otherwise `/etc/cloudflared` is read too).
- **No admin rights to run.** The downloads page offers the bare binaries
  ([downloads](https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/downloads/));
  only `service install` writes system locations. Verified on Linux: Desktop's own download code fetched 2026.10.5,
  matched GitHub's digest and ran. **Not run on macOS or Windows.** The macOS binary is signed by Cloudflare Inc.; a
  file an app downloads itself is not quarantined, so Gatekeeper should not ask (inferred).
- **SSE works through a named tunnel; keep it.** Quick tunnels "do not support Server-Sent Events"
  ([quick tunnels](https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/do-more-with-tunnels/trycloudflare/));
  for named tunnels cloudflared flushes every write of a `text/event-stream` response (`connection/connection.go`).
  Cloudflare ends a request with 524 when the origin gives no response within 125 s
  ([error 524](https://developers.cloudflare.com/support/troubleshooting/http-status-codes/cloudflare-5xx-errors/error-524/)).
  In MCP SDK 1.32.1, SSE mode returns the response headers as soon as the request is dispatched and sends a keep-alive
  comment every 15 s (`webStandardStreamableHttp.js`, `DEFAULT_SSE_KEEP_ALIVE_MS`); `enableJsonResponse` would hold
  the headers until the tool finishes, so a call slower than 125 s would get 524. **No cli-core change**: the research's
  suggestion to switch to JSON responses would make things worse here.

## Secrets

- Certificate: in the keyring from the end of login until the tunnel exists, then deleted. It can create and delete
  tunnels and DNS records in that zone, so it is not kept.
- Tunnel credentials (account tag, tunnel id, secret): in the keyring; handed to cloudflared as
  `TUNNEL_CRED_CONTENTS`, never as an argument. Another process of the same user can read a process's environment
  (`/proc/<pid>/environ`), as it can ask the keyring.
- **On disk only for one command:** cloudflared reads the certificate and writes the credentials only as files. Login
  writes `cert.pem` into Desktop's folder, `create` reads a copy of it and writes `credentials.json`; each is removed
  when the command ends (owner-only mode on Linux and macOS; on Windows the folder's default rights).
- Nothing secret in `tunnel.json` (name, tunnel id, routes, PID, metrics port) or `config.yml` (routes).
  `cloudflared.log` names the hostname and Cloudflare's locations, no secret.

## Desktop

- Rust `cloudflare_install.rs` (download), `cloudflare.rs` (login, create, run, stop). Commands, each with checked
  arguments: `cloudflare_status`, `cloudflare_install`, `cloudflare_login`, `cloudflare_stop`, `cloudflare_create
  (hostname)`, `cloudflare_tunnel_open (tool, port)`, `cloudflare_tunnel_close (tool)`, `cloudflare_routes`.
- cloudflared runs in the background and outlives the app, as the tools' servers do. Desktop stops it by its recorded
  PID, and only while that PID is still Desktop's cloudflared (`/proc/<pid>/exe` on Linux, `ps` on macOS, `tasklist`
  on Windows). Adding or removing a tool restarts it, which drops the other tools' connections for a few seconds.
- Stopping a tool's server takes its paths off the tunnel; the last one stops cloudflared. After a restart of the
  computer the guide shows "The Cloudflare tunnel is not running" with Start the tunnel.
- Mocks: `?cloudflare=missing|unsupported|loggedout|noaddress|ready`, `?cloudflare-os=…`,
  `?cloudflare-fail=install|login|address|tunnel`, `?connect=tunnel-off`.

## Not done, and why

- **No end-to-end run against Cloudflare.** It needs an account and a domain; wirecat.dev is the owner's. A test name
  (`mcp-test.wirecat.dev`) is an owner decision.
- **Zero Trust onboarding.** The tunnel pages list none; the Zero Trust setup page says every use case needs an
  organization and a plan with payment details, even Free
  ([Zero Trust setup](https://developers.cloudflare.com/cloudflare-one/setup/)). Whether `tunnel create` from the CLI
  needs it is unknown until someone runs it.
- **Bot Fight Mode and "I'm Under Attack"** on the domain challenge non-browser clients and cannot be skipped by rules
  ([Bot Fight Mode](https://developers.cloudflare.com/bots/get-started/bot-fight-mode/)); they would block ChatGPT's and
  Claude's servers. The address check shows the status Cloudflare answers and names both.
- **Deleting the tunnel and its record** from Cloudflare when the user is done: not offered; the guide says the old
  tunnel stays in the account.
- **Updating cloudflared**: the download step runs once; a newer release is not offered yet.
