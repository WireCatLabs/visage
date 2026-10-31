/** What the Search page shows of one hit. Every value is the tool's own text, shown as plain text only. */
export type HitRow = {
  key: string
  when: string | null
  /** The chat, mailbox subject, meeting or document the hit is in. */
  where: string | null
  who: string | null
  fromMe: boolean
  text: string | null
}

const str = (v: unknown) => (typeof v === "string" && v.trim() ? v : null)
const obj = (v: unknown) => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {})

// Messages carry chat_title and sender_name, mail adds email.subject, meetings, notes and documents a title or path.
export function hitRow(hit: Record<string, unknown>, index: number): HitRow {
  return {
    key: str(hit.ref) ?? str(hit.id) ?? `#${index}`,
    when: str(hit.timestamp) ?? str(hit.updated_at) ?? str(hit.started_at),
    where: str(obj(hit.email).subject) ?? str(hit.chat_title) ?? str(hit.title) ?? str(hit.path),
    who: str(hit.sender_name),
    fromMe: hit.sender_is_me === true,
    text: str(hit.excerpt) ?? str(hit.text),
  }
}

/**
 * The tool counts the span in the query it parsed; memo and drive count one or two places past the text typed, so the
 * span is kept inside the query and never points past its end.
 */
export function clampSpan(span: { start: number; end: number } | null, length: number) {
  if (!span) return null
  const start = Math.max(0, Math.min(span.start, length))
  return { start, end: Math.max(start, Math.min(span.end, length)) }
}

/** The closed reasons of cli-base's query language (`src/query/`); any other is shown in the tool's words. */
export const QUERY_REASONS = [
  "bare-word",
  "invalid-ast",
  "invalid-date",
  "invalid-escape",
  "invalid-number",
  "invalid-regex",
  "invalid-syntax",
  "invalid-tag",
  "invalid-timezone",
  "missing-value",
  "too-large",
  "unclosed-literal",
  "unknown-field",
  "unknown-value",
  "unsupported-field",
  "unsupported-operator",
  "unsupported-placement",
  "unsupported-regex",
  "unsupported-regex-flags",
  "unsupported-version",
] as const
export type QueryReason = (typeof QUERY_REASONS)[number]

export function queryReason(reason: string): QueryReason | null {
  const short = reason.startsWith("query.") ? reason.slice("query.".length) : reason
  return (QUERY_REASONS as readonly string[]).includes(short) ? (short as QueryReason) : null
}

/** "no field \"bogus\"" after the reason's own words: the part of the tool's message that names what was wrong. */
export function errorDetail(message: string): string | null {
  const dash = message.lastIndexOf(" — ")
  return dash >= 0 ? message.slice(dash + 3).trim() || null : null
}
