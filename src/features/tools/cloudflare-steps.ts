import type { CloudflareStatus } from "@/platform/cloudflare-schemas"

export type CloudflareStepId = "install" | "account" | "address"

export type CloudflareStep = { id: CloudflareStepId; title: string; done: boolean; missing: string | null }

function install(s: CloudflareStatus): string | null {
  if (!s.supported) return "Cloudflare publishes no cloudflared for this computer's processor."
  return s.installed ? null : "cloudflared is not on this computer yet."
}

/** Logged in with no tunnel yet, or a tunnel exists: its login was used up making it. */
const account = (s: CloudflareStatus) =>
  s.signedIn || s.hostname !== null ? null : "WireCat is not connected to a Cloudflare account yet."

/** Logged in again while a tunnel exists means the owner is choosing another name. */
const address = (s: CloudflareStatus) =>
  s.hostname !== null && !s.signedIn ? null : "There is no address on your domain yet."

/** A step is done only when every step before it is, as in the Tailscale guide. */
export function cloudflareSteps(s: CloudflareStatus): CloudflareStep[] {
  const all: [CloudflareStepId, string, (s: CloudflareStatus) => string | null][] = [
    ["install", "Download cloudflared", install],
    ["account", "Connect your Cloudflare account", account],
    ["address", "Choose the address", address],
  ]
  let blocked = false
  return all.map(([id, title, check]) => {
    const missing = blocked ? "Waits for the step before it." : check(s)
    blocked ||= missing !== null
    return { id, title, done: missing === null, missing }
  })
}
