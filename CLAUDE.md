# WireCat Desktop — working rules

**Start with [`docs/dev/ARCHITECTURE.md`](docs/dev/ARCHITECTURE.md)**: the layers, what each may import, and how a
request travels from a button to a process. Product truth is [`PRODUCT.md`](PRODUCT.md); visual decisions are
[`DESIGN.md`](DESIGN.md) once it exists, and `.impeccable/` holds the approved mock-up and design review material.

The repository is `visage`; the product is **WireCat**. The name `visage` never appears in the interface.

## Commands

| Task | Command |
| --- | --- |
| Run the interface in a browser, Rust mocked | `pnpm dev` → <http://localhost:1420> |
| Run the real app | `pnpm app` (Linux needs `bin/install-linux-deps` once) |
| Everything CI runs | `pnpm check` |
| Screenshot the browser build | `node scripts/capture.mjs out.png "?state=fresh" [--dark] [--width 1280]` |

Mock scenarios for the browser build: `?state=fresh`, `?state=nonode`, `?install=<tool>`, `?hold=<tool>`,
`?fail=<tool>`, `?state=one` (only Telegram installed; see `src/platform/mock.ts`). A fresh browser shows the first-run
setup; `?onboarding=off` hides it for one load, `?onboarding=<step>` (`choose`, `install`, `signin`…) opens that step. Bug reports: `?report=fail` (server
unreachable), `?report=queued` (stored, no issue yet); the real app sends to `WIRECAT_API_URL` or `https://api.wirecat.dev`.

## Rules

1. **The CLIs stay first.** The app installs the same npm packages and runs the tools' own commands. It never
   reimplements a tool's sign-in, sync or diagnostics; a missing capability is added to the CLI, not here.
2. **The interface asks for operations, never command lines.** A new native action is a new `#[tauri::command]`
   that takes a tool id and validated arguments; Rust maps it to a fixed program. No shell plugin, no
   `sh -c` with interpolated input (`src-tauri/src/terminal.rs` is the one place a shell line is built, from
   catalog words and a validated profile name).
3. **Never pick a profile or account for the owner.** Profile lists show every profile; commands that need one
   take the one the user chose.
4. **Nothing personal leaves Rust unmasked.** Doctor output goes through `redact.rs` before it reaches the
   interface, the clipboard or a log.
5. **Deleting data stays narrow.** Only folders computed in `storage.rs` from the catalog, only when nothing
   installed uses them, only after the user confirms in a dialog that lists every path. Never widen it to a
   pattern: `~/.cache` is full of unrelated files with tool-like names.
6. **No administrator rights.** Never call `sudo`, never install into a system folder; explain the fix instead.
7. **Adding a tool** is an entry in [`catalog/tools.json`](catalog/tools.json) plus an icon in
   `src/features/tools/ToolIcon.tsx`. If it needs more, the catalog shape is what changes.
8. **Both themes, keyboard and reduced motion** are part of done for every UI change. Check light and dark with
   the capture script.

Code style: Biome (`biome.json`, shared base in `config/wirecat/` — do not edit that folder, it is synced from
`WireCatLabs/community`), rustfmt and clippy pedantic for Rust. Comments say why, not what. Conventional commits.
