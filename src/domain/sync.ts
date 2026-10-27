/** What a sync brings in and where, in the words the result uses. */
export type SyncWhat = "messages" | "files" | "meetings" | "notes and mail" | "mail"

export type SyncSummary = { new: number; places: number; failed: number; left: number; complete: boolean }

const WORDS: Record<SyncWhat, { one: string; many: string; place: [string, string] }> = {
  messages: { one: "new message", many: "new messages", place: ["chat", "chats"] },
  files: { one: "file", many: "files", place: ["folder", "folders"] },
  meetings: { one: "meeting", many: "meetings", place: ["meeting", "meetings"] },
  "notes and mail": { one: "new email or note", many: "new emails and notes", place: ["source", "sources"] },
  mail: { one: "new email", many: "new emails", place: ["account", "accounts"] },
}

const n = (count: number) => count.toLocaleString("en-US")
const plural = (count: number, [one, many]: [string, string]) => `${n(count)} ${count === 1 ? one : many}`

/** "Synced 1,240 new messages in 3 chats", or "Up to date: no new messages". */
export function resultLine(what: SyncWhat, s: SyncSummary): string {
  const w = WORDS[what]
  if (s.new === 0) return `Up to date: no ${w.many}`
  const where = s.places > 0 ? ` in ${plural(s.places, w.place)}` : ""
  return `Synced ${plural(s.new, [w.one, w.many])}${where}`
}

/** What is left after a finished sync, and what to do about it; null when nothing is. */
export function resultNext(what: SyncWhat, s: SyncSummary): string | null {
  const w = WORDS[what]
  const parts: string[] = []
  if (s.failed > 0) {
    const failedWhat = what === "meetings" ? "came with a warning" : "could not be read"
    parts.push(
      `${plural(s.failed, what === "meetings" ? [w.one, w.many] : w.place)} ${failedWhat}; the next sync tries again.`,
    )
  }
  if (s.left > 0) parts.push(`${plural(s.left, [w.one, w.many])} still to come: sync again to continue.`)
  else if (!s.complete && s.failed === 0) parts.push("There is more history: sync again to continue.")
  return parts.length > 0 ? parts.join(" ") : null
}

/** What the owner can do next once the sync reached its goal. */
export function doneNext(what: SyncWhat): string {
  return what === "meetings" ? "Your agents can read their transcripts now." : "Your agents can search them now."
}

export type SyncFailure = { message: string; code: string | null; reason: string | null; run: string | null }
export type Advice = {
  title: string
  text: string
  again: boolean
  signIn: boolean
  report: boolean
  /** Offer the tool's update, when there is one: the tool may be the side that is behind. */
  update?: boolean
}

const BUSY = new Set(["profile.locked", "sync.running", "device.in-use", "app.busy"])

/** A failure in plain words with the way out. The tool's own message stays one click away, not the headline. */
export function advice(f: SyncFailure, account: string): Advice {
  if (f.code === "timeout") {
    return {
      title: "Time limit reached",
      text: "What came in is kept. Sync again to continue from where it stopped.",
      again: true,
      signIn: false,
      report: false,
    }
  }
  if (f.reason && BUSY.has(f.reason)) {
    return {
      title: "Another sync is running",
      text: `Something else is syncing ${account} right now, or the tool is being updated. Sync again when it ends.`,
      again: true,
      signIn: false,
      report: false,
    }
  }
  if (f.code === "configuration_error" && /newer version|schema/.test(f.message)) {
    return {
      title: "Update needed",
      text: "A newer WireCat tool changed the storage. Update this tool on the Tools page, then sync again.",
      again: false,
      signIn: false,
      report: false,
    }
  }
  if (f.code === "authentication_error") {
    return {
      title: "Signed out",
      text: `Sign in to ${account} again, then sync.`,
      again: false,
      signIn: true,
      report: false,
    }
  }
  if (f.code === "rate_limited") {
    return {
      title: "The service asked to slow down",
      text: "What came in is kept. Wait a while, then sync again.",
      again: true,
      signIn: false,
      report: false,
    }
  }
  if (f.code === "network_error" || f.code === "provider_unavailable") {
    return {
      title: "The service could not be reached",
      text: "Check the internet connection, then sync again.",
      again: true,
      signIn: false,
      report: false,
    }
  }
  // The tool's own words can name chats or people (RISK-44), so a refusal is told in fixed words only.
  if (f.code === "validation_error" || f.reason === "input.invalid") {
    return {
      title: "The tool refused the command",
      text: "The tool did not accept the sync command WireCat sent. It is likely older or newer than this app expects.",
      again: false,
      signIn: false,
      report: true,
      update: true,
    }
  }
  const logs = f.code || f.run ? " Its run on the Logs page shows what happened." : ""
  return { title: "The sync failed", text: `${f.message}${logs}`, again: true, signIn: false, report: true }
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

/** "Chat 4 of 40 · 1,240 new messages"; null when the tool says nothing countable. */
export function progressLine(p: SyncProgress | null): string | null {
  if (!p) return null
  const fetched = `${n(p.fetched)} new ${p.fetched === 1 ? "message" : "messages"}`
  if (!p.chats || p.chatsDone === null) return fetched
  return `Chat ${n(Math.min(p.chats, p.chatsDone + 1))} of ${n(p.chats)} · ${fetched}`
}
