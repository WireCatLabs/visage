export const MIN_LENGTH = 8

export type Strength = { level: 0 | 1 | 2 | 3; label: "Too short" | "Weak" | "Fair" | "Strong" }

/** A rough hint from length and kinds of characters; length counts most, so a few unrelated words rate well. */
export function strength(password: string): Strength {
  const length = [...password].length
  if (length < MIN_LENGTH) return { level: 0, label: "Too short" }
  const kinds = [/[a-z]/, /[A-Z]/, /[0-9]/, /[^A-Za-z0-9]/].filter((r) => r.test(password)).length
  const score = (length >= 12 ? 1 : 0) + (length >= 16 ? 1 : 0) + (kinds >= 3 ? 1 : 0)
  if (score >= 2) return { level: 3, label: "Strong" }
  if (score === 1) return { level: 2, label: "Fair" }
  return { level: 1, label: "Weak" }
}

/** Why the password cannot be used yet, or null. `repeat` is only judged once something is typed in it. */
export function passwordProblem(password: string, repeat: string): string | null {
  if (password.length === 0) return "Type a password."
  // The tool trims what it reads, so a space at either end would not be part of the password it seals with.
  if (password.trim() !== password) return "A password cannot start or end with a space."
  if ([...password].length < MIN_LENGTH) return `Use at least ${MIN_LENGTH} characters.`
  if (repeat.length === 0) return "Type the password again."
  if (repeat !== password) return "The two passwords differ."
  return null
}
