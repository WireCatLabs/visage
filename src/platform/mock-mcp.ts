import type { McpServerStatus } from "./mcp-server-schemas"
import { delay } from "./mock-delay"
import type { Platform } from "./types"

// `?mcp=<tool>` starts with that tool's `personal` server running, a login code and two apps logged in, one with a
// name that tries to look like a file; the Tools page opens it (`src/app/scenarios.ts`). `?mcp-fail=<tool>` makes Start
// fail as when another server holds the port. `?mcp-old=<tool>` answers as a tool from before `mcp server`.

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
  "mcpServerStatus" | "mcpServerStart" | "mcpServerStop" | "mcpServerRevoke" | "mcpServerConfig"
> {
  const servers = new Map<string, McpServerStatus>()
  const key = (id: string, profile: string | null) => `${id}:${profile ?? ""}`
  const shown = params.get("mcp")
  if (shown && params.get("tailscale") !== "leftover") {
    const ago = (minutes: number) => new Date(Date.now() - minutes * 60 * 1000).toISOString()
    servers.set(
      key(shown, shown === "memo" ? null : "personal"),
      running(8765, "https://laptop.tail4a2c.ts.net", [
        { claimedName: "Claude", lastLoginAt: ago(35) },
        { claimedName: "ChatGPT connector.pdf", lastLoginAt: ago(60 * 26) },
      ]),
    )
  }

  return {
    async mcpServerStatus(id, profile) {
      await delay(300)
      if (params.get("mcp-old") === id) return { ...stopped(), available: false }
      return servers.get(key(id, profile)) ?? stopped()
    },
    async mcpServerStart(id, profile, port, url) {
      await delay(1500)
      if (params.get("mcp-fail") === id)
        throw new Error(`mcp --http stopped before it listened:\nport ${port} is in use — pass another with --port`)
      const next = running(port, url, servers.get(key(id, profile))?.clients ?? [])
      servers.set(key(id, profile), { ...next, startedAt: new Date().toISOString() })
      return next
    },
    async mcpServerStop(id, profile) {
      await delay(700)
      const was = servers.get(key(id, profile))
      servers.set(key(id, profile), { ...stopped(), clients: was?.clients ?? [] })
    },
    async mcpServerRevoke(id, profile) {
      await delay(400)
      const was = servers.get(key(id, profile))
      if (was) servers.set(key(id, profile), { ...was, clients: [] })
    },
    async mcpServerConfig(id, profile) {
      await delay(300)
      const name = profile ? `${id}-${profile}` : id
      const args = [
        `/home/you/.local/share/pnpm/global/5/node_modules/.bin/${id}`,
        ...(profile ? [profile] : []),
        "mcp",
      ]
      return JSON.stringify({ mcpServers: { [name]: { type: "stdio", command: "/usr/bin/node", args } } }, null, 2)
    },
  }
}
