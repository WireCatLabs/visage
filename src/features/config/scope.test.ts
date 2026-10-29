import { describe, expect, it } from "vitest"
import { findTool } from "@/domain/catalog"
import type { SettingRow } from "@/platform/settings-schemas"
import { categoryPlan, categoryValue, plainWords, rowsFor, sharedCandidates, sharedDocument, sharedPlan } from "./scope"

const tg = findTool("tg")?.settings
if (!tg) throw new Error("catalog lost tg's settings")

const row = (key: string, value: unknown, extra: Partial<SettingRow> = {}): SettingRow => ({
  key,
  value,
  origin: "default",
  from: "default",
  scope: null,
  locked: null,
  masked: false,
  resettable: false,
  ...extra,
})
const cat = (name: string, value: string, extra: Partial<SettingRow> = {}) =>
  row(`task_categories.${name}`, value, { scope: "shared", ...extra })

const rows = [
  row("limit", 20, { origin: "profile", resettable: true }),
  row("phone_countries", "ES", { scope: "store" }),
  cat("travel", "flights | en:flight, ru:билет, es:vuelo"),
  cat("garden", "plants | en:seeds", { origin: "other", from: "~/.config/WireCat/config.json" }),
  cat("other", "anything else"),
]

describe("splitting rows by scope", () => {
  it("keeps shared and store rows out of a profile and only those in the shared view", () => {
    expect(rowsFor(rows, "tool").map((r) => r.key)).toEqual(["limit"])
    expect(rowsFor(rows, "shared").map((r) => r.key)).toEqual([
      "phone_countries",
      "task_categories.travel",
      "task_categories.garden",
      "task_categories.other",
    ])
  })

  it("asks a tool at its latest version first, and only tools that report shared rows", () => {
    const at = (version: string) => [{ version }]
    const installs = { wa: at("0.6.0"), tg: at("0.90.0"), zm: at("1.0.0"), max: [] }
    expect(sharedCandidates(installs, { tg: "0.91.0", wa: "0.6.0" })).toEqual(["wa", "tg"])
    expect(sharedCandidates(installs, null)).toEqual(["tg", "wa"])
  })
})

describe("category values", () => {
  it("shows words without the language the tool would guess anyway", () => {
    expect(plainWords(" en:flight, ru:билет, es:vuelo, en:вокзал")).toBe("flight, билет, es:vuelo, en:вокзал")
  })

  it("joins meaning and words the way config set takes them", () => {
    expect(categoryValue(" flights ", "flight,  hotel ,")).toBe("flights | flight, hotel")
    expect(categoryValue("flights", "")).toBe("flights")
    expect(categoryValue("a | b", "")).toEqual({ code: "meaningPipe" })
    expect(categoryValue("  ", "x")).toEqual({ code: "meaningMissing" })
  })
})

describe("category edits into config set / unset calls", () => {
  const cats = rows.filter((r) => r.key.startsWith("task_categories."))
  const doc = { travel: cats[0]?.value, garden: cats[1]?.value, other: cats[2]?.value }

  it("sets new and changed categories and unsets removed ones, never with --defaults", () => {
    const { garden: _, ...rest } = doc
    expect(categoryPlan(cats, { ...rest, travel: "trips", pets: "vet | en:vet" })).toEqual({
      ops: [
        { kind: "set", key: "task_categories.travel", value: "trips", defaults: false },
        { kind: "set", key: "task_categories.pets", value: "vet | en:vet", defaults: false },
        { kind: "unset", key: "task_categories.garden", defaults: false },
      ],
      problems: [],
    })
  })

  it("refuses to drop other, a non-text value or a hidden category's change", () => {
    const hidden = [...cats, cat("secret", "•••", { masked: true })]
    const { other: _, ...rest } = doc
    const p = categoryPlan(hidden, { ...rest, travel: 3, secret: "x" })
    expect(p.ops).toEqual([])
    expect(p.problems.map((x) => x.key)).toEqual(["travel", "secret", "other"])
  })

  it("nests categories in the shared JSON and plans the rest as flat settings", () => {
    const shared = rowsFor(rows, "shared")
    const document = sharedDocument(shared)
    expect(document).toEqual({ task_categories: doc, phone_countries: "ES" })
    expect(sharedPlan(shared, document, tg)).toEqual({ ops: [], problems: [] })
    const edited = { task_categories: { ...doc, travel: "trips" }, phone_countries: "ES,PT" }
    expect(sharedPlan(shared, edited, tg).ops).toEqual([
      { kind: "set", key: "task_categories.travel", value: "trips", defaults: false },
      { kind: "set", key: "phone_countries", value: "ES,PT", defaults: false },
    ])
    expect(sharedPlan(shared, { phone_countries: "ES" }, tg).problems[0]?.key).toBe("task_categories")
  })
})
