import type { SettingsSource } from "@/domain/catalog"
import { tools } from "@/domain/catalog"
import type { SettingRow } from "@/platform/settings-schemas"
import { isReadOnly, type Op, type Plan, type Problem, plan } from "./diff"
import type { Reason } from "./reason"

export type View = "tool" | "shared"

/** `config set task_categories.<name> "<meaning> | <words>"`; the tools keep the list in ~/.config/WireCat/config.json. */
export const CATEGORY = "task_categories."
export const FALLBACK = "other"
const SECTION = "task_categories"

/** Shared rows (`scope` set) are the same in every tool and profile, so they belong only to the shared view. */
export const rowsFor = (rows: readonly SettingRow[], view: View) =>
  rows.filter((r) => (view === "shared") === (r.scope !== null))

export const isCategory = (r: SettingRow) => r.key.startsWith(CATEGORY)
export const categoryName = (r: SettingRow) => r.key.slice(CATEGORY.length)

/** Tools whose `config show` reports the shared rows; one that is at its latest version answers first. */
export function sharedCandidates(
  installs: Record<string, readonly { version: string | null }[]>,
  latest: Record<string, string | null> | null,
): string[] {
  const installed = tools.filter((t) => t.settings?.shape === "rows" && (installs[t.id]?.length ?? 0) > 0)
  const current = (id: string) => {
    const v = installs[id]?.[0]?.version
    return Boolean(v && latest?.[id] === v)
  }
  return [...installed.filter((t) => current(t.id)), ...installed.filter((t) => !current(t.id))].map((t) => t.id)
}

export type Category = { name: string; meaning: string; words: string; value: string; row: SettingRow }

const CYRILLIC = /\p{Script=Cyrillic}/u

/** The tool prints every word with its language; a word whose language the tool would guess anyway reads plainer bare. */
export function plainWords(words: string): string {
  return words
    .split(",")
    .map((w) => w.trim())
    .filter(Boolean)
    .map((w) => {
      const tagged = /^(en|ru):(.+)$/.exec(w)
      if (!tagged) return w
      return (tagged[1] === "ru") === CYRILLIC.test(tagged[2] as string) ? (tagged[2] as string) : w
    })
    .join(", ")
}

export function toCategory(row: SettingRow): Category {
  const value = typeof row.value === "string" ? row.value : ""
  const cut = value.indexOf("|")
  const meaning = (cut === -1 ? value : value.slice(0, cut)).trim()
  const words = cut === -1 ? "" : plainWords(value.slice(cut + 1))
  return { name: categoryName(row), meaning, words, value, row }
}

/** What `config set` takes back: the tool splits on the first "|", so the meaning cannot hold one. */
export function categoryValue(meaning: string, words: string): string | Reason {
  const m = meaning.trim()
  if (!m) return { code: "meaningMissing" }
  if (m.includes("|")) return { code: "meaningPipe" }
  const w = words
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean)
    .join(", ")
  return w ? `${m} | ${w}` : m
}

export const setCategory = (name: string, value: string): Op => ({
  kind: "set",
  key: `${CATEGORY}${name}`,
  value,
  defaults: false,
})
export const removeCategory = (name: string): Op => ({ kind: "unset", key: `${CATEGORY}${name}`, defaults: false })

const NAME = /^[A-Za-z0-9_-]{1,64}$/

/** Category edits from the shared JSON: one `set` per new or changed text, one `unset` per removed category. */
export function categoryPlan(rows: readonly SettingRow[], edited: unknown): Plan {
  const ops: Op[] = []
  const problems: Problem[] = []
  if (edited === null || typeof edited !== "object" || Array.isArray(edited)) {
    return { ops, problems: [{ key: SECTION, message: { code: "categoriesShape" } }] }
  }
  const byName = new Map(rows.map((r) => [categoryName(r), r]))
  const given = edited as Record<string, unknown>
  for (const [name, value] of Object.entries(given)) {
    const key = `${CATEGORY}${name}`
    const row = byName.get(name)
    if (value === null) continue
    if (!NAME.test(name)) {
      problems.push({ key: name, message: { code: "categoryName" } })
    } else if (typeof value !== "string") {
      problems.push({ key: name, message: { code: "categoryText" } })
    } else if (row && isReadOnly(row)) {
      if (value !== row.value) problems.push({ key: name, message: { code: "categoryHidden" } })
    } else if (value !== row?.value) {
      ops.push({ kind: "set", key, value, defaults: false })
    }
  }
  for (const [name, row] of byName) {
    if (given[name] !== undefined && given[name] !== null) continue
    if (name === FALLBACK) problems.push({ key: name, message: { code: "fallback" } })
    else ops.push({ kind: "unset", key: row.key, defaults: false })
  }
  return { ops, problems }
}

/** The shared view's JSON: categories nested by name, in the tool's order, the other shared settings flat. */
export function sharedDocument(rows: readonly SettingRow[]): Record<string, unknown> {
  const doc: Record<string, unknown> = {}
  const categories = rows.filter(isCategory)
  if (categories.length > 0) doc[SECTION] = Object.fromEntries(categories.map((r) => [categoryName(r), r.value]))
  for (const r of rows) if (!isCategory(r) && r.key !== SECTION) doc[r.key] = r.value
  return doc
}

export function sharedPlan(rows: readonly SettingRow[], edited: Record<string, unknown>, src: SettingsSource): Plan {
  const categories = rows.filter(isCategory)
  const rest = rows.filter((r) => !isCategory(r) && r.key !== SECTION)
  const { [SECTION]: given, ...others } = edited
  const flat = plan(rest, others, src, false)
  let cats: Plan = { ops: [], problems: [] }
  if (categories.length === 0) {
    if (given !== undefined)
      cats.problems.push({
        key: SECTION,
        message: { code: "categoriesUnread" },
      })
  } else if (given === undefined) {
    cats.problems.push({ key: SECTION, message: { code: "keepSection" } })
  } else {
    cats = categoryPlan(categories, given)
  }
  return { ops: [...cats.ops, ...flat.ops], problems: [...cats.problems, ...flat.problems] }
}
