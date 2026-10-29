import { describe, expect, it } from "vitest"
import { passwordProblem, strength } from "./backup-password"

describe("backup password", () => {
  it("rates length above the kinds of characters", () => {
    expect(strength("Ab1!")).toBe(0)
    expect(strength("abcdefgh")).toBe(1)
    expect(strength("abcdefghijkl")).toBe(2)
    expect(strength("four unrelated words")).toBe(3)
    expect(strength("Abcdef1!xyzq")).toBe(3)
  })

  it("says what is missing, in the order the owner meets it", () => {
    expect(passwordProblem("", "")).toBe("empty")
    expect(passwordProblem("secret words ", "")).toBe("space")
    expect(passwordProblem("seven77", "")).toBe("short")
    expect(passwordProblem("eight888", "")).toBe("repeat")
    expect(passwordProblem("eight888", "eight88")).toBe("differ")
    expect(passwordProblem("eight888", "eight888")).toBeNull()
  })
})
