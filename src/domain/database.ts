// The storage file, shaped for the Storage page: its facts, its tables and its health in plain words.

export type TableLike = { name: string; kind: string; rows: number | null; bytes: number | null }
export type TableSort = { key: "name" | "kind" | "rows" | "bytes"; descending: boolean }

const isSearch = (t: TableLike) => t.kind === "search_index" || t.kind === "search_index_part"

/** Search indexes are rebuilt from the data, so they go under their own heading. */
export function splitTables<T extends TableLike>(tables: readonly T[]): { main: T[]; search: T[] } {
  return { main: tables.filter((t) => !isSearch(t)), search: tables.filter(isSearch) }
}

/** `null` sorts last either way: an unmeasured size is not a small one. Kinds sort by the label the reader sees. */
export function sortTables<T extends TableLike>(
  tables: readonly T[],
  query: string,
  sort: TableSort,
  kindLabel: (kind: string) => string = (kind) => kind,
): T[] {
  const q = query.trim().toLowerCase()
  const shown = q === "" ? [...tables] : tables.filter((t) => t.name.toLowerCase().includes(q))
  const dir = sort.descending ? -1 : 1
  return shown.sort((a, b) => {
    if (sort.key === "name" || sort.key === "kind") {
      const label = (t: T) => (sort.key === "kind" ? kindLabel(t.kind) : t.name)
      const by = label(a).localeCompare(label(b))
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

/** The sentences about the storage file, in the interface's language; the catalog is in `features/storage/messages.tsx`. */
export type DatabaseWords = {
  noBackup: string
  /** `checked` is what the backup job wrote about its own check, as it wrote it. */
  backup: (at: number, days: number, checked: string | null) => string
  backupStale: (at: number, days: number, checked: string | null) => string
  schemaBehind: (speaks: number) => string
  schemaAhead: string
  didNotOpen: (problem: string) => string
  schemaOld: (schema: number, bin: string, speaks: number) => string
  schemaTooNew: (schema: number, needs: number | null, bin: string, speaks: number) => string
  damaged: (details: string) => string
  danglingRows: (n: number) => string
  brokenIndexes: (n: number, names: string) => string
  lowDisk: (free: string, needed: string) => string
  toolSuggests: string
  chatsBehind: (n: number) => string
  orphans: (n: number) => string
}

export function backupState(
  backup: { at: string; checked: string | null } | null,
  now: number,
  w: DatabaseWords,
): { tone: Tone; text: string } {
  if (!backup) return { tone: "idle", text: w.noBackup }
  const at = Date.parse(backup.at)
  const days = Math.floor((now - at) / DAY)
  if (days >= BACKUP_STALE_DAYS) return { tone: "warn", text: w.backupStale(at, days, backup.checked) }
  return { tone: "ok", text: w.backup(at, days, backup.checked) }
}

// `speaks` comes from the one tool that answered, so the words stay about the tools in general; the Tools page names
// each tool that cannot read the store.
export function schemaState(
  schema: number | null,
  speaks: number | null,
  w: DatabaseWords,
): { tone: Tone; text: string } | null {
  if (schema === null || speaks === null || schema === speaks) return null
  if (schema < speaks) return { tone: "warn", text: w.schemaBehind(speaks) }
  return { tone: "warn", text: w.schemaAhead }
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

/** Each failed check in plain words, with the command that fixes it when there is one. */
export function healthIssues(c: CheckLike, formatBytes: (n: number) => string, w: DatabaseWords): Issue[] {
  if (c.problem) return [{ text: w.didNotOpen(c.problem), fix: null }]
  const issues: Issue[] = []
  const migrate = c.fixes.find((f) => f.endsWith("store migrate")) ?? `${c.bin} store migrate`
  if (c.checks.schema === false && c.schema !== null && c.speaks !== null) {
    if (c.schema < c.speaks) issues.push({ text: w.schemaOld(c.schema, c.bin, c.speaks), fix: migrate })
    else if (c.writable === false)
      issues.push({ text: w.schemaTooNew(c.schema, c.minCompatible, c.bin, c.speaks), fix: `${c.bin} upgrade` })
  }
  if (c.checks.integrity === false)
    issues.push({ text: w.damaged(c.integrity.slice(0, 3).join("; ")), fix: `${c.bin} store restore <backup file>` })
  if (c.checks.foreign_keys === false)
    issues.push({ text: w.danglingRows(c.foreignKeyViolations), fix: `${c.bin} store repair --dry-run` })
  if (c.checks.search_indexes === false)
    issues.push({
      text: w.brokenIndexes(c.brokenIndexes.length, c.brokenIndexes.join(", ")),
      fix: `${c.bin} store rebuild`,
    })
  if (c.checks.disk === false)
    issues.push({ text: w.lowDisk(formatBytes(c.diskFree), formatBytes(c.diskNeeded)), fix: null })
  for (const fix of c.fixes) if (!issues.some((i) => i.fix === fix)) issues.push({ text: w.toolSuggests, fix })
  return issues
}

/** What the check reports but does not count as a fault. */
export function healthNotes(c: CheckLike, w: DatabaseWords): string[] {
  const notes: string[] = []
  if (c.chatsBehind > 0) notes.push(w.chatsBehind(c.chatsBehind))
  if (c.orphanPointers > 0) notes.push(w.orphans(c.orphanPointers))
  return notes
}
