# Record every run, log the API requests inside it, and group runs by agent session

Asked on 2026-10-27 (journal TASK-31): "I think we should log all cli requests by default including successful and
within cli log api requests. also how is joining working? do we request agent id so we can group messages by cli/mcp
command and agent session". Plan only: nothing is changed yet.

cli-core references are to `origin/main` at `75e493c2` (0.462.0); Desktop references to `origin/feat/desktop-mvp`.
Disk figures are totals from `~/.local/share/*-cli/runs`; no record content was read.

Open decisions: NEED-107 … NEED-112 (section 6). Risks: RISK-33 … RISK-39 (section 5).

## Answer in short

- **Successful runs are thrown away today, and with them their request lines.** Every kept run already holds one line
  per API request. An unrecorded run holds its last 500 events in memory and writes them only if it fails or ends
  partial.
- **Grouping by agent session works only for the command line and stdio MCP**: it reads the agent's environment.
- **MCP over HTTP is credited to the wrong agent**: every call goes to whatever process started `mcp --http`, not the
  browser app that made it.
- **The every-profile proxy loses identity**: calls through it carry no caller, only a trace id when the client sends one.
- **Nothing records the MCP client, the OAuth client or the MCP session in a run.**

## 1. Today

### 1.1 What a run record holds

- A run is a directory `<state>/runs/<day>/<runId>/` written by `startRun` (`src/runs/run.ts:104-203`): `run.json`
  (0600, written at start with status `running` and at finish), `events.jsonl` (one line per event), and two lines in
  the day's `index.jsonl` that `runs list` reads (`run.ts:222-232`).
- `run.json` (`RunMetadata`, `run.ts:19-62`): run_id, command, profile, started_at, completed_at, status, duration_ms,
  requests (a count), operations[], codes[], cli_version, runtime, platform, arch, error_code, provider_error, partial,
  kept_because_failed, trace_id, cli_command, argv, unknown_command, agent, error.
- `agent` is `{kind, session_id, from_chat?}` from `agentOf(env)` (`src/runs/run-context.ts:24-57`): Claude Code
  `CLAUDE_CODE_SESSION_ID`, Codex `CODEX_THREAD_ID`, OpenCode `OPENCODE_SESSION_ID`, Hermes `HERMES_SESSION_ID`;
  Gemini CLI, Cursor and OpenClaw give a kind only. OpenClaw sets `from_chat` and nothing about the sender.
- `argv` is masked by `maskArgv` (`run-context.ts:95-185`). With `record_input` on (the default,
  `src/cli/settings.ts:523`) every typed word stays except secrets, credential-shaped words and phone numbers. Off: only
  command words, flag names, the profile and safe-shaped values.
- **When a run is kept:**
  - `src/cli/settings.ts:516`: `record` defaults to false for the messenger CLIs (`run()`).
  - `src/cli/command-runs.ts:27-34`: the same for CLIs built on `startCli`/`recordRuns` (drive, gcal, zoom); line 31
    keeps failures unless the flag or the config says no.
  - `src/mcp/tool.ts:289`: MCP-native tools always use `record: false, keepFailed: true`, and line 317 finishes only
    errors and partial answers — they never keep a success, even with `record: true`.
  - Retention `keep_runs_for_days`, default 30 (`run.ts:98`, `src/cli/default-config.ts:5`), pruned by day directory
    at run start (`run.ts:350-364`). `runs` and `help` are never recorded (`command-runs.ts:68`).

### 1.2 How runs are joined today

- **By agent session:** only `agent.session_id`, from the environment. Desktop already offers `agent` and `session_id`
  as facets (`src/domain/runs.ts:26-51,141,180`) and groups by any facet (`groupRuns`, `runs.ts:347`;
  `features/logs/Groups.tsx`).
- **By trace:** `trace_id` from `TRACEPARENT` (`src/runs/scope.ts:65-68`) or an MCP request's `_meta.traceparent`
  (command tools `src/mcp/server.ts:291-293`, native tools `tool.ts:278`). A command inside another run inherits the
  trace (`scope.ts:58`, `src/runs/recording.ts:82`).

| CLI | Runs kept | With `agent.session_id` | With `trace_id` | Named `mcp …` |
|---|---|---|---|---|
| tg | 716 | 20 | 4 | 8 |
| max | 1084 | 25 | 0 | 0 |
| whatsapp | 97 | 2 | 0 | 0 |
| zoom | 84 | 52 | 0 | 0 |

Of the 11 `mcp …` runs, 3 carry `claude-code` and a session (stdio inherited the environment); 8 have no agent.

### 1.3 API requests inside a run

- `RequestEvent` (`src/runs/events.ts:10-33`): event (request/response), operation, opcode, seq, status, method,
  endpointTemplate, bytes, ids, counts, durationMs, outcome, errorCode, providerError. No retry attempt, no flood wait.
- A recorded run writes every event, uncapped; an unrecorded one holds the newest 500 (`recording.ts:153`) and writes
  them only on failure or partial (`recording.ts:111-133`). `requests` counts `request` events.
- **Emitting today:** every messenger command at operation level (`src/cli/messenger/observed.ts:13-38`); max-cli at
  wire level, one event per frame (`max-cli src/client/request.ts:35-63`); tg Bot API (`tg-cli src/bot/transport.ts:78-102`);
  max Bot API (`max-cli src/bot/transport.ts:127`); WhatsApp Graph API (`whatsapp-cli src/bot/graph.ts:67`); gcal
  (`gcal-cli src/google-api.ts:107`, helper `cli-core src/cli/command-runs.ts:166-181`).
- **Not emitting:** tg MTProto (mtcute middlewares in `tg-cli src/telegram/sending.ts:28-41` only print the flood
  wait); the WhatsApp personal engine (`whatsapp-cli src/engine/go-engine.ts:165`); drive (googleapis/gaxios,
  `drive-cli src/google-api.ts:24-105`); zoom's `ZoomRemote` (`zoom-cli src/remote-http.ts:44-151`).
- **Chat ids already reach disk:** `ids.chat` appears in about 40 kept events across tg and max; `events.ts:5-8` calls
  ids safe. See NEED-110.

### 1.4 What MCP calls record

- **Command tools:** run in-process through `program.run` (`src/mcp/agent.ts:340-370`) as `mcp <command>`; `argv` is
  rebuilt from the agent's input (with `record_input` on, message text is in it); `agent` comes from the MCP server's
  own environment (`server.ts:293`). An audit row per call goes to `agentLog` (`server.ts:222-226`) with the fixed
  actor `<bin>-mcp` and no run id.
- **Stdio:** the server inherits the agent's environment, so kind and session are right for the session that started
  it. `clientInfo.name` from `initialize` is never read.
- **HTTP** (`src/mcp/http/serve.ts`): runs get the environment of the `mcp --http` process — started from a Claude Code
  shell, every browser-app call is credited to that Claude session (RISK-34). The OAuth `clientId` is known per request
  (`serve.ts:197-199`) but only feeds `<token>.activity.json` (`http/activity.ts`); `client_name` is stored with the
  client (`http/oauth.ts:173-202`) and unused in runs. Only `legacySessions` (`serve.ts:44-85`) issues an
  `Mcp-Session-Id`; the stateless `createMcpHandler` path (`serve.ts:170,200`) has none. A public client's id is
  bearer-ish and must be hashed before it is kept.
- **Every-profile proxy** (`src/mcp/all-profiles.ts`): children `<bin> <profile> mcp` are pooled per profile and shared
  by every session (lines 121-140), initialised with `clientInfo: {name: "all-profiles"}` (line 108) and the proxy's
  environment; `_meta` is forwarded on `tools/call` (lines 223-231). Only `_meta` can carry per-session identity.

## 2. Recording every run by default

### 2.1 Disk growth (measured)

| CLI | Allocated per run | Avg `run.json` | Avg non-empty `events.jsonl` | Bytes/event line |
|---|---|---|---|---|
| tg | 9.1 KB | 530 B | 2.3 KB (max 42.5 KB) | ≈235 |
| max | 8.8 KB | 445 B | 2.5 KB (max 12.3 KB) | ≈270 |
| whatsapp | 9.2 KB | 480 B | — | — |
| zoom | 9.5 KB | 1.08 KB | — | — |

Cost is set by 4 KB blocks: a directory, a `run.json`, and an `events.jsonl` when non-empty — about 9 KB without events,
13 KB with request lines. Success rate can't be measured (successes aren't kept), so per CLI:

| Runs per day | Per day | 30 days | Files after 30 days |
|---|---|---|---|
| 100 | 1.3 MB | 39 MB | ≈9k |
| 1,000 | 13 MB | 390 MB | ≈90k |
| 5,000 | 65 MB | 1.9 GB | ≈450k |

**Test leaks:** `app-cli` (2127 runs in 7 days), `chat-cli` (1099), `clidev-cli`, `demo-cli` — test fixtures writing
into the real state directory (RISK-35). Left out of the estimate; phase 0 stops them.

Storage options (NEED-108): **A** keep the format · **B** a success without events writes only its index line
(≈0.5 KB, no directory; `runs show` falls back to the index) · **C** day-level `<day>/events.jsonl` keyed by run id
(≈3 KB per run; `runs show` filters; Desktop reads through `runs show` and sees no change).

### 2.2 Retention

`keep_runs_for_days` stays 30 for failures; new `keep_successful_runs_for_days` defaults to 7. Successes are pruned by
status without opening runs (`runs/<day>/ok/` with A, tagged in the day file with C). A size limit (default 200 MB per
CLI) drops the oldest successes first.

### 2.3 Privacy

Kept always: command words, flag names, profile, `cli_command`, operation names, counts, durations, codes. Values: as
`record_input` says (the owner's 0.439 ruling). Never: secrets, credential-shaped words, phone numbers.

Trade-off: the ruling was made when a success was kept only on request. With every run kept, every `send` leaves the
message text and chat titles on disk for the retention window (0600 files in a 0700 directory). That helps a failure
and adds little to a success. The alternative `record_input: "failed"` narrows the ruling to the case it was made for
— an owner decision (NEED-109).

### 2.4 Edge cases

- **Commands that run until stopped** (`watch`, `bot`, `serve`, `mcp`): recorded only with `--record`, as now; under the
  cap they write a dropped-events summary. Each MCP tool call is already its own run.
- **Desktop's own calls** (`doctor --json`, `account list --json`, `session list --json`; Desktop strips agent
  variables in `src-tauri/src/run.rs:51-95`) would each become a run (NEED-111).
- `runs` and `help` stay skipped.

## 3. API requests inside a run

### 3.1 Event shape

```ts
level?: "operation" | "wire"      // observed.ts writes "operation"; transports write "wire"
transport?: "http" | "mtproto" | "max-ws" | "wa-engine"
attempt?: number                   // 1 for the first try, 2+ for retries
waitMs?: number                    // flood wait or Retry-After before this attempt
```

- No bodies, no URLs as sent, no query strings (`endpointTemplate()`, `recording.ts:164-166`).
- No ids of people or chats in recorded events (NEED-110): `ids` stays in `--trace` live output; recorded events keep
  `counts`. Message ids and the send journal's operation id may stay.
- `requests` counts `level: "wire"` when any wire event exists, otherwise operation events (no double count, RISK-39).
- A flood wait writes a `response` with `outcome: "error"`, `providerError: "FLOOD_WAIT"`, `waitMs`, then the retry with
  `attempt: 2`.

### 3.2 Hooks per transport

| Transport | Where | Status |
|---|---|---|
| Messenger adapter (all) | `cli-core src/cli/messenger/observed.ts` | emits; add `level: "operation"` |
| Google/Zoom-style HTTP | `cli-core providerRequest` (`command-runs.ts:166`) | add method, template, bytes, attempt, waitMs |
| gcal | `gcal-cli src/google-api.ts:107` | emits; pass template, method, attempt |
| drive | `drive-cli src/google-api.ts:24-105` (gaxios interceptor, or wrap with `providerRequest`) | new |
| zoom | `zoom-cli src/remote-http.ts:62-151` (each fetcher attempt) | new |
| tg MTProto | `tg-cli src/telegram/sending.ts`: `RpcCallMiddleware` with `context.request._`, duration, `mt_rpc_error`; `onBeforeWait` → `waitMs` | new |
| tg Bot API | `tg-cli src/bot/transport.ts:78-102` | emits; add duration on error, attempt |
| max personal | `max-cli src/client/request.ts:35-63` | emits; drop `idsOf(request)` from recorded events |
| max Bot API | `max-cli src/bot/transport.ts:127-146` | emits; attempt, waitMs from `retry_after_ms` |
| WhatsApp personal | `whatsapp-cli src/engine/go-engine.ts:165` | new; `transport: "wa-engine"` |
| WhatsApp Graph | `whatsapp-cli src/bot/graph.ts:67,79,126` | emits; add attempt |

Transports reach the run through their `events` sink or `providerEvent` (AsyncLocalStorage, `command-runs.ts:160`);
messenger CLIs under `run()` need a matching ALS sink so deep transports (mtcute middleware) can emit.

### 3.3 Caps per run

At most 2,000 events or 1 MB of `events.jsonl`, then counted not written; one `events.dropped` record with counts per
operation and `events_dropped: n` in `run.json`. The held buffer for unrecorded runs stays 500.

## 4. Agent identity for grouping

### 4.1 Record fields

```jsonc
"agent": {
  "kind": "claude-code" | "codex" | … | "mcp-client",
  "session_id": "…" | null,
  "from_chat": true,
  "client": { "name": "claude-ai", "version": "1.2", "id": "h:3f9a1c2e" },  // id = first 8 hex of sha256(client_id)
  "via": "cli" | "mcp-stdio" | "mcp-http" | "desktop"
},
"mcp": { "tool": "tg_read", "request_id": "17", "connection_id": "…", "proxied": true }
```

`connection_id`: stdio — a UUID made at server start; HTTP legacy path — the `Mcp-Session-Id`; HTTP stateless — absent.

### 4.2 Where each value comes from

- **CLI:** `agentOf(env)` plus `via: "cli"`; `via: "desktop"` when `WIRECAT_CALLER=desktop`.
- **MCP stdio:** kind and session from the environment; `client` from `server.server.getClientVersion()` after
  `initialize`; `via: "mcp-stdio"`; the `connection_id`.
- **MCP HTTP:** never `agentOf(context.env)`; `client` from `authInfo.clientId` (stored `name`, hashed id); `session_id`
  = `Mcp-Session-Id` on the legacy path, `null` on the stateless one (grouping falls back to client plus trace). Verify
  which path ChatGPT and claude.ai use, and that `authInfo` reaches the tool `ctx` on both.
- **Every-profile proxy:** the parent works out the caller, then adds `_meta["wirecat.dev/caller"] = {agent, mcp}` on
  each `tools/call` and sets `proxied: true`. A child trusts it only when its `initialize` came from
  `clientInfo.name === "all-profiles"`.
- **Plumbing:** `runCommandForAgent` already passes an `agent` object into `program.run` (`agent.ts:347-357`), read at
  `command-runs.ts:100` and `context.ts:212`. Add `caller: {agent, mcp}`; `runContextOf` uses `caller.agent` when given.
  Native tools (`tool.ts:280-293`) take the same `caller` from `ctx`.

### 4.3 Grouping keys for Desktop

1. Agent session: `agent.kind + agent.session_id`.
2. MCP connection, when there is no session: `mcp.connection_id`.
3. Trace: `trace_id`.
4. Fallback: `agent.client.id + via`, split where 30 minutes pass with no run.

The "conversation" key is the first that exists.

## 5. Phases

Every phase touching cli-core needs a dependency bump and release in each CLI (wa 0.452, drive 0.453, gcal 0.459,
zoom 0.451; tg and max to check).

- **Phase 0 — stop the test leaks (cli-core):** point tests opening runs with `appName` `app`/`chat` at a temp
  `XDG_STATE_HOME`/`runsDir`; a guard test fails if `pnpm test` writes the real `~/.local/share`.
- **Phase 1 — identity, nothing else changes (cli-core):** `client`, `via`, `mcp` in `RunAgent`/`RunMetadata`;
  `caller` run option; stdio client and connection id; HTTP client from `authInfo` with hashed id and the legacy
  session, no `context.env`; proxy `_meta` caller; native tools the same. Tests: `caller` beats the environment; an HTTP
  call from an environment with `CLAUDE_CODE_SESSION_ID` doesn't record it; proxy `_meta` reaches the child and is
  ignored from other clients; stdio records `clientInfo.name`.
- **Phase 2 — request fields and caps (cli-core, then each CLI):** `level`, `transport`, `attempt`, `waitMs`; the
  `requests` rule; per-run cap and `events_dropped`; ALS sink for `run()`; `providerRequest` parameters. CLIs in order
  of value: tg MTProto middleware, WhatsApp engine `request()`, zoom `ZoomRemote`, drive gaxios, then attempt/wait on
  transports that already emit. Masking of `ids` per NEED-110. Tests: per-transport shape against fakes (no body, no
  URL, no ids); tg flood wait gives two lines; 2,001 events give 2,000 lines plus `events.dropped`.
- **Phase 3 — record every run (cli-core):** flip `record` to true (`settings.ts:516`, `command-runs.ts:28`);
  `tool.ts:289` follows the config and `tool.ts:317` finishes successes; storage per NEED-108;
  `keep_successful_runs_for_days` 7; size limit; long-running commands; `record_input` per NEED-109; help text,
  `default-config.ts`, a changelog note naming the privacy change (`record: false` restores failures-only).
- **Phase 4 — Desktop:** `domain/runs.ts` facets `via`, `client`, `connection`, `trace_id` and a computed
  `conversation` key; Logs page "Group by conversation" (header: agent icon, client, start, runs, failed; runs under it
  in time order); `RunDetail.tsx` request lines (`→ messages.getHistory 118 ms 3 messages`, retries and waits marked);
  `KeepRuns.tsx` wording for the new default and success retention; Desktop calls per NEED-111; `report.rs` masks `ids`
  if events are ever attached. Tests in `runs.test.ts` and `LogsPage.test.tsx`.

| Risk | What could go wrong |
|---|---|
| RISK-33 | Message text on disk in every successful send for the retention window (2.3). |
| RISK-34 | HTTP MCP runs so far are credited to whichever agent started `mcp --http`; old records can't be fixed. |
| RISK-35 | Test fixtures already write thousands of runs into the owner's state directory; phase 0 must land first. |
| RISK-36 | Inode and disk growth at high call rates unless storage option B or C is chosen. |
| RISK-37 | A stdio server reads `CLAUDE_CODE_SESSION_ID` once; `/clear` or `--resume` without restarting MCP servers groups runs under the old session. Verify; the MCP connection key is the dependable one. |
| RISK-38 | The stateless HTTP path has no session id, so browser-app runs group only by client plus trace or time gaps. |
| RISK-39 | Wire events under operation events could double-count `requests`; old Desktop builds read `requests` as wire calls. |

## 6. Decisions

**NEED-107 · Record every run by default?**
- Now: failures only, unless `--record` or `record: true`; MCP-native tools never keep a success.
- Options: **A** every run, all callers · **B** every agent and MCP run, failures-only for what the owner types ·
  **C** as is, Desktop's switch decides.
- I'd pick: **A**, with the cap, 7-day success retention and the size limit.
- If no answer: A after phases 0 and 2 land.

**NEED-108 · How are successful runs stored?**
- Now: a directory per run, about 9–13 KB each.
- Options: **A** unchanged · **B** index line only for a success without events · **C** day-level events file.
- I'd pick: **C** — close to logical size, nothing changes for Desktop or `runs show`.
- If no answer: B, the smaller change.

**NEED-109 · Are typed words kept in successful runs?**
- Now: `record_input` on keeps typed words with secrets masked (the 0.439 ruling); successes were rarely kept then.
- Options: **A** the ruling as is, every run · **B** `record_input: "failed"` default · **C** masked everywhere.
- I'd pick: **B**.
- If no answer: A, the ruling stands.

**NEED-110 · Are chat and person ids kept in request events?**
- Now: recorded events carry `ids.chat` (tg and max adapters, the max wire layer).
- Options: **A** drop from recorded events, keep in `--trace` · **B** keep · **C** per-run salted hash.
- I'd pick: **A**.
- If no answer: A.

**NEED-111 · How are Desktop's own CLI calls recorded?**
- Options: **A** `--no-record` (failures still kept) · **B** `WIRECAT_CALLER=desktop`, `via: "desktop"`, failures
  only · **C** like any run.
- I'd pick: **B**.
- If no answer: B.

**NEED-112 · What identifies an HTTP MCP client in a run?**
- Now: nothing; only `activity.json` keys by the raw client id.
- Options: **A** `client_name` plus an 8-hex hash of the client id · **B** `client_name` only · **C** the raw id.
- I'd pick: **A**.
- If no answer: A.
