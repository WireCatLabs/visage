import type { CloudflareStatus, TunnelRoute } from "./cloudflare-schemas"
import { delay } from "./mock-delay"
import type { Platform } from "./types"

// `?cloudflare=<state>` opens tg's "Connect an AI app" guide at its address step with the Cloudflare tunnel chosen:
// `missing` (cloudflared not downloaded), `unsupported` (no build for this processor), `loggedout`, `noaddress`
// (logged in, no tunnel yet), `ready` (the tunnel exists). `?cloudflare-os=macos|windows` changes the system.
// `?cloudflare-fail=install|login|address|tunnel` makes that action fail: the download's checksum, the login, a name
// outside the domain chosen at login, cloudflared not reaching Cloudflare. `?connect=tunnel-off`: tg's server runs on
// the tunnel's address, but cloudflared is not running (after a restart of the computer). Logging in finishes by
// itself after a few seconds.

const params = new URLSearchParams(typeof window === "undefined" ? "" : window.location.search)
export const TUNNEL_HOST = "wirecat.example.com"

function initial(): CloudflareStatus {
  const os = (["macos", "windows"] as const).find((o) => o === params.get("cloudflare-os")) ?? "linux"
  const ready: CloudflareStatus = {
    os,
    supported: true,
    installed: true,
    version: "2026.10.5",
    signedIn: false,
    hostname: TUNNEL_HOST,
    running: false,
  }
  switch (params.get("cloudflare")) {
    case "missing":
      return { ...ready, installed: false, version: null, hostname: null }
    case "unsupported":
      return { ...ready, supported: false, installed: false, version: null, hostname: null }
    case "loggedout":
      return { ...ready, hostname: null }
    case "noaddress":
      return { ...ready, signedIn: true, hostname: null }
    default:
      return ready
  }
}

export function cloudflareMock(): Pick<
  Platform,
  | "cloudflareStatus"
  | "cloudflareInstall"
  | "cloudflareLogin"
  | "cloudflareStop"
  | "cloudflareCreate"
  | "cloudflareTunnelOpen"
  | "cloudflareTunnelClose"
  | "cloudflareRoutes"
> {
  let state = initial()
  let stopped = false
  const fail = params.get("cloudflare-fail")
  const routes: TunnelRoute[] = []
  if (params.get("connect") === "tunnel-off")
    routes.push({ tool: "tg", url: `https://${TUNNEL_HOST}/tg`, port: 8765, live: false })

  return {
    async cloudflareStatus() {
      await delay(400)
      return { ...state, running: routes.some((r) => r.live) }
    },
    async cloudflareInstall() {
      stopped = false
      await delay(2000)
      if (stopped) throw new Error("Stopped.")
      if (fail === "install")
        throw new Error(
          "The download of cloudflared-linux-amd64 does not match GitHub's checksum, so it was not kept. Try again.",
        )
      state = { ...state, installed: true, version: "2026.10.5" }
      return "2026.10.5"
    },
    async cloudflareLogin(onPage) {
      stopped = false
      await delay(800)
      onPage("https://dash.cloudflare.com/argotunnel?aud=&callback=https%3A%2F%2Flogin.cloudflareaccess.org%2Fq7")
      for (let i = 0; i < 8; i++) {
        await delay(500)
        if (stopped) throw new Error("Stopped.")
      }
      if (fail === "login") throw new Error("Cloudflare did not log in: Failed to write the certificate.")
      state = { ...state, signedIn: true }
    },
    async cloudflareStop() {
      stopped = true
    },
    async cloudflareCreate(hostname) {
      await delay(2200)
      const host = hostname.trim().toLowerCase().replace(/\.$/, "")
      if (host.split(".").length < 3)
        throw new Error(
          `“${hostname}” is not a name on a domain. Use a new name under your domain, such as wirecat.example.com.`,
        )
      if (fail === "address")
        throw new Error(
          `${host} is not on the domain you chose when you connected Cloudflare, so Cloudflare added ${host}.example.com instead. Delete that record on Cloudflare's DNS page, then choose a name under the domain you connected.`,
        )
      state = { ...state, signedIn: false, hostname: host }
      return host
    },
    async cloudflareTunnelOpen(id, port) {
      await delay(1800)
      if (fail === "tunnel")
        throw new Error(
          "cloudflared did not reach Cloudflare in 30 seconds. Check the internet connection and try again.",
        )
      const url = `https://${state.hostname ?? TUNNEL_HOST}/${id}`
      const others = routes.filter((r) => r.tool !== id).map((r) => ({ ...r, live: true }))
      routes.splice(0, routes.length, ...others, { tool: id, url, port, live: true })
      return url
    },
    async cloudflareTunnelClose(id) {
      await delay(500)
      const others = routes.filter((r) => r.tool !== id)
      routes.splice(0, routes.length, ...others)
    },
    async cloudflareRoutes() {
      await delay(300)
      return routes.map((r) => ({ ...r }))
    },
  }
}
