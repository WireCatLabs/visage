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

/** One row of the query bar's list. `whole` replaces the whole query; `open` keeps typing after it, no space. */
export type QueryOption = {
  label: string
  insert: string
  note?: string | null
  example?: string | null
  group?: string | null
  whole?: boolean
  open?: boolean
  /** The "More fields" row: shows the fields hidden at first, and inserts nothing. */
  more?: boolean
}
export type QueryOptions = { from: number; to: number; items: QueryOption[] }

export type FieldGroup = "who" | "where" | "when" | "what" | "files"
export const GROUPS: readonly FieldGroup[] = ["who", "where", "when", "what", "files"]

export type SearchFieldInfo = {
  name: string
  group: FieldGroup
  example: string
  top: boolean
}

export type SuggestWords = {
  group: Record<FieldGroup, string>
  describe: (field: string) => string | null
  more: string
  examplesHeading: string
  datesHeading: string
  valuesHeading: (field: string) => string
}

const pad = (n: number) => String(n).padStart(2, "0")
const day = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`

export type DateMeaning = "last7" | "last30" | "today" | "yesterday" | "thisMonth" | "since" | "between"

/** Each form checked against the installed tools: messages, notes, documents and mail take all of them. */
export function dateOptions(now: Date): { query: string; meaning: DateMeaning }[] {
  const first = new Date(now.getFullYear(), now.getMonth(), 1)
  const last = new Date(now.getFullYear(), now.getMonth() + 1, 0)
  return [
    { query: "date>=7d", meaning: "last7" },
    { query: "date>=30d", meaning: "last30" },
    { query: "date:today", meaning: "today" },
    { query: "date:yesterday", meaning: "yesterday" },
    { query: `date>=${day(first)}`, meaning: "thisMonth" },
    { query: `date:[${day(first)} TO *]`, meaning: "since" },
    { query: `date:[${day(first)} TO ${day(last)}]`, meaning: "between" },
  ]
}

export type ExampleId =
  | "photosWeek"
  | "filesMonth"
  | "links30"
  | "voice30"
  | "mailWeek"
  | "important30"
  | "invoice30"
  | "changed30"
  | "titled"
  | "words"

/** Ready queries the empty bar offers, each run against an installed tool's real data before it was listed. */
export function examples(what: string, now: Date): { query: string; id: ExampleId }[] {
  const first = day(new Date(now.getFullYear(), now.getMonth(), 1))
  if (what === "messages")
    return [
      { query: "has:photo date>=7d", id: "photosWeek" },
      { query: `has:file date:[${first} TO *]`, id: "filesMonth" },
      { query: "has:link date>=30d", id: "links30" },
      { query: "has:voice date>=30d", id: "voice30" },
    ]
  if (what === "mail")
    return [
      { query: "date>=7d", id: "mailWeek" },
      { query: "mailbox:important date>=30d", id: "important30" },
      { query: "invoice date>=30d", id: "invoice30" },
    ]
  if (what === "notes" || what === "documents")
    return [
      { query: "date>=30d", id: "changed30" },
      { query: "title:plan", id: "titled" },
    ]
  return [{ query: "demo", id: "words" }]
}

/**
 * A value as the tools' query parser reads it (cli-base `src/query/parser.ts`): a bare term stops at whitespace and at
 * its reserved characters (`+ - ! ( ) : = ^ @ < > [ ] " { } ~ \\ /`), a leading one is an operator, `*` and `?` make
 * a wildcard, and AND, OR and NOT are words of the language. Anything but letters, digits, `_` and inner dots is
 * therefore quoted, with `"` and `\\` escaped inside.
 */
export const quoteValue = (value: string) =>
  /^[\p{L}\p{N}_](?:[\p{L}\p{N}_.]*[\p{L}\p{N}_])?$/u.test(value) && !/^(AND|OR|NOT)$/.test(value)
    ? value
    : `"${value.replace(/[\\"]/g, (c) => `\\${c}`)}"`

/** One value a field can take: `value` goes in the query; `label` and `detail` (an @username) are what the row shows. */
export type ValueOption = { value: string; label?: string | null; detail?: string | null }

type Token = { start: number; end: number; raw: string }

// Whitespace ends a term except inside quotes or a [a TO b] range, so a value being typed stays one token.
function tokenAt(query: string, cursor: number): Token {
  let start = 0
  let quote = false
  let range = 0
  for (let i = 0; i <= query.length; i++) {
    const c = query[i]
    if (i === query.length || (/\s/.test(c ?? "") && !quote && range === 0)) {
      if (cursor >= start && cursor <= i) return { start, end: i, raw: query.slice(start, i) }
      start = i + 1
      continue
    }
    if (c === '"') quote = !quote
    else if (c === "[" && !quote) range++
    else if (c === "]" && !quote && range > 0) range--
  }
  return { start: cursor, end: cursor, raw: "" }
}

const fieldRow = (f: SearchFieldInfo, sign: string, words: SuggestWords): QueryOption => ({
  label: f.name === "date" ? "date" : `${f.name}:`,
  insert: f.name === "date" ? `${sign}date` : `${sign}${f.name}:`,
  note: words.describe(f.name),
  example: f.example,
  group: words.group[f.group],
  open: true,
})

const byGroup = (fields: SearchFieldInfo[]) =>
  [...fields].sort((a, b) => GROUPS.indexOf(a.group) - GROUPS.indexOf(b.group))

export type SuggestContext = {
  fields: SearchFieldInfo[]
  /** Every value a field can be given here: its fixed list, the tool's own list, and what the results show. */
  values: Readonly<Record<string, readonly ValueOption[]>>
  /** "More fields" was chosen: every field, not only the first few. */
  all: boolean
  now: Date
  words: SuggestWords
  dateWords: Record<DateMeaning, string>
  exampleWords: Record<ExampleId, string>
  what: string
}

export function suggestSearch(query: string, cursor: number, ctx: SuggestContext): QueryOptions {
  if (query.trim() === "") {
    const items = examples(ctx.what, ctx.now).map((e) => ({
      label: e.query,
      insert: e.query,
      note: ctx.exampleWords[e.id],
      group: ctx.words.examplesHeading,
      whole: true,
    }))
    return { from: 0, to: query.length, items }
  }
  const tok = tokenAt(query, cursor)
  const sign = /^[-+]/.test(tok.raw) ? (tok.raw[0] as string) : ""
  const body = tok.raw.slice(sign.length)
  const hasDate = ctx.fields.some((f) => f.name === "date")
  const at = { from: tok.start, to: tok.end }

  if (hasDate && /^date/i.test(body) && body.length >= 4) {
    const typed = body.toLowerCase()
    const items = dateOptions(ctx.now)
      .filter((o) => typed === "date" || typed === "date:" || (o.query.startsWith(typed) && o.query !== typed))
      .map((o) => ({
        label: o.query,
        insert: sign + o.query,
        note: ctx.dateWords[o.meaning],
        group: ctx.words.datesHeading,
      }))
    return { ...at, items }
  }

  const colon = body.indexOf(":")
  if (colon > 0) {
    const field = body.slice(0, colon).toLowerCase()
    const typed = body
      .slice(colon + 1)
      .replace(/^"/, "")
      .replace(/"$/, "")
      .toLowerCase()
    const all = ctx.values[field] ?? []
    const texts = (v: ValueOption) =>
      [v.label, v.detail, v.detail ? `@${v.detail}` : null, v.value]
        .filter(Boolean)
        .map((t) => (t as string).toLowerCase())
    const starts = all.filter((v) => texts(v).some((t) => t.startsWith(typed)))
    const contains = all.filter((v) => !starts.includes(v) && texts(v).some((t) => t.includes(typed)))
    const items = [...starts, ...contains]
      .filter((v) => v.value.toLowerCase() !== typed)
      .slice(0, 40)
      .map((v) => ({
        label: v.label ?? v.value,
        insert: `${sign}${field}:${quoteValue(v.value)}`,
        note: v.detail ? `@${v.detail.replace(/^@/, "")}` : null,
        example: v.label && v.label !== v.value ? v.value : null,
        group: ctx.words.valuesHeading(field),
      }))
    return { ...at, items }
  }

  const prefix = body.toLowerCase()
  if (prefix === "") {
    const shown = byGroup(ctx.all ? ctx.fields : ctx.fields.filter((f) => f.top))
    const items: QueryOption[] = shown.map((f) => fieldRow(f, sign, ctx.words))
    if (!ctx.all && shown.length < ctx.fields.length)
      items.push({ label: ctx.words.more, insert: "", more: true, group: null })
    return { ...at, items }
  }
  const items = byGroup(ctx.fields.filter((f) => f.name.startsWith(prefix) && f.name !== prefix)).map((f) =>
    fieldRow(f, sign, ctx.words),
  )
  return { ...at, items }
}

/**
 * The chat titles and sender names the shown hits carry. They only move matching list entries up: a title can name
 * two chats, so what goes in the query is always the list entry's id.
 */
export function valuesInHits(hits: readonly Record<string, unknown>[]): Record<string, string[]> {
  const seen: Record<string, Set<string>> = { chat: new Set(), from: new Set(), title: new Set() }
  for (const hit of hits) {
    const row = hitRow(hit, 0)
    if (typeof hit.chat_title === "string" && hit.chat_title.trim()) seen.chat?.add(hit.chat_title.trim())
    if (row.who && !row.fromMe) seen.from?.add(row.who)
    if (typeof hit.title === "string" && hit.title.trim()) seen.title?.add(hit.title.trim())
  }
  return Object.fromEntries(Object.entries(seen).map(([k, v]) => [k, [...v]]))
}

/**
 * The `field:` term an ambiguous name came from, so a choice can replace it. With several such terms, the one whose
 * value appears in a candidate's label; this reads the owner's own query, never the tool's answer.
 */
export function ambiguousTerm(
  query: string,
  field: string,
  labels: readonly (string | null)[],
): { start: number; end: number; sign: string } | null {
  const terms: Token[] = []
  for (let at = 0; at <= query.length; ) {
    const tok = tokenAt(query, at)
    if (tok.raw) terms.push(tok)
    at = tok.end + 1
  }
  const ofField = terms
    .map((t) => ({ ...t, sign: /^[-+]/.test(t.raw) ? (t.raw[0] as string) : "" }))
    .filter((t) => t.raw.slice(t.sign.length).toLowerCase().startsWith(`${field}:`))
  const typedIn = (t: Token & { sign: string }) =>
    t.raw
      .slice(t.sign.length + field.length + 1)
      .replace(/^"|"$/g, "")
      .replace(/^@/, "")
      .toLowerCase()
  const named = labels.filter((l): l is string => Boolean(l)).map((l) => l.toLowerCase())
  const found = ofField.find((t) => typedIn(t) !== "" && named.some((l) => l.includes(typedIn(t)))) ?? ofField[0]
  return found ? { start: found.start, end: found.end, sign: found.sign } : null
}
