import { type SetStateAction, useCallback, useEffect, useState } from "react"
import { create } from "zustand"

/**
 * State of a half-done flow that must survive the page unmounting: the owner goes to Logs mid-guide and comes back to
 * the step they left, not to an empty section (rule 9). Lives until the app closes.
 */
const useKeptStore = create<{ values: Record<string, unknown> }>(() => ({ values: {} }))

export function useKept<T>(scope: string, key: string, initial: T | (() => T)): [T, (next: SetStateAction<T>) => void] {
  const id = `${scope}:${key}`
  const [seed] = useState(initial)
  const has = useKeptStore((s) => id in s.values)
  const stored = useKeptStore((s) => s.values[id]) as T
  const value = has ? stored : seed

  // biome-ignore lint/correctness/useExhaustiveDependencies: the seed is written once, on the first mount
  useEffect(() => {
    if (!(id in useKeptStore.getState().values)) useKeptStore.setState((s) => ({ values: { ...s.values, [id]: seed } }))
  }, [id])

  const set = useCallback(
    (next: SetStateAction<T>) =>
      useKeptStore.setState((s) => {
        const before = (id in s.values ? s.values[id] : seed) as T
        const after = typeof next === "function" ? (next as (p: T) => T)(before) : next
        return { values: { ...s.values, [id]: after } }
      }),
    [id, seed],
  )
  return [value, set]
}

/** Forgets a finished flow, so the next one starts fresh. */
export function forgetKept(scope: string) {
  useKeptStore.setState((s) => ({
    values: Object.fromEntries(Object.entries(s.values).filter(([k]) => !k.startsWith(`${scope}:`))),
  }))
}

export const resetKept = () => useKeptStore.setState({ values: {} })

/** Sets a kept value from outside the component, e.g. to open a section on a page that is not on screen yet. */
export function keep(scope: string, key: string, value: unknown) {
  useKeptStore.setState((s) => ({ values: { ...s.values, [`${scope}:${key}`]: value } }))
}
