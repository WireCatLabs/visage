import type { SettingsSource } from "@/domain/catalog"
import type { SettingRow } from "@/platform/settings-schemas"

export type Op =
  | { kind: "set"; key: string; value: string; defaults: boolean }
  | { kind: "unset"; key: string; defaults: boolean }
export type Problem = { key: string; message: string }
export type Plan = { ops: Op[]; problems: Problem[] }

const SETTING_NAME = /^[A-Za-z0-9._-]{1,128}$/
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b)
export const isReadOnly = (row: SettingRow) => row.locked !== null || row.masked

export const toDocument = (rows: readonly SettingRow[]): Record<string, unknown> =>
  Object.fromEntries(rows.map((r) => [r.key, r.value]))

export const format = (value: unknown) => `${JSON.stringify(value, null, 2)}\n`

/** What `config set` takes on its command line: JSON for tools that parse JSON, plain words for the rest. */
export function toArgument(value: unknown, jsonValues: boolean): string | Error {
  if (jsonValues) return JSON.stringify(value)
  if (typeof value === "string") return value
  if (typeof value === "number" || typeof value === "boolean") return String(value)
  if (Array.isArray(value) && value.every((v) => typeof v === "string" || typeof v === "number")) return value.join(",")
  return new Error("Give a word, a number, true or false, or a list.")
}

/** `config set --defaults` changes what every profile gets, except store-wide settings, which refuse the flag. */
const defaultsFor = (src: SettingsSource, defaultsView: boolean, row: SettingRow | undefined) =>
  src.defaults && defaultsView && !row?.scope

/** One change from the Settings tab or from the JSON tab; `null` means remove the setting from this layer. */
export function change(
  src: SettingsSource,
  defaultsView: boolean,
  row: SettingRow | undefined,
  key: string,
  value: unknown,
): Op | Problem | null {
  if (row && isReadOnly(row)) {
    if (same(row.value, value)) return null
    return {
      key,
      message: row.locked ?? "This value is hidden because it may hold a secret, so it cannot be edited here.",
    }
  }
  if (!SETTING_NAME.test(key) || key.startsWith("-")) return { key, message: "Not a setting name." }
  const defaults = defaultsFor(src, defaultsView, row)
  if (value === null || value === undefined) {
    if (!row || row.value === null) return null
    if (row.resettable) return { kind: "unset", key, defaults }
    const own = ["store", "file", defaultsView ? "defaults" : "profile"].includes(row.origin)
    // An inherited or built-in value is not in this layer, so there is nothing to remove.
    return own && !src.unset ? { key, message: "This tool cannot remove a setting. Give it a value instead." } : null
  }
  if (row && same(row.value, value)) return null
  const argument = toArgument(value, src.jsonValues)
  if (argument instanceof Error) return { key, message: argument.message }
  return { kind: "set", key, value: argument, defaults }
}

/** Turns an edited document into the `config set` / `config unset` calls that make it true. */
export function plan(
  rows: readonly SettingRow[],
  edited: Record<string, unknown>,
  src: SettingsSource,
  defaultsView: boolean,
): Plan {
  const byKey = new Map(rows.map((r) => [r.key, r]))
  const ops: Op[] = []
  const problems: Problem[] = []
  const add = (result: Op | Problem | null) => {
    if (!result) return
    if ("kind" in result) ops.push(result)
    else problems.push(result)
  }
  for (const [key, value] of Object.entries(edited)) add(change(src, defaultsView, byKey.get(key), key, value))
  for (const row of rows) {
    if (row.key in edited) continue
    if (isReadOnly(row)) {
      problems.push({ key: row.key, message: "This setting is read-only here, so it cannot be removed." })
      continue
    }
    add(change(src, defaultsView, row, row.key, null))
  }
  return { ops, problems }
}

export type Parsed = { ok: true; value: Record<string, unknown> } | { ok: false; message: string; line: number }

/** Where JSON text stops being valid: V8's parse errors often carry no position. -1 when it is valid. */
export function breakOffset(text: string): number {
  let i = 0
  const fail = (): never => {
    throw i
  }
  const space = () => {
    while (/\s/.test(text[i] ?? "")) i++
  }
  const string = () => {
    i++
    while (i < text.length && text[i] !== '"' && text[i] !== "\n") i += text[i] === "\\" ? 2 : 1
    if (text[i] !== '"') fail()
    i++
  }
  const value = (): void => {
    space()
    const c = text[i]
    if (c === "{" || c === "[") {
      const close = c === "{" ? "}" : "]"
      i++
      space()
      if (text[i] === close) {
        i++
        return
      }
      for (;;) {
        space()
        if (c === "{") {
          if (text[i] !== '"') fail()
          string()
          space()
          if (text[i] !== ":") fail()
          i++
        }
        value()
        space()
        if (text[i] === close) {
          i++
          return
        }
        if (text[i] !== ",") fail()
        i++
      }
    }
    if (c === '"') {
      string()
      return
    }
    const token = /^(-?\d+(\.\d+)?([eE][+-]?\d+)?|true|false|null)(?![\w])/.exec(text.slice(i))
    if (!token) fail()
    i += token?.[0].length ?? 0
  }
  try {
    value()
    space()
    return i < text.length ? i : -1
  } catch (at) {
    return typeof at === "number" ? at : 0
  }
}

export function parse(text: string): Parsed {
  let value: unknown
  try {
    value = JSON.parse(text)
  } catch {
    const at = Math.max(0, breakOffset(text))
    const near = text.slice(at).split("\n")[0]?.trim()
    return {
      ok: false,
      message: near
        ? `Not valid JSON from ${near.length > 28 ? `${near.slice(0, 28)}…` : near}. Is a comma or a quote missing?`
        : "Not valid JSON: something is missing at the end.",
      line: text.slice(0, at).split("\n").length,
    }
  }
  if (typeof value !== "object" || value === null || Array.isArray(value))
    return { ok: false, message: 'The settings are one JSON object: { "name": value, … }', line: 1 }
  return { ok: true, value: value as Record<string, unknown> }
}

/** The line a key is written on, so a rejection can be shown where it belongs. */
export function lineOf(text: string, setting: string): number | null {
  const needle = JSON.stringify(setting)
  const lines = text.split("\n")
  const i = lines.findIndex((l) => l.trimStart().startsWith(`${needle}`) && /^\s*"[^"]*"\s*:/.test(l))
  return i === -1 ? null : i + 1
}
