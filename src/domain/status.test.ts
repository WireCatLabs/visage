import { describe, expect, it } from "vitest"
import { isNewer, toolStatus } from "./status"

const install = (version: string | null, problem: string | null = null) => ({
  path: "~/bin/tg",
  version,
  manager: "npm",
  problem,
})

describe("toolStatus", () => {
  it("is checking until detection answers", () => {
    expect(toolStatus(undefined, null)).toEqual({ kind: "checking" })
  })

  it("is missing with no executable on PATH", () => {
    expect(toolStatus([], "1.0.0")).toEqual({ kind: "missing" })
  })

  it("is broken when the first copy does not start", () => {
    expect(toolStatus([install(null, "SyntaxError")], null)).toEqual({ kind: "broken", problem: "SyntaxError" })
  })

  it("offers an update only when npm reports a newer version", () => {
    expect(toolStatus([install("0.6.0")], "0.7.0")).toEqual({ kind: "outdated", version: "0.6.0", latest: "0.7.0" })
    expect(toolStatus([install("0.7.0")], "0.7.0")).toEqual({ kind: "ready", version: "0.7.0" })
    expect(toolStatus([install("0.7.0")], null)).toEqual({ kind: "ready", version: "0.7.0" })
  })

  it("follows a running install over what is on disk", () => {
    const session = { operation: "install" as const, step: "install" as const, log: [], outcome: null }
    expect(toolStatus([], "1.0.0", session)).toEqual({ kind: "working", operation: "install", step: "install" })
  })
})

describe("isNewer", () => {
  it("compares numerically, not as text", () => {
    expect(isNewer("0.10.0", "0.9.9")).toBe(true)
    expect(isNewer("1.0.0", "1.0.0")).toBe(false)
    expect(isNewer("1.0.0-beta.1", "0.9.0")).toBe(true)
  })
})
