import { create } from "zustand"
import type { StoreInfo } from "@/platform/archive-schemas"
import { platform } from "@/platform/bridge"
import type { StorageArea, StorageFolder } from "@/platform/schemas"

type StorageState = {
  areas: StorageArea[] | null
  error: string | null
  /** `undefined` while asking, `null` when no messenger tool is installed to ask. */
  info: StoreInfo | null | undefined
  infoError: string | null
  loadInfo(): Promise<void>
  clearing: string | null
  load(): Promise<void>
  clear(id: string): Promise<void>
  /** Deletes every area nothing installed uses, the shared archive last. */
  clearAll(): Promise<void>
  open(id: string, kind: StorageFolder["kind"]): Promise<void>
}

const message = (e: unknown) => (e instanceof Error ? e.message : String(e))

export const useStorage = create<StorageState>((set, get) => ({
  areas: null,
  error: null,
  clearing: null,
  info: undefined,
  infoError: null,

  async loadInfo() {
    set({ info: undefined, infoError: null })
    try {
      set({ info: await platform.storeInfo() })
    } catch (e) {
      set({ info: null, infoError: message(e) })
    }
  },

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

  async open(id, kind) {
    try {
      await platform.openFolder(id, kind)
    } catch (e) {
      set({ error: message(e) })
    }
  },
}))

export const areaBytes = (a: StorageArea) => a.folders.reduce((sum, f) => sum + f.bytes, 0)
