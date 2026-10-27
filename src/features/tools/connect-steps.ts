import type { McpClient, McpServerStatus, PublicCheck } from "@/platform/mcp-server-schemas"
import type { AppId } from "./connect-apps"

export type ConnectStepId = "choose" | "address" | "start" | "reach" | "connect" | "test"

export const STEP_TITLES: Record<ConnectStepId, string> = {
  choose: "Choose the app",
  address: "Public address",
  start: "Start the server",
  reach: "Check the address",
  connect: "Add it in the app",
  test: "Test it",
}

const ORDER: ConnectStepId[] = ["choose", "address", "start", "reach", "connect", "test"]

export type Progress = {
  app: AppId | null
  /** Tailscale's own steps are all done, or the owner typed the address of a tunnel they run. */
  addressReady: boolean
  server: McpServerStatus | null
  /** Public DNS has the name (or no DNS service answered and the owner chose to go on). */
  reached: boolean
  /** The owner said they added the server in the app, or an app already logged in. */
  added: boolean
}

export const serving = (s: McpServerStatus | null): s is McpServerStatus & { connectorUrl: string } =>
  s?.running === true && s.listening && s.connectorUrl !== null

/** The first step that is not done. A running server counts as both an address and a start. */
export function currentStep(p: Progress): ConnectStepId {
  if (p.app === null) return "choose"
  if (!serving(p.server) && !p.addressReady) return "address"
  if (!serving(p.server)) return "start"
  if (!p.reached) return "reach"
  if (!p.added) return "connect"
  return "test"
}

export type StepState = "done" | "current" | "todo"

/** `finished`: the last step is done too, so every step is a tick. */
export function stepStates(
  current: ConnectStepId,
  finished = false,
): { id: ConnectStepId; title: string; state: StepState }[] {
  const at = finished ? ORDER.length : ORDER.indexOf(current)
  return ORDER.map((id, i) => ({
    id,
    title: STEP_TITLES[id],
    state: i < at ? "done" : i === at ? "current" : "todo",
  }))
}

const after = (iso: string | null, since: number) => iso !== null && Date.parse(iso) >= since - 2000

export type TestState =
  | { state: "waiting" }
  /** Logged in after the guide opened, or reached the server since. */
  | { state: "connected"; client: McpClient; counts: boolean }
  | { state: "called"; client: McpClient }

/**
 * What the app has done since the guide opened. Apps that logged in earlier do not count, so an old login is not
 * mistaken for this one; any of them calling a tool now does. `counts` is false for a tool too old to report calls.
 */
export function testState(server: McpServerStatus | null, since: number): TestState {
  const clients = server?.clients ?? []
  const called = clients.find((c) => after(c.lastToolAt, since))
  if (called) return { state: "called", client: called }
  const joined = clients.find((c) => after(c.lastLoginAt, since) || after(c.lastRequestAt, since))
  if (joined) return { state: "connected", client: joined, counts: joined.toolCallsToday !== null }
  return { state: "waiting" }
}

/** "just now", "4 min ago", "3 h ago", "2 days ago". */
export function ago(iso: string, now = Date.now()): string {
  const seconds = Math.max(0, Math.round((now - Date.parse(iso)) / 1000))
  if (seconds < 60) return "just now"
  const minutes = Math.round(seconds / 60)
  if (minutes < 60) return `${minutes} min ago`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours} h ago`
  const days = Math.round(hours / 24)
  return days === 1 ? "yesterday" : `${days} days ago`
}

/** The app's name as it gave it; anyone may register any name, so the interface always says "calls itself". */
export const appLabel = (c: McpClient) => (c.claimedName === null ? "An app with no name" : `“${c.claimedName}”`)

/** One line for a logged-in app: "last call 2 min ago · tg_read · 14 today", or when it last logged in. */
export function activityOf(c: McpClient, now = Date.now()): string {
  if (c.lastTool && c.lastToolAt) {
    const today = c.toolCallsToday ? ` · ${c.toolCallsToday} today` : ""
    return `last call ${ago(c.lastToolAt, now)} · ${c.lastTool}${today}`
  }
  if (c.lastRequestAt) return `connected ${ago(c.lastRequestAt, now)}, no calls yet`
  return `logged in ${ago(c.lastLoginAt, now)}`
}

/** The app that used the server last, for the tool's row on the Tools page. */
export function busiest(s: McpServerStatus | null): McpClient | null {
  if (!s?.running) return null
  const used = s.clients.filter((c) => c.lastToolAt !== null)
  return used.sort((a, b) => (b.lastToolAt ?? "").localeCompare(a.lastToolAt ?? ""))[0] ?? null
}

export type ReachState =
  | { state: "checking" }
  /** Tailscale has not published the name yet: wait, it can take up to 10 minutes. */
  | { state: "publishing" }
  | { state: "live"; tested: boolean }
  /** Something else answers on the address. */
  | { state: "wrong"; status: number }
  /** No public DNS service answered from this computer, so nothing can be said. */
  | { state: "unknown" }

/** Live once public DNS has the name; the fetch from here is a bonus, since a computer often cannot reach itself. */
export function reachOf(check: PublicCheck | null): ReachState {
  if (!check) return { state: "checking" }
  if (check.dns === "missing") return { state: "publishing" }
  if (check.dns === "unknown") return { state: "unknown" }
  if (check.answer.kind === "wrong") return { state: "wrong", status: check.answer.status }
  return { state: "live", tested: check.answer.kind === "ok" }
}
