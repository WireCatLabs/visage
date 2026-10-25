import { describe, expect, it } from "vitest"
import { backupState, healthIssues, healthNotes, schemaState, sortTables, splitTables } from "./database"
import { formatBytes } from "./format"

const t = (name: string, kind: string, rows: number | null, bytes: number | null) => ({ name, kind, rows, bytes })
const TABLES = [
  t("messages", "data", 120, 8192),
  t("chats", "data", 9, 4096),
  t("schema_migrations", "internal", 33, 4096),
  t("messages_fts", "search_index", null, null),
  t("messages_fts_data", "search_index_part", null, 90_000),
]

const healthy = {
  bin: "tg",
  ok: true,
  problem: null,
  schema: 33,
  minCompatible: 1,
  speaks: 33,
  writable: true,
  checks: { schema: true, integrity: true, foreign_keys: true, search_indexes: true, disk: true },
  integrity: [],
  foreignKeyViolations: 0,
  brokenIndexes: [],
  diskFree: 10_000_000_000,
  diskNeeded: 1_000_000_000,
  chatsBehind: 0,
  orphanPointers: 0,
  fixes: [],
}

describe("tables", () => {
  it("puts search indexes under their own heading", () => {
    const { main, search } = splitTables(TABLES)
    expect(main.map((x) => x.name)).toEqual(["messages", "chats", "schema_migrations"])
    expect(search.map((x) => x.name)).toEqual(["messages_fts", "messages_fts_data"])
  })

  it("finds by name and sorts by rows, unmeasured last", () => {
    expect(sortTables(TABLES, "MESS", { key: "name", descending: false }).map((x) => x.name)).toEqual([
      "messages",
      "messages_fts",
      "messages_fts_data",
    ])
    expect(sortTables(TABLES, "", { key: "rows", descending: true }).map((x) => x.rows)).toEqual([
      120,
      33,
      9,
      null,
      null,
    ])
    expect(sortTables(TABLES, "", { key: "bytes", descending: false }).at(-1)?.name).toBe("messages_fts")
  })
})

describe("database facts", () => {
  const now = Date.UTC(2026, 9, 25, 12)

  it("warns when the last backup is older than the mail clean-up allows", () => {
    expect(backupState({ at: "2026-10-24T02:00:00Z", checked: "quick_check ok" }, now)).toMatchObject({ tone: "ok" })
    const stale = backupState({ at: "2026-10-16T02:00:00Z", checked: null }, now)
    expect(stale.tone).toBe("warn")
    expect(stale.text).toContain("9 days ago")
    expect(backupState(null, now).tone).toBe("idle")
  })

  it("says whether the answering tool speaks the archive's schema", () => {
    expect(schemaState(33, 33, "Telegram")?.tone).toBe("ok")
    expect(schemaState(34, 33, "Telegram")?.text).toContain("update Telegram")
    expect(schemaState(null, 33, "Telegram")).toBeNull()
  })
})

describe("health", () => {
  it("has nothing to say about a healthy archive", () => {
    expect(healthIssues(healthy, formatBytes)).toEqual([])
    expect(healthNotes(healthy)).toEqual([])
  })

  it("names each failed check in plain words with its fix, and keeps the reported-only counts as notes", () => {
    const sick = {
      ...healthy,
      ok: false,
      schema: 31,
      checks: { ...healthy.checks, schema: false, search_indexes: false, disk: false },
      brokenIndexes: ["message_words"],
      diskFree: 500_000_000,
      chatsBehind: 12,
      orphanPointers: 1,
      fixes: ["tg store migrate"],
    }
    const issues = healthIssues(sick, formatBytes)
    expect(issues.map((i) => i.fix)).toEqual(["tg store migrate", "tg store rebuild", null])
    expect(issues[0]?.text).toContain("schema 31; tg speaks 33")
    expect(issues[2]?.text).toContain("477 MB free")
    expect(healthNotes(sick)).toEqual([
      "12 chats have newer messages than the archive holds.",
      "1 tag or link points at something deleted.",
    ])
  })

  it("reports an archive that does not open as the only problem", () => {
    expect(healthIssues({ ...healthy, ok: false, problem: "locked" }, formatBytes)).toEqual([
      { text: "The archive did not open: locked", fix: null },
    ])
  })
})
