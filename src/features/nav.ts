import { create } from "zustand"

type Nav = {
  /** The section on screen, so one page can send the owner to another (Agents → Logs for a session). */
  active: string
  past: string[]
  next: string[]
  go(section: string): void
  back(): void
  forward(): void
}

// An in-memory stack, not window.history: the webview may map mouse buttons to its own history, and the mock's
// `?state=` query must stay as loaded.
export const useNav = create<Nav>((set) => ({
  active: "tools",
  past: [],
  next: [],
  go: (section) => set((s) => (section === s.active ? s : { active: section, past: [...s.past, s.active], next: [] })),
  back: () =>
    set((s) => {
      const to = s.past.at(-1)
      return to === undefined ? s : { active: to, past: s.past.slice(0, -1), next: [s.active, ...s.next] }
    }),
  forward: () =>
    set((s) => {
      const [to, ...rest] = s.next
      return to === undefined ? s : { active: to, past: [...s.past, s.active], next: rest }
    }),
}))
