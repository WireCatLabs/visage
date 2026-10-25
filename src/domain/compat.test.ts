import { describe, expect, it } from "vitest"
import { fitSeverity, fits, parseRefusal, type StoreCompat, storeFile, summarize, type ToolView } from "./compat"

const view = (id: string, over: Partial<ToolView> = {}): ToolView => ({
  id,
  outcome: "answered",
  speaks: 33,
  writable: true,
  reason: "current",
  upgrade: null,
  file: { version: 33, minCompatible: 32 },
  exists: true,
  problem: null,
  ...over,
})
const unknown = (id: string, problem: string | null = null): ToolView => ({
  ...view(id),
  outcome: problem ? "failed" : "unknown",
  speaks: null,
  writable: null,
  reason: null,
  file: null,
  exists: null,
  problem,
})
const installed = {
  tg: { bin: "tg", version: "0.91.0" },
  max: { bin: "max", version: "0.75.0" },
  wa: { bin: "wa", version: "0.6.0" },
  zm: { bin: "zm", version: "0.42.0" },
  memo: { bin: "memo", version: "0.93.0" },
}

describe("parseRefusal", () => {
  it("reads a write-open's refusal, with and without what the tool speaks", () => {
    expect(
      parseRefusal(
        "the message store was written by a newer version (schema 33, needs at least 32; this one speaks 29) — run `wa upgrade`",
      ),
    ).toEqual({ schema: 33, needs: 32, speaks: 29 })
    expect(parseRefusal("written by a newer version (schema 34, needs at least 34)")).toEqual({
      schema: 34,
      needs: 34,
      speaks: null,
    })
  })

  it("reads a read-only open's refusal and ignores anything else", () => {
    expect(parseRefusal("The store requires schema 32, but this tool supports 29; run `zm upgrade`")).toEqual({
      schema: null,
      needs: 32,
      speaks: 29,
    })
    expect(parseRefusal("unknown command 'store'")).toBeNull()
    expect(parseRefusal(null)).toBeNull()
  })
})

describe("fits", () => {
  it("tells tools that read the store from one an older version cannot", () => {
    const compat: StoreCompat = {
      tools: [view("tg"), view("wa", { speaks: 29, writable: false, reason: null })],
      clients: [],
    }
    expect(fits(compat, installed)).toEqual({
      tg: { kind: "reads" },
      wa: { kind: "cannot_read", schema: 33, needs: 32, speaks: 29 },
    })
  })

  it("derives a tool too old to answer from the refusal it printed elsewhere", () => {
    const refusal =
      "the message store was written by a newer version (schema 33, needs at least 32; this one speaks 29)"
    const compat: StoreCompat = { tools: [unknown("zm", refusal)], clients: [] }
    expect(fits(compat, installed).zm).toEqual({ kind: "cannot_read", schema: 33, needs: 32, speaks: 29 })
    expect(storeFile(compat)).toEqual({ version: 33, minCompatible: 32, exists: true })
  })

  it("finds an older tool's schema in the store's own list of clients, matched by version", () => {
    const compat: StoreCompat = {
      tools: [view("tg"), unknown("memo"), unknown("zm")],
      clients: [
        { command: "memo", version: "0.93.0", speaks: 31 },
        { command: "zm", version: "0.40.0", speaks: 33 },
      ],
    }
    const all = fits(compat, installed)
    expect(all.memo).toEqual({ kind: "cannot_read", schema: 33, needs: 32, speaks: 31 })
    expect(all.zm).toEqual({ kind: "unknown" })
    expect(summarize(all)).toEqual({ cannotRead: ["memo"], unknown: ["zm"] })
  })

  it("**names the tools an upgrading run will lock out**, leaving out those already locked out", () => {
    const compat: StoreCompat = {
      tools: [
        view("tg"),
        view("max", { speaks: 34, reason: "older", upgrade: { version: 34, minCompatible: 34 } }),
        view("wa", { speaks: 29, writable: false }),
        unknown("zm"),
      ],
      clients: [],
    }
    const all = fits(compat, installed)
    expect(all.max).toEqual({ kind: "upgrades", to: 34, minCompatible: 34, locksOut: ["tg"] })
    expect(fitSeverity(all.max)).toBe("warn")
  })

  it("does not warn about an additive upgrade, nor guess one an older tool cannot describe", () => {
    const compat: StoreCompat = {
      tools: [
        view("tg"),
        view("max", { speaks: 34, reason: "older", upgrade: { version: 34, minCompatible: 32 } }),
        view("wa", { speaks: 35 }),
      ],
      clients: [],
    }
    const all = fits(compat, installed)
    expect(all.max).toMatchObject({ kind: "upgrades", locksOut: [] })
    expect(all.wa).toEqual({ kind: "upgrades", to: 35, minCompatible: null, locksOut: [] })
    expect(fitSeverity(all.max)).toBeNull()
  })

  it("lets every tool read a store that does not exist yet", () => {
    const compat: StoreCompat = {
      tools: [view("tg", { exists: false, file: null, reason: "missing" }), view("wa", { speaks: 29, writable: true })],
      clients: [],
    }
    expect(Object.values(fits(compat, installed))).toEqual([{ kind: "reads" }, { kind: "reads" }])
  })

  it("can't say for anyone when the file is there but did not open", () => {
    const compat: StoreCompat = {
      tools: [view("tg", { file: null }), view("wa", { speaks: 29, file: null })],
      clients: [],
    }
    expect(storeFile(compat)).toBeNull()
    expect(Object.values(fits(compat, installed))).toEqual([{ kind: "unknown" }, { kind: "unknown" }])
  })
})
