import { describe, expect, it } from "vitest"
import { ambiguousTerm, clampSpan, errorDetail, hitRow, queryReason, quoteValue, suggestSearch } from "./search"

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
    values: {
      chat: [
        { value: "-1001", label: "Design crit" },
        { value: "-1002", label: "Family" },
        { value: "-1003", label: "Accountant" },
        { value: "-1001762030832", label: "kyrillic", detail: "kyrillic" },
        { value: "-1001334573228", label: "kyrillic" },
      ],
      from: [],
    },
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

  it("shows a chat by its title and inserts its id, which names exactly one chat", () => {
    const found = suggestSearch('invoice chat:"des', 17, ctx)
    expect(found.items.map((i) => i.insert)).toEqual(['chat:"-1001"'])
    expect(found.items[0]).toMatchObject({ label: "Design crit", example: "-1001" })
    expect(found.from).toBe(8)
    expect(labels("chat:acc")).toEqual(["Accountant"])
  })

  it("tells two chats with one title apart by username and id", () => {
    const found = suggestSearch("chat:@kyr", 9, ctx).items
    expect(found.map((i) => [i.label, i.note, i.insert])).toEqual([["kyrillic", "@kyrillic", 'chat:"-1001762030832"']])
    expect(suggestSearch("chat:kyr", 8, ctx).items.map((i) => i.insert)).toEqual([
      'chat:"-1001762030832"',
      'chat:"-1001334573228"',
    ])
  })

  it("keeps a quoted value with spaces as one term while it is typed", () => {
    expect(suggestSearch('chat:"Design c', 14, ctx).items.map((i) => i.label)).toEqual(["Design crit"])
  })
})

describe("quoteValue", () => {
  it("leaves plain words bare, in any script", () => {
    expect(quoteValue("photo")).toBe("photo")
    expect(quoteValue("Кириллица")).toBe("Кириллица")
    expect(quoteValue("report.pdf")).toBe("report.pdf")
    expect(quoteValue("12345")).toBe("12345")
  })

  it("quotes whatever the parser reads as an operator, a wildcard or a separator", () => {
    expect(quoteValue("@kyrillic")).toBe('"@kyrillic"')
    expect(quoteValue("Design crit")).toBe('"Design crit"')
    expect(quoteValue("-1001762030832")).toBe('"-1001762030832"')
    expect(quoteValue("a:b")).toBe('"a:b"')
    expect(quoteValue("(work)")).toBe('"(work)"')
    expect(quoteValue("inv*")).toBe('"inv*"')
    expect(quoteValue("Кафе ☕")).toBe('"Кафе ☕"')
    expect(quoteValue("🎉")).toBe('"🎉"')
    expect(quoteValue("OR")).toBe('"OR"')
    expect(quoteValue("trailing.")).toBe('"trailing."')
  })

  it("escapes quotes and backslashes inside the quotes", () => {
    expect(quoteValue('say "hi"')).toBe('"say \\"hi\\""')
    expect(quoteValue("a\\b")).toBe('"a\\\\b"')
  })
})

describe("ambiguousTerm", () => {
  it("finds the chat term a refused name came from", () => {
    const q = 'date>=3d chat:"Design crit" chat:kyrillic'
    expect(ambiguousTerm(q, "chat", ["@kyrillic", "kyrillic"])).toEqual({ start: 28, end: 41, sign: "" })
    expect(ambiguousTerm("-chat:kyr x", "chat", ["kyrillic"])).toEqual({ start: 0, end: 9, sign: "-" })
    expect(ambiguousTerm("invoice", "chat", ["kyrillic"])).toBeNull()
  })
})

describe("catalog examples", () => {
  it("are written the way the bar quotes a value, so each one is a query the tool accepts", async () => {
    const { tools } = await import("./catalog")
    for (const tool of tools)
      for (const f of tool.search?.fields ?? []) {
        if (f.name === "date") continue
        const value = f.example.slice(f.name.length + 1)
        const raw = value.startsWith('"') ? value.slice(1, -1).replace(/\\(.)/g, "$1") : value
        expect(f.example, `${tool.id} ${f.name}`).toBe(`${f.name}:${quoteValue(raw)}`)
      }
  })
})
