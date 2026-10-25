import { ownerId, tools } from "@/domain/catalog"
import { agentsMock } from "./mock-agents"
import { storeCheckMock, storeInfoMock, storeTablesMock } from "./mock-archive"
import { reportMock } from "./mock-report"
import { runsMock } from "./mock-runs"
import { settingsMock } from "./mock-settings"
import type {
  Diagnosis,
  InstallEvent,
  NodeEvent,
  NodePath,
  Profile,
  Readiness,
  StorageArea,
  ToolState,
} from "./schemas"
import type { Platform } from "./types"

// A stand-in for Rust so the interface can be designed and reviewed in a browser.
// `?state=fresh` shows a machine with nothing installed, `?state=nonode` one without Node.js,
// `?state=one` only Telegram, `?fail=<tool>` makes that tool's install fail, `?hold=<tool>` keeps it installing, `?install=<tool>` starts one.
// `?state=noadmin` has an apt Node whose npm needs administrator rights. With `nonode` or `noadmin`, "Set up Node.js
// for me" runs a fake download; `?node=fail` makes its checksum mismatch, `?node=ready` starts with it already set up.

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

// Doctor's configuration checks: Telegram's personal profile has every warning kind, work has a broken file, and MAX
// is a released version that still sends one error string. Tools never put a setting's value into these.
const TG_CONFIG = "~/.config/tg-cli/config.json"
const MOCK_CONFIG: Record<string, { issues?: Record<string, unknown>[]; error?: string }> = {
  "tg/personal": {
    issues: [
      {
        kind: "unknown_permission",
        file: TG_CONFIG,
        profile: "personal",
        key: "permissions.bot.store.fetch",
        what: "permissions.bot.store.fetch is not a permission tg knows, so it has no effect.",
        fix: "tg personal config unset permissions.bot.store.fetch",
      },
      {
        kind: "unknown_setting",
        file: TG_CONFIG,
        profile: "personal",
        key: "sync.colour",
        what: "sync.colour is not a setting tg knows. It may be misspelled.",
        fix: "tg personal config unset sync.colour",
      },
      {
        kind: "missing_setting",
        file: TG_CONFIG,
        profile: "personal",
        key: "api_id",
        what: "api_id is not set. Sign-in needs it.",
      },
      {
        kind: "invalid_value",
        file: TG_CONFIG,
        profile: "personal",
        key: "sync.limit",
        line: 14,
        column: 18,
        what: "sync.limit must be a whole number from 1 to 1000.",
      },
    ],
  },
  "tg/work": {
    issues: [
      {
        kind: "invalid_json",
        file: TG_CONFIG,
        line: 9,
        column: 3,
        what: "The settings file is not valid JSON: a comma is missing before this line.",
      },
    ],
  },
  "max/personal": { error: "Could not read ~/.config/max-cli/config.json: Unexpected token } in JSON at position 212" },
}

// Each tool's data folder as the real tools lay it out: name, is a folder, share of the folder's size.
const STATE_ENTRIES: Record<string, [string, boolean, number][]> = {
  tg: [
    ["sessions", true, 0.02],
    ["runs", true, 0.55],
    ["backfill", true, 0.3],
    ["sends", true, 0.08],
    ["accounts", true, 0.01],
    ["pace", true, 0.02],
    ["update-check.json", false, 0.02],
  ],
  max: [
    ["profiles", true, 0.05],
    ["runs", true, 0.6],
    ["sends", true, 0.15],
    ["bots", true, 0.15],
    ["update-check.json", false, 0.05],
  ],
  wa: [
    ["runs", true, 0.9],
    ["update-check.json", false, 0.1],
  ],
  zm: [["runs", true, 1]],
  drive: [
    ["drive.db", false, 0.7],
    ["drive.db-wal", false, 0.05],
    ["backups", true, 0.2],
    ["profiles", true, 0.05],
  ],
  memo: [
    ["folders", true, 0.4],
    ["mail-trash", true, 0.5],
    ["domain-ages.json", false, 0.1],
  ],
  shared: [
    ["wirecat.db", false, 0.8],
    ["backups", true, 0.15],
    ["models", true, 0.05],
  ],
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
  const asksArchive = () => ["tg", "wa", "max"].find((id) => installed.has(id)) ?? null
  let cancelled = false
  const MB = 1024 * 1024
  const NODE = { version: "24.22.1", bytes: 58_290_700, dir: "~/.local/share/dev.wirecat.desktop/node/v24.22.1" }
  let managed = params.get("node") === "ready"
  let nodeCancelled = false
  let pathAdded = false
  const nodePath = (): NodePath => ({
    shell: os === "windows" ? "windows" : "zsh",
    file: os === "windows" ? "HKEY_CURRENT_USER\\Environment\\Path" : "~/.zshrc",
    line:
      os === "windows"
        ? "C:\\Users\\you\\AppData\\Local\\dev.wirecat.desktop\\node\\v24.22.1"
        : `export PATH="$HOME/.local/share/dev.wirecat.desktop/node/v${NODE.version}/bin:$PATH"`,
    added: pathAdded,
    automatic: true,
  })
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
      const managedInfo = managed ? { version: NODE.version, dir: NODE.dir, active: true } : null
      if (managed && (scenario === "nonode" || scenario === "noadmin")) {
        return {
          os: os === "macos" ? "macOS" : os === "windows" ? "Windows" : "Linux",
          arch: "x86_64",
          node: program(`${NODE.dir}/bin/node`, NODE.version),
          npm: program(`${NODE.dir}/bin/npm`, "11.19.1"),
          pnpm: absent,
          npmPrefix: NODE.dir,
          npmPrefixWritable: true,
          managed: managedInfo,
        }
      }
      if (scenario === "noadmin") {
        return {
          os: os === "macos" ? "macOS" : os === "windows" ? "Windows" : "Linux",
          arch: "x86_64",
          node: program("/usr/bin/node", "22.18.0"),
          npm: program("/usr/bin/npm", "10.9.3"),
          pnpm: absent,
          npmPrefix: "/usr/local",
          npmPrefixWritable: false,
          managed: managedInfo,
        }
      }
      const noNode = scenario === "nonode"
      return {
        os: os === "macos" ? "macOS" : os === "windows" ? "Windows" : "Linux",
        arch: "x86_64",
        node: noNode ? absent : program("~/.nvm/versions/node/v24.19.0/bin/node", "24.19.0"),
        npm: noNode ? absent : program("~/.nvm/versions/node/v24.19.0/bin/npm", "11.6.2"),
        pnpm: absent,
        npmPrefix: noNode ? null : "~/.nvm/versions/node/v24.19.0",
        npmPrefixWritable: noNode ? null : true,
        managed: managedInfo ? { ...managedInfo, active: false } : null,
      }
    },
    async nodeOffer() {
      await delay(600)
      return { version: NODE.version, bytes: NODE.bytes, dir: NODE.dir }
    },
    async setupNode(onEvent: (e: NodeEvent) => void) {
      nodeCancelled = false
      onEvent({ event: "step", step: "check" })
      await delay(700)
      onEvent({ event: "step", step: "download" })
      const chunks = 24
      for (let i = 0; i <= chunks; i++) {
        if (nodeCancelled)
          return onEvent({ event: "failed", reason: "cancelled", message: "Node.js setup cancelled.", hint: null })
        onEvent({ event: "progress", received: Math.round((NODE.bytes * i) / chunks), total: NODE.bytes })
        await delay(160)
      }
      onEvent({ event: "step", step: "verify" })
      await delay(600)
      if (params.get("node") === "fail") {
        return onEvent({
          event: "failed",
          reason: "verify",
          message: "The download does not match the checksum nodejs.org publishes, so it was thrown away.",
          hint: "Try again. If it keeps failing, something between you and nodejs.org changes downloads.",
        })
      }
      onEvent({ event: "step", step: "unpack" })
      await delay(900)
      managed = true
      onEvent({ event: "done", version: NODE.version, path: NODE.dir })
    },
    async cancelNodeSetup() {
      nodeCancelled = true
    },
    async removeNode() {
      await delay(500)
      if (installed.size > 0) {
        throw new Error(`These tools run on it: ${[...installed.keys()].join(", ")}. Uninstall them first.`)
      }
      managed = false
      pathAdded = false
    },
    async nodePath() {
      await delay(200)
      return nodePath()
    },
    async setNodePath(add) {
      await delay(400)
      pathAdded = add
      return nodePath()
    },
    async detectTools(): Promise<ToolState[]> {
      await delay(800)
      return tools.map(({ id: tool }) => {
        const id = ownerId(tool)
        return {
          id: tool,
          installs: installed.has(id)
            ? [
                {
                  path: `~/.local/share/pnpm/bin/${tools.find((t) => t.id === id)?.bin ?? id}`,
                  version: installed.get(id) ?? null,
                  manager: "pnpm",
                  problem: null,
                },
                ...(id === "zm"
                  ? [{ path: "~/.nvm/versions/node/v24.19.0/bin/zm", version: "0.40.0", manager: "npm", problem: null }]
                  : []),
              ]
            : [],
        }
      })
    },
    async latestVersions() {
      await delay(1300)
      return Object.fromEntries(tools.map((t) => [t.id, LATEST[ownerId(t.id)] ?? null]))
    },
    async listProfiles(id): Promise<Profile[] | null> {
      await delay(350)
      if (id === "memo") return null
      if (id === "email") return scenario === "mixed" ? [{ name: "personal", signedIn: null }] : []
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
      if (id === "email") {
        return {
          command: `memo mail check ${profile ?? ""} --json`,
          exitCode: 0,
          durationMs: 240,
          report: { item: { name: "•••", address: "[email]" } },
          stderr: "",
        }
      }
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
      const config = MOCK_CONFIG[`${id}/${profile ?? ""}`]
      if (config) {
        const broken = config.issues?.some((i) => i.kind === "invalid_json") || "error" in config
        return {
          command,
          exitCode: broken ? 1 : 0,
          durationMs: 884,
          report: { item: { profile, config: { found: true, path: `~/.config/${id}-cli/config.json`, ...config } } },
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
    async install(given, onEvent: (e: InstallEvent) => void) {
      const id = ownerId(given)
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
    async uninstall(given, onEvent: (e: InstallEvent) => void) {
      const id = ownerId(given)
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
                {
                  kind: "config" as const,
                  path: `~/.config/${name}`,
                  bytes: 4096,
                  entries: [{ name: "config.json", dir: false, bytes: 4096 }],
                },
                {
                  kind: "state" as const,
                  path: `~/.local/share/${name}`,
                  bytes,
                  entries: (STATE_ENTRIES[id] ?? []).map(([entry, dir, share]) => ({
                    name: entry,
                    dir,
                    bytes: Math.round(bytes * share),
                  })),
                },
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
    async openFolder() {},
    storeInfo: () => storeInfoMock(asksArchive()),
    storeTables: (sizes) => storeTablesMock(asksArchive(), sizes),
    storeCheck: () => storeCheckMock(asksArchive()),
    ...agentsMock((id) => installed.get(id)),
    async cancelInstall() {
      cancelled = true
    },
    async openSetup() {},
    ...reportMock,
    ...runsMock,
    ...settingsMock,
    async openUrl(url) {
      window.open(url, "_blank", "noopener")
    },
    async window() {},
  }
}
