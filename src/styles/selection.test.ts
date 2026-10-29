import { readFileSync } from "node:fs"
import { expect, it } from "vitest"

const css = readFileSync("src/styles/index.css", "utf8").replace(/\/\*[\s\S]*?\*\//g, "")
const rules = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map(([, selector, body]) => ({
  selector: (selector ?? "").trim(),
  body: body ?? "",
}))

it("writes every user-select with the -webkit- prefix too, which is all WebKitGTK reads", () => {
  const unprefixed = rules
    .filter((r) => /(^|[^-])user-select\s*:/.test(r.body) && !/-webkit-user-select\s*:/.test(r.body))
    .map((r) => r.selector)
  expect(unprefixed).toEqual([])
})

it("leaves the page selectable and turns selection off only on chrome", () => {
  const body = rules.find((r) => r.selector === "body")
  expect(body?.body).not.toMatch(/user-select/)
  const chrome = rules.find((r) => /user-select\s*:\s*none/.test(r.body))
  expect(chrome?.selector).toMatch(/\bbutton\b/)
  expect(chrome?.selector).toMatch(/data-tauri-drag-region/)
})
