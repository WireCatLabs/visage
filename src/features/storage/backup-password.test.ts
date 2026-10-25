import { describe, expect, it } from "vitest"
import { passwordProblem, strength } from "./backup-password"

describe("backup password", () => {
  it("rates length above the kinds of characters", () => {
    expect(strength("Ab1!").label).toBe("Too short")
    expect(strength("abcdefgh").label).toBe("Weak")
    expect(strength("abcdefghijkl").label).toBe("Fair")
    expect(strength("four unrelated words").label).toBe("Strong")
    expect(strength("Abcdef1!xyzq").label).toBe("Strong")
  })

  it("says what is missing, in the order the owner meets it", () => {
    expect(passwordProblem("", "")).toBe("Type a password.")
    expect(passwordProblem("secret words ", "")).toBe("A password cannot start or end with a space.")
    expect(passwordProblem("seven77", "")).toBe("Use at least 8 characters.")
    expect(passwordProblem("eight888", "")).toBe("Type the password again.")
    expect(passwordProblem("eight888", "eight88")).toBe("The two passwords differ.")
    expect(passwordProblem("eight888", "eight888")).toBeNull()
  })
})
