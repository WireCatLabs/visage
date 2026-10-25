// What the shared archive holds, shaped for the Storage page. Plain data in, rows out.

export type GroupLike = {
  provider: string
  key: string | null
  accounts: number
  chats: number
  messages: number
  emails: number
  documents: number
  meetings: number
}

export type BreakdownLike = {
  providers: readonly GroupLike[]
  chatKinds: readonly GroupLike[]
  accounts: readonly GroupLike[]
  years: readonly GroupLike[]
  attachmentKinds: readonly { owner: string; kind: string; count: number; bytes: number }[]
}

export type Dimension = "provider" | "chatKind" | "account" | "year" | "attachment"

export const DIMENSIONS: readonly { id: Dimension; label: string }[] = [
  { id: "provider", label: "Source" },
  { id: "chatKind", label: "Chat type" },
  { id: "account", label: "Account" },
  { id: "year", label: "Year" },
  { id: "attachment", label: "Files" },
]

const PROVIDERS: Record<string, string> = {
  telegram: "Telegram",
  whatsapp: "WhatsApp",
  max: "MAX",
  email: "Email",
  "google-drive": "Google Drive",
  zoom: "Zoom",
  notes: "Notes",
  chat: "Chat",
}

const CHAT_KINDS: Record<string, string> = {
  dialog: "One-to-one",
  group: "Groups",
  channel: "Channels",
  saved: "Saved messages",
  unknown: "Unknown kind",
}

const OWNERS: Record<string, string> = {
  message: "messages",
  email: "emails",
  document: "documents",
  meeting: "meetings",
}

export const providerName = (p: string) => PROVIDERS[p] ?? p

/** The command that collects each source into storage, so a number can be traced to the tool that wrote it. */
const COLLECTED_BY: Record<string, string> = {
  telegram: "tg",
  whatsapp: "wa",
  max: "max",
  email: "memo mail",
  "google-drive": "drive",
  zoom: "zm",
  notes: "memo",
}

export const collectedBy = (p: string): string | null => COLLECTED_BY[p] ?? null

/** Totals in the order the page shows them; only the tables this store has. */
export const TOTALS: readonly { key: string; label: string }[] = [
  { key: "messages", label: "Messages" },
  { key: "chats", label: "Chats" },
  { key: "emails", label: "Emails" },
  { key: "documents", label: "Documents" },
  { key: "meetings", label: "Meetings" },
  { key: "attachments", label: "Attachments" },
  { key: "accounts", label: "Accounts" },
]

export function totals(rows: Record<string, number>) {
  return TOTALS.filter((t) => t.key in rows).map((t) => ({ ...t, value: rows[t.key] ?? 0 }))
}

export type BarRow = { id: string; label: string; detail: string; value: number; share: number }

const n = (x: number) => x.toLocaleString("en-US")

function itemsOf(g: GroupLike): { value: number; detail: string } {
  const parts: [number, string][] = [
    [g.chats, "chats"],
    [g.messages, "messages"],
    [g.emails, "emails"],
    [g.documents, "documents"],
    [g.meetings, "meetings"],
  ]
  return {
    value: g.messages + g.emails + g.documents + g.meetings,
    detail: parts
      .filter(([c]) => c > 0)
      .map(([c, w]) => `${n(c)} ${c === 1 ? w.slice(0, -1) : w}`)
      .join(" · "),
  }
}

const withShares = (rows: Omit<BarRow, "share">[]): BarRow[] => {
  const max = rows.reduce((m, r) => Math.max(m, r.value), 1)
  return rows.map((r) => ({ ...r, share: r.value / max }))
}

const byValue = (a: { value: number }, b: { value: number }) => b.value - a.value

/** Rows for one dimension, largest first (years newest first). `formatBytes` sizes the files view. */
export function breakdownRows(b: BreakdownLike, dim: Dimension, formatBytes: (n: number) => string): BarRow[] {
  switch (dim) {
    case "provider":
      return withShares(
        b.providers
          .map((g) => {
            const { value, detail } = itemsOf(g)
            const accounts = `${g.accounts} ${g.accounts === 1 ? "account" : "accounts"}`
            const via = collectedBy(g.provider)
            return {
              id: g.provider,
              label: providerName(g.provider),
              value,
              detail: [via ? `via ${via}` : null, accounts, detail].filter(Boolean).join(" · "),
            }
          })
          .sort(byValue),
      )
    case "chatKind":
      return withShares(
        b.chatKinds
          .map((g) => ({
            id: `${g.provider}:${g.key}`,
            label: `${providerName(g.provider)} · ${CHAT_KINDS[g.key ?? "unknown"] ?? g.key}`,
            ...itemsOf(g),
          }))
          .sort(byValue),
      )
    case "account":
      return withShares(
        b.accounts
          .map((g, i) => ({
            id: `${g.provider}:${g.key}:${i}`,
            label: `${providerName(g.provider)} · ${g.key ?? "•••"}`,
            ...itemsOf(g),
          }))
          .sort(byValue),
      )
    case "year": {
      const years = new Map<string, GroupLike[]>()
      for (const g of b.years) years.set(g.key ?? "?", [...(years.get(g.key ?? "?") ?? []), g])
      return withShares(
        [...years]
          .sort(([a], [z]) => z.localeCompare(a))
          .map(([year, groups]) => ({
            id: year,
            label: year,
            value: groups.reduce((s, g) => s + g.messages, 0),
            detail: [...groups]
              .sort((a, z) => z.messages - a.messages)
              .map((g) => `${providerName(g.provider)} ${n(g.messages)}`)
              .join(" · "),
          })),
      )
    }
    case "attachment":
      return withShares(
        b.attachmentKinds
          .map((a) => ({
            id: `${a.owner}:${a.kind}`,
            label: `${a.kind[0]?.toUpperCase() ?? ""}${a.kind.slice(1)} in ${OWNERS[a.owner] ?? a.owner}`,
            value: a.count,
            detail: a.bytes > 0 ? formatBytes(a.bytes) : "",
          }))
          .sort(byValue),
      )
  }
}

/** What the value of a dimension's rows counts, for the column header. */
export const UNIT: Record<Dimension, string> = {
  provider: "items",
  chatKind: "messages",
  account: "items",
  year: "messages",
  attachment: "files",
}
