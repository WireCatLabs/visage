# Every command over MCP, sign-in included

Asked on 2026-10-26 (journal TASK-17). Plan only: nothing in the CLI repositories is changed yet.
Open decisions: NEED-52 to NEED-55. Findings: FIND-34, RISK-14.

Goal, in the owner's words: "allow session start and so on via mcp for full support … allow all commands by default
and we may just have a setting to turn that off". MCP is not promoted to CLI users. It must work so that WireCat can
be found and listed through MCP.

Code references are to the `main` branch on 2026-10-26: cli-core `3540f7cc`, cli-base `a89dffe`, tg-cli `6f25538`,
max-cli `85ba8edc`, whatsapp-cli `0eaae4b`, zoom-cli `307323b`, drive-cli `2e71d32`, cli-memo `f198a69`. All paths
are under `~/Projects/AI/`.

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

- `mcp.authority` is `deny` by default (`cli-core/src/sends/permissions.ts:31`, owner ruling NEED-1662 in the cli-core
  journal). It blocks commands marked `grantsAuthority`: `config set` (`cli-core/src/cli/config-command.ts:76`),
  `upgrade` (`cli-core/src/cli/upgrade-command.ts:51`), `bot` settings (`cli-core/src/cli/bot/command.ts:37,109,215`),
  memo `mail add` and mail rules (`cli-memo/src/mail/setup-command.ts:17`, `cli-memo/src/mail/command.ts:460,502,567`),
  memo `folders add|update`, drive `config set|unset`, `models set` and `skill install`.
- `bot.api` is deny over MCP only (`cli-core/src/sends/permissions.ts:65-78`). `replies.send` is deny everywhere
  (`permissions.ts:29`).
- Level `ask` already means "go ahead" over MCP (`cli-core/src/mcp/server.ts:190-191`, owner ruling NEED-773, commit
  `1c94a5d1`). So "allow by default" needs no change for ordinary writes.

### Sign-in, per tool

| Tool | Command | Why it is out | What it needs from a person |
| --- | --- | --- | --- |
| tg | `session start [qr\|phone]` | interactive (`tg-cli/src/commands/session.ts:205`); refuses without a terminal unless `--qr-file` (`session.ts:133-138`) | scan a QR; or phone number, login code, 2FA password (`session.ts:183-185`); first time also app keys from my.telegram.org |
| tg | `setup` | interactive (`tg-cli/src/commands/setup.ts:83`) | all of the above, plus skill install |
| max | `session` group | `mcp: false` on the group (`max-cli/src/commands/session.ts:29`), so `session end` is out too | QR scan, then the cloud password through `ask` (`session.ts:207-209`); `token` reads a pasted token; `qr-chrome` and `sms` open a local Chromium (`session.ts:181-187`) |
| max | `setup` | interactive and `mcp: false` (`max-cli/src/commands/setup.ts:92`) | as above |
| max | `bot uploads` | `mcp: false` (`max-cli/src/commands/bot-setup.ts:11`) | owner-only bot set-up |
| wa | `session` group | `mcp: false` on the group (`whatsapp-cli/src/commands/session.ts:44`), start is interactive (`session.ts:49-52`), so `session end` (`session.ts:90`) is out too | scan a QR that renews often; or type an 8-character pairing code into the phone |
| wa | `setup` | interactive and `mcp: false` (`whatsapp-cli/src/commands/setup.ts:45-49`) | as above |
| zoom | `session start` | interactive (`zoom-cli/src/setup-commands.ts:194`); also counted as an authority change (`zoom-cli/src/mcp.ts:29`); refuses `--no-input` and `CI` (`setup-commands.ts:177-181`) | approve in a browser (OAuth with PKCE); needs `config set zoom.client_id` first |
| drive | `session start`, `session end` | `mcp: false` (`drive-cli/src/commands/session.ts:28,85`) | Google sign-in in a browser; `--no-browser` prints the URL (`session.ts:39`) |
| memo | (no sign-in) | memo has no session; adding a mail account is `mail add`, an authority change | none |

The shared contract template marks the whole `session` group `mcp: false` and `setup` interactive
(`cli-core/src/cli/contract-templates.ts:52,57-60`). cli-base checks tools against it
(`cli-base/src/dev/shared-contracts.ts:97`), so the template must change first, or every tool's contract test fails.

### Other `mcp: false` commands (owner-only on purpose)

`help` (`cli-core/src/cli/help/first-screen.ts:175`, drive `drive-cli/src/first-screen.ts:74`), `complete`
(`cli-core/src/cli/messenger/complete-command.ts:39`, `drive-cli/src/commands/discovery.ts:20`), `bot auth`, which
takes the bot token (`cli-core/src/cli/bot/command.ts:35`), drive `api call`, the raw Google API
(`drive-cli/src/commands/remote.ts:116`), and memo's list: `upgrade`, `skill install`, `jobs start|stop`, `config unset`
(`cli-memo/src/mcp/catalogue.ts:14-21`). Zoom also leaves out `complete` (`zoom-cli/src/mcp.ts:25`).

### Where the "no sign-in over MCP" text comes from

`max-cli/skills/max-cli/SKILL.md:54`: "Через MCP вход недоступен". It describes reasons 1 and 2 above.

**FIND-34 · Stale skill text in WhatsApp.** `whatsapp-cli/skills/whatsapp-cli/SKILL.md:34` says `chats delete|clear`
are "not over MCP". No code leaves them out (`cli-core/src/cli/messenger/records-command.ts:131-154`); since commit
`1c94a5d1` the level `ask` goes ahead over MCP. The line predates that commit. Fix it with this work.

## 2. The design

### 2.1 Sign-in is two kinds of step

A sign-in is a short series of steps. Each step is one of two kinds:

- **Show step.** The server has something for the person to see: a QR, the WhatsApp pairing code, an OAuth URL.
  Nothing secret goes back to the server. It is safe for this to pass through the model.
- **Submit step.** The person must give the server something secret: a login code, a 2FA or cloud password, a MAX
  token, Telegram app keys, a pasted OAuth redirect.

### 2.2 The start call returns at once; the login lives in the server

`session start` over MCP does not wait for the scan. It starts the login inside the MCP server process and answers
at once with the first step. A second call, `session status`, reads where the login is now (and the next QR when
WhatsApp renews it). Three facts force this shape:

- Each MCP call runs a fresh program (`cli-core/src/mcp/agent.ts:24-26`). A login cannot live inside one call.
- The server runs one call at a time (`cli-core/src/mcp/server.ts:272-277`). A two-minute wait for a scan would block
  every other tool.
- The model cannot show a QR until its call returns.

**One shared piece in cli-core:** a `PendingSignIn` holder, one per server, handed to commands through the run's
environment, the same way `spawnJob` and `embedders` are today (`cli-core/src/mcp/server.ts:226-230`). It is made in
`createServer`, next to `session` (`server.ts:195-199`), not in `build()`: `build()` runs again for each throwaway
stdio probe (`server.ts:92-96`) and for each HTTP session (`cli-core/src/mcp/http/serve.ts:55`). It holds at most one
login, with a deadline. The holder owns the login's connection and its abort signal, not the call: today everything a
call opens is closed when the call ends (`trackCloseable`, `signal`, `commandSignal`, `server.ts:57-77`). Before
sign-in there is no account, so the server's shared connection cannot be lent (`server.ts:236-251`); the login opens
its own. Each tool's `session start` keeps its own login code and only reports its steps to
the holder: `show(kind, payload)`, `needs(kind, prompt)`, `done(account)`, `failed(error)`. At a terminal the same
calls draw the QR and ask the question as they do now. After `done`, the server drops its cached connection, so the
next call connects as the new account (`MessengerSession`, `cli-core/src/mcp/session.ts`).

Changes in cli-core and cli-base:

1. Let `toolsFromCommands` and `runCommandForAgent` offer a command with `lifetime: "interactive"` when it declares
   that it supports agent sign-in (a new annotation, `agentSteps: true`). Persistent commands stay out
   (`agent.ts:235,298-299`).
2. Remove `mcp: false` from the `session` group in the contract template (`contract-templates.ts:57`), and give
   `session start` the new annotation there.
3. Add a shared `session status` answer for a pending login.

### 2.3 How a submit step reaches the person

The MCP specification forbids form-mode elicitation for passwords, API keys and tokens, and requires URL mode for them
([elicitation, 2026-07-28](https://modelcontextprotocol.io/specification/2026-07-28/client/elicitation), "Form Mode
Security"; the same rule is in
[2025-11-25](https://modelcontextprotocol.io/specification/2025-11-25/client/elicitation)). In URL mode the secret
does not pass through the client or the model.

So the server serves a **one-time sign-in page**: a single form for the one value it needs, at a random path, valid
for one use and a few minutes.

- stdio: on `127.0.0.1`, with a random port.
- HTTP: under the tunnel's public address.

The spec also says the server **must verify that the person who opens the URL is the person who started the
request** (2025-11-25 page, "Phishing"), and must not hand out a pre-authenticated URL ("Safe URL Handling"). A random
one-time path alone does not meet that. The existing HTTP owner login does not help: it gives tokens to MCP client
apps after a code typed from the server's terminal (`cli-core/src/mcp/http/oauth.ts:97-108`); a person opening a link
in a browser holds no such token. So:

- stdio: the page is on this computer only; besides the random path, it shows a short code that the sign-in step's
  answer also shows, and the person confirms they match. That is enough for one owner on one machine (I think;
  not reviewed against the spec's full security text).
- HTTP: there is no trustworthy way today to know who opens the page. One more reason for NEED-52 **A**. If the owner
  wants HTTP sign-in, the page needs a browser session bound to the owner login first: a separate piece of work.

The server hands the page to the person in this order:

1. If the client declares URL-mode elicitation, send it (`mode: "url"`). The installed SDK, `@modelcontextprotocol/server`
   2.4.0, has both shapes: `elicitInput` for 2025-era clients and the `inputRequired(...)` builder for the 2026-07-28
   multi-round-trip model (`cli-core/node_modules/@modelcontextprotocol/server/dist/mcp-BCJHyo7l.d.mts`). Servers must
   not send a mode the client did not declare (spec, "Capabilities").
2. Otherwise, the step's answer carries the URL and a sentence for the model to pass on: "open this link and enter
   the code there". This works in every client.

Fallback, only if NEED-54 says yes: the value as the command's stdin field (`cli-core/src/mcp/agent.ts:186-195`). It
stays out of argv, but it does pass through the model's context. Before that ships, check that run records
(`cli-core/src/cli/command-runs.ts`) and the agent log keep no stdin.

Client support for elicitation: not verified here. I did not find a current support table on modelcontextprotocol.io.
cli-core's own comment says the browser apps declare form support (`cli-core/src/mcp/http/serve.ts:35-38`). This
plan does not depend on elicitation: the URL in the answer is the baseline.

Note on the owner's earlier ruling: MCP shows no confirmation forms (NEED-772, commit `1c94a5d1`). A sign-in page is
not a confirmation of a write, but it is a page outside the chat. NEED-54 asks.

### 2.4 The setting

A new permission key, **`mcp.sign-in`**, checked only by MCP servers, like `bot.api`
(`cli-core/src/sends/permissions.ts:65-78`). It is not a command key, so `session.start: deny` would not be the same:
that would also block the owner's own terminal. `mcp.sign-in` covers `session start`, `session end` and `setup`, if
NEED-55 lets `setup` in.

- Default `allow` over stdio. Default over HTTP: NEED-52.
- The owner turns it off with one line in the profile's permissions: `mcp.sign-in: deny`. Or, for one server only,
  with the existing flag `--permission mcp.sign-in=deny`, which can only make levels stricter
  (`cli-core/src/cli/messenger/mcp-command.ts:40-41`).
- The read-only lock and a profile that is `readonly` as a whole turn `mcp.sign-in` off. Today a login has no
  permission key, so the lock does not see it (`cli-core/src/cli/effects.ts:122-135`).
- Side effect to handle: `mcp config` refuses to install a server that offers any writing tool unless `--allow-writes`
  is passed (`cli-core/src/cli/messenger/mcp-command.ts:153-157`). With `session start` offered everywhere, every
  profile would need that flag, including the desktop app's "Advanced: MCP". Leave `mcp.sign-in` commands out of that
  count.
- Discovery still lists the command, marked unavailable with the reason, as it does for other blocked commands
  (`cli-core/src/mcp/agent.ts:236-242`).

**RISK-14 · An agent could switch the setting back on.** Today only `mcp.authority: deny` keeps `config set` away from
agents. If "allow all by default" also opens `mcp.authority` (NEED-53), an agent could run
`config set permissions …` and lift `mcp.sign-in: deny` or any other limit. Zoom already refuses this case
(`zoom-cli/src/mcp.ts:90-93`); memo leaves out `config unset` (`cli-memo/src/mcp/catalogue.ts:20`); the others rely on
`mcp.authority`. Make it one cli-core rule: **over MCP, nothing writes the `permissions` setting, at any level.**

## 3. Per-tool work

Build it in two phases, so the first ships without any page:

1. **Show steps only.** tg QR without 2FA, WhatsApp pairing code and QR, max QR without a cloud password, the Zoom and
   Google URLs over stdio, and `session end` everywhere. No secret ever reaches the server through MCP.
2. **Submit steps.** The one-time page for codes, passwords, tokens and pasted redirects (section 2.3).

**cli-core** (most of the work):

- `PendingSignIn` holder, the one-time page (stdio and HTTP), URL-mode elicitation with the URL-in-answer fallback.
- `agentSteps` annotation; the catalogue and runner changes; `session status`; `mcp.sign-in` key; the
  "never write permissions over MCP" rule; drop the connection after a login.
- The audit row: today a call is not logged until an account is known (`cli-core/src/mcp/server.ts:221`). A sign-in
  must always be logged, most of all over HTTP.
- Instructions text: say that sign-in works and how (`cli-core/src/mcp/instructions.ts`).

**cli-base:** contract template and parity check accept `agentSteps` on `session start`; `session` group no longer
`mcp: false`.

**tg-cli:** `startSession` reports to the holder instead of refusing without a terminal (`session.ts:133-138`). QR: a
show step with the PNG (as an image result, reusing `pictureTools`, `cli-core/src/mcp/tools.ts`) and the login link. Phone: the number as an argument; code and 2FA password as submit steps. Missing app keys: a submit step for
`api_id` and `api_hash` (or `--app auto`, if it asks nothing secret: not checked). Recommend QR over MCP.

**max-cli:** remove `mcp: false` from the `session` group (`session.ts:29`). `qr`: show step, then the cloud password
as a submit step (`session.ts:207-209`). `token`: submit step. `qr-chrome` and `sms` open a local browser: offer them
over stdio only, refuse over HTTP. Update `SKILL.md:54` and `AGENT_QR_HELP` (`session.ts:134-137`). `setup` follows
NEED-55.

**whatsapp-cli:** remove `mcp: false` from the group (`session.ts:44`). Recommend the pairing code (`phone`) over MCP:
one show step that does not expire in seconds. QR stays possible; `session status` returns the current QR, since it
renews faster than a round trip through the model. Fix FIND-34 in `SKILL.md:34`.

**zoom-cli:** builds its own server from cli-core parts (`zoom-cli/src/mcp.ts:72-108`), so it needs the same wiring by
hand. Take `session start` out of `changesAuthority` (`mcp.ts:29`) and put it under `mcp.sign-in`. The OAuth URL is a
show step; when the redirect cannot reach this machine (HTTP mode, the person is elsewhere), the pasted redirect URL
(`readPaste`) is a submit step. `config set zoom.client_id` stays an authority change.

**drive-cli:** builds its own catalogue without `toolsFromCommands` (`drive-cli/src/mcp.ts:127`), so the shared change
does not reach it. Remove `mcp: false` from `session start|end` (`session.ts:28,85`), add `agentSteps`. Google URL as a
show step, `--no-browser` behaviour; over HTTP the redirect paste is a submit step. `--grant write` widens what later
calls may do: treat that argument as an authority change.

**cli-memo:** no sign-in. Nothing to do beyond following NEED-53 for `mail add`.

Persistent commands (`mcp`, `serve`, `watch`) stay out in every tool: an MCP call must return.

## 4. Security defaults

| | stdio (local agent) | HTTP (`mcp --http --public-url`) |
| --- | --- | --- |
| Who can call | whoever started the process: the owner's own agent | whoever holds the owner login of the tunnel |
| What sign-in adds | the agent can link an account the owner then uses | a remote caller can add an account to this computer, or end one |
| `mcp.sign-in` default | allow | deny, unless the profile says allow (NEED-52) |
| Submit steps | page on `127.0.0.1`, with a match code | not until the page can verify the owner (see 2.3) |
| Browser-based methods (`qr-chrome`, `sms`, OAuth loopback) | allowed | refused, or paste-back only |

Always, both transports:

- No secret as a command argument. Secrets go through the one-time page; the stdin fallback only if NEED-54 says yes.
- One pending login per server, with a deadline; a new start cancels the old one.
- Nothing writes `permissions` over MCP (RISK-14).
- Every sign-in step goes into the agent log, with no secret in it.

## 5. Decisions for the owner

**NEED-52 · Should sign-in over the remote HTTP server be off by default, even though stdio has it on?**

- Now: the owner ruled that HTTP follows the same permissions as stdio (NEED-774, commit `1c94a5d1`). Sign-in over
  HTTP lets anyone with the tunnel login add or end an account on this computer.
- Options: **A** off over HTTP unless the profile says `mcp.sign-in: allow`; on over stdio · **B** same as stdio: on
  everywhere.
- Recommendation: **A**. Linking a new account is bigger than reading or sending. The owner still turns it on with
  one line.
- If no answer: the plan ships A, which is a narrow exception to NEED-774.

**NEED-53 · Does "allow all commands by default" also mean the commands that change what an agent may do later
(`config set`, `skill install`, `upgrade`, memo `mail add`, bot settings)?**

- Now: `mcp.authority: deny` blocks them (owner ruling NEED-1662: an agent could lift its own limits).
- Options: **A** sign-in on by default; `mcp.authority` stays deny · **B** both on by default, with the rule that
  nothing writes `permissions` over MCP (RISK-14) · **C** both on, no extra rule.
- Recommendation: **A**. Sign-in is what blocks "full support". Authority commands are rare for an agent, and opening
  them weakens every other limit.
- If no answer: A ships; authority commands stay listed as unavailable with the reason.

**NEED-54 · How does an agent hand over a login code or a 2FA password?**

- Now: no way over MCP. The spec forbids passing passwords through form-mode elicitation.
- Options: **A** only the one-time page (URL mode where the client supports it, else the link in the answer) · **B**
  the page, plus the command's stdin field as a fallback (the value passes through the model) · **C** stdin only.
- Recommendation: **A**. It works in every client and keeps the secret out of the model and its logs.
- If no answer: A ships; phone-code login over MCP needs a browser on the same network as the server.

**NEED-55 · Should `setup` also run over MCP, or only `session start`?**

- Now: `setup` signs in, installs skills into agents and writes agent configuration.
- Options: **A** only `session start` and `session end` over MCP; `setup` stays at the terminal · **B** `setup` too,
  with skill install under `mcp.authority`.
- Recommendation: **A**. An agent connected over MCP is already set up; it only needs to sign in.
- If no answer: A ships; skills say "sign in with `session start`".

## 6. How to test

- **cli-core unit:** catalogue offers `session start` with `agentSteps` and still refuses `persistent`; `mcp.sign-in:
  deny` marks it unavailable and the runner refuses it; `--permission mcp.sign-in=deny` wins over the profile;
  `config set permissions` is refused over MCP at every level; HTTP default follows NEED-52.
- **cli-core integration** with the in-memory MCP client (`cli-core/src/testing/mcp-http-client.ts` already declares
  elicitation): start → show step → status → submit through the one-time page → done → next call uses the new
  account. Once with a client that declares URL mode, once without (URL in the answer). Check that the page refuses
  a second use and an expired token, and that the agent log has the steps and no secret.
- **Per tool,** with the tool's fake transport: tg QR and phone + 2FA, max QR + password and token, wa pairing code
  and QR renewal, zoom and drive OAuth with the paste-back step.
- **By hand, real accounts:** Claude Code over stdio for each tool; one tool over `mcp --http` through the tunnel
  from a browser app, with NEED-52's default.
- **Contract:** each tool's shared-contract test passes with the new template.
