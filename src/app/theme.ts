import { useEffect } from "react"
import { create } from "zustand"
import { createJSONStorage, persist } from "zustand/middleware"

export type ThemeChoice = "system" | "light" | "dark"

type ThemeState = { choice: ThemeChoice; set(choice: ThemeChoice): void }

export const useTheme = create<ThemeState>()(
  persist((set) => ({ choice: "system", set: (choice) => set({ choice }) }), {
    name: "wirecat.theme",
    storage: createJSONStorage(() => localStorage),
  }),
)

const media = () => window.matchMedia("(prefers-color-scheme: dark)")

export function resolveTheme(choice: ThemeChoice, systemDark: boolean): "light" | "dark" {
  return choice === "system" ? (systemDark ? "dark" : "light") : choice
}

/** Keeps `<html data-theme>` in step with the choice and, for "system", with the OS setting. */
export function useApplyTheme() {
  const choice = useTheme((s) => s.choice)
  useEffect(() => {
    const apply = () => {
      document.documentElement.dataset.theme = resolveTheme(choice, media().matches)
    }
    apply()
    const m = media()
    m.addEventListener("change", apply)
    return () => m.removeEventListener("change", apply)
  }, [choice])
}
