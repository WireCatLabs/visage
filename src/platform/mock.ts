import type { Diagnosis, InstallEvent, Profile, Readiness, StorageArea, ToolState } from "./schemas"
import type { Platform } from "./types"

// A stand-in for Rust so the interface can be designed and reviewed in a browser.
// `?state=fresh` shows a machine with nothing installed, `?state=nonode` one without Node.js,
// `?state=one` only Telegram, `?fail=<tool>` makes that tool's install fail, `?hold=<tool>` keeps it installing, `?install=<tool>` starts one.

const params = new URLSearchParams(typeof window === "undefined" ? "" : window.location.search)
const scenario = params.get("state") ?? "mixed"
const delay = (ms: number) => new Promise((r) => setTimeout(r, ms))
const LATEST: Record<string, string> = {
  tg: "0.88.0",
  max: "0.74.0",
  wa: "0.7.0",
  zm: "0.42.0",
  drive: "0.30.0",
  memo: "0.95.0",
}
const PACKAGES: Record<string, string> = {
  tg: "@wirecat/tg-cli",
  max: "@wirecat/max-cli",
  wa: "@wirecat/whatsapp-cli",
  zm: "@wirecat/zoom-cli",
  drive: "@wirecat/drive-cli",
  memo: "@wirecat/cli-memo",
}

export function createMock(os: Platform["os"]): Platform {
  const installed = new Map<string, string>(
    scenario === "mixed"
      ? [
          ["tg", "0.88.0"],
          ["max", "0.74.0"],
          ["wa", "0.6.0"],
          ["zm", "0.42.0"],
          ["memo", "0.93.0"],
        ]
      : scenario === "one"
        ? [["tg", "0.88.0"]]
        : [],
  )
  let cancelled = false
  const MB = 1024 * 1024
  const dataSize: Record<string, number> = {
    tg: 46 * MB,
    max: 12 * MB,
    wa: 3 * MB,
    zm: 210 * MB,
    drive: 88 * MB,
    memo: 31 * MB,
    shared: 1450 * MB,
  }
  const app: Record<string, string> = {
    tg: "tg-cli",
    max: "max-cli",
    wa: "whatsapp-cli",
    zm: "zm",
    drive: "drive-cli",
    memo: "cli-memo",
    shared: "WireCat",
  }

  const program = (path: string, version: string) => ({ path, version, ok: true, problem: null })
  const absent = { path: null, version: null, ok: false, problem: "not found" }

  return {
    kind: "mock",
    os,
    async readiness(): Promise<Readiness> {
      await delay(450)
      const noNode = scenario === "nonode"
      return {
        os: os === "macos" ? "macOS" : os === "windows" ? "Windows" : "Linux",
        arch: "x86_64",
        node: noNode ? absent : program("~/.nvm/versions/node/v24.19.0/bin/node", "24.19.0"),
        npm: noNode ? absent : program("~/.nvm/versions/node/v24.19.0/bin/npm", "11.6.2"),
        pnpm: absent,
        npmPrefix: noNode ? null : "~/.nvm/versions/node/v24.19.0",
        npmPrefixWritable: noNode ? null : true,
      }
    },
    async detectTools(): Promise<ToolState[]> {
      await delay(800)
      return Object.keys(PACKAGES).map((id) => ({
        id,
        installs: installed.has(id)
          ? [
              {
                path: `~/.local/share/pnpm/bin/${id}`,
                version: installed.get(id) ?? null,
                manager: "pnpm",
                problem: null,
              },
              ...(id === "zm"
                ? [{ path: "~/.nvm/versions/node/v24.19.0/bin/zm", version: "0.40.0", manager: "npm", problem: null }]
                : []),
            ]
          : [],
      }))
    },
    async latestVersions() {
      await delay(1300)
      return { ...LATEST }
    },
    async listProfiles(id): Promise<Profile[] | null> {
      await delay(350)
      if (id === "memo") return null
      if (id === "wa") return []
      if (id === "tg") {
        return [
          { name: "personal", signedIn: true },
          { name: "work", signedIn: false },
        ]
      }
      return [{ name: "personal", signedIn: id === "max" ? true : null }]
    },
    async diagnose(id, profile): Promise<Diagnosis> {
      await delay(1000)
      const command = `${id} ${profile ? `${profile} ` : ""}doctor --json`
      if (id === "memo") {
        return {
          command,
          exitCode: 1,
          durationMs: 712,
          report: {
            item: {
              memo: { version: "0.93.0", node: "24.19.0" },
              mail: { accounts: [{ name: "•••", address: "•••", mode: "himalaya" }] },
              problems: [
                { what: "The search model is not downloaded yet.", fix: "memo search model download" },
                { what: "The daily sync timer is not installed.", fix: "memo timer install" },
              ],
            },
          },
          stderr: "",
        }
      }
      return {
        command,
        exitCode: 0,
        durationMs: 1043,
        report: {
          item: {
            profile,
            config: { found: true, path: `~/.config/${id}/config.toml` },
            store: { exists: true, writable: true, chats: 214, messages: 48210 },
            login: { state: "not checked" },
            files: { ok: true, problems: [] },
          },
        },
        stderr: "",
      }
    },
    async install(id, onEvent: (e: InstallEvent) => void) {
      cancelled = false
      const pkg = PACKAGES[id] ?? id
      onEvent({ event: "step", step: "check" })
      await delay(700)
      onEvent({ event: "step", step: "install" })
      onEvent({ event: "log", line: `$ npm install --global ${pkg}@latest --no-fund --no-audit`, stderr: false })
      for (const line of [
        `npm http fetch GET 200 https://registry.npmjs.org/${pkg} 312ms`,
        "npm http fetch GET 200 https://registry.npmjs.org/@wirecat%2fcli-core 188ms",
        "npm http fetch GET 200 https://registry.npmjs.org/better-sqlite3 140ms",
        "added 214 packages in 9s",
      ]) {
        await delay(700)
        if (cancelled)
          return onEvent({ event: "failed", reason: "cancelled", message: "Installation cancelled.", hint: null })
        onEvent({ event: "log", line, stderr: false })
        if (params.get("hold") === id) await new Promise(() => undefined)
      }
      if (params.get("fail") === id) {
        return onEvent({
          event: "failed",
          reason: "network",
          message: "Could not reach the npm registry.",
          hint: "Check your internet connection or proxy, then try again.",
        })
      }
      onEvent({ event: "step", step: "verify" })
      await delay(800)
      const version = LATEST[id] ?? "1.0.0"
      installed.set(id, version)
      onEvent({ event: "done", version, path: `~/.nvm/versions/node/v24.19.0/bin/${id}`, shadowedBy: null })
    },
    async uninstall(id, onEvent: (e: InstallEvent) => void) {
      cancelled = false
      onEvent({ event: "step", step: "check" })
      await delay(500)
      onEvent({ event: "step", step: "remove" })
      onEvent({ event: "log", line: `$ pnpm remove --global ${PACKAGES[id] ?? id}`, stderr: false })
      await delay(900)
      if (cancelled)
        return onEvent({ event: "failed", reason: "cancelled", message: "Uninstalling cancelled.", hint: null })
      onEvent({ event: "log", line: "Packages: -214", stderr: false })
      onEvent({ event: "step", step: "verify" })
      await delay(500)
      installed.delete(id)
      onEvent({ event: "removed" })
    },
    async storage(): Promise<StorageArea[]> {
      await delay(400)
      const used = [...installed.keys()]
      return Object.keys(app).map((id) => {
        const bytes = dataSize[id] ?? 0
        const name = app[id] ?? id
        return {
          id,
          folders: bytes
            ? [
                { kind: "config" as const, path: `~/.config/${name}`, bytes: 4096 },
                { kind: "state" as const, path: `~/.local/share/${name}`, bytes },
              ]
            : [],
          usedBy: id === "shared" ? used : used.filter((u) => u === id),
        }
      })
    },
    async clearStorage(id) {
      await delay(600)
      dataSize[id] = 0
    },
    async cancelInstall() {
      cancelled = true
    },
    async openSetup() {},
    async openUrl(url) {
      window.open(url, "_blank", "noopener")
    },
    async window() {},
  }
}
