import { describe, expect, it } from "vitest"
import { clampSpan, errorDetail, hitRow, queryReason, suggestSearch } from "./search"

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

describe("suggestSearch", () => {
  const words = {
    group: { who: "Who", where: "Where", when: "When", what: "What", files: "Files and links" },
    describe: (f: string) => `about ${f}`,
    more: "More fields…",
    examplesHeading: "Try",
    datesHeading: "Dates",
    valuesHeading: (f: string) => `Values for ${f}`,
  } as const
  const fields = [
    { name: "from", group: "who", example: 'from:"Ana Ruiz"', top: true },
    { name: "chat", group: "where", example: "chat:x", top: true },
    { name: "date", group: "when", example: "date>=7d", top: true },
    { name: "transcript", group: "what", example: "transcript:x", top: false },
  ] as const
  const ctx = {
    fields: [...fields],
    values: { chat: ["Design crit", "Family", "Accountant"], from: [] },
    all: false,
    now: new Date(2026, 9, 31),
    words,
    dateWords: {
      last7: "7",
      last30: "30",
      today: "t",
      yesterday: "y",
      thisMonth: "m",
      since: "s",
      between: "b",
    },
    exampleWords: Object.fromEntries(
      [
        "photosWeek",
        "filesMonth",
        "links30",
        "voice30",
        "mailWeek",
        "important30",
        "invoice30",
        "changed30",
        "titled",
        "words",
      ].map((k) => [k, k]),
    ) as Record<import("./search").ExampleId, string>,
    what: "messages",
  }
  const labels = (q: string, at = q.length, all = false) =>
    suggestSearch(q, at, { ...ctx, all }).items.map((i) => i.label)

  it("offers ready queries in an empty box, each replacing the whole query", () => {
    const found = suggestSearch("", 0, ctx)
    expect(found.items[1]).toMatchObject({ label: "has:file date:[2026-10-01 TO *]", whole: true })
  })

  it("shows the first fields by group, the rest behind More fields, and finds a hidden one by name", () => {
    expect(labels("x ")).toEqual(["from:", "chat:", "date", "More fields…"])
    expect(labels("x ", 2, true)).toContain("transcript:")
    expect(labels("x tr")).toEqual(["transcript:"])
    expect(suggestSearch("x ", 2, ctx).items[0]).toMatchObject({
      note: "about from",
      example: 'from:"Ana Ruiz"',
      group: "Who",
    })
  })

  it("offers dates the tools accept after date, narrowed as typed", () => {
    expect(labels("date")).toEqual([
      "date>=7d",
      "date>=30d",
      "date:today",
      "date:yesterday",
      "date>=2026-10-01",
      "date:[2026-10-01 TO *]",
      "date:[2026-10-01 TO 2026-10-31]",
    ])
    expect(labels("date>=")).toEqual(["date>=7d", "date>=30d", "date>=2026-10-01"])
    expect(labels("-date:to")).toEqual(["date:today"])
    expect(suggestSearch("-date:to", 8, ctx).items[0]?.insert).toBe("-date:today")
  })

  it("offers values after a field, quoting the ones with spaces", () => {
    const found = suggestSearch('invoice chat:"des', 17, ctx)
    expect(found.items.map((i) => i.insert)).toEqual(['chat:"Design crit"'])
    expect(found.from).toBe(8)
    expect(labels("chat:a")).toEqual(["Accountant", "Family"])
  })

  it("keeps a quoted value with spaces as one term while it is typed", () => {
    expect(suggestSearch('chat:"Design c', 14, ctx).items.map((i) => i.label)).toEqual(["Design crit"])
  })
})
