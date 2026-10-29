# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

A Tauri 2 desktop app (Linux, macOS, Windows) whose interface is a web page in the system webview. Native
conventions apply to windowing, menus and keyboard; the design language is web.

## Stack

Tauri 2 + React + TypeScript + Vite + Tailwind CSS, shadcn/ui where useful and restyled to WireCat. Rust owns
system inspection and process execution. Decided by the owner in the brief (2026-10-25); alternatives are not to
be re-evaluated.

## Users

Primary: people who want their AI agent to work with their messages, meetings, documents and notes, but do not
want to drive npm by hand. They download WireCat Desktop, see which integrations exist, install the ones they
need, and get to a working tool.

Secondary: existing CLI users who want one place to see what is installed, which version, and whether it is
healthy. They must never be forced into the app; `npm install -g @wirecat/<tool>` stays a complete path.

## Product Purpose

WireCat Desktop is an optional graphical control plane for the WireCat CLI tools: discover, install, update,
verify and diagnose them. Success: a user opens WireCat, immediately understands which integrations are
available and which are installed, and installs another one without touching npm — and the result is polished
enough that a developer would recommend it.

Later (not in the first version): accounts, data and sync coverage, memory, people, projects, relationship
graphs, agent activity. The structure must leave room for these sections.

## Positioning

The CLI tools are the product; the app is a thin, honest window onto them. It installs the same npm packages
a CLI user would, runs the tools' own `--version`, `doctor` and `setup` commands, and never reimplements
authentication. Everything stays on the user's computer.

## Operating Context

- Tools (catalog, 2026-10-25): Telegram `tg` (@wirecat/tg-cli), MAX `max` (@wirecat/max-cli), WhatsApp `wa`
  (@wirecat/whatsapp-cli), Zoom `zm` (@wirecat/zoom-cli), Google Drive `drive` (@wirecat/drive-cli), Memo
  `memo` (@wirecat/cli-memo). All six shown equally (owner, 2026-10-25). Email is a seventh row over memo's package
  and `memo mail` commands, with its own accounts, checks and logs; installing either installs both (owner, NEED-13
  answer B, 2026-10-25).
- Requirements: Node `^22.16.0 || >=24` with npm. The app itself must start without Node.
- Account commands take an explicit profile (`tg personal doctor`); no profile is ever assumed. memo has no
  profiles. Setup flows are interactive and run in a terminal.
- Tools may be installed by npm or pnpm, sometimes both; versions come from running the binary.

## Capabilities and Constraints

- First version: system readiness (OS, Node, npm), tool catalog with installed state and version, install and
  update with progress and verification, tool details, diagnostics per profile, links to docs and GitHub,
  copyable CLI install command.
- Frontend asks only for known operations by tool id; Rust maps them to fixed commands. No shell plugin, no
  arbitrary commands, no administrator rights.
- Diagnostics never show tokens, session files, passwords or personal data.
- Undecided: a managed Node runtime (structure must allow it later); in-app account setup.

## Brand Commitments

- Name **WireCat**. `visage` is only the repository name and never appears in the UI.
- Shared identity with wirecat.dev: purple WireCat monogram and word mark
  (`../cli-docs/design/logo/`, `../cli-docs/lib/brand.ts`), green-tinted neutrals, Unbounded / Onest /
  JetBrains Mono (`../cli-docs/DESIGN.md`).
- Owner references for quality: Docker Desktop, Raycast, Linear. Avoid generic AI-dashboard looks, heavy
  gradients, nested cards and decoration that does no work.

## Evidence on Hand

- Real: six published npm packages, their `commands --json`, `doctor --json` and `account list --json`
  output, Apache 2.0 licence, wirecat.dev docs.
- Absent and never to be invented: user or download counts, testimonials, ratings.

## Product Principles

1. The CLI stays first: the app adds a window, never a requirement.
2. Show the real state — what the tool itself reports — and say plainly what could not be checked.
3. One obvious action per tool; details on demand.
4. Errors say what happened and what to do next, with the raw log one click away.
5. Never choose an account or profile for the user.

## Accessibility & Inclusion

Keyboard operable throughout, visible focus, WCAG AA contrast in light and dark, reduced-motion respected.
