import { describe, expect, it } from "vitest"
import { doctorCommand, findTool, isValidProfile, setupCommand, tools } from "./catalog"

describe("catalog", () => {
  it("lists the six tools with unique ids and binaries", () => {
    expect(tools.map((t) => t.id)).toEqual(["tg", "max", "wa", "zm", "drive", "memo"])
    expect(new Set(tools.map((t) => t.bin)).size).toBe(tools.length)
  })

  it("fills the profile into setup and doctor commands", () => {
    const tg = findTool("tg")
    if (!tg) throw new Error("tg missing")
    expect(setupCommand(tg, "work")).toBe("tg work setup")
    expect(doctorCommand(tg, "work")).toBe("tg work doctor --json")
  })

  it("accepts plain profile names only", () => {
    expect(isValidProfile("personal")).toBe(true)
    expect(isValidProfile("--json")).toBe(false)
    expect(isValidProfile("a b")).toBe(false)
    expect(isValidProfile("x;rm")).toBe(false)
  })
})
