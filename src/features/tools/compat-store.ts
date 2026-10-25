import { create } from "zustand"
import { findTool } from "@/domain/catalog"
import { type Fit, fits, type Installed, type StoreCompat } from "@/domain/compat"
import { platform } from "@/platform/bridge"
import type { ToolState } from "@/platform/schemas"

/** An install that will move the shared store to a schema other installed tools cannot read. */
export type UpgradeWarning = { id: string; to: number; locksOut: string[]; mayLockOut: string[] }

type CompatState = {
  /** `undefined` while asking, `null` when the tools could not be asked. */
  compat: StoreCompat | null | undefined
  error: string | null
  warning: UpgradeWarning | null
  load(): Promise<void>
  /** The schema moves on the tool's next run, not on install, so asking right after the install still warns in time. */
  checkAfterInstall(id: string, installed: () => Record<string, Installed>): Promise<void>
  dismiss(): void
}

export const useCompat = create<CompatState>((set, get) => ({
  compat: undefined,
  error: null,
  warning: null,

  async load() {
    try {
      set({ compat: await platform.storeCompat(), error: null })
    } catch (e) {
      set({ compat: null, error: e instanceof Error ? e.message : String(e) })
    }
  },

  async checkAfterInstall(id, installed) {
    await get().load()
    const compat = get().compat
    if (!compat) return
    const all = fits(compat, installed())
    const fit: Fit | undefined = all[id]
    const mayLockOut = Object.keys(all).filter((other) => all[other]?.kind === "unknown")
    if (fit?.kind === "upgrades" && fit.locksOut.length > 0)
      set({ warning: { id, to: fit.to, locksOut: fit.locksOut, mayLockOut } })
  },

  dismiss: () => set({ warning: null }),
}))

export function installedOf(installs: Record<string, ToolState["installs"]>): Record<string, Installed> {
  return Object.fromEntries(
    Object.entries(installs).map(([id, copies]) => [
      id,
      { bin: findTool(id)?.bin ?? id, version: copies[0]?.version ?? null },
    ]),
  )
}
