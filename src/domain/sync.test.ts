import { describe, expect, it } from "vitest"
import { advice, clock, progressLine, resultLine, resultNext, share } from "./sync"

const summary = { new: 1240, places: 3, failed: 0, left: 0, complete: true }

describe("the words a finished sync ends with", () => {
  it("counts what came in and where", () => {
    expect(resultLine("messages", summary)).toBe("Synced 1,240 new messages in 3 chats")
    expect(resultLine("messages", { ...summary, new: 1, places: 1 })).toBe("Synced 1 new message in 1 chat")
    expect(resultLine("files", { ...summary, new: 200, places: 0 })).toBe("Synced 200 files")
    expect(resultLine("mail", { ...summary, new: 0 })).toBe("Up to date: no new emails")
  })

  it("says what is left and that syncing again continues", () => {
    expect(resultNext("messages", summary)).toBeNull()
    expect(resultNext("files", { ...summary, left: 140, complete: false })).toBe(
      "140 files still to come: sync again to continue.",
    )
    expect(resultNext("messages", { ...summary, failed: 1, complete: false })).toMatch(/^1 chat could not be read/)
    expect(resultNext("messages", { ...summary, complete: false })).toMatch(/more history/)
  })
})

describe("a failed sync in plain words", () => {
  it("keeps progress on the time limit and points to another sync on a lock", () => {
    expect(advice({ message: "x", code: "timeout", reason: null, run: null }, "personal").title).toBe(
      "Time limit reached",
    )
    for (const reason of ["profile.locked", "sync.running", "device.in-use", "app.busy"]) {
      expect(advice({ message: "x", code: "provider_unavailable", reason, run: null }, "personal").title).toBe(
        "Another sync is running",
      )
    }
  })

  it("tells a refused command in fixed words, with an update and a report, never the tool's text", () => {
    for (const f of [
      { message: "MAX stopped with the error validation_error.", code: "validation_error", reason: null, run: null },
      { message: "chat Family failed", code: "usage_error", reason: "input.invalid", run: null },
    ]) {
      const a = advice(f, "personal")
      expect([a.title, a.update, a.report]).toEqual(["The tool refused the command", true, true])
      expect(a.text).not.toContain(f.message)
    }
  })

  it("sends a signed-out profile to sign in, and an unknown failure to a report", () => {
    expect(advice({ message: "x", code: "authentication_error", reason: null, run: null }, "work").signIn).toBe(true)
    const unknown = advice({ message: "boom", code: null, reason: null, run: null }, "work")
    expect([unknown.text, unknown.report]).toEqual(["boom", true])
  })
})

it("prints elapsed time like a clock", () => {
  expect([clock(4_000), clock(725_000), clock(3_729_000)]).toEqual(["0:04", "12:05", "1:02:09"])
})

it("counts chats on the bar when the tool prints its progress, and stays indeterminate when it does not", () => {
  const p = { chats: 40, chatsDone: 3, fetched: 1240 }
  expect([share(p), progressLine(p)]).toEqual([8, "Chat 4 of 40 · 1,240 new messages"])
  expect(progressLine({ ...p, chatsDone: 40 })).toBe("Chat 40 of 40 · 1,240 new messages")
  expect([share({ chats: null, chatsDone: null, fetched: 5 }), share(null), progressLine(null)]).toEqual([
    null,
    null,
    null,
  ])
})
