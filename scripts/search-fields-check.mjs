// Every field the Search page offers, run against the owner's real stores through the Rust code the app uses.
//   node scripts/search-fields-check.mjs [--tools tg,wa] [--out results.json]
// Queries are built by src/domain/search.ts, the page's own code (quoting, dates, examples); values come from
// search_values and answers from search_store, both through `cargo test real_batch` (src-tauri/src/search.rs).
// Read-only: every template passes --offline (memo has none) and --no-record. The table printed names value kinds
// ("a chat id", "has:photo"), never the owner's chats or people; the raw rows go to --out, which stays local.
import { execFileSync } from "node:child_process"
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { dateOptions, examples, quoteValue } from "../src/domain/search.ts"

const root = new URL("..", import.meta.url).pathname
const args = process.argv.slice(2)
const arg = (name) => {
  const i = args.indexOf(`--${name}`)
  return i === -1 ? null : args[i + 1]
}
const only = arg("tools")?.split(",")
const out = arg("out")
const catalog = JSON.parse(readFileSync(join(root, "catalog/tools.json"), "utf8"))
const tools = catalog.tools.filter((t) => t.search && (!only || only.includes(t.id)))
const dir = mkdtempSync(join(tmpdir(), "search-fields-"))

function batch(requests) {
  if (requests.length === 0) return []
  const input = join(dir, "in.jsonl")
  const output = join(dir, "out.jsonl")
  writeFileSync(input, requests.map((r) => JSON.stringify(r)).join("\n"))
  execFileSync("cargo", ["test", "--quiet", "real_batch", "--", "--ignored"], {
    cwd: join(root, "src-tauri"),
    env: { ...process.env, SEARCH_BATCH_IN: input, SEARCH_BATCH_OUT: output, CARGO_BUILD_JOBS: "8" },
    stdio: ["ignore", "ignore", "inherit"],
  })
  return readFileSync(output, "utf8")
    .trim()
    .split("\n")
    .map((l) => JSON.parse(l))
}

// Profiles from each tool's own refusal to run without one, or its read-only account list: never a sign-in.
function profilesOf(tool) {
  if (!tool.search.args.some((a) => a.includes("{profile}"))) return [null]
  const run = (words) => {
    try {
      return execFileSync(tool.bin, words, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], timeout: 60_000 })
    } catch (e) {
      return `${e.stdout ?? ""}\n${e.stderr ?? ""}`
    }
  }
  if (tool.id === "email") {
    const doctor = JSON.parse(
      run(["doctor", "--json"])
        .trim()
        .split("\n")
        .find((l) => l.startsWith("{")) ?? "{}",
    )
    return (doctor.item?.mail?.accounts ?? []).map((a) => a.name)
  }
  const text = run(["account", "list", "--offline", "--no-record", "--json"])
  for (const line of text.split("\n").filter((l) => l.startsWith("{"))) {
    const body = JSON.parse(line)
    if (Array.isArray(body.items)) return body.items.map((i) => i.profile).filter(Boolean)
    if (body.error?.details?.profiles) return body.error.details.profiles
  }
  for (const words of [["search", "all"], ["search"]]) {
    const refusal = run([...words, "--no-record", "--json", "--", "x"])
    for (const line of refusal.split("\n").filter((l) => l.startsWith("{"))) {
      const profiles = JSON.parse(line).error?.details?.profiles
      if (profiles) return profiles
    }
  }
  return []
}

const now = new Date()
const plan = []
const valueRequests = []
for (const tool of tools) {
  for (const profile of profilesOf(tool)) {
    for (const source of Object.keys(tool.search.values ?? {}))
      valueRequests.push({ kind: "values", tool: tool.id, profile, source })
    plan.push({ tool, profile })
  }
}
const versions = batch(tools.map((t) => ({ kind: "version", tool: t.id, profile: null })))
tools.forEach((t, i) => {
  console.error(`${t.id}: ${versions[i].ok ?? "version unknown"}`)
})
console.error(`reading ${valueRequests.length} value lists…`)
const valueAnswers = batch(valueRequests)
const lists = new Map(valueRequests.map((r, i) => [`${r.tool}|${r.profile}|${r.source}`, valueAnswers[i].ok ?? []]))

const cases = []
for (const { tool, profile } of plan) {
  const add = (form, query, check = null) => cases.push({ tool: tool.id, profile, form, query, check })
  for (const field of tool.search.fields) {
    if (field.name === "date") {
      for (const d of dateOptions(now)) add(`date: ${d.meaning}`, d.query, { date: d.meaning })
      continue
    }
    if (Array.isArray(field.values)) {
      for (const v of field.values) add(`${field.name}:${v}`, `${field.name}:${quoteValue(v)}`)
      continue
    }
    if (typeof field.values === "string") {
      const items = lists.get(`${tool.id}|${profile}|${field.values}`) ?? []
      if (items.length === 0) add(`${field.name}: (no values listed)`, null)
      // Named entries first: a match can only be checked against a name the hits also carry.
      const ordered = [...items.filter((i) => i.label), ...items.filter((i) => !i.label)]
      for (const item of ordered.slice(0, 2))
        add(`${field.name}: id from ${field.values}`, `${field.name}:${quoteValue(item.value)}`, {
          field: field.name,
          label: item.label,
        })
      const named = items.find((i) => i.detail)
      if (named && field.name === "chat")
        add(`${field.name}: @username typed`, `${field.name}:${quoteValue(`@${named.detail}`)}`, {
          field: field.name,
          label: named.label,
        })
      if (field.name === "chat") {
        const titles = new Map()
        for (const i of items) if (i.label) titles.set(i.label, (titles.get(i.label) ?? 0) + 1)
        const shared = [...titles].find(([, n]) => n > 1)?.[0]
        if (shared) add("chat: title two chats share, typed", `chat:${quoteValue(shared)}`, { ambiguous: true })
        const usernames = new Set(items.map((i) => i.detail?.toLowerCase()).filter(Boolean))
        const clash = items.find(
          (i) => i.label && usernames.has(i.label.toLowerCase()) && i.detail?.toLowerCase() !== i.label.toLowerCase(),
        )
        if (clash)
          add("chat: title equal to another's username, typed", `chat:${quoteValue(clash.label)}`, { ambiguous: true })
      }
      const person = items.find((i) => i.label)
      if (field.name === "from" && person)
        add("from: name typed", `from:${quoteValue(person.label)}`, { field: "from", label: person.label })
      continue
    }
    add(`${field.name}: catalog example`, field.example)
  }
  for (const e of examples(tool.search.what, now)) add(`example: ${e.id}`, e.query)
  const chat = lists.get(`${tool.id}|${profile}|chats`)?.find((i) => i.label)
  if (chat)
    add("combo: date>=3d chat:id", `date>=3d chat:${quoteValue(chat.value)}`, { field: "chat", label: chat.label })
  const person = lists.get(`${tool.id}|${profile}|contacts`)?.find((i) => i.label)
  if (person)
    add("combo: date>=30d from:id", `date>=30d from:${quoteValue(person.value)}`, {
      field: "from",
      label: person.label,
    })
}

const runnable = cases.filter((c) => c.query !== null)
console.error(`running ${runnable.length} searches…`)
const answers = batch(runnable.map((c) => ({ kind: "search", tool: c.tool, profile: c.profile, query: c.query })))
runnable.forEach((c, i) => {
  c.answer = answers[i]
})

// A day of slack each side: the tools count days in the owner's time zone, the hits carry UTC.
function inRange(iso, meaning) {
  if (typeof iso !== "string") return false
  const t = Date.parse(iso)
  const day = 86_400_000
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  const month = new Date(now.getFullYear(), now.getMonth(), 1).getTime()
  const from = {
    last7: now - 7 * day,
    last30: now - 30 * day,
    today: start,
    yesterday: start - day,
    thisMonth: month,
    since: month,
    between: month,
  }[meaning]
  const to =
    meaning === "yesterday"
      ? start
      : meaning === "between"
        ? new Date(now.getFullYear(), now.getMonth() + 1, 1).getTime()
        : Infinity
  return t >= from - day && t <= to + day
}

const lower = (s) => (typeof s === "string" ? s.trim().toLowerCase() : null)
function verdict(c) {
  if (c.query === null) return { result: "no value list", hits: "", match: "" }
  if (c.answer.err) return { result: `app error: ${c.answer.err}`, hits: "", match: "" }
  const a = c.answer.ok
  if (a.kind === "queryError") return { result: `refused ${a.reason}`, hits: "", match: "" }
  if (a.kind === "old") return { result: "too old", hits: "", match: "" }
  if (a.kind === "failed") {
    const n = a.candidates?.length ?? 0
    if (c.check?.ambiguous && n) return { result: `refused as expected: ambiguous, ${n} choices`, hits: "", match: "" }
    return {
      result: n ? `refused: ambiguous, ${n} choices` : `refused: ${a.message.split("\n")[0].slice(0, 60)}`,
      hits: "",
      match: "",
    }
  }
  const hits = a.hits
  let match = ""
  if (c.check && "label" in c.check && !c.check.label && hits.length) match = "entry has no name to compare"
  else if (c.check?.field === "chat" && hits.length) {
    const titled = hits.filter((h) => typeof h.chat_title === "string")
    match = titled.length
      ? `${titled.filter((h) => lower(h.chat_title) === lower(c.check.label)).length}/${titled.length} in that chat`
      : "hits carry no chat"
  } else if (c.check?.field === "from" && hits.length) {
    const named = hits.filter((h) => typeof h.sender_name === "string")
    match = named.length
      ? `${named.filter((h) => lower(h.sender_name) === lower(c.check.label)).length}/${named.length} from that person`
      : "hits carry no sender"
  }
  if (c.check?.date && hits.length) {
    const inside = hits.filter((h) => inRange(h.timestamp ?? h.updated_at, c.check.date)).length
    match = `${inside}/${hits.length} in that time`
  }
  const meaning = hits.filter((h) => Array.isArray(h.found_by) && h.found_by.includes("meaning")).length
  if (meaning) match = `${match ? `${match}; ` : ""}${meaning} by meaning`
  return { result: "accepted", hits: String(hits.length) + (a.hasMore ? "+" : ""), match }
}

const rows = cases.map((c) => ({ ...c, ...verdict(c) }))
console.log("| Tool | Profile | Field and value form | Result | Hits | Hits match |")
console.log("|---|---|---|---|---|---|")
for (const r of rows)
  console.log(`| ${r.tool} | ${r.profile ?? "—"} | ${r.form} | ${r.result} | ${r.hits} | ${r.match} |`)
if (out) writeFileSync(out, JSON.stringify(rows, null, 2))
