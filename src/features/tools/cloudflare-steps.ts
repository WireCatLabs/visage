import type { CloudflareStatus } from "@/platform/cloudflare-schemas"

export type CloudflareStepId = "install" | "account" | "address"

export type CloudflareMissing = "blocked" | "unsupported" | "notInstalled" | "noAccount" | "noAddress"

export type CloudflareStep = { id: CloudflareStepId; done: boolean; missing: CloudflareMissing | null }

function install(s: CloudflareStatus): CloudflareMissing | null {
  if (!s.supported) return "unsupported"
  return s.installed ? null : "notInstalled"
}

/** Logged in with no tunnel yet, or a tunnel exists: its login was used up making it. */
const account = (s: CloudflareStatus): CloudflareMissing | null =>
  s.signedIn || s.hostname !== null ? null : "noAccount"

/** Logged in again while a tunnel exists means the owner is choosing another name. */
const address = (s: CloudflareStatus): CloudflareMissing | null =>
  s.hostname !== null && !s.signedIn ? null : "noAddress"

/** A step is done only when every step before it is, as in the Tailscale guide. */
export function cloudflareSteps(s: CloudflareStatus): CloudflareStep[] {
  const all: [CloudflareStepId, (s: CloudflareStatus) => CloudflareMissing | null][] = [
    ["install", install],
    ["account", account],
    ["address", address],
  ]
  let blocked = false
  return all.map(([id, check]) => {
    const missing: CloudflareMissing | null = blocked ? "blocked" : check(s)
    blocked ||= missing !== null
    return { id, done: missing === null, missing }
  })
}
