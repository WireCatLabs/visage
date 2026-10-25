import { create } from "zustand"

/** The section on screen, so one page can send the owner to another (Agents → Logs for a session). */
export const useNav = create<{ active: string; go(section: string): void }>((set) => ({
  active: "tools",
  go: (active) => set({ active }),
}))
