import { describe, expect, it } from "vitest"
import { clampSpan, errorDetail, hitRow, queryReason } from "./search"

describe("hitRow", () => {
  it("reads a message hit by its chat, sender and excerpt", () => {
    const row = hitRow(
      { ref: "msg:1", timestamp: "2026-10-30T10:00:00Z", chat_title: "Family", sender_name: "Ana", excerpt: "hi" },
      0,
    )
    expect(row).toEqual({
      key: "msg:1",
      when: "2026-10-30T10:00:00Z",
      where: "Family",
      who: "Ana",
      fromMe: false,
      text: "hi",
    })
  })

  it("prefers a mail subject over its mailbox, and a note's title over its path", () => {
    expect(hitRow({ chat_title: "INBOX", email: { subject: "Re: plan" } }, 0).where).toBe("Re: plan")
    expect(hitRow({ title: "Plan", path: "plan.md", updated_at: "2026-01-01" }, 0)).toMatchObject({
      where: "Plan",
      when: "2026-01-01",
    })
  })

  it("keys a hit without a ref by its place in the page", () => {
    expect(hitRow({}, 3)).toMatchObject({ key: "#3", where: null, text: null })
  })
})

describe("clampSpan", () => {
  it("keeps a span the tool counted past the text inside the query", () => {
    expect(clampSpan({ start: 0, end: 9 }, 7)).toEqual({ start: 0, end: 7 })
    expect(clampSpan({ start: 15, end: 15 }, 13)).toEqual({ start: 13, end: 13 })
    expect(clampSpan(null, 5)).toBeNull()
  })
})

describe("queryReason", () => {
  it("knows only the closed query reasons", () => {
    expect(queryReason("query.unknown-field")).toBe("unknown-field")
    expect(queryReason("query.something-new")).toBeNull()
    expect(queryReason("input.invalid")).toBeNull()
  })

  it("takes the part of the message after the dash as the tool's detail", () => {
    expect(errorDetail('search: query.unknown-field at position 1 — no field "bogus"')).toBe('no field "bogus"')
    expect(errorDetail("search: query.invalid-syntax at position 12")).toBeNull()
  })
})
