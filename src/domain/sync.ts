/** What a sync brings in and where, in the words the result uses. */
export type SyncWhat = "messages" | "files" | "meetings" | "notes and mail" | "mail"

export type SyncSummary = { new: number; places: number; failed: number; left: number; complete: boolean }

export type SyncFailure = { message: string; code: string | null; reason: string | null; run: string | null }

/** Why a sync failed, in the categories the interface explains; `failed` shows the tool's own message. */
export type AdviceKind =
  | "timeout"
  | "busy"
  | "update"
  | "signedOut"
  | "rateLimited"
  | "unreachable"
  | "refused"
  | "failed"

export type Advice = {
  kind: AdviceKind
  again: boolean
  signIn: boolean
  report: boolean
  /** Offer the tool's update, when there is one: the tool may be the side that is behind. */
  update?: boolean
  /** The run is on the Logs page, so the text can point there. */
  logs?: boolean
}

const BUSY = new Set(["profile.locked", "sync.running", "device.in-use", "app.busy"])

/** A failure sorted into the way out. The tool's own message stays one click away, not the headline. */
export function advice(f: SyncFailure): Advice {
  const plain = { again: false, signIn: false, report: false }
  if (f.code === "timeout") return { ...plain, kind: "timeout", again: true }
  if (f.reason && BUSY.has(f.reason)) return { ...plain, kind: "busy", again: true }
  if (f.code === "configuration_error" && /newer version|schema/.test(f.message)) return { ...plain, kind: "update" }
  if (f.code === "authentication_error") return { ...plain, kind: "signedOut", signIn: true }
  if (f.code === "rate_limited") return { ...plain, kind: "rateLimited", again: true }
  if (f.code === "network_error" || f.code === "provider_unavailable")
    return { ...plain, kind: "unreachable", again: true }
  // The tool's own words can name chats or people (RISK-44), so a refusal is told in fixed words only.
  if (f.code === "validation_error" || f.reason === "input.invalid")
    return { ...plain, kind: "refused", report: true, update: true }
  return { ...plain, kind: "failed", again: true, report: true, logs: Boolean(f.code || f.run) }
}

/** "0:42", "12:05", "1:02:09": elapsed time with a steady width per magnitude. */
export function clock(ms: number): string {
  const total = Math.floor(ms / 1000)
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = String(total % 60).padStart(2, "0")
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${s}` : `${m}:${s}`
}

export type SyncProgress = { chats: number | null; chatsDone: number | null; fetched: number }

/** The bar's share done, when the tool counts chats; null keeps it indeterminate. */
export function share(p: SyncProgress | null): number | null {
  if (!p?.chats || p.chatsDone === null) return null
  return Math.min(100, Math.round((p.chatsDone / p.chats) * 100))
}
