import { describe, expect, it } from "vitest"
import { findTool } from "@/domain/catalog"
import type { SettingRow } from "@/platform/settings-schemas"
import { lineOf, parse, plan, toArgument } from "./diff"

const tg = findTool("tg")?.settings
const drive = findTool("drive")?.settings
const zm = findTool("zm")?.settings
if (!tg || !drive || !zm) throw new Error("catalog lost a settings entry")

const row = (key: string, value: unknown, extra: Partial<SettingRow> = {}): SettingRow => ({
  key,
  value,
  origin: "default",
  from: null,
  scope: null,
  locked: null,
  masked: false,
  resettable: false,
  ...extra,
})

const rows = [
  row("limit", 20, { origin: "profile", resettable: true }),
  row("record", false),
  row("color", null),
  row("proxy", "•••", { origin: "profile", masked: true, resettable: true }),
  row("requests_per_minute", 12, { origin: "environment", locked: "Set by TG_REQUESTS_PER_MINUTE" }),
  row("task_agent_close", "ask", { origin: "store", scope: "store", resettable: true }),
]
const doc = Object.fromEntries(rows.map((r) => [r.key, r.value]))

describe("turning an edited document into config set / unset calls", () => {
  it("does nothing when nothing changed", () => {
    expect(plan(rows, doc, tg, false)).toEqual({ ops: [], problems: [] })
  })

  it("sets changed and new values as text, and unsets removed ones", () => {
    const { limit: _, ...rest } = doc
    const edited = { ...rest, record: true, color: "always", "task_categories.pets": "vet,food" }
    expect(plan(rows, edited, tg, false)).toEqual({
      ops: [
        { kind: "set", key: "record", value: "true", defaults: false },
        { kind: "set", key: "color", value: "always", defaults: false },
        { kind: "set", key: "task_categories.pets", value: "vet,food", defaults: false },
        { kind: "unset", key: "limit", defaults: false },
      ],
      problems: [],
    })
  })

  it("passes --defaults in the defaults view, but never for store-wide settings", () => {
    const edited = { ...doc, limit: 5, task_agent_close: "never" }
    expect(plan(rows, edited, tg, true).ops).toEqual([
      { kind: "set", key: "limit", value: "5", defaults: true },
      { kind: "set", key: "task_agent_close", value: "never", defaults: false },
    ])
  })

  it("refuses to touch masked or locked values, so ••• is never written", () => {
    const edited = { ...doc, proxy: "•••x", requests_per_minute: 99 }
    const result = plan(rows, edited, tg, false)
    expect(result.ops).toEqual([])
    expect(result.problems.map((p) => p.key)).toEqual(["proxy", "requests_per_minute"])

    const { proxy: _, ...withoutProxy } = doc
    expect(plan(rows, withoutProxy, tg, false).problems.map((p) => p.key)).toEqual(["proxy"])
  })

  it("sends JSON to tools that parse JSON, and explains when a tool cannot unset", () => {
    const driveRows = [
      row("max_text_chars", 1000, { origin: "profile" }),
      row("permissions.files", "readonly", { origin: "profile" }),
    ]
    const result = plan(driveRows, { "permissions.files": "full", picture_search: true }, drive, false)
    expect(result.ops).toEqual([
      { kind: "set", key: "permissions.files", value: '"full"', defaults: false },
      { kind: "set", key: "picture_search", value: "true", defaults: false },
    ])
    expect(result.problems).toEqual([{ key: "max_text_chars", message: { code: "cannotUnset" } }])
  })

  it("ignores removing a built-in default, since there is nothing in the file to remove", () => {
    const { record: _, ...rest } = doc
    expect(plan(rows, rest, tg, false)).toEqual({ ops: [], problems: [] })
  })

  it("rejects names that would read as options", () => {
    expect(plan([], { "--defaults": 1 }, tg, false).problems[0]?.key).toBe("--defaults")
  })
})

describe("values on the command line", () => {
  it("joins lists with commas and refuses objects for text tools", () => {
    expect(toArgument(["send", "reaction"], false)).toBe("send,reaction")
    expect(toArgument({ a: 1 }, false)).toEqual({ code: "valueShape" })
    expect(toArgument({ a: 1 }, true)).toBe('{"a":1}')
  })
})

describe("the JSON text", () => {
  it("points a syntax error at its line", () => {
    const result = parse('{\n  "limit": 20,\n  "record": tru\n}')
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.line).toBe(3)
  })

  it("wants one object", () => {
    expect(parse("[1]").ok).toBe(false)
  })

  it("finds the line a key is on", () => {
    expect(lineOf('{\n  "limit": 20,\n  "record": true\n}', "record")).toBe(3)
    expect(lineOf('{\n  "x": "record"\n}', "record")).toBeNull()
  })
})
