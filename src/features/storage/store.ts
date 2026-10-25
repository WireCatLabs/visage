import { create } from "zustand"
import { platform } from "@/platform/bridge"
import type { StorageArea } from "@/platform/schemas"

type StorageState = {
  areas: StorageArea[] | null
  error: string | null
  clearing: string | null
  load(): Promise<void>
  clear(id: string): Promise<void>
  /** Deletes every area nothing installed uses, the shared archive last. */
  clearAll(): Promise<void>
}

const message = (e: unknown) => (e instanceof Error ? e.message : String(e))

export const useStorage = create<StorageState>((set, get) => ({
  areas: null,
  error: null,
  clearing: null,

  async load() {
    try {
      set({ areas: await platform.storage(), error: null })
    } catch (e) {
      set({ error: message(e) })
    }
  },

  async clear(id) {
    set({ clearing: id, error: null })
    try {
      await platform.clearStorage(id)
    } catch (e) {
      set({ error: message(e) })
    } finally {
      set({ clearing: null })
      await get().load()
    }
  },

  async clearAll() {
    const ids = (get().areas ?? [])
      .filter((a) => a.folders.length > 0 && a.usedBy.length === 0)
      .map((a) => a.id)
      .sort((a, b) => Number(a === "shared") - Number(b === "shared"))
    for (const id of ids) await get().clear(id)
  },
}))

export const areaBytes = (a: StorageArea) => a.folders.reduce((sum, f) => sum + f.bytes, 0)
