import { describe, expect, it } from "vitest"
import {
  agentOf,
  cliCommand,
  commandLabel,
  commandLine,
  countValues,
  errorOf,
  FACETS,
  facetCounts,
  formatDuration,
  groupRuns,
  inlineJson,
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

describe("commands, facets and grouping by path", () => {
  it("prefixes the tool's name and labels a run started with no command", () => {
    expect(cliCommand("tg", "chats list")).toBe("tg chats list")
    expect(cliCommand("max", "max")).toBe("max")
    expect(cliCommand("max", "")).toBe("max")
    expect(commandLabel("max")).toBe("max (no command)")
    expect(commandLabel("tg chats list")).toBe("tg chats list")
  })

  it("orders facets with profile before error code, and values by count with ties alphabetical", () => {
    expect(FACETS).toEqual([
      "tool",
      "status",
      "cli_command",
      "profile",
      "agent",
      "error_code",
      "error.class",
      "error.http.status",
    ])
    expect(countValues(runs, "tool")).toEqual([
      { value: "tg", count: 2 },
      { value: "max", count: 1 },
      { value: "wa", count: 1 },
    ])
  })

  it("groups by a nested path, counting a run once per distinct value", () => {
    const groups = groupRuns(runs, "partial.failures.stage")
    expect(groups.map((g) => [g.value, g.count])).toEqual([
      ["", 3],
      ["download", 1],
      ["upload", 1],
    ])
  })
})

describe("inline JSON", () => {
  it("puts empty and short scalar lists on one line and keeps the rest collapsible", () => {
    expect(inlineJson([])).toBe("[]")
    expect(inlineJson({})).toBe("{}")
    expect(inlineJson(["messages.getHistory"])).toBe('["messages.getHistory"]')
    expect(inlineJson({ method: "POST", status: 429 })).toBe('{ method: "POST", status: 429 }')
    expect(inlineJson([1, 2, 3, 4])).toBeNull()
    expect(inlineJson([{ stage: "download" }])).toBeNull()
    expect(inlineJson(["x".repeat(70)])).toBeNull()
    expect(inlineJson("text")).toBeNull()
  })
})

describe("what newer CLIs record about a run", () => {
  const recorded = run({
    tool: "max",
    command: "messages send",
    cli_command: "max messages send",
    argv: ["work", "messages", "send", "[redacted]", "--limit", "5"],
    agent: { kind: "claude-code", session_id: "3b8e51d2-7c4a-4f0e" },
    error: {
      class: "CliError",
      code: "rate_limited",
      message: "MAX asks to slow down",
      http: { method: "POST", endpoint_template: "https://platform-api2.max.ru/messages", status: 429 },
      causes: [{ class: "TypeError", message: "fetch failed" }, { nope: 1 }],
      stack: ["send transport.js:140", 7],
    },
  })
  const older = run({ command: "sync" })

  it("reads the agent, the command line and the failure, and nothing from a run that predates them", () => {
    expect(agentOf(recorded)).toEqual({ kind: "claude-code", session: "3b8e51d2-7c4a-4f0e" })
    expect(commandLine(recorded)).toBe("max work messages send [redacted] --limit 5")
    expect(errorOf(recorded)).toMatchObject({
      class: "CliError",
      http: { method: "POST", endpoint: "https://platform-api2.max.ru/messages", status: 429 },
      causes: [{ class: "TypeError", message: "fetch failed" }],
      stack: ["send transport.js:140"],
    })
    expect([agentOf(older), commandLine(older), errorOf(older)]).toEqual([null, null, null])
    expect(errorOf(run({ error: "boom" }))).toBeNull()
  })

  it("quotes a word the shell would split", () => {
    expect(commandLine(run({ cli_command: "tg", argv: ["it's here", "x"] }))).toBe("tg 'it'\\''s here' x")
  })

  it("filters and counts by agent, session, error class and HTTP status", () => {
    const all = [recorded, older]
    const find = (q: string) => all.filter(matcher(parseQuery(q).terms))
    expect(find("agent:claude-code")).toEqual([recorded])
    expect(find("session_id:3b8e51d2*")).toEqual([recorded])
    expect(find("error.class:CliError error.http.status:429")).toEqual([recorded])
    expect(find("slow")).toEqual([recorded])
    expect(facetCounts(all, [], "agent")).toEqual([
      { value: "", count: 1 },
      { value: "claude-code", count: 1 },
    ])
  })
})
