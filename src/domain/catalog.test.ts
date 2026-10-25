import { describe, expect, it } from "vitest"
import { doctorCommand, findTool, isValidProfile, ownerId, runTool, samePackage, setupCommand, tools } from "./catalog"

describe("catalog", () => {
  it("lists the tools with unique ids, and a binary of their own unless part of another", () => {
    expect(tools.map((t) => t.id)).toEqual(["tg", "max", "wa", "zm", "drive", "memo", "email"])
    const owners = tools.filter((t) => !t.partOf)
    expect(new Set(owners.map((t) => t.bin)).size).toBe(owners.length)
  })

  it("installs a part through the tool that owns its package", () => {
    expect(ownerId("email")).toBe("memo")
    expect(ownerId("memo")).toBe("memo")
    expect(ownerId("tg")).toBe("tg")
    expect(samePackage("email").map((t) => t.id)).toEqual(["memo", "email"])
    expect(samePackage("tg").map((t) => t.id)).toEqual(["tg"])
    for (const part of tools.filter((t) => t.partOf)) {
      const owner = findTool(ownerId(part.id))
      expect(owner && !owner.partOf).toBe(true)
      expect([part.bin, part.package]).toEqual([owner?.bin, owner?.package])
    }
  })

  it("files memo's mail runs under Email and the rest under Memo", () => {
    expect(runTool("memo", "mail inspect")).toBe("email")
    expect(runTool("memo", "sync")).toBe("memo")
    expect(runTool("memo", "mailbox")).toBe("memo")
    expect(runTool("memo", "mcp mail inspect")).toBe("email")
    expect(runTool("memo", "mcp")).toBe("memo")
    expect(runTool("tg", "mail x")).toBe("tg")
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
