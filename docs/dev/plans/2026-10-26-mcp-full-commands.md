# Every command over MCP; sign-in from WireCat Desktop

Asked on 2026-10-26 (journal TASK-17). **Revised the same day for TASK-18:** sign-in moves out of MCP and into
WireCat Desktop. Plan only: nothing in the CLI repositories or in Desktop code is changed yet.

Open decisions: NEED-53, NEED-57, NEED-58, NEED-59. Superseded or answered: NEED-52, NEED-54, NEED-55 (section 9).
Findings: FIND-34, RISK-14, RISK-15.

The owner, first (TASK-17): "allow session start and so on via mcp for full support … allow all commands by default
and we may just have a setting to turn that off". MCP is not promoted to CLI users, but it must work so that WireCat
can be found and listed through MCP.

The owner, then (TASK-18): "if we use mcp we would have to pass user credentials to ai agent and they will leak, so
probably need to set up the auth locally anyway. but whats great is we can actually drive the setup from the desktop
app so users enter credentials there or in browser so they dont feed stuff to ai agent but still can login without
using the terminal. And I'd allow enabling mcp, starting/stopping/status check of cli server right from the desktop
and also setting up a tunnel with cloudflared/tailscale so they dont have to set it up via terminal".

Code references are to `main` on 2026-10-26: cli-core `6d8f415a`, cli-base `a89dffe`, tg-cli `6f25538`, max-cli
`85ba8edc`, whatsapp-cli `0eaae4b`, zoom-cli `307323b`, drive-cli `2e71d32`, cli-memo `f198a69`. CLI paths are under
`~/Projects/AI/`; Desktop paths are in this repository.

## 1. What MCP leaves out today, and why

The three MCP tools (`<tool>_tools_search`, `<tool>_read`, `<tool>_write`) are built in cli-core
(`cli-core/src/mcp/surface.ts:119-245`). The catalogue behind them comes from `toolsFromCommands`
(`cli-core/src/mcp/agent.ts:224-251`). A command is left out when one of these is true:

| # | Reason | Where it is decided | Commands it removes |
| --- | --- | --- | --- |
| 1 | `lifetime: "interactive"`: the command asks questions at a terminal | `cli-core/src/mcp/agent.ts:235` (catalogue), `agent.ts:298-299` (refused if called) | every `session start`, every `setup` |
| 2 | `mcp: false` on a command or on its group (children inherit it) | `cli-core/src/mcp/agent.ts:234`; inheritance in `cli-base/src/commands/registry.ts:178,198` | see the per-tool list below |
| 3 | `lifetime: "persistent"`: runs until stopped, so a call never returns | `cli-core/src/mcp/agent.ts:235` | `mcp`, `serve`, `watch`, `bot mcp`, `mirrors watch` |
| 4 | An exclusion list in the server | personal server `cli-core/src/mcp/server.ts:144` (`bot`, which has its own `bot mcp` server); zoom `zoom-cli/src/mcp.ts:25`; memo `cli-memo/src/mcp/catalogue.ts:14-21` | see below |
| 5 | Owner-only options (`ownerOnlyOption`) | `cli-core/src/cli/effects.ts:153-155`, dropped in `agent.ts:207` | single flags, not commands |
| 6 | The messenger cannot do it at all (`lackedNeed`) | `cli-core/src/mcp/server.ts:186`, `cli-core/src/cli/messenger/lacks.ts:44-50` | correct; stays |

Commands that are offered but blocked by permissions (shown as unavailable, with the reason):

- `mcp.authority` is `deny` by default (`cli-core/src/sends/permissions.ts:31`, cli-core ruling 1662). It blocks
  commands marked `grantsAuthority`: `config set` (`cli-core/src/cli/config-command.ts:76`), `upgrade`
  (`cli-core/src/cli/upgrade-command.ts:51`), `bot` settings (`cli-core/src/cli/bot/command.ts:37,109,215`), memo
  `mail add` and mail rules (`cli-memo/src/mail/setup-command.ts:17`, `cli-memo/src/mail/command.ts:460,502,567`),
  memo `folders add|update`, drive `config set|unset`, `models set` and `skill install`.
- `bot.api` is deny over MCP only (`cli-core/src/sends/permissions.ts:65-78`). `replies.send` is deny everywhere
  (`permissions.ts:29`).
- Level `ask` already means "go ahead" over MCP (`cli-core/src/mcp/server.ts:190-191`, cli-core ruling 773, commit
  `1c94a5d1`). So "allow by default" needs no change for ordinary writes.

### Sign-in, per tool

| Tool | Command | Over MCP today | What it asks a person | Works without a terminal today? |
| --- | --- | --- | --- | --- |
| wa | `session start [qr\|phone]` | out: `mcp: false` on the group (`whatsapp-cli/src/commands/session.ts:44`), interactive (`session.ts:49-52`) | scan a QR that renews; or type the phone number, then type an 8-character pairing code into the phone | **QR: yes.** With `--json` each QR is a stderr line `{"event":"qr","qr":{"text","expires_at","scan"}}` (`cli-core/src/terminal/login-qr.ts:53-65`). Phone: no, it refuses (`whatsapp-cli/src/session.ts:107-140`) |
| max | `session start [token\|qr\|qr-chrome\|sms]` | out: `mcp: false` on the group (`max-cli/src/commands/session.ts:29`) | QR scan, then the cloud password if set (`session.ts:199-210`, `askPassword` at 203); `token` reads a pasted token (`session.ts:152-154`); `qr-chrome` and `sms` open a local Chromium (`session.ts:181-187`) | QR: yes, same QR line (`session.ts:189-195`), until a cloud password is needed; it then refuses (`session.ts:200-205`) |
| tg | `session start [qr\|phone]` | out: interactive (`tg-cli/src/commands/session.ts:205`) | first time: app keys from my.telegram.org (`--app browser`: `api_id` and hidden `api_hash`; `--app auto`: phone and a code). Then a QR scan, or phone, login code and 2FA password (`session.ts:146-185`) | no: refuses without a TTY unless `--qr-file` (`session.ts:133-140`); every question goes through one `ask` function (`session.ts:135-141`) |
| zoom | `session start` | out: interactive (`zoom-cli/src/setup-commands.ts:194`); also an authority change (`zoom-cli/src/mcp.ts:29`) | approve in a browser (OAuth with PKCE); needs `config set zoom.client_id` first (`setup-commands.ts:172-173`) | partly: refuses `--no-input` and `CI` (`setup-commands.ts:176-181`); prints the URL to stderr (`setup-commands.ts:189`); falls back to a pasted redirect (`readPaste`) |
| drive | `session start` | out: `mcp: false` (`drive-cli/src/commands/session.ts:28`) | Google sign-in in the browser | yes: opens the browser itself and prints the URL to stderr (`session.ts:60-61`) |
| memo | (no sign-in) | — | adding a mail account is `mail add`, an authority change | — |

`setup` (tg, max, wa) is interactive everywhere and also installs skills and writes agent settings.

### Other `mcp: false` commands (owner-only on purpose)

`help` (`cli-core/src/cli/help/first-screen.ts:175`, drive `drive-cli/src/first-screen.ts:74`), `complete`
(`cli-core/src/cli/messenger/complete-command.ts:39`, `drive-cli/src/commands/discovery.ts:20`), `bot auth`, which
takes the bot token (`cli-core/src/cli/bot/command.ts:35`), drive `api call`, the raw Google API
(`drive-cli/src/commands/remote.ts:116`), and memo's list: `upgrade`, `skill install`, `jobs start|stop`, `config unset`
(`cli-memo/src/mcp/catalogue.ts:14-21`). Zoom also leaves out `complete` (`zoom-cli/src/mcp.ts:25`).

**FIND-34 · Stale skill text in WhatsApp.** `whatsapp-cli/skills/whatsapp-cli/SKILL.md:34` says `chats delete|clear`
are "not over MCP". No code leaves them out (`cli-core/src/cli/messenger/records-command.ts:131-154`); since commit
`1c94a5d1` the level `ask` goes ahead over MCP. The line predates that commit. Fix it with this work.

## 2. The direction (TASK-18)

1. **A secret never passes through an agent.** Phone numbers, login codes, 2FA and cloud passwords, tokens and app
   keys are typed into WireCat Desktop, or into the provider's own page in a browser. Never into a chat.
2. **Desktop drives sign-in; the tool still does it.** Rule 1 (`CLAUDE.md`): Desktop never reimplements a tool's
   sign-in. So the tool speaks a small machine-readable protocol (section 3), and Desktop only draws it: a QR image,
   a code to type into the phone, an input field, a masked password, progress.
3. **Over MCP, `session start` signs nothing in.** It tells the agent where the person finishes (section 4).
4. **Desktop manages the MCP server** per tool and profile: enable, start, stop, status, copy client config
   (section 5), and **a tunnel** for browser apps (section 6).

**What this drops from the first version of the plan.** The pending-login holder in the MCP server
(`PendingSignIn`), the one-time sign-in page, URL-mode elicitation, the match code and the `mcp.sign-in` permission
key are no longer needed. The MCP specification's problem (a secret must not pass through form-mode elicitation, and
the page must know who opens it) goes away, because no secret enters MCP at all.

## 3. Sign-in from Desktop

### 3.1 How Desktop runs tools today

- `run::command` starts every tool with an empty stdin (`src-tauri/src/run.rs:79-82`).
- `run::stream` streams stdout and stderr lines (`run.rs:212-219`). `stream_with_input` writes one input, then
  closes stdin (`run.rs:221-236`). It is how the Storage page hands a value to `store backup` (`backup.rs:303`).
- Cancel sends `SIGTERM` to the process group and then kills the child at once (`run.rs:304-316`).
- Sign-in today is `open_setup` (`src-tauri/src/lib.rs:394-400`): it opens the catalog's `setup` words in the
  user's terminal (`src-tauri/src/terminal.rs:7-21`). Buttons: `src/features/tools/Health.tsx:120,243`,
  `src/features/tools/Permissions.tsx:342`, `src/features/onboarding/steps.tsx:405`.

So Desktop can already show what a tool prints. It cannot yet answer a question: that needs a run that keeps stdin
open (phase 2).

### 3.2 The protocol the tool speaks

It grows from the QR line cli-core already prints. With `--json`, the tool writes one JSON object per line on
**stderr**; stdout keeps only the final answer, as today.

| Event | Meaning | Desktop shows |
| --- | --- | --- |
| `{"event":"qr","qr":{"text","link","expires_at","scan"}}` | a QR to scan; a new one replaces the old | the QR as an image from `link`, the `scan` sentence, a countdown |
| `{"event":"pairing_code","code","expires_at","where"}` | a code to type into the phone (WhatsApp) | the code, large, and where to type it |
| `{"event":"open_url","url","purpose"}` | a page the person opens: OAuth, my.telegram.org | an "Open in browser" button; the tool may already have opened it |
| `{"event":"needs","field","secret","prompt","hint"}` | the tool waits for one answer on stdin | an input field; masked when `secret` |
| `{"event":"progress","step","message"}` | waiting, receiving history | a line under a spinner |

The answer to `needs` is one line on stdin. The run ends as today: exit code and the `--json` answer on stdout
(`done`), or the usual error envelope (`failed`). Today's `qr` event has `text` only; adding `link` is a small
change in `loginQr` (`cli-core/src/terminal/login-qr.ts:53-65`), shared by wa and max. Until then Desktop draws
`text` in a monospace block.

`needs` is opt-in: `--answer-stdin` (name to settle in cli-core). Without the flag a tool off a terminal keeps
refusing, as now. An agent that runs the command in a shell must never hang on a read nobody will answer.

Fields per tool: `phone` (not secret), `code` (login code), `password` (2FA or MAX cloud password, secret),
`api_id`, `api_hash` (secret), `token` (MAX, secret), `redirect` (Zoom or Google pasted redirect, secret).

### 3.3 What Desktop adds

- One `#[tauri::command]` to start: `sign_in(id, profile, method)`. The tool id and a method from the catalog; the
  profile validated as today (`catalog::with_profile`). Rust maps them to fixed words (rule 2). Events go back on a
  typed `Channel`, parsed by valibot in `src/platform/`.
- One `#[tauri::command]` to answer: `sign_in_answer(run, value)`. Rust writes the value to that run's stdin. The
  value is never an argument, never logged, never kept after the write.
- One to stop: `sign_in_stop(run)`. `SIGTERM` to the group, then a few seconds' grace before the kill, so
  WhatsApp's history wait ends cleanly and keeps what came. Today's `kill` does not wait (`run.rs:304-316`).
- **Nothing personal reaches a log (rule 4, and SEC-5).** A QR link and a pairing code are login tokens while they
  are valid. They reach the window unmasked, on the Channel only. The line log Desktop keeps for a run gets the
  event name and never its payload. Typed answers never appear in any log or bug report.
- The catalog gets a `signIn.methods` entry per tool (words and labels). The "Open terminal" button stays for
  tools and methods not yet ported.

## 4. Sign-in over MCP

- `session start` stays out of the MCP catalogue, as today (reasons 1 and 2 in section 1). Instead, every
  messenger's server instructions (`cli-core/src/mcp/instructions.ts`) and `session status` say the same thing
  when there is no account: "Sign in from WireCat Desktop (Tools → <tool> → Sign in), or run
  `<bin> <profile> session start` in a terminal." The terminal line matters: CLI-only users have no Desktop.
- The agent passes that sentence on. It never sees a code, a password, a QR or a token.
- `session status` over MCP reports whether the profile is signed in, so the agent can check after the person is
  done.
- For browser sign-in (Zoom, Google) the agent may also give the link Desktop would open. Not needed in phase 1.
- `setup` stays out of MCP (NEED-55, answered).
- `session end` over MCP: NEED-57. Today tg offers it (`tg-cli/src/commands/session.ts:252`, no `mcp: false`),
  while wa, max and drive leave it out.
- Skill text to update: `max-cli/skills/max-cli/SKILL.md:54` ("Через MCP вход недоступен") and wa's
  `AGENTS_LINK_BY_QR` (`whatsapp-cli/src/commands/session.ts:35-40`) say the same thing in the new words.

## 5. Desktop manages the MCP server

What exists:

- `mcp` serves stdio; `mcp --http --port <n> --public-url <https>` serves Streamable HTTP on `127.0.0.1`
  (`cli-core/src/cli/messenger/mcp-command.ts:46-90`; default port 8765, `mcp-command.ts:32`). tg, max, wa
  (cli-core), drive (`drive-cli/src/commands/mcp.ts`) and memo (`cli-memo/src/mcp/command.ts`) have it. **zoom has
  no HTTP server.**
- The HTTP server has its own login: an OAuth server for one owner. Any client may register, but no client gets a
  token without a one-time code (`cli-core/src/mcp/http/oauth.ts:97-108`). The code goes to the server's terminal
  through `onCode` (`cli-core/src/mcp/server.ts:544-547`), lasts ten minutes and changes after each login
  (`oauth.ts:15`). Host and Origin checks refuse rebound DNS names (`cli-core/src/mcp/http/serve.ts:108-129`).
- `mcp --revoke` forgets every issued login (`mcp-command.ts:64-69`). `mcp config` prints the client entry
  (`mcp-command.ts:93-121`); `mcp add` registers with Codex or Claude Code.
- `mcp --http` runs in the foreground until `SIGINT` or `SIGTERM` (`server.ts:560-563`). **It has no lock file,
  no PID file, no background mode.**
- `serve` already has all of that: `server start|stop|restart|status|logs` with a lock file, the PID, a marker
  check before a stop, and optional systemd or launchd units
  (`cli-core/src/cli/messenger/server-command.ts:43-110`).

What the CLI must add (cli-core, then drive and memo):

1. **`mcp server start|stop|status`** on the same pattern as `server`: a lock file with PID, start time, port and
   public URL; `stop` only kills a PID whose command line carries its marker (`carries`, `server-command.ts:97`).
   Desktop then never kills a process it did not identify, and status survives a Desktop restart.
2. **The login code in `mcp server status --json`**, read from a mode-600 status file the server writes on each new
   code. A background server has no terminal to print it on.
3. **Clients in the status**: from the token file (`oauth.ts:41,198-206`), the registered clients that hold a live
   token, with their names and when they last got one. Names come from open registration, so the window shows
   them as untrusted text. Live connections are in the server's memory only; not reported.

What Desktop adds: an **MCP** block per tool and profile on the Tools page.

- **Local (stdio):** the existing Agents page flow (`mcp check`, `mcp add`, remove); plus "Copy config" from
  `mcp config`.
- **Remote (HTTP):** Start / Stop, the state (running since, port, public URL), the login code to type into the
  browser app, the list of logged-in clients, "Forget all logins" (`mcp --revoke`). Each runs the tool's own
  command (rules 1 and 2). Zoom shows "not available yet".

## 6. Tunnel

The browser apps (claude.ai, ChatGPT) call the server from their own servers on the internet, so the tunnel must be
public. A tunnel that only the owner's own devices reach does not work for them.

| | cloudflared quick tunnel | cloudflared named tunnel | Tailscale Funnel | Tailscale Serve |
| --- | --- | --- | --- | --- |
| Account | none | Cloudflare account and a domain | Tailscale account | Tailscale account |
| Install, rule 6 | a single binary, runs as the user ([downloads](https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/downloads/)) | same binary; `cloudflared tunnel login` in a browser | `tailscaled` is a system service: needs admin; Desktop only uses one already installed | same |
| Address | new on every start ([quick tunnels](https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/do-more-with-tunnels/trycloudflare/)) | stable | stable `*.ts.net` | stable, tailnet only |
| Reaches browser apps | yes, but see RISK-15 | yes | yes; ports 443, 8443, 10000 only; first use needs approval in Tailscale's admin page ([Funnel](https://tailscale.com/kb/1223/funnel)) | **no**: tailnet only ([Serve](https://tailscale.com/kb/1242/tailscale-serve)) |
| Cloudflare's own word | "for testing and development" | for production | — | — |

**RISK-15 · A quick tunnel may break MCP, and breaks the login on every restart.** Cloudflare says quick tunnels "do
not support Server-Sent Events". cli-core's HTTP transport does not set `enableJsonResponse` (no match in
`cli-core/src/`), so I think answers may be sent as server-sent events and fail. Not tested. Also, the public URL is
the OAuth issuer (`serve.ts:98`): a new hostname means every browser app must be added and logged in again.
Before Desktop offers quick tunnels, test MCP through one; if it fails, the CLI can answer with plain JSON, but
check that this does not break the 2025-era session path (`serve.ts:35-75`).

What Desktop does, all as user processes:

- **cloudflared:** downloads the release binary into the app's data folder (as for Node.js, `node.rs`), checks it,
  runs `cloudflared tunnel --url http://127.0.0.1:<port>`, reads the `trycloudflare.com` address from its output,
  then starts `mcp --http --public-url <that address>`. The order is forced: `--public-url` must be known at start
  (`cli-core/src/http/public-url.ts:9-28`). Desktop keeps the cloudflared PID it started and stops only that PID.
- **Tailscale:** if `tailscale` is on PATH and logged in, Desktop runs `tailscale funnel --bg <port>`-style
  commands and reads the `*.ts.net` name from `tailscale status --json`. If Tailscale is missing, or Linux asks for
  root, Desktop explains the fix (install it; or the one-time `sudo tailscale set --operator=$USER`) and never runs
  it (rule 6). The docs I read do not say whether Linux needs `--operator` for `serve`/`funnel`, or document `--bg`
  for `funnel`: check on a real machine.
- The order of the two: NEED-58.

## 7. Security

| | stdio (local agent) | HTTP through a tunnel |
| --- | --- | --- |
| Who can call | the process that started the server: the owner's agent | anyone with a token from the owner login |
| Sign-in | never over MCP | never over MCP |
| Secrets | only in Desktop or the provider's page | same |
| Permissions | the profile's, as today | the profile's, as today (cli-core ruling 774), unless NEED-59 makes a tunnel start read-only |

- **What protects a tunnel:** the owner login. No token without the one-time code shown only to the owner, five
  wrong codes pause attempts for 30 s (`oauth.ts:16-17`), tokens stored only as hashes (`oauth.ts:61-71`), and
  Host and Origin checks. Desktop shows the code only on the owner's screen and offers "Forget all logins".
- **Stopping the tunnel** is the real off switch. Desktop says plainly when a server is reachable from the internet.
- **RISK-14 · An agent could lift its own limits.** Still open with NEED-53: today only `mcp.authority: deny` keeps
  `config set` from agents. If it opens, an agent could write `permissions`. Zoom already refuses this case
  (`zoom-cli/src/mcp.ts:90-93`); memo leaves out `config unset`. Make it one cli-core rule: over MCP, nothing writes
  the `permissions` setting, at any level.
- Typed answers go only on stdin. I found no stdin field in run records (`cli-core/src/cli/command-runs.ts`, a text
  search only). Confirm with a test before phase 2 ships.

## 8. Phases

1. **WhatsApp QR from Desktop. Desktop only, no CLI change.** `sign_in` runs `wa <profile> session start qr --json`
   with the existing `stream`, parses `qr` lines from stderr, draws the QR, shows "receiving history" and Stop.
   Why this one: it asks nothing; the QR line exists and is tested off a terminal (`whatsapp-cli/src/commands/session.test.ts:42-59`, run 2026-10-26, 23 of 23 pass); the hardest part to draw, a QR that renews every 20 s, is proven first.
   Optional small cli-core change: `link` in the `qr` event. Drive is simpler still, but its sign-in already
   happens in the browser, so it proves less.
2. **The rest of sign-in.** cli-core: `pairing_code`, `open_url`, `needs`, `progress` events and the opt-in flag in
   one shared helper. Per tool: wa phone and pairing code; max QR plus cloud password, and token; tg QR and phone,
   code, 2FA and app keys (its `ask` becomes the helper); zoom and drive `open_url` plus the pasted redirect.
   Desktop: the stdin-holding run, `sign_in_answer`, the graceful stop. MCP side: the "finish in Desktop" sentence
   and skill texts (section 4), FIND-34.
3. **MCP server management.** cli-core `mcp server start|stop|status` with lock file, login code and clients;
   drive and memo the same. Desktop: the MCP block (section 5).
4. **Tunnel.** First test MCP through a quick tunnel (RISK-15). Then the provider NEED-58 picks, then the other.

## 9. Decisions

**NEED-57 · Over MCP, should `session end` be offered by every tool, or by none?**

- Now: tg offers it (`tg-cli/src/commands/session.ts:252`); wa, max and drive leave it out (`mcp: false` on their
  group). No secret is involved, but it logs the account out on the provider's side; WhatsApp's code says unlinking
  is not an agent's call (`whatsapp-cli/src/commands/session.ts:43`).
- Options: **A** none: sign-out from Desktop or a terminal only, tg loses it · **B** all, under the profile's
  permissions · **C** leave each tool as it is.
- Recommendation: **A**. Sign-in and sign-out sit in one place, and an agent that cannot sign in back should not
  sign out.
- If no answer: C stays (today's mix), and the instructions text says sign-out is in Desktop.

**NEED-58 · Which tunnel should Desktop set up first: Tailscale Funnel or a cloudflared quick tunnel?** (proposal,
not decided)

- Now: no tunnel support; the owner sets one up by hand.
- Options: **A** Tailscale Funnel first: stable address, logins survive restarts; needs Tailscale already installed
  (admin) and a one-time approval · **B** cloudflared quick tunnel first: no account, nothing to install as admin;
  new address and new logins on every start, and it may break MCP (RISK-15) · **C** a named Cloudflare tunnel:
  stable, user process; needs a Cloudflare account and a domain.
- Recommendation: **A**, then **B** as "try it" once tested.
- If no answer: phase 4 starts with the RISK-15 test only.

**NEED-59 · When Desktop opens a tool to the internet through a tunnel, should that server start read-only?**

- Now: HTTP follows the profile's permissions, like stdio (cli-core ruling 774). A tunnel plus a stolen login token
  could send messages.
- Options: **A** read-only by default for a tunnel started from Desktop, one switch "Allow sending" (the tool's
  `--permission <key>=deny` flags, which only make levels stricter, `mcp-command.ts:40-41`) · **B** the profile's
  permissions, as today.
- Recommendation: **A**. The first use of a remote connector is reading; sending is one deliberate click.
- If no answer: B stays.

**NEED-53 · Does "allow all commands by default" also mean the commands that change what an agent may do later
(`config set`, `skill install`, `upgrade`, memo `mail add`, bot settings)?** Still open.

- Now: `mcp.authority: deny` blocks them (cli-core ruling 1662: an agent could lift its own limits).
- Options: **A** `mcp.authority` stays deny · **B** on by default, with the rule that nothing writes `permissions`
  over MCP (RISK-14) · **C** on, no extra rule.
- Recommendation: **A**.
- If no answer: A; authority commands stay listed as unavailable with the reason.
- **поправка (TASK-18):** the first version paired this with "sign-in on by default". Sign-in no longer runs over
  MCP, so only the authority half remains.

**NEED-52 · Should sign-in over the remote HTTP server be off by default?** **поправка (TASK-18): superseded.**
Sign-in runs over no MCP transport. The remaining question about HTTP defaults is NEED-59.

**NEED-54 · How does an agent hand over a login code or a 2FA password?** **поправка (TASK-18): superseded.** It
does not. Codes and passwords are typed into Desktop, which writes them to the tool's stdin (section 3).

**NEED-55 · Should `setup` also run over MCP?** **поправка (TASK-18): answered — no.** `setup` stays at the terminal
and in Desktop; with sign-in out of MCP, nothing in it belongs there.

## 10. How to test

- **Phase 1, Desktop:** a mock scenario `?signin=wa` that streams QR lines and renewals; Rust unit test that parses
  `qr` lines and keeps their payload out of the run log. By hand: link a real WhatsApp profile from the app,
  light and dark, keyboard only (rule 8).
- **Phase 2, cli-core:** the shared helper prints each event and reads `needs` answers only with the opt-in flag;
  without it, a non-terminal run still refuses. Run records and the agent log hold no answer.
- **Per tool,** with its fake transport: wa phone and pairing code; max QR plus password and token; tg QR, phone
  plus code plus 2FA, app keys; zoom and drive URL plus pasted redirect.
- **Phase 3:** `mcp server start` twice refuses the second; `stop` refuses a PID without the marker; `status`
  shows the login code and clients; Desktop restart keeps the state.
- **Phase 4:** a real MCP session (`tools/list`, one read) from a browser app through each tunnel type; the
  address change after a quick-tunnel restart.
- **Contract:** each tool's shared-contract test passes with any template change.
