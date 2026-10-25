import { describe, expect, it } from "vitest"
import { summarize } from "./doctor"

describe("summarize", () => {
  it("reads memo's problems with their fixes", () => {
    const report = { item: { problems: [{ what: "No search model", fix: "memo search model download" }] } }
    expect(summarize(report, 1)).toEqual([{ tone: "warn", text: "No search model", fix: "memo search model download" }])
  })

  it("explains an expired Zoom sign-in", () => {
    expect(summarize({ item: { state: "expired" } }, 0)[0]?.text).toMatch(/expired/)
  })

  it("passes a tool's own error message through", () => {
    expect(summarize({ error: { message: "name a profile" } }, 2)).toEqual([{ tone: "bad", text: "name a profile" }])
  })

  it("says all is well only when the tool exited cleanly", () => {
    expect(summarize({ item: {} }, 0)).toEqual([{ tone: "ok", text: "No problems found." }])
    expect(summarize({ item: {} }, 3)[0]?.tone).toBe("bad")
  })

  it("survives output it does not understand", () => {
    expect(summarize("not json", 1)[0]?.tone).toBe("bad")
  })
})
