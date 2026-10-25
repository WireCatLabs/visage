# OpenClaw and Hermes as agents, and publishing the connectors

Status: **draft for the owner's review** (journal TASK-8). Nothing here is built yet.

A *connector* here is what one WireCat tool gives an agent: its skill (SKILL.md) and its MCP server
(`<bin> <profile> mcp`; memo has no profile: `memo mcp`).

## What the research found

The full notes, with a source for every claim, were written by three research agents. They are not in the repository;
the parts that matter are below.

| | Hermes Agent (Nous Research) | OpenClaw |
| --- | --- | --- |
| Found by | `hermes` on PATH, or `~/.hermes` (`HERMES_HOME`) | `openclaw` on PATH, or `~/.openclaw` |
| Reads skills from | `~/.hermes/skills`, plus folders listed in `skills.external_dirs` in `config.yaml` (empty by default). Never `~/.agents/skills` or `~/.claude/skills` on its own | `~/.agents/skills` already, so `skill install --for agents` reaches it today |
| MCP servers kept in | `~/.hermes/config.yaml`, key `mcp_servers.<name>` (`command`, `args`, `env`, `enabled`) | `~/.openclaw/openclaw.json` (JSON5), key `mcp.servers.<name>` |
| Add a server | `hermes mcp add` asks questions and starts the server; no `--yes`. Writing the YAML is the dependable way | `openclaw mcp add <name> --command … --arg …` (`--no-probe` to not start it). **Refused while OpenClaw's background service runs**, which is almost always |
| List without starting servers | read the YAML keys (`hermes mcp list` prints a table only) | `openclaw mcp list --json` (shape not yet seen) |
| Marks its commands with | `AI_AGENT=hermes-agent`, `HERMES_AGENT=true`, `HERMES_SESSION_ID` (local terminal) | `OPENCLAW_SHELL=exec`; from a chat also `OPENCLAW_CHANNEL_CONTEXT`; no session id found |
| MCP server environment | only PATH, HOME, locale and the entry's own `env` | the service's own plus the entry's `env` |
| Skill registry | installs from GitHub, a URL, skills.sh, ClawHub, or `/.well-known/skills/index.json` | ClawHub (`clawhub skill publish`), automatic security scans, every skill MIT-0 |

Where to publish, ranked by reach for the effort:

1. **The official MCP Registry** (registry.modelcontextprotocol.io). Add `mcpName` to each `package.json` and a
   `server.json`, and run `mcp-publisher` in release CI. It can declare a required profile argument with no default.
   PulseMCP and probably Glama read from it. GitHub's registry (and so VS Code's gallery) takes an email nomination.
2. **Our own Claude Code plugin marketplace**: a `WireCatLabs/claude-plugins` repo with one plugin per tool (skill
   plus MCP server, profile asked at enable). No review, so it is live the day it is pushed.
3. **skills.sh**: `npx skills add WireCatLabs/<repo>` already works. **Hermes**: a `wirecat.dev/.well-known/skills/index.json`
   the docs build generates. **ClawHub**: `clawhub skill publish` from CI with a token.
4. Later: Anthropic's directory (inside a plugin, a paid claude.ai plan, six reviews, and local servers never run in
   claude.ai chat), Cursor's marketplace.
5. Not a fit: `.mcpb` desktop bundles (no longer accepted, ~500 MB per OS), Docker's catalog (container, away from
   the sign-in and store), Codex's directory (remote servers only), mcp.so (paid to skip review).

## The work, cut for subagents

Wave 1 runs three agents in parallel, each in its own worktree. Wave 2 waits for NEED-29 and NEED-30.

### W1 · cli-base and cli-core: the two agents as clients (one agent)

- **cli-base `mcp/index.ts`.** `McpClient` gains `hermes` and `openclaw`. Hermes is added and removed by editing
  `mcp_servers` in `$HERMES_HOME/config.yaml` with a YAML library that keeps comments (`yaml`'s Document API), never
  by `hermes mcp add`. OpenClaw goes through `openclaw mcp add … --no-probe` and `openclaw mcp unset`. When the
  service refuses, it fails with a clear error: stop the service and run it again, or add it in OpenClaw's own
  settings. It never stops the service itself. Every entry gets `AI_AGENT=<kind>` in its `env`, so MCP runs are
  attributed. The command is the absolute path of the installed binary, because Hermes runs commands from a
  `bash -l` snapshot and OpenClaw from its service's PATH.
- **cli-base `skill/index.ts`.** A new target `hermes` (choice NEED-31).
- **cli-core `cli/author.ts` and `runs/run-context.ts`** (the run-context PR #1963). `OPENCLAW_SHELL` means
  `openclaw`. `HERMES_SESSION_ID` becomes the session, like Claude Code's. A chat-started OpenClaw run records that it
  came from a chat, but not the sender ids.
- Done when each repo's own check passes, plus a test for each client against a temporary home folder.

### W2 · wirecat-desktop: detection, connection and activation (one agent, mocks until W1 ships)

- **Detection and links.** Hermes and OpenClaw rows in `src-tauri/src/skills.rs` (`AGENTS`). Their MCP lists in
  `src-tauri/src/mcp.rs`: Hermes reads `mcp_servers` keys from YAML (a small YAML crate, only the key names leave),
  and OpenClaw runs `openclaw mcp list --json`. Their markers go into `AGENT_ENV` in `src-tauri/src/run.rs`, and
  their kinds (`hermes-agent`, `openclaw`) into `AGENT_KIND` in `src/domain/agents.ts`. Icons are added too.
- **Activation.** One "Connect WireCat to <agent>" flow per agent on the Agents page:
  1. Choose tools and, for each, the profile. Nothing is preselected.
  2. The app installs the skill and adds the MCP server, using only the tools' own commands.
  3. It runs the check and shows each step's result.
  4. "Disconnect" removes both again.
  For OpenClaw, if its service holds the lock, the step says so and offers "Try again".
- **Chat-driven agents.** Hermes's gateway and OpenClaw's chat channels let anyone that bot accepts drive the tools.
  When the agent has one set up, connecting shows a warning and the profile's permission choice (NEED-32).
- Done when `pnpm check` passes and the capture script shows the flow in light and dark.

### W3 · cli-docs: the pages (one agent)

- `content/docs/agents.mdx` (and `.es`, `.ru`): a section each for Hermes and OpenClaw, covering:
  - skill and MCP setup
  - the OpenClaw service lock
  - the Hermes `bash -l` PATH note
  - the chat-driven warning
- A "Connectors" page: one table of every tool × agent, the commands, and where each is published (filled in W5).
- The build generates `/.well-known/skills/index.json` from each tool's published SKILL.md.

### Wave 2 — publishing (after NEED-29 and NEED-30)

- **W4 · the registry from release CI.** Each tool repo gets `mcpName` and a `server.json`. A shared workflow in
  `WireCatLabs/.github` runs after `npm publish`: it writes the version into `server.json`, then logs in and runs
  `mcp-publisher publish`. Plus a `glama.json` in each repo to claim the Glama listing.
- **W5 · the marketplace and ClawHub.** A new `WireCatLabs/claude-plugins` repo with plugins `wirecat-tg` …
  `wirecat-memo`, checked with `claude plugin validate --strict` in CI. The SKILL.md files gain
  `metadata.openclaw.requires.bins` and an `install` entry, and CI publishes them to ClawHub with a token.
- **W6 · the desktop shows where each connector is published.** "Also in: Claude Code marketplace, MCP Registry",
  with links, on each tool's agent row. This can wait.

### What the owner does by hand, once

- Choose the namespace (NEED-29). For `dev.wirecat` this means one DNS TXT record at Hetzner DNS, and a key stored as
  an org secret by a `bin/` script; the key never passes through the chat.
- The GitHub registry nomination email to partnerships@github.com. A draft will be ready; sending it is the owner's.
- A ClawHub account (GitHub sign-in) and its token as an org secret.

## Risks

- **RISK-6 · npx and the global install are two copies.** Most catalogs start a server with `npx`, but the sign-in
  and the store belong to the global install. `mcp add` already refuses to run from npx's cache. A listing that says
  `npx @wirecat/tg` would run a second copy at a different version. See NEED-30.
- **RISK-7 · ClawHub's trust problem.** In February 2026, 341 of 2,857 ClawHub skills were found to be malware. Every
  install step and variable must be declared, or the scan hides the skill. Owners will read our install steps closely.

## Decisions (journal NEED-29 … NEED-33)

- NEED-29: namespace `dev.wirecat/*` or `io.github.wirecatlabs/*`
- NEED-30: launch command in listings, the bare program or a pinned `npx`
- NEED-31: how Hermes gets the skills — **answered A, with B as fallback**: add `~/.agents/skills` to `skills.external_dirs`; if that edit fails, copy the skill into `~/.hermes/skills/<app>`
- NEED-32: what connecting a chat-driven agent does to permissions — **answered A**: warn and offer read-only, the owner chooses
- NEED-33: whether to submit to Anthropic's directory now
