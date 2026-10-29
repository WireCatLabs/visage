import { create } from "zustand"
import { platform } from "@/platform/bridge"
import type { AppUpdate, UpdateProgress } from "@/platform/types"

export const RELEASES_URL = "https://github.com/WireCatLabs/wirecat-desktop/releases/latest"

type Phase = "available" | "downloading" | "restarting" | "failed"

type UpdateState = {
  update: AppUpdate | null
  open: boolean
  phase: Phase
  progress: UpdateProgress | null
  error: string | null
  check(): Promise<void>
  show(): void
  close(): void
  install(): Promise<void>
}

const message = (e: unknown) => (e instanceof Error ? e.message : String(e))

export const useUpdate = create<UpdateState>((set, get) => ({
  update: null,
  open: false,
  phase: "available",
  progress: null,
  error: null,

  async check() {
    // Offline, GitHub down or no release yet: nothing to offer, and nothing worth interrupting the user for.
    const update = await platform.checkUpdate().catch(() => null)
    if (update) set({ update })
  },

  show: () => set({ open: true }),
  close: () => set({ open: false }),

  async install() {
    if (get().phase === "downloading" || get().phase === "restarting") return
    set({ phase: "downloading", progress: null, error: null })
    try {
      await platform.installUpdate((progress) => set({ progress }))
    } catch (e) {
      set({ phase: "failed", error: message(e) })
      return
    }
    // The user pressed "Install and restart", so this restart is the one they asked for.
    set({ phase: "restarting" })
    await platform.restart().catch((e) => set({ phase: "failed", error: message(e) }))
  },
}))
