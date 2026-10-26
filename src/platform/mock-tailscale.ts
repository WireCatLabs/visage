import { delay } from "./mock-delay"
import type { FunnelState, TailscaleStatus } from "./tailscale-schemas"
import type { Platform } from "./types"

// `?tailscale=<state>` opens tg's MCP server Start dialog for the profile personal with the Tailscale guide at that
// state: `missing`, `nooperator` (Linux: only root may change Tailscale), `nodaemon` (installed, not running),
// `loggedout`, `approval` (the tailnet's admin approves new devices), `stopped`, `nohttps`, `nofunnel`, `full` (all
// three Funnel ports taken), `ready`. `?tailscale-os=macos|windows` changes the install step; Linux offers a .deb.
// `?tailscale=leftover` with `?mcp=<tool>`: the server is off but the funnel the app set up still points at it.
// `?tailscale-fail=funnel` makes turning Funnel on fail. Logging in finishes by itself after a few seconds.

const params = new URLSearchParams(typeof window === "undefined" ? "" : window.location.search)
const HOST = "laptop.tail4a2c.ts.net"

function initial(): TailscaleStatus {
  const os = (["macos", "windows"] as const).find((o) => o === params.get("tailscale-os")) ?? "linux"
  const ready: TailscaleStatus = {
    os,
    installed: true,
    package: os === "macos" ? "pkg" : os === "windows" ? "exe" : "deb",
    operator: os === "linux" ? true : null,
    user: "alex",
    daemon: true,
    backend: "running",
    https: true,
    funnel: true,
    host: HOST,
    freePorts: [443, 8443, 10000],
  }
  const off = { https: false, funnel: false, host: null, freePorts: [] }
  switch (params.get("tailscale")) {
    case "missing":
      return { ...ready, installed: false, operator: null, daemon: false, backend: "unknown", ...off }
    case "nooperator":
      return { ...ready, operator: false, backend: "needsLogin", ...off }
    case "nodaemon":
      return { ...ready, daemon: false, backend: "unknown", ...off }
    case "loggedout":
      return { ...ready, backend: "needsLogin", ...off }
    case "approval":
      return { ...ready, backend: "needsApproval", ...off }
    case "stopped":
      return { ...ready, backend: "stopped", ...off }
    case "nohttps":
      return { ...ready, https: false, funnel: false, freePorts: [] }
    case "nofunnel":
      return { ...ready, funnel: false, freePorts: [] }
    case "full":
      return { ...ready, freePorts: [] }
    default:
      return ready
  }
}

export function tailscaleMock(): Pick<
  Platform,
  | "tailscaleStatus"
  | "tailscaleDownload"
  | "tailscaleTerminal"
  | "tailscaleLogin"
  | "tailscaleStop"
  | "tailscaleFunnelOpen"
  | "tailscaleFunnelClose"
  | "tailscaleFunnels"
> {
  let state = initial()
  let stopped = false
  const funnels: FunnelState[] = []
  const shown = params.get("mcp")
  if (shown) {
    const profile = shown === "memo" ? null : "personal"
    funnels.push({ tool: shown, profile, url: `https://${HOST}`, port: 8765, live: true })
  }

  return {
    async tailscaleStatus() {
      await delay(500)
      return state
    },
    async tailscaleDownload(kind) {
      await delay(1800)
      const file = {
        pkg: "Tailscale-1.104.2-macos.pkg",
        exe: "tailscale-setup-1.104.2.exe",
        deb: "tailscale_1.104.2_amd64.deb",
        rpm: "tailscale_1.104.2_x86_64.rpm",
      }[kind]
      return { path: `~/Downloads/${file}`, file, opened: kind === "pkg" || kind === "exe" }
    },
    async tailscaleTerminal() {
      await delay(200)
    },
    async tailscaleLogin(onPage) {
      stopped = false
      await delay(800)
      onPage("https://login.tailscale.com/a/1a2b3c4d5e")
      for (let i = 0; i < 8; i++) {
        await delay(500)
        if (stopped) throw new Error("Stopped.")
      }
      state = { ...state, backend: "running", https: true, funnel: true, host: HOST, freePorts: [443, 8443, 10000] }
    },
    async tailscaleStop() {
      stopped = true
    },
    async tailscaleFunnelOpen(id, profile, port) {
      await delay(1200)
      if (params.get("tailscale-fail") === "funnel")
        throw new Error("Tailscale did not turn Funnel on: serve config denied")
      const https = state.freePorts[0]
      if (https === undefined)
        throw new Error("Tailscale Funnel allows 3 public addresses per computer, and all are in use.")
      const url = https === 443 ? `https://${HOST}` : `https://${HOST}:${https}`
      const others = funnels.filter((f) => f.tool !== id || f.profile !== profile)
      funnels.splice(0, funnels.length, ...others, { tool: id, profile, url, port, live: true })
      return url
    },
    async tailscaleFunnelClose(id, profile) {
      await delay(400)
      for (const f of funnels) if (f.tool === id && f.profile === profile) f.live = false
    },
    async tailscaleFunnels() {
      await delay(300)
      return funnels.map((f) => ({ ...f }))
    },
  }
}
