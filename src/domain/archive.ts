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

export const DIMENSIONS: readonly Dimension[] = ["provider", "chatKind", "account", "year", "attachment"]

/** Product names, the same in every language; the other sources are named in `ArchiveWords.providers`. */
const PROVIDERS: Record<string, string> = {
  telegram: "Telegram",
  whatsapp: "WhatsApp",
  max: "MAX",
  email: "Email",
  "google-drive": "Google Drive",
  zoom: "Zoom",
}

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
export const TOTALS = ["messages", "chats", "emails", "documents", "meetings", "attachments", "accounts"] as const
export type TotalKey = (typeof TOTALS)[number]

export function totals(rows: Record<string, number>): { key: TotalKey; value: number }[] {
  return TOTALS.filter((key) => key in rows).map((key) => ({ key, value: rows[key] ?? 0 }))
}

export type Counted = "accounts" | "chats" | "messages" | "emails" | "documents" | "meetings"

/** The words of the breakdown, in the interface's language; the catalog is in `features/storage/messages.tsx`. */
export type ArchiveWords = {
  count: (what: Counted, n: number) => string
  via: (command: string) => string
  /** Sources that are not a product name, such as notes. */
  providers: Readonly<Record<string, string>>
  chatKinds: Readonly<Record<string, string>>
  /** `kind` is the tool's own word (photo, voice); `owner` is message, email, document or meeting. */
  attachment: (kind: string, owner: string) => string
}

const providerName = (p: string, w: ArchiveWords) => w.providers[p] ?? PROVIDERS[p] ?? p

export type BarRow = { id: string; label: string; detail: string; value: number; share: number }

function itemsOf(g: GroupLike, w: ArchiveWords): { value: number; detail: string } {
  const parts: [number, Counted][] = [
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
      .map(([c, what]) => w.count(what, c))
      .join(" · "),
  }
}

const withShares = (rows: Omit<BarRow, "share">[]): BarRow[] => {
  const max = rows.reduce((m, r) => Math.max(m, r.value), 1)
  return rows.map((r) => ({ ...r, share: r.value / max }))
}

const byValue = (a: { value: number }, b: { value: number }) => b.value - a.value

/** Rows for one dimension, largest first (years newest first). `formatBytes` sizes the files view. */
export function breakdownRows(
  b: BreakdownLike,
  dim: Dimension,
  formatBytes: (n: number) => string,
  w: ArchiveWords,
  formatNumber: (n: number) => string = String,
): BarRow[] {
  switch (dim) {
    case "provider":
      return withShares(
        b.providers
          .map((g) => {
            const { value, detail } = itemsOf(g, w)
            const via = collectedBy(g.provider)
            return {
              id: g.provider,
              label: providerName(g.provider, w),
              value,
              detail: [via ? w.via(via) : null, w.count("accounts", g.accounts), detail].filter(Boolean).join(" · "),
            }
          })
          .sort(byValue),
      )
    case "chatKind":
      return withShares(
        b.chatKinds
          .map((g) => ({
            id: `${g.provider}:${g.key}`,
            label: `${providerName(g.provider, w)} · ${w.chatKinds[g.key ?? "unknown"] ?? g.key}`,
            ...itemsOf(g, w),
          }))
          .sort(byValue),
      )
    case "account":
      return withShares(
        b.accounts
          .map((g, i) => ({
            id: `${g.provider}:${g.key}:${i}`,
            label: `${providerName(g.provider, w)} · ${g.key ?? "•••"}`,
            ...itemsOf(g, w),
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
              .map((g) => `${providerName(g.provider, w)} ${formatNumber(g.messages)}`)
              .join(" · "),
          })),
      )
    }
    case "attachment":
      return withShares(
        b.attachmentKinds
          .map((a) => ({
            id: `${a.owner}:${a.kind}`,
            label: w.attachment(a.kind, a.owner),
            value: a.count,
            detail: a.bytes > 0 ? formatBytes(a.bytes) : "",
          }))
          .sort(byValue),
      )
  }
}
