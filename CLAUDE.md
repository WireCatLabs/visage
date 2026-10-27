# WireCat Desktop — working rules

**Start with [`docs/dev/ARCHITECTURE.md`](docs/dev/ARCHITECTURE.md)**: the layers, what each may import, and how a
request travels from a button to a process. Product truth is [`PRODUCT.md`](PRODUCT.md); visual decisions are
[`DESIGN.md`](DESIGN.md) once it exists, and `.impeccable/` holds the approved mock-up and design review material.

The repository is `wirecat-desktop` (the local folder may still be called `visage`, its old name); the product is
**WireCat**. The old name `visage` never appears in the interface.

## Commands

| Task | Command |
| --- | --- |
| Run the interface in a browser, Rust mocked | `pnpm dev` → <http://localhost:1420> |
| Run the real app | `pnpm app` (Linux needs `bin/install-linux-deps` once) |
| Put WireCat in the Linux app launcher | `bin/install-desktop-entry` (`--remove` takes it out) |
| Everything CI runs | `pnpm check` |
| Screenshot the browser build | `node scripts/capture.mjs out.png "?state=fresh" [--dark] [--width 1280]` |
| Rule 9 check: a tool's panel never moves the clicked row | `pnpm build && pnpm preview --port 1478 --strictPort`, then `node scripts/scroll-hold.mjs --port 1478` |

Mock scenarios for the browser build: `?state=fresh`, `?state=nonode`, `?install=<tool>`, `?hold=<tool>`,
`?fail=<tool>`, `?fail=storage` (the Storage page cannot read its folders), `?crash=<section>` (that page breaks while
rendering, to see the error screen), `?state=one` (only Telegram installed; see `src/platform/mock.ts`). A fresh browser shows the first-run
setup; `?onboarding=off` hides it for one load, `?onboarding=<step>` (`choose`, `install`, `signin`…) opens that step. Backups: `?backups=none`, `?backup-fail=disk` (not enough space); clearing: `?clear=old` (tool too old, button off), `?clear=busy` (a sync holds the store). Bug reports: `?report=fail` (server
unreachable), `?report=queued` (stored, no issue yet); Agents: `?chats=none` (Hermes and OpenClaw answer in no chat app); sign-in: `?signin=<tool>` opens that tool's sign-in for a profile named personal (`wa` and `max` QR codes, `tg` app keys then QR or phone, `zm` and `drive` the browser; questions are answered in the window), `?signin-fail=wa` (the tool refuses after the first code), `?signin-fail=zm` (Zoom has no Public Client ID until one is saved). MCP server, one per tool for every profile: `?mcp=<tool>` (that tool's details open with its server running, a login code and two apps logged in), `?mcp-fail=<tool>` (Start fails: port in use), `?mcp-old=<tool>` (the tool is too old for the server of every profile), `?funnel-old=<tool>` (a whole-port Funnel left from a server of profile personal), `?code-used=<tool>` (like `?mcp=`; after 4 s ChatGPT logs in with the code, so a new one replaces it and the page says which app used the last one). Connect an AI app (tg's guide, `src/features/tools/connect-scenario.ts`): `?connect=choose|address|starting|instructions|waiting|unreached|connected|called|oldcli|funnel-off|live` (`address` is the Tailscale step, `starting` holds the server start, `unreached` shows the hints for an app that never logged in, `called` the first call, `oldcli` a tool too old to report calls, `live` logs in after 6 s and calls after 12 s), `?connect-app=claude|other` (ChatGPT otherwise), `?activity=<tool>` (its row on the Tools page shows the last call); the address check: `?public=pending|publishing|unknown|wrong|unreached` (no public name yet, published after 8 s, no DNS service answers, the address answers 502, published but this computer cannot open it). Tailscale Funnel steps (tg's guide at the address step; each tool gets a path, `/tg`, on one shared address): `?tailscale=missing|nooperator|nodaemon|loggedout|approval|stopped|nohttps|nofunnel|full|ready`, `?tailscale=nosource` (installed from a package, no update source), `?tailscale-os=macos|windows` (the install step there), `?tailscale-distro=<id>` with Linux (`ubuntu` default, `debian`, `fedora`, `rhel`, `opensuse`, `arch`, `nixos`, `other`), `?tailscale-nocurl=1` (curl missing: its install line comes first), `?tailscale-fail=funnel` (turning Funnel on fails), `?tailscale=leftover&mcp=<tool>` (server off, its Funnel still on). Cloudflare tunnel (the same guide, the second choice): `?cloudflare=missing|unsupported|loggedout|noaddress|ready`, `?cloudflare-os=macos|windows`, `?cloudflare-fail=install|login|address|tunnel` (checksum, login, a name outside the domain chosen at login, cloudflared not reaching Cloudflare), `?connect=tunnel-off` (tg's server runs on the tunnel's address, cloudflared does not). Sync: `?sync=<tool>` (that tool's details open and its sync for personal starts, then finishes), `?sync-hold=<tool>` (it keeps running), `?sync-fail=<tool>` (another sync holds the profile), `?sync-timeout=<tool>` (it ends at the time limit), `?sync=never` (no profile synced yet). The real app sends to `WIRECAT_API_URL` or `https://api.wirecat.dev`.

## Rules

1. **The CLIs stay first.** The app installs the same npm packages and runs the tools' own commands. It never
   reimplements a tool's sign-in, sync or diagnostics; a missing capability is added to the CLI, not here.
2. **The interface asks for operations, never command lines.** A new native action is a new `#[tauri::command]`
   that takes a tool id and validated arguments; Rust maps it to a fixed program. No shell plugin, no
   `sh -c` with interpolated input (`src-tauri/src/terminal.rs` is the one place a shell line is built, from
   catalog words and a validated profile name, or Tailscale's fixed install line from `tailscale.rs`).
3. **Never pick a profile or account for the owner.** Profile lists show every profile; commands that need one
   take the one the user chose.
4. **Nothing personal leaves Rust unmasked.** Doctor output goes through `redact.rs` before it reaches the
   interface, the clipboard or a log.
5. **Deleting data stays narrow.** Only folders computed in `storage.rs` from the catalog, only when nothing
   installed uses them, only after the user confirms in a dialog that lists every path. Never widen it to a
   pattern: `~/.cache` is full of unrelated files with tool-like names. Emptying the shared store is the one
   exception: the tool's own `store reset`, behind a dialog that lists every file and table it deletes.
6. **No administrator rights.** Never call `sudo`, never install into a system folder; explain the fix instead.
7. **Adding a tool** is an entry in [`catalog/tools.json`](catalog/tools.json) plus an icon in
   `src/features/tools/ToolIcon.tsx`. If it needs more, the catalog shape is what changes.
8. **Both themes, keyboard and reduced motion** are part of done for every UI change. Check light and dark with
   the capture script.
9. **Nothing jumps, nothing vanishes.** A click never resets the scroll position or shifts content the user did not
   touch. Every change of state is animated (open, close, expand, step to step; instant under reduced motion), so the
   user sees where things came from and went. A multi-step flow stays on one surface, slides from step to step, and
   after each action shows what happens next; a surface never closes on its own. When the user's goal is reached, the
   surface says so plainly ("ChatGPT can now read your Telegram") and suggests the next steps.

Code style: Biome (`biome.json`, shared base in `config/wirecat/` — do not edit that folder, it is synced from
`WireCatLabs/community`), rustfmt and clippy pedantic for Rust. Comments say why, not what. Conventional commits.
