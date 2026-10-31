import { findTool } from "@/domain/catalog"
import { delay } from "./mock-delay"
import type { SearchAnswer, SearchHit } from "./search-schemas"
import type { Platform } from "./types"

// Fictional stores for the browser build. `?search=<tool>` opens the page on that tool's hits, `?search=empty` on a
// query nothing matches, `?search-fail=query` on a query the tool refuses with a span, `?search-fail=tool` on the
// tool's own refusal, `?search-old=<tool>` makes that tool too old to search. Anywhere, a field the tool does not know
// or an unclosed bracket gets the tool's query error, so the bar can be tried by typing.
const params = new URLSearchParams(typeof window === "undefined" ? "" : window.location.search)
const TOTAL = 128

const CHATS = ["Harbour flat", "Design crit", "Family", "Climbing club", "Accountant"]
const PEOPLE = ["Ana Ruiz", "Marco Bellini", "Jo Park", "Lena Vogel", "You"]
const LINES = [
  "Sent the invoice for October, can you check the VAT line?",
  "The invoice is attached, due on the 15th",
  "Let's move the review to Thursday, the invoice can wait",
  "Found the old invoice from the landlord in the shared folder",
  "Draft is ready, invoice numbers start at 2026-041",
]
const TITLES = ["Quarterly plan", "Invoice template", "Harbour flat lease", "Weekly sync", "Tax checklist"]

function hit(what: string, i: number): SearchHit {
  const at = new Date(Date.UTC(2026, 9, 30, 18, 0) - i * 7.3 * 3600_000).toISOString()
  const line = LINES[i % LINES.length]
  if (what === "messages")
    return {
      ref: `msg:telegram/1/-100${i}/${4000 + i}`,
      timestamp: at,
      chat_title: CHATS[i % CHATS.length],
      sender_name: PEOPLE[i % PEOPLE.length],
      sender_is_me: i % PEOPLE.length === 4,
      excerpt: line,
      matched_in: "text",
      score: Math.round((1 - i / TOTAL) * 1000) / 1000,
      untrusted: ["chat_title", "sender_name", "excerpt"],
    }
  if (what === "mail")
    return {
      ref: `msg:email/personal/INBOX/${9000 + i}`,
      timestamp: at,
      chat_title: "INBOX",
      sender_name: PEOPLE[i % 4],
      excerpt: line,
      email: { subject: `Re: ${TITLES[i % TITLES.length]}`, from: "ana@example.com", labels: ["inbox"] },
      untrusted: ["chat_title", "sender_name", "excerpt"],
    }
  if (what === "meetings")
    return {
      kind: "meeting",
      ref: `meeting:${i}/${100 + i}`,
      title: TITLES[i % TITLES.length],
      timestamp: at,
      excerpt: line,
      offset_ms: 60_000 * (i % 40),
      scope: "transcript",
      untrusted: ["title", "excerpt"],
    }
  return {
    ref: `document:${200 + i}`,
    kind: what === "notes" ? "note" : "document",
    title: TITLES[i % TITLES.length],
    path: `${TITLES[i % TITLES.length]}.md`,
    updated_at: at,
    excerpt: line,
    found_by: ["words"],
  }
}

function refusal(id: string, query: string): SearchAnswer | null {
  const open = query.lastIndexOf("(")
  if (open >= 0 && !query.slice(open).includes(")"))
    return {
      kind: "queryError",
      reason: "query.invalid-syntax",
      message: `search: query.invalid-syntax at position ${query.length + 1}`,
      span: { start: query.length, end: query.length },
    }
  const fields = findTool(id)?.search?.fields ?? []
  for (const m of query.matchAll(/(^|[\s(])-?([a-z_]+):/g)) {
    const field = m[2] ?? ""
    if (fields.includes(field)) continue
    const start = (m.index ?? 0) + (m[1]?.length ?? 0)
    const end = query.slice(start).search(/\s|$/) + start
    return {
      kind: "queryError",
      reason: "query.unknown-field",
      message: `search: query.unknown-field at position ${start + 1} — no field "${field}"`,
      span: { start, end },
    }
  }
  return null
}

export const searchMock: Pick<Platform, "searchStore"> = {
  async searchStore(id, _profile, query, limit, page) {
    await delay(700)
    const tool = findTool(id)
    const search = tool?.search
    if (!tool || !search) throw new Error("This tool cannot search its local data.")
    if (params.get("search-old") === id) return { kind: "old", message: "unknown option '--offline'" }
    if (params.get("search-fail") === "tool")
      return {
        kind: "failed",
        message: `nothing recorded for profile "personal" yet — log in with \`${tool.bin} personal setup\``,
      }
    const refused = refusal(id, query)
    if (refused) return refused
    const paged = search.args.includes("{page}")
    const total = params.get("search") === "empty" ? 0 : paged ? TOTAL : limit
    const from = (page - 1) * limit
    const hits = Array.from({ length: Math.max(0, Math.min(limit, total - from)) }, (_, i) =>
      hit(search.what, from + i),
    )
    const notes =
      search.what === "messages" && total > 0
        ? ["searched 12,480 messages in 64 chats — 3 never fetched, 5 behind"]
        : []
    return { kind: "hits", hits, hasMore: paged && from + limit < total, paged, notes }
  },
}
