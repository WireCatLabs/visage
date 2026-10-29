import { describe, expect, it } from "vitest"
import { cellAction, type SkillReportLike, skillCell } from "./skills"

const status = (targets: SkillReportLike["targets"]): SkillReportLike => ({ source: "status", targets })

describe("skillCell", () => {
  it("needs a newer tool for Hermes when the report does not list it, and offers no install", () => {
    const old = status([{ target: "claude", installed: "1.0.0", state: "current" }])
    const cell = skillCell({ target: "hermes", cliVersion: "1.0.0", report: old })
    expect(cell.kind).toBe("unsupported")
    expect(cellAction(cell)).toBeNull()
    expect(skillCell({ target: "agents", cliVersion: "1.0.0", report: old }).kind).toBe("missing")
    const knows = status([{ target: "hermes", installed: null, state: "missing" }])
    expect(skillCell({ target: "hermes", cliVersion: "1.0.0", report: knows }).kind).toBe("missing")
  })

  it("takes the state the tool reports", () => {
    const report = status([
      { target: "claude", installed: "0.88.0", state: "current" },
      { target: "agents", installed: "0.85.2", state: "stale" },
    ])
    expect(skillCell({ target: "claude", cliVersion: "0.88.0", report })).toEqual({
      kind: "current",
      installed: "0.88.0",
    })
    expect(skillCell({ target: "agents", cliVersion: "0.88.0", report })).toEqual({
      kind: "stale",
      installed: "0.85.2",
    })
  })

  it("compares doctor versions with the tool's own, and a missing target is missing", () => {
    const report: SkillReportLike = {
      source: "doctor",
      targets: [
        { target: "claude", installed: "0.90.0", state: null },
        { target: "agents", installed: null, state: "missing" },
      ],
    }
    expect(skillCell({ target: "claude", cliVersion: "0.95.0", report }).kind).toBe("stale")
    expect(skillCell({ target: "claude", cliVersion: "0.90.0", report }).kind).toBe("current")
    expect(skillCell({ target: "agents", cliVersion: "0.95.0", report }).kind).toBe("missing")
  })

  it("is unknown for a tool without skill status, until an install writes a version", () => {
    const report: SkillReportLike = { source: "none", targets: [] }
    const unknown = skillCell({ target: "agents", cliVersion: "0.74.0", report })
    expect(unknown).toEqual({ kind: "unknown" })
    expect(cellAction(unknown)).toBe("Update")
    expect(skillCell({ target: "agents", cliVersion: "0.74.0", report, written: "0.74.0" }).kind).toBe("current")
  })

  it("is checking before an answer and failed after an error", () => {
    expect(skillCell({ target: "claude", cliVersion: "1.0.0" }).kind).toBe("checking")
    expect(skillCell({ target: "claude", cliVersion: "1.0.0", error: "boom" })).toEqual({
      kind: "failed",
      message: "boom",
    })
    expect(cellAction({ kind: "missing" })).toBe("Install")
    expect(cellAction({ kind: "current", installed: "1.0.0" })).toBeNull()
  })
})
