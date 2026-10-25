# WireCat Desktop

Install, update and check the [WireCat](https://wirecat.dev) tools for AI agents without touching npm.

WireCat Desktop shows which WireCat tools exist, which are installed on your computer and in which version, and
installs or updates them with one click. It checks that your computer is ready (Node.js and npm), runs each tool's
own health check, and opens a tool's account setup in your terminal.

It is optional. The tools stay command-line first: `npm install -g @wirecat/tg-cli` works exactly as before, and the
app installs the same packages.

| Tool | Command | Package |
| --- | --- | --- |
| Telegram | `tg` | `@wirecat/tg-cli` |
| MAX | `max` | `@wirecat/max-cli` |
| WhatsApp | `wa` | `@wirecat/whatsapp-cli` |
| Zoom | `zm` | `@wirecat/zoom-cli` |
| Google Drive | `drive` | `@wirecat/drive-cli` |
| Memo | `memo` | `@wirecat/cli-memo` |

## Requirements

- To run the app: nothing extra on macOS and Windows; WebKitGTK on Linux (installed with the package).
- To install tools: Node.js 22.16+ or 24+, with npm. The app tells you when it is missing.

## Develop

```sh
pnpm install
pnpm dev        # the interface in a browser, with Rust mocked: http://localhost:1420
pnpm app        # the real desktop app
pnpm check      # types, lint, tests, rustfmt, clippy, Rust tests
```

On Debian or Ubuntu, run `bin/install-linux-deps` once for the Tauri build libraries.

Start with [docs/dev/ARCHITECTURE.md](docs/dev/ARCHITECTURE.md).

## Licence

Apache 2.0.
