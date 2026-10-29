export const MIN_LENGTH = 8

/** 0 is too short; 1 weak, 2 fair, 3 strong. */
export type Strength = 0 | 1 | 2 | 3

/** A rough hint from length and kinds of characters; length counts most, so a few unrelated words rate well. */
export function strength(password: string): Strength {
  const length = [...password].length
  if (length < MIN_LENGTH) return 0
  const kinds = [/[a-z]/, /[A-Z]/, /[0-9]/, /[^A-Za-z0-9]/].filter((r) => r.test(password)).length
  const score = (length >= 12 ? 1 : 0) + (length >= 16 ? 1 : 0) + (kinds >= 3 ? 1 : 0)
  if (score >= 2) return 3
  if (score === 1) return 2
  return 1
}

export type PasswordProblem = "empty" | "space" | "short" | "repeat" | "differ"

/** Why the password cannot be used yet, or null. `repeat` is only judged once something is typed in it. */
export function passwordProblem(password: string, repeat: string): PasswordProblem | null {
  if (password.length === 0) return "empty"
  // The tool trims what it reads, so a space at either end would not be part of the password it seals with.
  if (password.trim() !== password) return "space"
  if ([...password].length < MIN_LENGTH) return "short"
  if (repeat.length === 0) return "repeat"
  if (repeat !== password) return "differ"
  return null
}
