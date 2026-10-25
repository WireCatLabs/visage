# Architecture

WireCat Desktop is a thin window onto the WireCat CLIs. The interface is React in the system webview; Rust inspects
the machine and runs the tools. Nothing here duplicates what a CLI already does.

## The layers

```text
src/
  app/          shell: window frame, sidebar, sections, theme. May import everything below.
  features/     one folder per area (tools/, system/). Data, state and screens for that area.
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
  storage.rs    each tool's data folders, their sizes, and deleting them once nothing uses them.
  paths.rs      the PATH a terminal would have; finding every copy of a binary.
  run.rs        running a process with a timeout; streaming lines; killing a whole process tree.
  redact.rs     masking tokens, numbers, addresses and names in tool output.
  terminal.rs   opening a tool's interactive setup in the user's terminal.
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
the shared archive until no tool is installed. Before `remove_dir_all`, each path must be absolute, at least four
components deep, not the home folder, and named for the tool. A store moved with `MESSAGING_STORE` and sign-in
tokens in the system keyring are never touched. After the last tool is uninstalled the app offers, once, to delete
everything that is left.

## Profiles and diagnostics

The CLIs differ: `tg`, `max`, `wa` list profiles with `account list --json`, `drive` with `session list --json`,
`zm` in `doctor --json`, and `memo` has none. The catalog records each tool's command and the JSON shape to read.
Doctor output is masked in Rust and summarised in `src/domain/doctor.ts`; the raw (masked) JSON stays one click away.

## Growing the app

A new area (accounts, memory, people…) is one entry in `src/app/sections.tsx` and one folder in `src/features/`.
A managed Node.js runtime would live behind `system.rs`/`install.rs`: they already resolve `node` and `npm` by
path, so pointing them at a bundled runtime changes no caller.

## Design review

`.impeccable/` holds the approved mock-up (`mocks/decision/rack.png`), its measured spec and review captures.
`scripts/capture.mjs` screenshots the browser build with the mock platform for any state.
