import { describe, expect, it } from "vitest"
import { type BreakdownLike, breakdownRows, type GroupLike, totals } from "./archive"
import { describeEntry } from "./files"

const g = (provider: string, key: string | null, c: Partial<GroupLike>): GroupLike => ({
  provider,
  key,
  accounts: 0,
  chats: 0,
  messages: 0,
  emails: 0,
  documents: 0,
  meetings: 0,
  ...c,
})

const breakdown: BreakdownLike = {
  providers: [g("chat", null, { accounts: 1, messages: 4 }), g("telegram", null, { accounts: 2, messages: 900 })],
  chatKinds: [g("telegram", "group", { chats: 3, messages: 600 }), g("telegram", "dialog", { messages: 300 })],
  accounts: [g("telegram", "personal", { messages: 900 })],
  years: [
    g("telegram", "2025", { messages: 500 }),
    g("whatsapp", "2025", { messages: 100 }),
    g("telegram", "2026", { messages: 400 }),
  ],
  attachmentKinds: [{ owner: "message", kind: "photo", count: 7, bytes: 2048 }],
}

describe("breakdownRows", () => {
  it("names messengers, sorts largest first and scales bars to the largest", () => {
    const rows = breakdownRows(breakdown, "provider", String)
    expect(rows.map((r) => r.label)).toEqual(["Telegram", "Chat"])
    expect(rows[0]?.share).toBe(1)
    expect(rows[1]?.detail).toBe("1 account · 4 messages")
  })

  it("adds providers up per year, newest first", () => {
    const rows = breakdownRows(breakdown, "year", String)
    expect(rows.map((r) => [r.label, r.value])).toEqual([
      ["2026", 400],
      ["2025", 600],
    ])
    expect(rows[1]?.detail).toBe("Telegram 500 · WhatsApp 100")
  })

  it("labels chat kinds and files in words", () => {
    expect(breakdownRows(breakdown, "chatKind", String).map((r) => r.label)).toEqual([
      "Telegram · Groups",
      "Telegram · One-to-one",
    ])
    expect(breakdownRows(breakdown, "attachment", (n) => `${n} B`)[0]).toMatchObject({
      label: "Photo in messages",
      value: 7,
      detail: "2048 B",
    })
  })

  it("lists only the totals the store has", () => {
    expect(totals({ messages: 5, chats: 2, identities: 9 }).map((t) => t.label)).toEqual(["Messages", "Chats"])
  })
})

describe("describeEntry", () => {
  it("marks sign-in material and explains known entries", () => {
    expect(describeEntry("tg", "state", "sessions")?.secret).toBe(true)
    expect(describeEntry("max", "state", "profiles")?.secret).toBe(true)
    expect(describeEntry("drive", "config", "client_secret_[client id].json")?.secret).toBe(true)
    expect(describeEntry("shared", "state", "wirecat.db")?.what).toMatch(/shared archive/)
    expect(describeEntry("max", "cache", "personal.db")?.what).toMatch(/older per-profile/)
    expect(describeEntry("tg", "state", "something-new")).toBeNull()
  })
})
