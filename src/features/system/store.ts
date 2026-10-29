import { create } from "zustand"
import { platform } from "@/platform/bridge"
import type { Readiness } from "@/platform/schemas"

type SystemState = {
  readiness: Readiness | null
  error: string | null
  refresh(): Promise<void>
}

export const useSystem = create<SystemState>((set) => ({
  readiness: null,
  error: null,
  async refresh() {
    try {
      set({ readiness: await platform.readiness(), error: null })
    } catch (e) {
      set({ error: e instanceof Error ? e.message : String(e) })
    }
  },
}))
