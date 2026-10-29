import { describe, expect, it } from "vitest"
import { LANGS, type Messages, plural, systemLang } from "."

const modules = import.meta.glob<Record<string, Messages<unknown>>>("/src/**/messages*.{ts,tsx}", { eager: true })
const catalogs = Object.entries(modules).flatMap(([file, mod]) =>
  Object.entries(mod).map(([name, messages]) => ({ where: `${file} ${name}`, messages })),
)

/** Every key with its kind: a string, or a function and how many slots it takes. */
function shape(value: unknown, path = ""): string[] {
  if (typeof value === "string") return [`${path}: string`]
  if (typeof value === "function") return [`${path}: (${value.length})`]
  if (typeof value === "object" && value !== null)
    return Object.entries(value).flatMap(([k, v]) => shape(v, path ? `${path}.${k}` : k))
  return [`${path}: ${typeof value}`]
}

function leaves(value: unknown, path = ""): [string, unknown][] {
  if (typeof value === "object" && value !== null)
    return Object.entries(value).flatMap(([k, v]) => leaves(v, path ? `${path}.${k}` : k))
  return [[path, value]]
}

describe("message catalogs", () => {
  it("are found", () => {
    expect(catalogs.length).toBeGreaterThan(2)
  })

  it.each(catalogs)("$where has every key in every language", ({ messages }) => {
    const english = shape(messages.en)
    for (const lang of LANGS) expect(shape(messages[lang])).toEqual(english)
  })

  it.each(catalogs)("$where has Russian written in Cyrillic, not English left over", ({ messages }) => {
    const english = new Map(leaves(messages.en))
    const leftover = leaves(messages.ru).filter(
      ([key, v]) => !/[а-яё]/i.test(String(v)) && String(v) !== String(english.get(key)),
    )
    expect(leftover.map(([key]) => key)).toEqual([])
  })

  it("counts in each language's own plural forms", () => {
    const runs = { one: "# запуск", few: "# запуска", many: "# запусков", other: "# запуска" }
    expect([1, 3, 5, 21, 1.5].map((n) => plural("ru", n, runs))).toEqual([
      "1 запуск",
      "3 запуска",
      "5 запусков",
      "21 запуск",
      "1,5 запуска",
    ])
    expect(plural("es", 1_000_000, { one: "# mensaje", many: "# de mensajes", other: "# mensajes" })).toBe(
      "1.000.000 de mensajes",
    )
    expect(plural("en", 2, { one: "# run", other: "# runs" })).toBe("2 runs")
  })

  it("follows the system language when it is Russian or Spanish, else English", () => {
    expect(systemLang(["ru-RU", "en-US"])).toBe("ru")
    expect(systemLang(["es-MX"])).toBe("es")
    expect(systemLang(["de-DE", "es-ES"])).toBe("es")
    expect(systemLang(["en-GB", "ru"])).toBe("en")
    expect(systemLang([])).toBe("en")
  })
})
