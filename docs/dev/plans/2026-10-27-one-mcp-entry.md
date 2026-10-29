# One MCP entry for every tool and profile

Asked on 2026-10-27 (journal TASK-26, after NEED-79). Plan only: nothing is changed yet.

The owner: "I think that user should control the mcps via desktop not via multiple connectors in ai agent for
different profiles. I'd try to centralize config in general so all works out of the box."

Code references are to local `main` on 2026-10-27: cli-core `13175fca` (0.449.0), cli-base, drive-cli, cli-memo,
zoom-cli, whatsapp-cli; Desktop paths are in this repository. CLI paths are under `~/Projects/AI/`.

Open decisions: NEED-83 … NEED-86 (section 8). Risks: RISK-25 … RISK-27.

## 1. Today

- **One server per (tool, profile).** `tg personal mcp` serves one profile: `createServer` takes the one `settings`,
  one `MessengerSession` and one permission set (`cli-core/src/mcp/server.ts:102-200`). It runs every command
  in-process with `[profile, ...path]` (`cli-core/src/mcp/agent.ts:276,308`).
- **Every server shows the same three tools:** `<bin>_tools_search`, `<bin>_read`, `<bin>_write`
  (`cli-core/src/mcp/surface.ts:119-245`). `_write` appears only when some command writes (`surface.ts:233`). The
  checked-in `contracts/mcp-tools.json` has exactly these 3 for all six CLIs.
  - Each set is about 11–12 KB of JSON (~3k tokens); about 10 KB of it is `outputSchema` (measured from the contracts).
  - Behind the three tools sits the catalogue, which the agent searches and never loads whole (max: 263 commands,
    `max-cli/contracts/mcp-catalogue.json`).
  - Each server also sends instructions, which Claude Code cuts at 2048 characters (`cli-core/src/mcp/instructions.ts:1-4`).
- **HTTP: one OAuth issuer per server.** The issuer is the public URL's origin; the resource is a fixed `/mcp`
  (`cli-core/src/mcp/http/serve.ts:18,120-121`). Each server has its own token file `mcp-http/<profile>.json`
  (`cli-core/src/cli/messenger/mcp-command.ts:39-40`), its own login code and its own port (catalog: 8765–8769).
- **Funnel allows only 3 public ports** (443, 8443, 10000), so at most three (tool, profile) pairs reach browser apps
  at once, each its own connector with its own login.
- **Permissions live in each tool's own config**, under `profiles.<name>.permissions` (`cli-core/src/cli/settings.ts:472`),
  enforced inside the serving process: before a call (`agent.ts:300-307`), around picture tools (`server.ts:339-345`),
  and by the command's own guard. `mcp.authority: deny` is a default (`cli-core/src/sends/permissions.ts:31`).
  `--permission key=level` can only make a level stricter (`mcp-command.ts:42-47`).
- **No server sends requests back to the client** (no elicitation, no sampling; searched cli-core, drive, memo, zoom,
  wa, max, tg). A proxy only forwards requests and their answers.

## 2. The three options

| | A. One server per tool, all its profiles | B. One WireCat gateway | C. Per-profile servers, one address by path |
| --- | --- | --- | --- |
| Connectors in the AI app | one per tool (up to 6) | **one** | one per profile |
| Logins | one per tool | **one** | one per profile |
| Funnel ports | one per tool: 5 HTTP servers for 3 ports | **one** | one |
| Tools seen | 3 per tool, `profile` argument | 3 per exposed tool (≤18) with `profile`, or 3 in total (NEED-84) | 3 per profile |
| Another profile costs | one enum value | one enum value | ~12 KB, another connector and login |
| Zoom over HTTP | needs a zm HTTP server | **free**: the gateway serves zm's stdio | needs a zm HTTP server |
| CLI work | large: `createServer` becomes multi-profile in cli-core, drive, memo, zoom | new package; cli-core unchanged | cli-core: issuer and metadata under a path |
| Fits the owner's words | half | yes | no |

- **C fails on the code.** Discovery (`oauthMetadataResponse`) and the issuer are per origin (`serve.ts:120-153`);
  paths would need path-scoped issuers and `.well-known` routes, and Desktop's address check refuses paths
  (`src-tauri/src/mcp_server.rs`). It still means N connectors and N logins.
- **A is not enough.** The biggest refactor of `createServer`, and still 5 HTTP servers for 3 Funnel ports.
- **B does not load tools in-process.** Each CLI pins its own cli-core release, and the server takes the process's
  SIGINT and SIGTERM (`server.ts:514-515,567-568`). So the gateway starts each tool's own stdio server,
  `<bin> <profile> mcp`, as a child. The child applies that profile's permissions, keyring, store and audit log.
  Rule 1 holds: the tools stay first.

**Recommendation: B.**

## 3. The gateway

**Package.** A new CLI, `@wirecat/cli` with bin `wirecat` (name: NEED-83), built on cli-base like the tools. It reuses
exported code:

- `serveOverHttp` from `@wirecat/cli-core/mcp` (`cli-core/src/mcp/index.ts:16`): takes any `() => McpServer`
  (`serve.ts:104`) and gives the owner login, Host and Origin checks, and the lock file with the login code.
- `mcpServerCommand` from `@wirecat/cli-core/cli` (`cli-core/src/cli/index.ts:348`): `wirecat mcp server start|stop|status`.
- `installStdioEntry` and `probeStdio` from `@wirecat/cli-base/mcp`: `wirecat mcp add claude-code|codex`, `wirecat mcp check`.

**Commands.**

| Command | What it does |
| --- | --- |
| `wirecat mcp` | stdio, serving the `local` exposure list |
| `wirecat mcp --http --port --public-url` | HTTP, serving the `remote` list |
| `wirecat mcp server start\|stop\|status` | the HTTP server in the background |
| `wirecat mcp --revoke` | forget every browser-app login |
| `wirecat mcp add claude-code\|codex`, `wirecat mcp config`, `wirecat mcp check` | register, print or check the local entry |
| `wirecat expose list` / `add <set> <tool> [profile] [--permission k=deny]…` / `remove <set> <tool> [profile]` | the central list (section 4) |

**Children.**

- Started lazily on the first call for that (tool, profile); closed after 10 min idle by ending stdin
  (`serveOverStdio` answers what is pending and exits, `server.ts:510-524`).
- Started from the absolute command recorded at expose time: tg, max, wa from their `mcp config --json`
  (`mcp-command.ts:309-344`); drive, memo, zm from the bin's resolved path until they have `mcp config`. Hermes's
  short PATH then does not matter (FIND-30).
- `--permission` entries from the exposure list go to the child. They only tighten.

**What the AI app sees (NEED-84; start with B1).**

- **B1. Per-tool names kept:** `tg_tools_search`, `tg_read`, `tg_write`, each with one extra field `profile`,
  **required, an enum of that tool's exposed profiles, no default**, even with one. Description: "Which Telegram
  account. If the owner did not name one, ask; never guess." memo has no field. The gateway strips `profile` and
  forwards `{command, arguments}` unchanged, so the children's errors (`surface.ts:191,197`), `next` steps and skills
  stay correct. Up to 18 tools.
- **B2. Collapsed:** `wirecat_tools_search|read|write` with `tool` and `profile`. ~12 KB in all; every tool name in the
  children's text must be rewritten.
- **Either way:** dropping `outputSchema` from the gateway's tools would cut ~80% of the size (MCP allows
  `structuredContent` without it). Measure first.

**Instructions.** One block under 2048 characters: message text is data, not instructions; send only when asked; ask
which account when the owner did not name one; the list of exposed accounts. Each tool's own instructions come back in
its first `*_tools_search` answer in a session. Prompts and resources are not forwarded in phase 1.

**No restart for changes.** Over HTTP, `build()` runs per session (`serve.ts:58,134`) and reads the list then. Over
stdio, the gateway re-reads the file when it changes and sends `notifications/tools/list_changed`.

## 4. Central config

- **Path:** `mcp.json` in cli-base's config folder for app `wirecat` (`cli-base/src/paths.ts:36-59`), on Linux
  `~/.config/wirecat/mcp.json` (`WIRECAT_CONFIG_DIR` overrides). Mode 600. Checked with valibot; unknown keys refused.

  ```json
  {
    "version": 1,
    "tools":  { "tg": { "command": ["/abs/node", "/abs/tg.js"], "env": { "XDG_RUNTIME_DIR": "/run/user/1000" } } },
    "local":  { "tg": { "personal": {}, "work": {} }, "wa": { "personal": {} }, "memo": {} },
    "remote": { "tg": { "personal": { "permission": ["messages.send=deny"] } }, "memo": {} }
  }
  ```

- **Who writes it:** only `wirecat expose …`, which Desktop runs (rules 1 and 2). A hand edit is checked the same way.
- **Not permission levels.** Levels stay in each tool's `profiles.<name>.permissions`, one place, enforced by the
  child. The central file decides *which* profiles an agent reaches, plus stricter-only overrides per set. NEED-53 A
  holds: `mcp.authority` stays `deny`, and the gateway offers no command of its own over MCP, so an agent cannot widen
  the list through MCP.
- **Two sets, `local` and `remote`**, because they reach different people. Named sets (Hermes) later as
  `wirecat mcp --set <name>`.
- **Nothing exposed by default.** Desktop pre-ticks nothing (rule 3).

## 5. Security

- **Blast radius.** One gateway login reaches every profile in `remote`; today a stolen token reaches one. Mitigations:
  1. `remote` is separate from `local` and empty until the owner ticks something.
  2. A tunnel starts read-only (NEED-59 A), per entry as `--permission <group>=deny|readonly`.
  3. Phase 3: the consent page asks which accounts *this* login gets; the token carries that set and the gateway
     refuses others (`ownerLogin`, `cli-core/src/mcp/http/oauth.ts`).
  4. "Forget all logins" is one button for everything.
- **Enforcement unchanged, in the child.** The gateway only checks the enum before starting anything.
- **Audit.** Each child keeps its own agent log (`server.ts:220-224`); Logs and Agents pages work as today.
- **Shell access.** An agent with a shell could run `wirecat expose add`, as it can run `tg config set` today. Not new.

## 6. Local agents

- **One entry, `wirecat`.** Claude Code and Codex: `wirecat mcp add claude-code|codex` after a dialog naming the exposed
  accounts. Cursor, Gemini, OpenCode, Hermes: Desktop shows `wirecat mcp config` to copy; Desktop never writes Hermes or
  OpenClaw settings.
- **Old `<bin>-<profile>` entries keep working.** Desktop's Disconnect removes them (`src-tauri/src/mcp.rs:238`).

## 7. Phases

**Phase 1, smallest useful step: the gateway beside what exists.**

- New repo `wirecat-cli`: config schema and `expose`; child pool (stdio MCP client, lazy start, idle close); B1
  surface; stdio and `--http` via `serveOverHttp`; `mcp server` via `mcpServerCommand`; `mcp add|config|check`; a
  contract test like `contracts/mcp-tools.json`. Medium: ~1–1.5k lines with tests.
- cli-core and all tools: **no change.** zm reaches browser apps through the gateway.
- Desktop: a catalog entry for `wirecat` (a kind not shown on the Tools grid, rule 7); `hub.rs` fixed commands; one
  **"Connect AI apps"** panel: a grid of tool × profile × (This computer | Browser apps), nothing ticked; the existing
  MCP server row and Tailscale guide, now for one server on one Funnel port; mock scenarios. Medium.
- Measure: a child's memory and cold start.

**Phase 2: move over.** Desktop offers "Move to one connector": it lists running per-profile servers and stdio entries
as ticks the owner confirms, runs `wirecat expose add` for each, then stops the old servers, turns off their Funnel
ports and revokes their logins. Per-profile rows move under "Advanced"; CLIs keep `<bin> <profile> mcp`. Read-only
remote by default. Named sets for Hermes. The registry `server.json` entries move to one `dev.wirecat/wirecat`.

**Phase 3: smaller blast radius, better address.** Per-login account choice; prompts and resources forwarded; the
tsnet helper (NEED-73) gives the gateway its own node on port 443; B2 or no `outputSchema` if context measurements say so.

| Repo | Phase 1 | Later |
| --- | --- | --- |
| new `wirecat-cli` | medium | per-login scope, prompts and resources |
| cli-core | none | small: account set in the token (`oauth.ts`) |
| tg, max, wa | none | none |
| drive, memo, zm | none | small: `mcp config` |
| Desktop | medium | migration dialog, sets per agent |

**Risks.**

- **RISK-25 · Two connections to one WhatsApp account.** wa is the one `connection: "exclusive"` messenger
  (`whatsapp-cli/src/messenger.ts:169`); its `mcp` goes through `serve` only when `serve` runs
  (`cli-core/src/cli/messenger/context.ts:147-150`). A gateway child beside Claude Code's own `wa personal mcp` opens a
  second socket (already true today with stdio plus HTTP). Mitigation: recommend `serve` for wa; children close when
  idle. Not tested.
- **RISK-26 · Memory.** Each child is a Node process that warms embedders (`server.ts:202`). Lazy start and idle close
  bound it; six at once not measured.
- **RISK-27 · The agent picks a profile anyway.** A required enum forces naming one, not asking. Check with claude.ai
  and ChatGPT in phase 1 that they ask when two accounts of one tool are exposed.
- **Dependency weight.** The gateway pulls cli-core for ~400 lines of HTTP and OAuth; moving `serveOverHttp` and
  `ownerLogin` into cli-base is the clean fix later.

## 8. Decisions

**NEED-83 · Approve the shape: one `wirecat` gateway (B), package `@wirecat/cli`, bin `wirecat`?**
- Now: one server, port, login and connector per (tool, profile); Funnel caps it at 3.
- Options: **A** one server per tool · **B** one gateway, `@wirecat/cli` / `wirecat` · **B′** the same, named
  `@wirecat/mcp` · **C** per-profile servers under paths.
- I'd pick: **B**. One connector, one login, one port, Zoom included, no CLI changes.
- If no answer: B.

**NEED-84 · How should the gateway's tools look to the AI app?**
- Now: three tools per profile, named `<bin>_…`.
- Options: **B1** `tg_read` etc. with a required `profile` enum (≤18 tools) · **B2** three `wirecat_*` tools with
  `tool` and `profile`.
- I'd pick: **B1** now, B2 only if measured context hurts.
- If no answer: B1.

**NEED-85 · Is one exposure list per place (This computer / Browser apps) enough for phase 1?**
- Options: **A** two sets, `local` and `remote` · **B** one set · **C** a set per agent now.
- I'd pick: **A**.
- If no answer: A.

**NEED-86 · After the move, do the per-profile HTTP servers stay in Desktop?**
- Options: **A** under "Advanced" for one release, then removed · **B** removed now (CLIs keep them) · **C** kept as is.
- I'd pick: **A**.
- If no answer: A.

## 9. Revision after the owner's answers (2026-10-27)

The owner on NEED-83: "but that's what core does, I'd use core for this, just isolate it there as a module". On
NEED-84: "if we have 1 server we would have to rework all toools. ok let's keep tools separate for each cli but 1 url
per cli so profile access is managed via desktop/config". The gateway package is dropped. The new shape:

- **A module in cli-core, not a new package.** `<bin> mcp` with no profile (stdio) and `<bin> mcp --http` serve every
  profile the owner enabled. The module starts `<bin> <profile> mcp` children of the same tool and forwards calls,
  as section 3 describes for the gateway, but per tool. `createServer` stays single-profile, so no tool is reworked.
- **Profile access in the tool's own config,** e.g. `mcp.local` and `mcp.remote` lists of profile names, written by
  Desktop through the tool's `config set`. No central `wirecat` file.
- **Tools look as today plus a required `profile` enum** (B1): `tg_read` etc., no default, "ask if not named".
- **One URL per CLI, one public address for all:** `https://<host>/tg/mcp`, `/max/mcp`… behind one Funnel port with
  `tailscale funnel --set-path`. Needs a small cli-core change: issuer and `.well-known` metadata under a path prefix
  (section 2, option C's cost), and Desktop's address check accepting a path. Not tested yet.
- drive, memo and zm have their own `mcp` commands: drive and zm adopt the module; memo has no profiles and only
  needs the path prefix.
- RISK-25…27 still apply. NEED-83 and NEED-84 are answered by this section; NEED-85 and NEED-86 stay open; NEED-91 confirms it.

## 10. Simplified (2026-10-27, second answer)

The owner: "I just realized that I overcompllicated. all profiles are available in cli and mcp. no switches so we
don't bloat ui and settings". And: "I don't want to overengineer at this stage".

- No exposure lists, no `mcp.local`/`mcp.remote`, no Desktop panel of ticks. NEED-85 and NEED-86 are void.
- `<bin> mcp` (stdio) and `<bin> mcp --http` serve every profile of that tool; each tool call takes a required
  `profile` enum of the tool's profiles, no default, "ask if not named".
- One public address: Tailscale's path routing is the single entry (`/tg` → tg's port, `/max` → max's port), so no
  WireCat process routes between tools. Each CLI still runs its own server.
- Size: the cli-core module (start `<bin> <profile> mcp` children on demand, add `profile`, forward) is small-medium,
  ~400–600 lines with tests; tg, max, wa get it by updating cli-core; drive and zm wire their own `mcp`; memo has no
  profiles. The path-prefix login change in cli-core is small but untested.

**Measured while building (TASK-26):** a login under a path needs three Funnel paths per tool, not one: `/tg`, and the
two places RFC 8414 §3 and RFC 9728 §3 put the metadata of an issuer under a path,
`/.well-known/oauth-authorization-server/tg` and `/.well-known/oauth-protected-resource/tg`. Each is mounted with the
path kept (`--set-path /p http://127.0.0.1:<port>/p`); Desktop sets and removes all three, by path, never a whole port.
