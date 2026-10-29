import type { TailscaleStatus } from "@/platform/tailscale-schemas"

export type StepId = "install" | "login" | "funnel" | "connect"

/** What is still missing; the guide says it in a sentence from its catalog. */
export type Missing =
  | "blocked"
  | "notInstalled"
  | "noOperator"
  | "notRunning"
  | "needsLogin"
  | "needsApproval"
  | "stopped"
  | "starting"
  | "unknown"
  | "noHttps"
  | "noFunnel"
  | "noHost"
  | "portsFull"

export type Step = {
  id: StepId
  done: boolean
  /** Null once done. */
  missing: Missing | null
}

function install(s: TailscaleStatus): Missing | null {
  if (!s.installed) return "notInstalled"
  if (s.operator === false) return "noOperator"
  return null
}

function login(s: TailscaleStatus): Missing | null {
  if (!s.daemon) return "notRunning"
  switch (s.backend) {
    case "running":
      return null
    case "needsLogin":
      return "needsLogin"
    case "needsApproval":
      return "needsApproval"
    case "stopped":
      return "stopped"
    case "starting":
      return "starting"
    default:
      return "unknown"
  }
}

function funnel(s: TailscaleStatus): Missing | null {
  if (!s.https) return "noHttps"
  if (!s.funnel) return "noFunnel"
  if (!s.host) return "noHost"
  return null
}

function connect(s: TailscaleStatus): Missing | null {
  return s.freePorts.length === 0 ? "portsFull" : null
}

/** A step is done only when every step before it is, so the guide always has one step to work on. */
export function stepsOf(s: TailscaleStatus): Step[] {
  const all: [StepId, (s: TailscaleStatus) => Missing | null][] = [
    ["install", install],
    ["login", login],
    ["funnel", funnel],
    ["connect", connect],
  ]
  let blocked = false
  return all.map(([id, check]) => {
    const missing: Missing | null = blocked ? "blocked" : check(s)
    blocked ||= missing !== null
    return { id, done: missing === null, missing }
  })
}

/**
 * The address Funnel will most likely get: the tool's path on the port the tools share, which Rust lists first, or on
 * a free one. Rust reuses this tool's last port when it can.
 */
export function addressOf(s: TailscaleStatus, tool: string): string | null {
  const port = s.freePorts[0]
  if (!s.host || port === undefined) return null
  return `${port === 443 ? `https://${s.host}` : `https://${s.host}:${port}`}/${tool}`
}
