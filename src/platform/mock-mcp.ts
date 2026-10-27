import type { McpClient, McpServerStatus } from "./mcp-server-schemas"
import { delay } from "./mock-delay"
import type { Platform } from "./types"

// `?mcp=<tool>` starts with that tool's server running, a login code and two apps logged in, one with a
// name that tries to look like a file; the Tools page opens it (`src/app/scenarios.ts`). `?mcp-fail=<tool>` makes Start
// fail as when another server holds the port. `?mcp-old=<tool>` answers as a tool from before `mcp server`.
// `?connect=<state>` opens tg's "Connect an AI app" guide (`connect-scenario.ts`); from `instructions` on, tg's server
// runs (`tunnel-off`: on the Cloudflare tunnel's address). `connected`: an app logged in after the guide opened; `called`: it also called tg_read; `oldcli`: it logged in,
// but the tool is too old to report calls; `live`: it logs in after 6 s and calls after 12 s. `?activity=<tool>`: that
// tool's server runs and ChatGPT called it 2 minutes ago, for the Tools page row. `?public=pending` (public DNS has
// no name yet, for good), `publishing` (none for 8 s, then live), `unknown` (no DNS service answered), `wrong` (the
// address answers 502), `unreached` (published, but this computer cannot open it): the guide's address check.
// `?code-used=<tool>`: like `?mcp=<tool>`, and after 4 s an app called ChatGPT logs in with the code, so the tool
// shows a new one.

const params = new URLSearchParams(typeof window === "undefined" ? "" : window.location.search)
const CODE_MS = 10 * 60 * 1000

const stopped = (): McpServerStatus => ({
  available: true,
  running: false,
  listening: false,
  startedHere: false,
  startedAt: null,
  port: null,
  connectorUrl: null,
  loginCode: null,
  outdated: false,
  clients: [],
})

const ago = (minutes: number) => new Date(Date.now() - minutes * 60 * 1000).toISOString()

const quiet = { lastRequestAt: null, lastTool: null, lastToolAt: null, toolCallsToday: 0 }

const client = (claimedName: string | null, lastLoginAt: string, more: Partial<McpClient> = {}): McpClient => ({
  claimedName,
  lastLoginAt,
  ...quiet,
  ...more,
})

const RUNNING = [
  "instructions",
  "waiting",
  "connected",
  "called",
  "oldcli",
  "unreached",
  "funnel-off",
  "tunnel-off",
  "live",
]

/** The app that logs in during a `?connect=` scenario, at the time of the status call, so it is after the guide opened. */
function newcomer(state: string, appName: string, opened: number): McpClient | null {
  const now = new Date().toISOString()
  const elapsed = Date.now() - opened
  if (state === "live" && elapsed < 6000) return null
  if (state === "oldcli") return client(appName, now, { toolCallsToday: null })
  if (state === "connected" || (state === "live" && elapsed < 12_000))
    return client(appName, now, { lastRequestAt: now })
  if (state === "called" || state === "live")
    return client(appName, now, { lastRequestAt: now, lastTool: "tg_read", lastToolAt: now, toolCallsToday: 1 })
  return null
}

const running = (port: number, url: string, clients: McpServerStatus["clients"]): McpServerStatus => ({
  available: true,
  running: true,
  listening: true,
  startedHere: true,
  startedAt: new Date(Date.now() - 42 * 60 * 1000).toISOString(),
  port,
  connectorUrl: `${url.replace(/\/$/, "")}/mcp`,
  loginCode: { code: "K7QX-M3PH", expiresAt: new Date(Date.now() + CODE_MS).toISOString() },
  outdated: false,
  clients,
})

export function mcpServerMock(): Pick<
  Platform,
  | "mcpServerStatus"
  | "mcpServerStart"
  | "mcpServerStop"
  | "mcpServerRevoke"
  | "mcpServerConfig"
  | "mcpServerOAuth"
  | "mcpServerPublic"
> {
  const servers = new Map<string, McpServerStatus>()
  const used = params.get("code-used")
  const shown = params.get("mcp") ?? used
  if (shown && params.get("tailscale") !== "leftover") {
    servers.set(
      shown,
      running(8765, `https://laptop.tail4a2c.ts.net/${shown}`, [
        client("Claude", ago(35)),
        client("ChatGPT connector.pdf", ago(60 * 26)),
      ]),
    )
  }
  const active = params.get("activity")
  if (active)
    servers.set(
      active,
      running(8765, `https://laptop.tail4a2c.ts.net/${active}`, [
        client("ChatGPT", ago(60 * 3), {
          lastRequestAt: ago(2),
          lastTool: `${active}_read`,
          lastToolAt: ago(2),
          toolCallsToday: 14,
        }),
      ]),
    )
  const connect = params.get("connect") ?? ""
  const opened = Date.now()
  const appName = params.get("connect-app") === "claude" ? "Claude" : "ChatGPT"
  const host = connect === "tunnel-off" ? "wirecat.example.com" : "laptop.tail4a2c.ts.net"
  if (RUNNING.includes(connect))
    servers.set("tg", running(8765, `https://${host}/tg`, [client("Claude", ago(60 * 26))]))

  return {
    async mcpServerStatus(id) {
      await delay(300)
      if (params.get("mcp-old") === id) return { ...stopped(), available: false }
      const now = servers.get(id) ?? stopped()
      if (id === used && now.running && Date.now() - opened > 4000) {
        const at = new Date(opened + 4000).toISOString()
        return {
          ...now,
          loginCode: { ...(now.loginCode ?? { expiresAt: at }), code: "R2WN-8TJD" },
          clients: [client("ChatGPT", at), ...now.clients],
        }
      }
      const joined = id === "tg" && now.running ? newcomer(connect, appName, opened) : null
      return joined ? { ...now, clients: [joined, ...now.clients] } : now
    },
    async mcpServerStart(id, port, url) {
      await delay(connect === "starting" ? 600_000 : 1500)
      if (params.get("mcp-fail") === id)
        throw new Error(`mcp --http stopped before it listened:\nport ${port} is in use — pass another with --port`)
      const next = running(port, url, servers.get(id)?.clients ?? [])
      servers.set(id, { ...next, startedAt: new Date().toISOString() })
      return next
    },
    async mcpServerStop(id) {
      await delay(700)
      servers.set(id, { ...stopped(), clients: servers.get(id)?.clients ?? [] })
    },
    async mcpServerRevoke(id) {
      await delay(400)
      const was = servers.get(id)
      if (was) servers.set(id, { ...was, clients: [] })
    },
    async mcpServerOAuth(id) {
      await delay(300)
      const url = servers.get(id)?.connectorUrl
      if (!url) throw new Error("The MCP server is not running.")
      const issuer = url.replace(/\/mcp$/, "")
      return {
        issuer,
        authorizationEndpoint: `${issuer}/authorize`,
        tokenEndpoint: `${issuer}/token`,
        registrationEndpoint: `${issuer}/register`,
      }
    },
    async mcpServerPublic(id) {
      await delay(900)
      const url = servers.get(id)?.connectorUrl
      if (!url) throw new Error("The MCP server is not running.")
      const host = new URL(url).hostname
      const pub = params.get("public")
      if (pub === "pending" || (pub === "publishing" && Date.now() - opened < 8000))
        return { host, dns: "missing", answer: { kind: "notTried" } }
      if (pub === "unknown") return { host, dns: "unknown", answer: { kind: "notTried" } }
      if (pub === "wrong") return { host, dns: "live", answer: { kind: "wrong", status: 502 } }
      if (pub === "unreached")
        return { host, dns: "live", answer: { kind: "unreached", reason: "Connection refused (os error 111)" } }
      return { host, dns: "live", answer: { kind: "ok" } }
    },
    async mcpServerConfig(id) {
      await delay(300)
      const args = [`/home/you/.local/share/pnpm/global/5/node_modules/.bin/${id}`, "mcp"]
      return JSON.stringify({ mcpServers: { [id]: { type: "stdio", command: "/usr/bin/node", args } } }, null, 2)
    },
  }
}
