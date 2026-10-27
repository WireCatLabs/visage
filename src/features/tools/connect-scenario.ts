import { platform } from "@/platform/bridge"
import type { AppId } from "./connect-apps"

/**
 * Browser build only: `?connect=<state>` opens tg's "Connect an AI app" guide at that step, for review captures.
 * `choose`, `address` (with `?tailscale=<state>` for Tailscale's own steps), `starting`, `instructions`, `waiting`,
 * `unreached` (waiting long enough for the hints), `connected`, `called`, `oldcli`, `funnel-off`, `live`.
 * `?connect-app=claude|other` picks the app (ChatGPT otherwise). `?tailscale=<state>` alone opens it at the address.
 */
export type Scenario = { app: AppId | null; confirmed: boolean; added: boolean; quiet: boolean }

export function scenarioOf(id: string): Scenario | null {
  if (platform.kind !== "mock" || id !== "tg") return null
  const params = new URLSearchParams(window.location.search)
  const state =
    params.get("connect") ?? (params.has("tailscale") && params.get("tailscale") !== "leftover" ? "address" : null)
  if (state === null) return null
  const chosen = params.get("connect-app")
  const app: AppId = chosen === "claude" || chosen === "other" ? chosen : "chatgpt"
  return {
    app: state === "choose" ? null : app,
    confirmed: state === "starting",
    added: ["waiting", "unreached", "connected", "called", "oldcli", "live"].includes(state),
    quiet: state === "unreached",
  }
}
