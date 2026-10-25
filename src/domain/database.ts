// The storage file, shaped for the Storage page: its facts, its tables and its health in plain words.

export type TableLike = { name: string; kind: string; rows: number | null; bytes: number | null }
export type TableSort = { key: "name" | "kind" | "rows" | "bytes"; descending: boolean }

export const KIND_LABEL: Record<string, string> = {
  data: "Data",
  internal: "Internal",
  search_index: "Search index",
  search_index_part: "Search index part",
}

const isSearch = (t: TableLike) => t.kind === "search_index" || t.kind === "search_index_part"

/** Search indexes are rebuilt from the data, so they go under their own heading. */
export function splitTables<T extends TableLike>(tables: readonly T[]): { main: T[]; search: T[] } {
  return { main: tables.filter((t) => !isSearch(t)), search: tables.filter(isSearch) }
}

/** `null` sorts last either way: an unmeasured size is not a small one. */
export function sortTables<T extends TableLike>(tables: readonly T[], query: string, sort: TableSort): T[] {
  const q = query.trim().toLowerCase()
  const shown = q === "" ? [...tables] : tables.filter((t) => t.name.toLowerCase().includes(q))
  const dir = sort.descending ? -1 : 1
  return shown.sort((a, b) => {
    if (sort.key === "name" || sort.key === "kind") {
      const by = (KIND_LABEL[a[sort.key]] ?? a[sort.key]).localeCompare(KIND_LABEL[b[sort.key]] ?? b[sort.key])
      return by === 0 ? a.name.localeCompare(b.name) : by * dir
    }
    const x = a[sort.key]
    const y = b[sort.key]
    if (x === null || y === null) return x === y ? a.name.localeCompare(b.name) : x === null ? 1 : -1
    return x === y ? a.name.localeCompare(b.name) : (x - y) * dir
  })
}

export const totalBytes = (tables: readonly TableLike[]) => tables.reduce((sum, t) => sum + (t.bytes ?? 0), 0)

const DAY = 86_400_000

/** The owner's backup job keeps a marker; mail clean-up refuses to run when it is older than eight days. */
export const BACKUP_STALE_DAYS = 8

export type Tone = "ok" | "warn" | "bad" | "idle"

export function backupState(
  backup: { at: string; checked: string | null } | null,
  now: number,
): { tone: Tone; text: string } {
  if (!backup) return { tone: "idle", text: "No backup recorded beside the storage file" }
  const at = Date.parse(backup.at)
  const days = Math.floor((now - at) / DAY)
  const when = days <= 0 ? "today" : days === 1 ? "yesterday" : `${days} days ago`
  const date = new Date(at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })
  const checked = backup.checked ? `, ${backup.checked}` : ""
  if (days >= BACKUP_STALE_DAYS)
    return { tone: "warn", text: `${date}, ${when}${checked}. The backup job has not finished since` }
  return { tone: "ok", text: `${date}, ${when}${checked}` }
}

// `speaks` comes from the one tool that answered, so the words stay about the tools in general; the Tools page names
// each tool that cannot read the store.
export function schemaState(schema: number | null, speaks: number | null): { tone: Tone; text: string } | null {
  if (schema === null || speaks === null || schema === speaks) return null
  if (schema < speaks)
    return { tone: "warn", text: `newer tools use ${speaks}; storage moves to it the next time one writes` }
  return { tone: "warn", text: "newer than some installed tools know; update them on the Tools page" }
}

export type CheckLike = {
  bin: string
  ok: boolean
  problem: string | null
  schema: number | null
  minCompatible: number | null
  speaks: number | null
  writable: boolean | null
  checks: Record<string, boolean>
  integrity: readonly string[]
  foreignKeyViolations: number
  brokenIndexes: readonly string[]
  diskFree: number
  diskNeeded: number
  chatsBehind: number
  orphanPointers: number
  fixes: readonly string[]
}

export type Issue = { text: string; fix: string | null }

const plural = (n: number, one: string, many: string) => `${n.toLocaleString("en-US")} ${n === 1 ? one : many}`

/** Each failed check in plain words, with the command that fixes it when there is one. */
export function healthIssues(c: CheckLike, formatBytes: (n: number) => string): Issue[] {
  if (c.problem) return [{ text: `Storage did not open: ${c.problem}`, fix: null }]
  const issues: Issue[] = []
  const migrate = c.fixes.find((f) => f.endsWith("store migrate")) ?? `${c.bin} store migrate`
  if (c.checks.schema === false && c.schema !== null && c.speaks !== null) {
    if (c.schema < c.speaks)
      issues.push({
        text: `Storage is at schema ${c.schema}; ${c.bin} speaks ${c.speaks}. Back it up, then bring it up to date.`,
        fix: migrate,
      })
    else if (c.writable === false)
      issues.push({
        text: `Storage is at schema ${c.schema} and needs a tool that speaks at least ${c.minCompatible}; ${c.bin} speaks ${c.speaks}.`,
        fix: `${c.bin} upgrade`,
      })
  }
  if (c.checks.integrity === false)
    issues.push({
      text: `SQLite found damage in the file: ${c.integrity.slice(0, 3).join("; ")}. Restore a backup.`,
      fix: `${c.bin} store restore <backup file>`,
    })
  if (c.checks.foreign_keys === false)
    issues.push({
      text: `${plural(c.foreignKeyViolations, "row points", "rows point")} at a row that is not there.`,
      fix: `${c.bin} store repair --dry-run`,
    })
  if (c.checks.search_indexes === false)
    issues.push({
      text: `${plural(c.brokenIndexes.length, "search index is", "search indexes are")} damaged: ${c.brokenIndexes.join(", ")}. Search may miss messages until it is rebuilt.`,
      fix: `${c.bin} store rebuild`,
    })
  if (c.checks.disk === false)
    issues.push({
      text: `Only ${formatBytes(c.diskFree)} free on the disk; a backup or a clean-up needs about ${formatBytes(c.diskNeeded)}.`,
      fix: null,
    })
  for (const fix of c.fixes) if (!issues.some((i) => i.fix === fix)) issues.push({ text: "The tool suggests:", fix })
  return issues
}

/** What the check reports but does not count as a fault. */
export function healthNotes(c: CheckLike): string[] {
  const notes: string[] = []
  if (c.chatsBehind > 0)
    notes.push(`${plural(c.chatsBehind, "chat has", "chats have")} newer messages than storage holds.`)
  if (c.orphanPointers > 0)
    notes.push(`${plural(c.orphanPointers, "tag or link points", "tags and links point")} at something deleted.`)
  return notes
}

export function formatDuration(ms: number): string {
  const s = Math.round(ms / 1000)
  if (s < 60) return `${s} s`
  return `${Math.floor(s / 60)} min ${String(s % 60).padStart(2, "0")} s`
}
