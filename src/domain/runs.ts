// The Logs explorer's query language, facets and grouping, over runs already fetched from the tools.
// Syntax, close to the WireCat search language: `status:failed cli_command:"tg chats*" -profile:work duration_ms:>1000`.
// Terms are ANDed, except that several plain values of one field mean "any of them", so facet clicks add up.

export type Run = {
  tool: string
  run_id: string
  command: string
  status: string
  started_at: string
  profile?: string | undefined
  duration_ms?: number | undefined
  error_code?: string | undefined
  [key: string]: unknown
}

export type Op = "=" | ">" | "<" | ">=" | "<="
export type Term =
  | { kind: "field"; field: string; value: string; op: Op; negate: boolean; start: number; end: number; raw: string }
  | { kind: "text"; value: string; negate: boolean; start: number; end: number; raw: string }

export type QueryProblem = { start: number; end: number; message: string }
export type Parsed = { terms: Term[]; problems: QueryProblem[] }

/** The fields a facet column shows, in order. */
export const FACETS = [
  "tool",
  "status",
  "cli_command",
  "profile",
  "agent",
  "error_code",
  "error.class",
  "error.http.status",
] as const
export const FACET_LABELS: Record<string, string> = {
  tool: "Tool",
  status: "Status",
  cli_command: "Command",
  command: "Subcommand",
  error_code: "Error code",
  profile: "Profile",
  agent: "Agent",
  session_id: "Agent session",
  "error.class": "Error class",
  "error.http.status": "HTTP status",
  cli_version: "Version",
}

// Short names for fields a run keeps nested; `valuesAt` reads them at their real path.
const PATHS: Record<string, string> = { agent: "agent.kind", session_id: "agent.session_id" }

// A tool records `command` without its own name ("chats list"), except when it recognised no command at all: then
// it records the bare name ("tg"). Prefixing the name keeps tg and max commands apart in facets and groups.
export function cliCommand(bin: string, command: string): string {
  const c = command.trim()
  if (!c) return bin
  return c === bin || c.startsWith(`${bin} `) ? c : `${bin} ${c}`
}

/** Which coding agent started the run, from CLIs that record it; older runs have none. */
export type RunAgent = { kind: string; session: string | null }
export function agentOf(run: Run): RunAgent | null {
  const a = run.agent
  if (!a || typeof a !== "object") return null
  const { kind, session_id } = a as Record<string, unknown>
  if (typeof kind !== "string" || !kind) return null
  return { kind, session: typeof session_id === "string" && session_id ? session_id : null }
}

const AGENT_NAMES: Record<string, string> = {
  "claude-code": "Claude Code",
  codex: "Codex",
  "gemini-cli": "Gemini CLI",
  cursor: "Cursor",
  opencode: "OpenCode",
}
export const agentName = (kind: string) => AGENT_NAMES[kind] ?? kind
/** Enough of a session id to tell sessions apart in a column; the whole id is one click away. */
export const shortSession = (id: string) => id.slice(0, 8)

/** The command line as the tool kept it, values that may be content already masked by the tool. */
export function commandLine(run: Run): string | null {
  if (!Array.isArray(run.argv) || !run.argv.every((w) => typeof w === "string")) return null
  const bin = (typeof run.cli_command === "string" ? run.cli_command : run.command).split(" ")[0] ?? ""
  return [bin, ...(run.argv as string[]).map(shellWord)].filter(Boolean).join(" ")
}
const shellWord = (w: string) => (w === "" || /[^\w@%+=:,./[\]-]/.test(w) ? `'${w.replace(/'/g, "'\\''")}'` : w)

type Maybe<T> = T | undefined
export type RunError = {
  class: string
  code?: Maybe<string>
  message?: Maybe<string>
  operation?: Maybe<string>
  http?: { method?: Maybe<string>; endpoint?: Maybe<string>; status?: Maybe<number> }
  provider?: { key?: Maybe<string>; code?: Maybe<number> }
  causes: { class: string; message?: Maybe<string> }[]
  stack: string[]
}

const str = (v: unknown) => (typeof v === "string" && v ? v : undefined)
const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : undefined)
const obj = (v: unknown) => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null)

/** How a failed run failed, from CLIs that record it; read field by field so a different shape shows what it can. */
export function errorOf(run: Run): RunError | null {
  const e = obj(run.error)
  const cls = str(e?.class)
  if (!e || !cls) return null
  const http = obj(e.http)
  const provider = obj(e.provider)
  const h = http && { method: str(http.method), endpoint: str(http.endpoint_template), status: num(http.status) }
  const p = provider && { key: str(provider.key), code: num(provider.code) }
  return {
    class: cls,
    code: str(e.code),
    message: str(e.message),
    operation: str(e.operation),
    ...(h && (h.method || h.endpoint || h.status !== undefined) ? { http: h } : {}),
    ...(p && (p.key || p.code !== undefined) ? { provider: p } : {}),
    causes: (Array.isArray(e.causes) ? e.causes : []).flatMap((c) => {
      const o = obj(c)
      const k = str(o?.class)
      return k ? [{ class: k, message: str(o?.message) }] : []
    }),
    stack: (Array.isArray(e.stack) ? e.stack : []).filter((f): f is string => typeof f === "string"),
  }
}

const ordered = (o: Record<string, unknown>, first: readonly string[], last: readonly string[]) => {
  const rank = (k: string) =>
    first.includes(k) ? first.indexOf(k) - first.length : last.includes(k) ? 1 + last.indexOf(k) : 0
  return Object.fromEntries(Object.entries(o).sort(([a], [b]) => rank(a) - rank(b)))
}

const RECORD_NEXT = [
  "profile",
  "agent",
  "started_at",
  "completed_at",
  "duration_ms",
  "error",
  "error_code",
  "unknown_command",
  "partial",
]
const RECORD_LAST = ["status", "cli_version", "runtime", "platform", "arch", "kept_because_failed", "event_count"]

/** A run record with what tells runs apart first and what the row already shows, or rarely matters, last. */
export function orderRecord(record: Record<string, unknown>): Record<string, unknown> {
  // Without cli_command, `command` is the command, and argv belongs right under it.
  const head = "cli_command" in record ? ["run_id", "cli_command", "argv", "command"] : ["run_id", "command", "argv"]
  const out = ordered(record, [...head, ...RECORD_NEXT], RECORD_LAST)
  const error = obj(out.error)
  if (error) out.error = ordered(error, ["class", "code", "message", "http", "provider", "causes"], ["stack"])
  return out
}

/** A `cli_command` that is the tool's name alone: it was started without a command it knows. */
export const isBareCommand = (value: string) => value !== "" && !value.includes(" ")
export const BARE_COMMAND_HINT = "The tool was started without a known command — often a typo or a missing profile."
export const commandLabel = (value: string) => (isBareCommand(value) ? `${value} (no command)` : value)
/** A field the runs do not carry: "true" when the tool was started without a command it knows. */
export const NO_COMMAND = "no_command"
/** The default query: runs with no command are mostly typos, noise next to the runs that did something. */
export const NO_COMMAND_HIDDEN = `-${NO_COMMAND}:true`
const bare = (run: Run) => isBareCommand(typeof run.cli_command === "string" ? run.cli_command : run.command)

const ALIASES: Record<string, string> = { operation: "operations", code: "codes", duration: "duration_ms" }
const FIELD = /^[a-z_][a-z0-9_]*(\.[a-z_][a-z0-9_]*)*$/i
const TEXT_FIELDS = [
  "tool",
  "run_id",
  "command",
  "cli_command",
  "unknown_command",
  "agent",
  "session_id",
  "error.class",
  "error.message",
  "error.http.endpoint_template",
  "error.provider.key",
  "profile",
  "status",
  "error_code",
  "operations",
  "codes",
  "provider_error",
  "cli_version",
]

type Token = { raw: string; start: number; end: number; unclosed: boolean }

function tokenize(query: string): Token[] {
  const tokens: Token[] = []
  let i = 0
  while (i < query.length) {
    if (/\s/.test(query[i] as string)) {
      i++
      continue
    }
    const start = i
    let quoted = false
    while (i < query.length && (quoted || !/\s/.test(query[i] as string))) {
      if (query[i] === '"') quoted = !quoted
      i++
    }
    tokens.push({ raw: query.slice(start, i), start, end: i, unclosed: quoted })
  }
  return tokens
}

const unquote = (s: string) => (s.length >= 2 && s.startsWith('"') && s.endsWith('"') ? s.slice(1, -1) : s)

export function parseQuery(query: string): Parsed {
  const terms: Term[] = []
  const problems: QueryProblem[] = []
  for (const t of tokenize(query)) {
    const { raw, start, end } = t
    if (t.unclosed) {
      problems.push({ start, end, message: "A quote is not closed." })
      continue
    }
    const negate = raw.startsWith("-") && raw.length > 1
    const body = negate ? raw.slice(1) : raw
    const colon = body.indexOf(":")
    const name = colon > 0 ? body.slice(0, colon) : ""
    if (colon > 0 && FIELD.test(name)) {
      let rest = body.slice(colon + 1)
      const op = (/^(>=|<=|>|<)/.exec(rest)?.[0] ?? "=") as Op
      rest = rest.slice(op === "=" ? 0 : op.length)
      const value = unquote(rest)
      if (!value) {
        problems.push({ start, end, message: `${name}: needs a value, like ${name}:something.` })
        continue
      }
      if (op !== "=" && Number.isNaN(Number(value))) {
        problems.push({ start, end, message: `${op} compares numbers; "${value}" is not one.` })
        continue
      }
      const field = ALIASES[name.toLowerCase()] ?? name.toLowerCase()
      terms.push({ kind: "field", field, value, op, negate, start, end, raw })
    } else {
      terms.push({ kind: "text", value: unquote(body), negate, start, end, raw })
    }
  }
  return { terms, problems }
}

/** Every scalar at a dotted path; arrays on the way are walked, so `codes` or `partial.failures.stage` match any. */
export function valuesAt(run: Run, path: string): string[] {
  if (path === NO_COMMAND) return [String(bare(run))]
  let current: unknown[] = [run]
  for (const key of (PATHS[path] ?? path).split(".")) {
    const next: unknown[] = []
    for (const c of current) {
      const v = c && typeof c === "object" && !Array.isArray(c) ? (c as Record<string, unknown>)[key] : undefined
      if (Array.isArray(v)) for (const x of v) next.push(x)
      else if (v !== undefined && v !== null) next.push(v)
    }
    current = next
  }
  return current.filter((v) => typeof v !== "object").map(String)
}

const globCache = new Map<string, RegExp>()
function glob(pattern: string, anchored: boolean): RegExp {
  const key = `${anchored}:${pattern}`
  let re = globCache.get(key)
  if (!re) {
    const body = pattern
      .split("*")
      .map((s) => s.replace(/[.+?^${}()|[\]\\]/g, "\\$&"))
      .join(".*")
    re = new RegExp(anchored ? `^${body}$` : body, "i")
    globCache.set(key, re)
  }
  return re
}

function fieldMatches(run: Run, term: Extract<Term, { kind: "field" }>): boolean {
  const values = valuesAt(run, term.field)
  if (term.op === "=") return values.some((v) => glob(term.value, true).test(v))
  const limit = Number(term.value)
  return values.some((v) => {
    const n = Number(v)
    if (Number.isNaN(n)) return false
    return term.op === ">" ? n > limit : term.op === "<" ? n < limit : term.op === ">=" ? n >= limit : n <= limit
  })
}

function textMatches(run: Run, value: string): boolean {
  const re = glob(value, false)
  return TEXT_FIELDS.some((f) => valuesAt(run, f).some((v) => re.test(v)))
}

/** A matcher for the whole query; `skipField` leaves that field's terms out, for facet counts. */
export function matcher(terms: Term[], skipField?: string): (run: Run) => boolean {
  const active = terms.filter((t) => !(t.kind === "field" && t.field === skipField))
  const anyOf = new Map<string, Extract<Term, { kind: "field" }>[]>()
  const each: Term[] = []
  for (const t of active) {
    if (t.kind === "field" && t.op === "=" && !t.negate) anyOf.set(t.field, [...(anyOf.get(t.field) ?? []), t])
    else each.push(t)
  }
  return (run) => {
    for (const group of anyOf.values()) if (!group.some((t) => fieldMatches(run, t))) return false
    for (const t of each) {
      const hit = t.kind === "field" ? fieldMatches(run, t) : textMatches(run, t.value)
      if (hit === t.negate) return false
    }
    return true
  }
}

export type Count = { value: string; count: number }

export function countValues(runs: Run[], field: string): Count[] {
  const counts = new Map<string, number>()
  for (const run of runs) {
    const values = new Set(valuesAt(run, field))
    if (values.size === 0) values.add("")
    for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1)
  }
  return [...counts]
    .map(([value, count]) => ({ value, count }))
    .sort((a, b) => b.count - a.count || a.value.localeCompare(b.value))
}

/** Adds the values that have no runs, at count 0 after the rest, so a facet can list every known value. */
export function withZeros(counts: Count[], values: readonly string[]): Count[] {
  const seen = new Set(counts.map((c) => c.value))
  const missing = values.filter((v) => !seen.has(v)).sort((a, b) => a.localeCompare(b))
  return [...counts, ...missing.map((value) => ({ value, count: 0 }))]
}

/** Counts per value of a facet among runs that match everything else in the query. */
export function facetCounts(runs: Run[], terms: Term[], field: string): Count[] {
  return countValues(runs.filter(matcher(terms, field)), field)
}

export type Group = { value: string; count: number; failed: number; last: string }

export function groupRuns(runs: Run[], field: string): Group[] {
  const groups = new Map<string, Group>()
  for (const run of runs) {
    const values = new Set(valuesAt(run, field))
    if (values.size === 0) values.add("")
    for (const value of values) {
      const g = groups.get(value) ?? { value, count: 0, failed: 0, last: "" }
      g.count++
      if (run.status === "failed") g.failed++
      if (run.started_at > g.last) g.last = run.started_at
      groups.set(value, g)
    }
  }
  return [...groups.values()].sort((a, b) => b.count - a.count || a.value.localeCompare(b.value))
}

export type TermState = "include" | "exclude" | null

export function termState(terms: Term[], field: string, value: string): TermState {
  const t = terms.find((t) => t.kind === "field" && t.op === "=" && t.field === field && t.value === value)
  return t ? (t.negate ? "exclude" : "include") : null
}

const quote = (value: string) => (/[\s"():]/.test(value) || value === "" ? `"${value.replace(/"/g, "")}"` : value)
export const termText = (field: string, value: string, negate = false) => `${negate ? "-" : ""}${field}:${quote(value)}`

/** Adds `field:value` (or `-field:value`), or removes it when the same term is already there. */
export function toggleTerm(query: string, field: string, value: string, negate = false): string {
  const { terms } = parseQuery(query)
  const same = (t: Term) => t.kind === "field" && t.op === "=" && t.field === field && t.value === value
  const existing = terms.find(same)
  const kept = tokenize(query)
    .filter((tok) => !terms.some((t) => same(t) && t.start === tok.start))
    .map((tok) => tok.raw)
  if (existing?.kind === "field" && existing.negate === negate) return kept.join(" ")
  return [...kept, termText(field, value, negate)].join(" ")
}

/** Problems a parse cannot see: a field no fetched run has at all. */
export function unknownFields(parsed: Parsed, runs: Run[]): QueryProblem[] {
  return parsed.terms.flatMap((t) =>
    t.kind === "field" && runs.length > 0 && !runs.some((r) => valuesAt(r, t.field).length > 0)
      ? [{ start: t.start, end: t.end, message: `No run has a field named ${t.field}.` }]
      : [],
  )
}

/**
 * A list or object short enough to read on one line: empty, or up to three scalars whose compact JSON fits.
 * Returns that line, or null when the value should stay a collapsible node.
 */
export function inlineJson(value: unknown, width = 60): string | null {
  if (value === null || typeof value !== "object") return null
  const entries = Object.entries(value)
  if (entries.length === 0) return Array.isArray(value) ? "[]" : "{}"
  if (entries.length > 3 || entries.some(([, v]) => v !== null && typeof v === "object")) return null
  const text = Array.isArray(value)
    ? `[${value.map((v) => JSON.stringify(v)).join(", ")}]`
    : `{ ${entries.map(([k, v]) => `${k}: ${JSON.stringify(v)}`).join(", ")} }`
  return text.length <= width ? text : null
}

export type Suggestion = { label: string; insert: string; hint: string }
export type Suggestions = { from: number; to: number; items: Suggestion[] }

export function suggest(query: string, cursor: number, runs: Run[], fields: readonly string[]): Suggestions {
  const tok = tokenize(query).find((t) => t.start <= cursor && cursor <= t.end)
  const from = tok?.start ?? cursor
  const to = tok?.end ?? cursor
  const raw = tok?.raw ?? ""
  const negate = raw.startsWith("-") ? "-" : ""
  const body = raw.slice(negate.length)
  const colon = body.indexOf(":")
  if (colon < 0) {
    const prefix = body.toLowerCase()
    const items = fields
      .filter((f) => f.startsWith(prefix) && f !== prefix)
      .map((f) => ({ label: `${f}:`, insert: `${negate}${f}:`, hint: FACET_LABELS[f] ?? "field" }))
    return { from, to, items }
  }
  const field = ALIASES[body.slice(0, colon).toLowerCase()] ?? body.slice(0, colon).toLowerCase()
  const typed = unquote(body.slice(colon + 1)).toLowerCase()
  const items = countValues(runs, field)
    .filter((c) => c.value !== "" && c.value.toLowerCase().startsWith(typed) && c.value.toLowerCase() !== typed)
    .slice(0, 8)
    .map((c) => ({ label: c.value, insert: termText(field, c.value, negate === "-"), hint: String(c.count) }))
  return { from, to, items }
}

export const RANGES = [
  { id: "1h", label: "1h", ms: 3_600_000 },
  { id: "24h", label: "24h", ms: 86_400_000 },
  { id: "7d", label: "7d", ms: 7 * 86_400_000 },
  { id: "30d", label: "30d", ms: 30 * 86_400_000 },
  { id: "all", label: "All", ms: Number.POSITIVE_INFINITY },
] as const
export type RangeId = (typeof RANGES)[number]["id"]

export function inRange(runs: Run[], range: RangeId, now: number): Run[] {
  const ms = RANGES.find((r) => r.id === range)?.ms ?? Number.POSITIVE_INFINITY
  if (!Number.isFinite(ms)) return runs
  const since = now - ms
  return runs.filter((r) => Date.parse(r.started_at) >= since)
}

export const newestFirst = (a: Run, b: Run) => (a.started_at < b.started_at ? 1 : a.started_at > b.started_at ? -1 : 0)

export type Tone = "ok" | "warn" | "bad" | "busy" | "idle"
export const statusTone = (status: string): Tone =>
  status === "success"
    ? "ok"
    : status === "failed"
      ? "bad"
      : status === "partial"
        ? "warn"
        : status === "running"
          ? "busy"
          : "idle"

export function formatDuration(ms: number | undefined): string {
  if (ms === undefined) return "—"
  if (ms < 1000) return `${Math.round(ms)} ms`
  if (ms < 60_000) return `${(ms / 1000).toFixed(ms < 10_000 ? 1 : 0)} s`
  return `${Math.floor(ms / 60_000)} min ${Math.round((ms % 60_000) / 1000)} s`
}

const pad = (n: number) => String(n).padStart(2, "0")
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]

/** Local time: "14:05:12" today, "Yesterday 14:05", "3 Oct 14:05" otherwise. */
export function formatWhen(iso: string, now: Date): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  const hm = `${pad(d.getHours())}:${pad(d.getMinutes())}`
  const day = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime()
  const days = Math.round((day(now) - day(d)) / 86_400_000)
  if (days === 0) return `${hm}:${pad(d.getSeconds())}`
  if (days === 1) return `Yesterday ${hm}`
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${hm}`
}

export const formatDay = (iso: string) => {
  const d = new Date(iso)
  return `${d.getDate()} ${MONTHS[d.getMonth()]}`
}
