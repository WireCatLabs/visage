import { describe, expect, it } from "vitest"
import { advice } from "@/domain/sync"
import { syncMessages } from "./messages-sync"

const { en, ru, es } = syncMessages
const summary = { new: 1240, places: 3, failed: 0, left: 0, complete: true }

describe("the words a finished sync ends with", () => {
  it("counts what came in and where", () => {
    expect(en.sync.result("messages", summary)).toBe("Synced 1,240 new messages in 3 chats")
    expect(en.sync.result("messages", { ...summary, new: 1, places: 1 })).toBe("Synced 1 new message in 1 chat")
    expect(en.sync.result("files", { ...summary, new: 200, places: 0 })).toBe("Synced 200 files")
    expect(en.sync.result("mail", { ...summary, new: 0 })).toBe("Up to date: no new emails")
  })

  it("agrees with the count in Russian and Spanish", () => {
    expect(ru.sync.result("messages", summary)).toBe("Получено: 1\u00a0240 новых сообщений из 3 чатов")
    expect(ru.sync.result("messages", { ...summary, new: 21, places: 1 })).toBe(
      "Получено: 21 новое сообщение из 1 чата",
    )
    expect(ru.sync.result("files", { ...summary, new: 3, places: 0 })).toBe("Получено: 3 файла")
    expect(es.sync.result("messages", { ...summary, new: 1, places: 1 })).toBe(
      "Sincronizado: 1 mensaje nuevo en 1 chat",
    )
  })

  it("says what is left and that syncing again continues", () => {
    expect(en.sync.next("messages", summary)).toBeNull()
    expect(en.sync.next("files", { ...summary, left: 140, complete: false })).toBe(
      "140 files still to come: sync again to continue.",
    )
    expect(en.sync.next("messages", { ...summary, failed: 1, complete: false })).toMatch(/^1 chat could not be read/)
    expect(en.sync.next("messages", { ...summary, complete: false })).toMatch(/more history/)
  })

  it("counts chats while it runs", () => {
    const p = { chats: 40, chatsDone: 3, fetched: 1240 }
    expect(en.sync.progress(p)).toBe("Chat 4 of 40 · 1,240 new messages")
    expect(en.sync.progress({ ...p, chatsDone: 40 })).toBe("Chat 40 of 40 · 1,240 new messages")
    expect(ru.sync.progress({ ...p, fetched: 2 })).toBe("Чат 4 из 40 · 2 новых сообщения")
  })
})

describe("a failed sync in plain words", () => {
  it("never repeats a refusing tool's own words", () => {
    const f = { message: "chat Family failed", code: "usage_error", reason: "input.invalid", run: null }
    const a = advice(f)
    expect(en.sync.advice[a.kind]).toBe("The tool refused the command")
    expect(en.sync.adviceText(a.kind, "personal", f.message, Boolean(a.logs))).not.toContain(f.message)
  })

  it("shows an unknown failure as the tool said it", () => {
    expect(en.sync.adviceText("failed", "work", "boom", false)).toBe("boom")
    expect(en.sync.adviceText("failed", "work", "", false)).toBe("The sync ended without saying how.")
  })
})
