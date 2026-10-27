# Architecture

WireCat Desktop is a thin window onto the WireCat CLIs. The interface is React in the system webview; Rust inspects
the machine and runs the tools. Nothing here duplicates what a CLI already does.

## The layers

```text
src/
  app/          shell: window frame, sidebar, sections, theme. May import everything below.
  features/     one folder per area (tools/, agents/, system/, logs/, config/, storage/, onboarding/, report/, signin/).
  ui/           presentational parts: Button, Lamp, Stepper… Props in, events out.
  platform/     the only door to Rust. Validates every answer with valibot. Has a browser mock.
  domain/       plain TypeScript: catalog, tool status, doctor summaries. No React, no Tauri.
catalog/
  tools.json    the tool list, read by both TypeScript and Rust.
src-tauri/src/
  lib.rs        Tauri commands: the whole native surface, one function each.
  catalog.rs    the same tools.json, compiled in; profile validation.
  system.rs     OS, Node.js, npm, npm's global folder and whether it is writable.
  tools.rs      finding executables, versions, profiles, doctor runs.
  install.rs    install, update and uninstall with progress events, verification, failure reasons.
  runs.rs       run logs, read through each tool's own `runs list` / `runs show`.
  settings.rs   tool settings: `config show`, and saving only through `config set` / `config unset`.
  storage.rs    each tool's data folders, their sizes and entries (names only); deleting them once unused.
  archive.rs    what the shared archive holds, from a tool's `store info`; the database is never opened.
  backup.rs     backing the shared store up into a zip, and clearing it, through the tool's own `store backup` / `store reset`.
  compat.rs     every installed tool's own `store info`, at once: which schema each reads and what its next run does.
  skills.rs     agents found on this computer; each tool's skill through its own `skill status` / `install` / `show`.
  chats.rs      which chat apps drive Hermes and OpenClaw, by name only; the PATH Hermes's gateway starts from.
  mcp.rs        which WireCat MCP servers each agent has registered; adding through the tool's own `mcp add`.
  mcp_server.rs each tool's HTTP MCP server for browser apps: its own `mcp server start|stop|status` and `mcp --revoke`.
  tailscale.rs  Tailscale Funnel for an MCP server: its state, `tailscale login`, and Funnel on and off for ports the app set up.
  tailscale_install.rs Tailscale's official installer or package, downloaded into Downloads and handed to the system.
  tailscale_linux.rs Tailscale's install commands for this Linux, from /etc/os-release and lists of known releases.
  tasks.rs      task claims through the tool's own `tasks list` / `tasks release`, ids and holders only.
  paths.rs      the PATH a terminal would have; finding every copy of a binary.
  run.rs        running a process with a timeout; streaming lines; killing a whole process tree.
  redact.rs     masking tokens, numbers, addresses and names in tool output.
  terminal.rs   opening a tool's interactive setup in the user's terminal.
  signin.rs     signing in inside the window: the tool's own `session start`, its stdin open for the answers.
  signin_steps.rs the tool's sign-in lines read into steps: QR code, pairing code, page to open, question, progress.
  report.rs     bug reports: what this computer adds, masked, and sending to the WireCat API (docs/dev/report-api.md).
```

Biome enforces the arrows (`biome.json`, `noRestrictedImports`): `domain` imports nothing above it, `platform`
knows no UI, `ui` knows no data, and only `platform` imports `@tauri-apps/*`.

## How an install travels

1. `ToolRow` calls `useTools().install("drive")` (`src/features/tools/store.ts`). Installs queue; one runs at a time,
   because two global npm installs at once can corrupt each other.
2. `platform.install` opens a Tauri `Channel` and invokes `install_tool` with the tool **id** only.
3. Rust looks the id up in the compiled catalog, checks Node.js and that npm's global folder is writable, then
   runs `npm install --global <package>@latest` — or `pnpm add --global` when pnpm owns the copy that is already
   installed, so an update never leaves a second copy behind.
4. Each output line is masked and sent as a `log` event; steps arrive as `step` events.
5. Verification re-resolves PATH (npm's bin folder may be new), finds the binary and runs `--version`. If an older
   copy still comes first on PATH, the result says which.
6. Every event is parsed by `InstallEventSchema` before the store sees it.

## Finding tools

An app started from a desktop launcher does not get the PATH a terminal has: nvm, pnpm and Volta add theirs in
shell profiles. `paths.rs` merges the process PATH, the login shell's PATH (`$SHELL -lic`) and known folders
(nvm versions newest first, pnpm, Volta, Homebrew, `%APPDATA%\npm`). Every copy of a binary is reported in PATH order;
the first is the one a terminal runs. Versions come from running the binary, never from `npm ls`, because a tool may
be installed by npm, pnpm or both.

## Uninstalling and storage

Uninstall removes **every** copy of a tool, each with the manager that installed it (`npm uninstall -g` with the npm
beside an nvm copy, `pnpm remove -g`, `bun remove -g`, `volta uninstall`), then checks that the binary is gone. It
never touches data.

Data folders are not guessed from names: `storage.rs` mirrors cli-base's `resolvePaths` (`src/paths.ts` in
cli-base): `<PREFIX>_{CONFIG,STATE,CACHE}_DIR` first, then the XDG layout on Linux and macOS, `%APPDATA%` and
`%LOCALAPPDATA%` on Windows. The catalog records each tool's folder name and prefix (`storage`), plus the archive
every tool shares (`sharedStorage`: `WireCat`, `WIRECAT`). Keep `storage.rs` in step if cli-base changes.

Deleting is refused while a tool that uses the data is installed: a tool's own folders until it is uninstalled,
the shared archive until no tool is installed (emptying it while tools are installed goes through the tool's own
`store reset`, see "Backups and clearing storage"). Before `remove_dir_all`, each path must be absolute, at least four
components deep, not the home folder, and named for the tool. A store moved with `MESSAGING_STORE` and sign-in
tokens in the system keyring are never touched. After the last tool is uninstalled the app offers, once, to delete
everything that is left.

## Skills and the archive

Each tool writes its skill (`SKILL.md`) to `~/.claude/skills` and `~/.agents/skills` with its own
`skill install --for claude|agents`; the catalog's `skill` templates hold those commands, `skill status` and
`skill show`. The app never reads a `SKILL.md` file itself. A tool from before `skill status` answers "unknown command" and its cells show "unknown";
memo falls back to the skill list in `doctor --json`. Agents are found by program on PATH or by their settings
folder (`skills.rs`); which folder each agent reads comes from the agents' own docs.

Shared storage is described by `store info --json` (`storeInfo` in the catalog). `compat.rs` asks every installed
package at once, read-only, and the answer of the tool that reads the newest schema fills the Storage page; tables and
checks go to the first messenger in that ranking. A tool from before cli-core's shared `store info` (zm, drive, memo
before their release with WireCatLabs/cli-core#1973) answers "unknown command". `archive.rs` picks known fields by name,
because the generic masker would hide counts called `accounts` or `emails`. The breakdown is read only when the tool
prints `by_provider`, and the file facts (journal mode, pages, migrations, last backup) only when it prints
`migrations`. The same tool answers `storeTables` (every table with its kind and rows), `storeTableSizes` (the same with
sizes; it reads the whole file, so the page runs it on request) and `storeCheck` (the health check, also on request:
about 90 s on a 3 GB file). A tool that answers "unknown command" gets "arrives with the next update". Of a check only
counts leave Rust, never the chats it finds behind. The interface calls the shared database "storage" everywhere, never
"archive". Folder entries on the Storage page are names and sizes from `storage.rs`; what each one is lives in
`src/domain/files.ts`. `open_folder` opens a folder or one entry in it by name: Rust joins the name to the catalog's
folder after refusing anything but a plain child, opens a directory, and shows a file or a link in its folder instead of
opening it.

## Can each tool read storage

The store records a schema version and the oldest schema a tool must read to open it (`min_compatible`); each tool
reads up to the schema of its cli-core (`speaks`). `src/domain/compat.ts` turns the tools' answers into one state per
installed package: reads it, can't read it (and the update that fixes it), will move it on its next run past what other
installed tools read (from `schema.upgrade`), or can't say. A tool too old to say is placed from the store's own list of
the tools that opened it (`clients`, matched by command and version) or from a refusal it printed ("written by a newer
version (schema N, needs at least M"). The schema moves on a tool's first run after an update, not on install, so
the Tools page asks again right after an install and warns, with the other tools' updates to queue, before that run.

## Backups and clearing storage

**Back up now** runs `store backup <file>` (`storeBackup` in the catalog) of the tool `archive.rs` asks, the installed
one that reads the newest schema, never with a profile. The copy goes to a hidden `.<name>.db.partial` in
`~/WireCat backups`, is deflated into one `wirecat.db` entry of `wirecat-store-YYYY-MM-DD-HHMM.zip` (local time, `-2`
for a second in the same minute, mode 600 in a 700 folder), and is removed whatever happens. The home folder, not
Documents: macOS and Windows often sync Documents to a cloud drive, and the zip is every message, unencrypted. Before
it starts, the folder's disk needs one and a half times the store free. `VACUUM INTO` prints nothing, so copying
progress is the copy's size against the store's; compressing reports each percent. Cancel kills the tool's process
group and removes both partial files. Events travel on a `Channel` (`BackupEvent`).

**Clear storage** runs `store reset --no-backup --yes` (`storeReset`). The button stays off until the tool
answers `store reset --dry-run` with its `tables`; an older tool asks for a profile there, or does not know the option.
The dialog lists the store's files and every table with its rows from that preview, says what stays, warns when the
preview says a sync holds the file, and needs the word `clear` typed. "Back up first" is on by default and runs the
backup above; nothing is cleared unless the zip is finished. The CLI itself refuses while another process has the
store open, so a running sync or import is never cut off. Only one backup or clear runs at a time (`Running`).

## What agents do with the tools

The Agents page has one row per agent found. Each opens to what to fix, the tools (skill and MCP per profile), the
agent's recent sessions and the tasks it holds.

- **MCP.** The messenger CLIs register a profile's server as `<bin>-<profile>` with their own
  `<bin> <profile> mcp add codex|claude-code` (cli-core), after the owner confirms; `mcp check` runs first so the
  dialog says how many of the server's commands can write, and `--allow-writes` is passed only then. No tool removes
  its server yet, so Disconnect runs the agent's own `claude mcp remove <name> --scope user` or `codex mcp remove
  <name>`, for a name `mcp.rs` builds from the catalog and a validated profile. What is registered is read from
  `codex mcp list --json`, and from the agents' settings files where no command lists without starting every server:
  `~/.claude.json` (`mcpServers`, user scope), `~/.cursor/mcp.json`, `~/.gemini/settings.json`,
  `~/.config/opencode/opencode.json` (`mcp`). Only names that look like a WireCat server leave Rust; commands,
  environment and headers never do. zm, drive and memo serve MCP but cannot register themselves yet. Not read yet: a
  Claude Code home moved with `CLAUDE_CONFIG_DIR`, OpenCode's `opencode.jsonc` (JSON with comments) and project-level
  servers. `run::command` drops the agents' own variables (`CLAUDECODE`, `CODEX_THREAD_ID`…), so the tools never
  record the app's calls as an agent session even when the app was started from an agent's terminal.
- **Sessions** come from the runs the Logs page already read: runs grouped by `agent.kind` and `agent.session_id`
  (`src/domain/agents.ts`). A run with `argv` and no agent was started by a person; one without either comes from a
  tool too old to record it.
- **Tasks.** `tasks list --json=id,key,claimed_by,claimed_until` for every profile of tg, max and wa, so no title reaches
  the app; the holder (`claude-code:<session>`, `codex:<thread>`, an agent's name) is matched to its agent.
  Release runs `tasks release <task> --holder owner`, because the app may itself run inside an agent's terminal.
- **Check** joins these with `paths::in_terminal` (is the tool on the PATH a terminal has, without the folders the
  app adds), runs `mcp check` for every connected profile and counts the commands each profile's permissions block
  (the Permissions block's `permissions_show`).
- **Skill preview** shows `skill show --json`, the SKILL.md the installed version ships, beside the installed copies'
  versions. The app does not read an installed SKILL.md, so what an update changes waits for a CLI that prints it.

- **Hermes and OpenClaw** (plan `docs/dev/plans/2026-10-25-agents-openclaw-hermes.md`). Found by program, or by
  their settings file (`~/.hermes/config.yaml` or `$HERMES_HOME`, `~/.openclaw/openclaw.json` or
  `$OPENCLAW_STATE_DIR`); a bare `skills` folder is left by other installers and does not count. OpenClaw reads
  `~/.agents/skills`. Hermes is its own target, `hermes`, which only a tool whose `skill status` lists it can write
  (cli-base's `--for hermes`); until then its cells say "needs a newer" tool and offer nothing. The app never writes
  either agent's settings. Their PATH is not a terminal's: Hermes runs commands in `bash -l` started from its gateway's
  PATH (read from its systemd unit, else the system PATH), and OpenClaw from its gateway's, fixed with
  `tools.exec.pathPrepend`; the check shows the shell-profile line or OpenClaw's own `config set` to copy, never runs it.
  `chats.rs` reads which chat apps drive them, by name only: Hermes's `gateway_state.json`, OpenClaw's
  `channels list --json`. **Connect** (any found agent) installs the chosen tools' skills, then for a chat-driven agent
  sets the profiles the owner ticks to read only (`config set permissions.<group> readonly` for each catalog group,
  then the tool's own count of what still writes), then checks that agent's PATH. Nothing is preselected; MCP is not
  part of it. No tool removes its skill yet, so **Disconnect** lists the folders to delete and who else reads them.

Every write on the page (skill install, MCP add or remove, task release) opens a dialog with the exact command.

## One package, several tools

Email is a row of its own over memo's package (`partOf: "memo"` in the catalog): the same `bin`, `package` and
`storage`. Install, update, uninstall and cancel act on the owner's id in Rust (`catalog::owner`) and in the
interface (`ownerId`), so the package is installed once and the install queue never runs it twice. Detection and
update checks run once per package and report it for every part. Storage, bug reports and the Node.js removal check
count packages, not rows. A part has no skill of its own (`skill: null`) and stays out of the skills matrix. With
no interactive `setup` in the CLI, its `signIn.command` is shown to copy and never run. The owner's run logs are read once;
runs whose command starts with the part's `commandPrefix` (memo's `mail …`) are filed under Email on the Logs page.

## Profiles and diagnostics

The CLIs differ: `tg`, `max`, `wa` list profiles with `account list --json`, `drive` with `session list --json`,
`zm` in `doctor --json`, and `memo` has none; Email lists memo's mail accounts from `item.mail.accounts` of
`memo doctor --json`, by name only. The catalog records each tool's command and the JSON shape to read.
Doctor output is masked in Rust and summarised in `src/domain/doctor.ts`; the raw (masked) JSON stays one click away.

## Signing in inside the window

Each tool with `signIn.methods` in the catalog signs in without a terminal (step 2 of
`docs/dev/plans/2026-10-26-mcp-full-commands.md`): tg (QR or phone), max (QR), wa (QR), zm and drive (the browser).
"Sign in here" opens a dialog, and `sign_in(id, method, profile)` runs that method's words for the profile the owner
named. With `--json` the tool prints each step as a JSON line on stderr, from cli-core's `signInSteps` (0.443) and
`loginQr`: `qr`, `pairing_code`, `open_url`, `needs` and `progress`. `signin_steps.rs` reads them, the tool's notes and
its stdout answer into steps on a `Channel`; `signin.rs` runs the tool with its stdin kept open
(`run::stream_stoppable`). A `needs` step draws a field, masked when `secret`; the answer goes through
`sign_in_answer(id, value)`, which writes it and a newline to that run's stdin and wipes it (`zeroize`). Only with
`--answer-stdin` does a tool read answers; without it a tool with no terminal refuses, so an agent's shell never waits.
A tool too old for the flag answers "unknown option", which becomes "update it on the Tools page"; "Open terminal" stays
the second choice.

What never leaves the window: a QR code, a pairing code and a sign-in link are login tokens while valid, so they travel
on the Channel only, and the plain copies the tool prints beside them (the code's drawing, the link's line, the agents'
note) are dropped. The account's id and name stay in Rust (max's "logged in as" line is dropped too). No step is logged
or put in a report, and an answer is never kept in the store or repeated in an error. The QR comes as a half-block
drawing, so `src/domain/qr.ts` turns it back into modules and the dialog draws an SVG, dark on white in both themes.
Zoom without its own app's Public Client ID fails, and the dialog asks for it and saves it with zm's own `config set`
before starting again. Cancel, Escape and Stop call `sign_in_stop`: SIGTERM to the tool alone, five seconds for it to
answer with what it kept (WhatsApp's history), then the whole group is killed. Switching method (tg's QR or phone)
stops the running sign-in first.

## The MCP server for browser apps

ChatGPT and Claude in the browser reach a tool through its HTTP MCP server behind the owner's tunnel (step 3 of
`docs/dev/plans/2026-10-26-mcp-full-commands.md`). The Manage panel has a "Connect an AI app" section, closed by
default because agents on this computer use the tools directly. One server serves every profile; the app names one in
each call. Zoom serves no HTTP MCP and Email is part of memo, so neither has the section.

**The guide** (`ConnectGuide.tsx`) aims at a working call from the app, not at a running server. Five steps in a rail,
on one surface that only Finish closes: choose the app (ChatGPT, Claude, another), the public address (Tailscale's own
steps, done ones as ticks, or a tunnel the owner runs), start the server (Funnel, then `mcp server start`, with each
part's progress; nothing runs before the owner presses Start the server), add it in the app, and test it. The step logic
is plain TypeScript (`connect-steps.ts`); what to click in each app is one table, `connect-apps.ts`, with the vendors'
pages it was read from, and takes the address and login code from `status`, so a different address shape changes no
instruction. The test reads `status` every 4 s while it is on screen: an app counts once it logs in, or reaches the
server, after the guide opened (an older login does not), and the guide ends at the first `tools/call`. From cli-core
0.453 `status` reports per app `last_request_at`, `last_tool`, `last_tool_at` and `tool_calls_today` (the tool keeps
names and times only); an older tool reports none, and the guide says to check the answer in the app. The step's
heading takes focus when the step changes; steps fade in (`.step-in`), instantly under reduced motion. "If ChatGPT
says it couldn't discover OAuth settings" shows the issuer and endpoints that `mcp_server_oauth` reads from the running
server on 127.0.0.1 (a computer often cannot reach its own Funnel address), keeping only addresses on the connector's
own origin. After setup the section lists the apps with their last call, and the tool's row on the Tools page shows the
latest one, read when the row appears and when its panel closes. "Server details" keeps the row described below.

Every action is the tool's own command from `mcpServer` in the catalog. `mcp server start` takes the tunnel's address
and a port, which `mcp_server.rs` checks first (https, or http on this computer; no path; a port of 1024 or above) and
only then puts in place of `{url}` and `{port}`. The tool runs `mcp --http` in the background with a marker in its
environment, and `stop` refuses a server it did not start (one started in a terminal: the row says to stop it there).
`status` gives the port, the address for the browser app, the login code with when it runs out (the row reads it again
then; the tool renews it), and the apps holding a login, each by the name it gave itself: the row says "calls itself",
since anyone may register any name, and Rust drops control and bidirectional characters from it. "Forget all logins"
runs `mcp --revoke` after a dialog. "Copy config for desktop apps" copies `mcp config` (tg, max, wa).

The login code, the address and the apps' names leave Rust unmasked, an exception to rule 4 like the sign-in QR: the
owner needs them as they are. They are never logged and never put in a report. A tool from before `mcp server`
(cli-core 0.445; memo and drive need their own release with it) answers "unknown command" or "too many arguments";
`status` then reports it unavailable, and the row says it arrives with the next update, with nothing to press.

## Tailscale Funnel for the MCP server

The guide's address step offers Tailscale Funnel, set up by the app, or a tunnel the owner runs (step 4 of
`docs/dev/plans/2026-10-26-mcp-full-commands.md`). Tailscale's part has three steps, each with Check (the fourth below,
a free public port, is checked there and done by the start step); the window re-checks when
it regains focus. All of it is `tailscale.rs` running the `tailscale` CLI found on PATH (or inside the Mac app with
`TAILSCALE_BE_CLI=1`, or in Program Files):

1. **Install.** macOS and Windows: `tailscale_install.rs` follows `Tailscale-latest-macos.pkg` or
   `tailscale-setup-latest.exe` on pkgs.tailscale.com to the versioned file, checks its `.sha256`, saves it in
   Downloads and opens it; the system's installer asks for the password. Linux (Debian and Fedora families): the newest
   package from Tailscale's apt `Packages` or yum `primary.xml`, checked against the checksum there, shown selected in
   the file manager (the opener plugin's `reveal_item_in_dir`, D-Bus `FileManager1.ShowItems`). The second option, or
   the only one where there is no package (openSUSE, Arch), is Tailscale's own commands for this release:
   `tailscale_linux.rs` reads `ID`, `VERSION_ID` and the codename from `/etc/os-release` and builds the lines of
   pkgs.tailscale.com/stable/#linux (Fedora 41+ in the dnf 5 form of Tailscale's `installer.sh`) only from releases on
   its lists, so os-release text never reaches the terminal. They add Tailscale's package source, so system updates
   keep it current; when Tailscale is installed and that source file is missing, the done step offers the commands.
   Where the lines start with `curl` (apt, `install.sh`) and `curl` is not on PATH, the first line installs it with the
   apt-get, dnf or zypper found on PATH.
   NixOS gets its configuration line; any other system gets `install.sh` and links. Every step links its section of
   wirecat.dev/en/docs/desktop/tailscale-funnel. On Linux the step also needs this user as
   Tailscale's operator (`tailscale debug prefs`, a hint only; a refused write says the same).
2. **Log in.** `tailscale login`, only while `BackendState` is `NeedsLogin`; the page it prints is opened when its host
   is login.tailscale.com or console.tailscale.com. The step polls until the state is `Running`.
3. **Allow Funnel.** The node's `CapMap` has `https` and `funnel`; otherwise the guide opens the admin console's DNS or
   Access controls page.
4. **Connect.** `tailscale funnel --bg --https=<public> http://127.0.0.1:<port>`, then `mcp server start` with the
   public address. The public port is one of the tailnet's Funnel ports (`funnel-ports` in `CapMap`; 443, 8443, 10000)
   that nothing in `funnel status --json` uses, the same as last time when free, so the address and the browser apps'
   logins survive. No `--yes`: a question about the owner's own settings fails instead of overwriting them.

What the app turned on is recorded in `<app local data>/dev.wirecat.desktop/tailscale-funnels.json`. Stop, and a server
that fails to start, turn off only that port (`tailscale funnel --https=<public> off`), and only while it still points
at the recorded local port; never `funnel reset`. The row says when a Funnel is still on with the server off.

The computer's Tailscale name, the Unix user name (for the operator line, shown to copy only: a terminal would run its
`sudo` at once) and the login and approval links leave Rust unmasked, an exception to rule 4 like the MCP login code;
they are never logged or put in a report. The raw `tailscale status` never leaves Rust.

## Growing the app

A new area (accounts, memory, people…) is one entry in `src/app/sections.tsx` and one folder in `src/features/`.
The app's own Node.js (`node.rs`) is the nodejs.org LTS build, checked against `SHASUMS256.txt` and unpacked into
`<app local data>/dev.wirecat.desktop/node/v<version>`, outside the shared archive that Storage may delete.
`paths.rs` puts its `bin` first only when the user's own Node or npm cannot install tools, so `system.rs` and
`install.rs` pick it up by path and no caller changes. `profile.rs` owns the marked PATH block in shell profiles
and the user PATH in the Windows registry.

## Loading without layout shift

**Rule:** what the user sees first has the final shape. Data fills slots; it never adds rows, grows blocks or pushes
the page down. Only the user's own click may change the layout.

- **Render the real layout from what is known up front.** The catalog (`catalog/tools.json`) gives every tool's name,
  icon and order before any command runs, so a list of tools renders its real rows at once and only the values wait.
- **`<Skeleton chars={n} />`** (`src/ui/Skeleton.tsx`) stands in for a value inside a line: `n` characters wide, the
  line's own height. Size `n` to the usual value (`7` for `24.19.0`). Use it in a cell, next to a label, in a sentence.
- **`<Skeleton className="h-… w-…" />`** stands in for a block. Give it the block's final height, not a token one: a
  row of a list is one skeleton per expected row at that row's height, not one short bar.
- **`label`** goes on the first skeleton of a group only; it is announced as `role="status"`, the rest are silent.
- **`<StableText value variants />`** is a label that switches between known texts ("Check again" / "Checking…")
  and keeps the width of the widest.
- **A slot that may appear later** (a note, an error, a "Tasks held by others" box) reserves its room with
  `min-h-[…]` on the wrapper, or sits below everything that loads, where growing moves nothing.
- **Numbers** use `tabular-nums` (or the mono font), so a count changing from 9 to 10 does not move its neighbours.
- **`.reveal`** fades content in where its placeholder was. Under reduced motion it is instant.
- **Global:** `main` reserves the scrollbar's gutter, so a page growing past the window does not narrow and re-wrap,
  and `src/main.tsx` renders after the bundled fonts load, so the first frame is not laid out in a fallback font.

**How to check.** On the browser build:

```sh
pnpm build && pnpm preview --port 1478 --strictPort
node scripts/layout-shift.mjs tools agents --port 1478 --slow 3   # --port is required; use your own free port
```

It prints per page the Cumulative Layout Shift (`CLS`, how far things moved, 0 is best) and `grew`, how many pixels
the visible part of the page grew after its first frame, which CLS does not see. A page is done when both are under
the budget (`--budget 0.01`, `--grow 8`); the script exits 1 otherwise. `--shots 150,2000,4000` saves screenshots of
the loading stages; check them in light and dark (`--dark`). `?slow=3` on any browser-build URL stretches every
mock wait the same way.

## Design review

`.impeccable/` holds the approved mock-up (`mocks/decision/rack.png`), its measured spec and review captures.
`scripts/capture.mjs` screenshots the browser build with the mock platform for any state.
