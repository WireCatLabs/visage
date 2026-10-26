import type { TailscaleStatus } from "@/platform/tailscale-schemas"

export type StepId = "install" | "login" | "funnel" | "connect"

export type Step = {
  id: StepId
  title: string
  done: boolean
  /** What is still missing, in a sentence; null once done. */
  missing: string | null
}

function install(s: TailscaleStatus): string | null {
  if (!s.installed) return "Tailscale is not installed on this computer."
  if (s.operator === false) return "Tailscale is installed, but only the administrator may change its settings."
  return null
}

function login(s: TailscaleStatus): string | null {
  if (!s.daemon) return "Tailscale is installed but not running."
  switch (s.backend) {
    case "running":
      return null
    case "needsLogin":
      return "This computer is not logged in to Tailscale."
    case "needsApproval":
      return "Your Tailscale network's admin has not approved this computer yet."
    case "stopped":
      return "Tailscale is turned off on this computer."
    case "starting":
      return "Tailscale is still connecting."
    default:
      return "Tailscale did not say whether it is logged in."
  }
}

function funnel(s: TailscaleStatus): string | null {
  if (!s.https) return "HTTPS certificates are off for your Tailscale network."
  if (!s.funnel) return "Your Tailscale network does not allow Funnel yet."
  if (!s.host) return "This computer has no Tailscale name. Turn on MagicDNS."
  return null
}

function connect(s: TailscaleStatus): string | null {
  return s.freePorts.length === 0
    ? "All of Funnel's public addresses on this computer are in use. Stop another server, or remove a Funnel you set up yourself."
    : null
}

/** A step is done only when every step before it is, so the guide always has one step to work on. */
export function stepsOf(s: TailscaleStatus): Step[] {
  const all: [StepId, string, (s: TailscaleStatus) => string | null][] = [
    ["install", "Install Tailscale", install],
    ["login", "Log in to Tailscale", login],
    ["funnel", "Allow Funnel", funnel],
    ["connect", "Connect this server", connect],
  ]
  let blocked = false
  return all.map(([id, title, check]) => {
    const missing = blocked ? "Waits for the step before it." : check(s)
    blocked ||= missing !== null
    return { id, title, done: missing === null, missing }
  })
}

/** The address Funnel will most likely get: Rust picks the port, reusing this server's last one when it is free. */
export function addressOf(s: TailscaleStatus): string | null {
  const port = s.freePorts[0]
  if (!s.host || port === undefined) return null
  return port === 443 ? `https://${s.host}` : `https://${s.host}:${port}`
}
