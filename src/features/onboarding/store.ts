import { create } from "zustand"
import { createJSONStorage, persist, type StateStorage } from "zustand/middleware"

export const STEPS = [
  { id: "welcome", label: "Welcome" },
  { id: "computer", label: "Your computer" },
  { id: "choose", label: "Choose tools" },
  { id: "install", label: "Install" },
  { id: "agents", label: "Agents" },
  { id: "signin", label: "Sign in" },
  { id: "done", label: "Done" },
] as const

export type StepId = (typeof STEPS)[number]["id"]

/** Absent on the first start; "later" when the owner postponed it, "done" once finished. */
type Status = "new" | "later" | "done"

type OnboardingState = {
  status: Status
  open: boolean
  step: StepId
  chosen: string[]
  go(step: StepId): void
  toggle(id: string): void
  later(): void
  finish(): void
  reopen(step?: StepId): void
  hide(): void
}

// Private windows, previews and some webviews refuse storage outright; the flow must still work for this session.
const safeStorage: StateStorage = {
  getItem: (name) => {
    try {
      return window.localStorage.getItem(name)
    } catch {
      return null
    }
  },
  setItem: (name, value) => {
    try {
      window.localStorage.setItem(name, value)
    } catch {}
  },
  removeItem: (name) => {
    try {
      window.localStorage.removeItem(name)
    } catch {}
  },
}

export const useOnboarding = create<OnboardingState>()(
  persist(
    (set) => ({
      status: "new",
      open: true,
      step: "welcome",
      chosen: [],
      go: (step) => set({ step }),
      toggle: (id) =>
        set((s) => ({ chosen: s.chosen.includes(id) ? s.chosen.filter((c) => c !== id) : [...s.chosen, id] })),
      later: () => set({ status: "later", open: false }),
      finish: () => set({ status: "done", open: false }),
      reopen: (step) => set((s) => ({ open: true, step: step ?? s.step })),
      hide: () => set({ open: false }),
    }),
    {
      name: "wirecat.onboarding",
      storage: createJSONStorage(() => safeStorage),
      partialize: (s) => ({ status: s.status }),
      merge: (persisted, current) => {
        const status = (persisted as { status?: Status } | undefined)?.status ?? "new"
        return { ...current, status, open: status === "new" }
      },
    },
  ),
)
