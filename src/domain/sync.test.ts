import { describe, expect, it } from "vitest"
import { advice, clock, share } from "./sync"

describe("a failed sync sorted into the way out", () => {
  it("keeps progress on the time limit and points to another sync on a lock", () => {
    expect(advice({ message: "x", code: "timeout", reason: null, run: null }).kind).toBe("timeout")
    for (const reason of ["profile.locked", "sync.running", "device.in-use", "app.busy"]) {
      expect(advice({ message: "x", code: "provider_unavailable", reason, run: null }).kind).toBe("busy")
    }
  })

  it("tells a refused command apart, with an update and a report", () => {
    for (const f of [
      { message: "MAX stopped with the error validation_error.", code: "validation_error", reason: null, run: null },
      { message: "chat Family failed", code: "usage_error", reason: "input.invalid", run: null },
    ]) {
      const a = advice(f)
      expect([a.kind, a.update, a.report]).toEqual(["refused", true, true])
    }
  })

  it("sends a signed-out profile to sign in, and an unknown failure to a report", () => {
    expect(advice({ message: "x", code: "authentication_error", reason: null, run: null }).signIn).toBe(true)
    const unknown = advice({ message: "boom", code: null, reason: null, run: null })
    expect([unknown.kind, unknown.report, unknown.logs]).toEqual(["failed", true, false])
  })
})

it("prints elapsed time like a clock", () => {
  expect([clock(4_000), clock(725_000), clock(3_729_000)]).toEqual(["0:04", "12:05", "1:02:09"])
})

it("counts chats on the bar when the tool prints its progress, and stays indeterminate when it does not", () => {
  expect(share({ chats: 40, chatsDone: 3, fetched: 1240 })).toBe(8)
  expect([share({ chats: null, chatsDone: null, fetched: 5 }), share(null)]).toEqual([null, null])
})
