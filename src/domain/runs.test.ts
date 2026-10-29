import { describe, expect, it } from "vitest"
import {
  agentOf,
  cliCommand,
  clientOf,
  commandLine,
  conversations,
  countValues,
  errorOf,
  FACETS,
  facetCounts,
  formatDuration,
  groupRuns,
  inlineJson,
  inRange,
  isBareCommand,
  matcher,
  orderRecord,
  parseQuery,
  type Run,
  stepOf,
  suggest,
  termState,
  toggleTerm,
  unknownFields,
  withConversations,
  withZeros,
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
    expect(parseQuery('command:"sync').problems[0]).toMatchObject({ code: "unclosed" })
    expect(parseQuery("status:").problems[0]).toMatchObject({ code: "noValue", field: "status" })
    expect(parseQuery("duration_ms:>soon").problems[0]).toMatchObject({ code: "notNumber", op: ">", value: "soon" })
    expect(unknownFields(parseQuery("stauts:failed"), runs)[0]).toMatchObject({ code: "unknownField", field: "stauts" })
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
    expect(isBareCommand("max")).toBe(true)
    expect(isBareCommand("tg chats list")).toBe(false)
  })

  it("orders facets with profile before error code, and values by count with ties alphabetical", () => {
    expect(FACETS).toEqual([
      "tool",
      "status",
      "cli_command",
      "profile",
      "agent",
      "via",
      "client",
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

describe("orderRecord", () => {
  it("puts the run id, command and argv first, the failure next, and status and version last", () => {
    const { tool: _, ...record } = run({
      cli_version: "0.9.1",
      runtime: "node 24",
      requests: 3,
      error: { stack: ["a.js:1"], message: "slow down", http: { status: 429 }, class: "CliError", code: "x" },
      duration_ms: 40,
      cli_command: "tg sync",
      argv: ["personal", "sync"],
    })
    const ordered = orderRecord(record)
    expect(Object.keys(ordered)).toEqual([
      "run_id",
      "cli_command",
      "argv",
      "command",
      "profile",
      "started_at",
      "duration_ms",
      "error",
      "requests",
      "status",
      "cli_version",
      "runtime",
    ])
    expect(Object.keys(ordered.error as object)).toEqual(["class", "code", "message", "http", "stack"])
  })

  it("keeps argv right under the command when the tool recorded no cli_command", () => {
    expect(Object.keys(orderRecord({ status: "ok", argv: [], command: "sync", run_id: "r" }))).toEqual([
      "run_id",
      "command",
      "argv",
      "status",
    ])
  })
})

describe("withZeros", () => {
  it("lists values with no runs after the rest, at zero", () => {
    expect(withZeros([{ value: "tg", count: 3 }], ["tg", "memo", "email"])).toEqual([
      { value: "tg", count: 3 },
      { value: "email", count: 0 },
      { value: "memo", count: 0 },
    ])
  })
})

describe("conversations", () => {
  const at = (min: number) => new Date(Date.UTC(2026, 9, 27, 10, min)).toISOString()
  const id = (n: number) => `20261027T10${String(n).padStart(2, "0")}00Z-sync-${n}`
  const session = { kind: "claude-code", session_id: "s-1" }
  const browser = { kind: "mcp-client", session_id: null, client: { name: "claude-ai", id: "3f9a1c2e" } }
  const loaded = withConversations([
    run({ run_id: id(1), started_at: at(0), via: "cli", agent: session }),
    run({ run_id: id(2), started_at: at(5), via: "mcp-stdio", agent: session, mcp: { connection_id: "c-1" } }),
    run({ run_id: id(3), started_at: at(1), via: "mcp-http", agent: browser, mcp: { connection_id: "c-9" } }),
    run({ run_id: id(4), started_at: at(2), via: "mcp-http", agent: browser, trace_id: "t-1" }),
    run({ run_id: id(5), started_at: at(3), via: "mcp-http", agent: browser }),
    run({ run_id: id(6), started_at: at(20), via: "mcp-http", agent: browser, status: "success" }),
    run({ run_id: id(7), started_at: at(45), via: "mcp-http", agent: browser }),
    run({ run_id: id(9), started_at: at(80), via: "mcp-http", agent: browser }),
    run({ run_id: id(8), started_at: at(4) }),
  ])
  const keyOf = (n: number) => loaded.find((r) => r.run_id === id(n))?.conversation

  it("takes the agent session first, then the MCP connection, then the trace", () => {
    expect(keyOf(1)).toBe("session:claude-code:s-1")
    expect(keyOf(2)).toBe(keyOf(1))
    expect(keyOf(3)).toBe("connection:c-9")
    expect(keyOf(4)).toBe("trace:t-1")
  })

  it("falls back to the app and how it called, cut where 30 minutes pass with no run", () => {
    expect(keyOf(6)).toBe(keyOf(5))
    expect(keyOf(7)).toBe(keyOf(5))
    expect(keyOf(9)).not.toBe(keyOf(5))
    expect(keyOf(8)).toBe("")
  })

  it("is worked out before any search, because hiding a run in between would move the cut", () => {
    const again = withConversations(loaded.filter((r) => r.run_id !== id(6)))
    const keyIn = (list: Run[], n: number) => list.find((r) => r.run_id === id(n))?.conversation
    expect(keyIn(again, 7)).not.toBe(keyIn(again, 5))
    expect(loaded.filter(matcher(parseQuery(`conversation:"${keyOf(5)}"`).terms))).toHaveLength(3)
  })

  it("lists conversations latest first with runs in time order, and runs in none last", () => {
    const list = conversations(loaded)
    expect(list.map((c) => c.runs.length)).toEqual([1, 3, 2, 1, 1, 1])
    expect(list[0]).toMatchObject({ client: { name: "claude-ai", id: "3f9a1c2e" }, via: "mcp-http", failed: 1 })
    const ofSession = list.find((c) => c.key === keyOf(1))
    expect(ofSession).toMatchObject({ agent: "claude-code", session: "s-1", first: at(0), last: at(5), failed: 2 })
    expect(ofSession?.runs.map((r) => r.run_id)).toEqual([id(1), id(2)])
    expect(list.at(-1)?.key).toBe("")
  })

  it("filters and counts by how a run was started, the app and its connection", () => {
    const find = (q: string) => loaded.filter(matcher(parseQuery(q).terms)).map((r) => r.run_id)
    expect(find("via:mcp-http client:claude-ai")).toHaveLength(6)
    expect(find("connection:c-9")).toEqual([id(3)])
    expect(find("trace_id:t-1")).toEqual([id(4)])
    expect(facetCounts(loaded, [], "via")[0]).toEqual({ value: "mcp-http", count: 6 })
    expect(clientOf(run({}))).toBeNull()
  })
})

describe("steps", () => {
  it("reads a request line, a retry after a wait, and steps the tool did not keep", () => {
    expect(
      stepOf({
        event: "provider.response",
        operation: "messages.getHistory",
        level: "operation",
        duration_ms: 118,
        counts: { messages: 3, chats: 1 },
      }),
    ).toMatchObject({ kind: "response", name: "messages.getHistory", retry: null, counts: "3 messages, 1 chat" })
    expect(
      stepOf({
        event: "provider.request",
        method: "GET",
        endpoint_template: "/v2/users/:id",
        attempt: 2,
        wait_ms: 27000,
      }),
    ).toMatchObject({ kind: "request", name: "GET /v2/users/:id", retry: 2, waitMs: 27000 })
    expect(
      stepOf({ event: "provider.request", operation: "x", attempt: 1, level: "wire", transport: "mtproto" }),
    ).toMatchObject({
      retry: null,
      wire: true,
      transport: "mtproto",
    })
    expect(stepOf({ event: "events.dropped", dropped: 412, counts: { "messages.getHistory": 412 } })).toMatchObject({
      kind: "dropped",
      dropped: 412,
      counts: null,
    })
    expect(stepOf({ event: "cache.answered" })).toMatchObject({ kind: "other", name: "cache.answered" })
  })
})
