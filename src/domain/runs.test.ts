import { describe, expect, it } from "vitest"
import {
  facetCounts,
  formatDuration,
  groupRuns,
  inRange,
  matcher,
  parseQuery,
  type Run,
  suggest,
  termState,
  toggleTerm,
  unknownFields,
} from "./runs"

const run = (over: Partial<Run>): Run => ({
  tool: "tg",
  run_id: "20261025T100000Z-sync-aaaaaa",
  command: "sync",
  status: "failed",
  started_at: "2026-10-25T10:00:00.000Z",
  profile: "personal",
  ...over,
})

const runs: Run[] = [
  run({ error_code: "timeout", duration_ms: 31000, codes: ["timeout"] }),
  run({ command: "messages send", error_code: "rate_limited", profile: "work", codes: ["rate_limited"] }),
  run({ tool: "max", command: "chats list", status: "success", duration_ms: 200 }),
  run({
    tool: "wa",
    status: "partial",
    error_code: "timeout",
    partial: { failures: [{ stage: "download" }, { stage: "upload" }] },
  }),
]

const search = (q: string) => runs.filter(matcher(parseQuery(q).terms))

describe("run query", () => {
  it("matches fields with wildcards, exclusions and number comparisons", () => {
    expect(search("command:messages*")).toHaveLength(1)
    expect(search("-tool:tg")).toHaveLength(2)
    expect(search("duration_ms:>1000")).toHaveLength(1)
    expect(search('command:"chats list"')).toHaveLength(1)
  })

  it("treats several values of one field as any of them, and different fields as all", () => {
    expect(search("tool:max tool:wa")).toHaveLength(2)
    expect(search("tool:max tool:wa status:partial")).toHaveLength(1)
  })

  it("finds free text across the run's own fields and inside nested arrays", () => {
    expect(search("rate")).toHaveLength(1)
    expect(search("partial.failures.stage:upload")).toHaveLength(1)
    expect(search("code:timeout")).toHaveLength(1)
  })

  it("reports what it cannot read", () => {
    expect(parseQuery('command:"sync').problems[0]?.message).toMatch(/quote/)
    expect(parseQuery("status:").problems[0]?.message).toMatch(/needs a value/)
    expect(parseQuery("duration_ms:>soon").problems[0]?.message).toMatch(/numbers/)
    expect(unknownFields(parseQuery("stauts:failed"), runs)[0]?.message).toMatch(/stauts/)
  })
})

describe("facets and groups", () => {
  it("counts a facet over the other filters, so its own values stay pickable", () => {
    const { terms } = parseQuery("tool:tg error_code:timeout")
    expect(facetCounts(runs, terms, "tool")).toEqual([
      { value: "tg", count: 1 },
      { value: "wa", count: 1 },
    ])
  })

  it("groups with counts, failures and the latest run", () => {
    const groups = groupRuns(runs, "error_code")
    expect(groups[0]).toMatchObject({ value: "timeout", count: 2, failed: 1 })
    expect(groups.find((g) => g.value === "")?.count).toBe(1)
  })

  it("toggles include and exclude terms in the query text", () => {
    let q = toggleTerm("sync", "status", "failed")
    expect(q).toBe("sync status:failed")
    q = toggleTerm(q, "status", "failed", true)
    expect(q).toBe("sync -status:failed")
    expect(termState(parseQuery(q).terms, "status", "failed")).toBe("exclude")
    expect(toggleTerm(q, "status", "failed", true)).toBe("sync")
    expect(toggleTerm("", "command", "messages send")).toBe('command:"messages send"')
  })
})

describe("helpers", () => {
  it("suggests fields, then values with counts", () => {
    expect(suggest("err", 3, runs, ["error_code", "status"]).items[0]?.insert).toBe("error_code:")
    const values = suggest("error_code:t", 12, runs, []).items
    expect(values).toEqual([{ label: "timeout", insert: "error_code:timeout", hint: "2" }])
  })

  it("keeps runs inside the time range", () => {
    const now = Date.parse("2026-10-25T10:30:00.000Z")
    const old = run({ started_at: "2026-10-01T00:00:00.000Z" })
    expect(inRange([old, ...runs], "24h", now)).toHaveLength(4)
    expect(inRange([old, ...runs], "all", now)).toHaveLength(5)
  })

  it("formats durations the way people say them", () => {
    expect([formatDuration(340), formatDuration(1400), formatDuration(31_000), formatDuration(125_000)]).toEqual([
      "340 ms",
      "1.4 s",
      "31 s",
      "2 min 5 s",
    ])
  })
})
