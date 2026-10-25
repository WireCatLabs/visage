import { create } from "zustand"
import type { StoreCheck, StoreInfo, TableList } from "@/platform/archive-schemas"
import { platform } from "@/platform/bridge"
import type { StorageArea, StorageFolder } from "@/platform/schemas"

type StorageState = {
  areas: StorageArea[] | null
  error: string | null
  /** `undefined` while asking, `null` when no messenger tool is installed to ask. */
  info: StoreInfo | null | undefined
  infoError: string | null
  /** When the tool answered, so the page can say how fresh the numbers are. */
  infoAt: number | null
  loadInfo(): Promise<void>
  /** `undefined` while asking; sizes stay from the last measurement until the list is asked for again. */
  tables: TableList | null | undefined
  tablesError: string | null
  /** When a size measurement started, while it runs; and how long the last one took. */
  measuring: number | null
  measuredIn: number | null
  loadTables(): Promise<void>
  measureSizes(): Promise<void>
  checking: number | null
  check: StoreCheck | null | undefined
  checkedIn: number | null
  checkError: string | null
  runCheck(): Promise<void>
  clearing: string | null
  /** Asking again while the last answers stay on screen. */
  revalidating: boolean
  /** Folders, storage facts and tables together, as the page asks on every visit. */
  refresh(): Promise<void>
  load(): Promise<void>
  clear(id: string): Promise<void>
  /** Deletes every area nothing installed uses, the shared archive last. */
  clearAll(): Promise<void>
  open(id: string, kind: StorageFolder["kind"], entry?: string): Promise<void>
}

const message = (e: unknown) => (e instanceof Error ? e.message : String(e))

export const useStorage = create<StorageState>((set, get) => ({
  areas: null,
  error: null,
  clearing: null,
  revalidating: false,
  info: undefined,
  infoError: null,
  infoAt: null,
  tables: undefined,
  tablesError: null,
  measuring: null,
  measuredIn: null,
  checking: null,
  check: undefined,
  checkedIn: null,
  checkError: null,

  async refresh() {
    set({ revalidating: true })
    await Promise.all([get().load(), get().loadInfo(), get().loadTables()])
    set({ revalidating: false })
  },

  // The last list stays on screen while the tool is asked again.
  async loadTables() {
    if (get().measuring !== null) return
    set({ tablesError: null })
    try {
      set({ tables: await platform.storeTables(false) })
    } catch (e) {
      set({ tables: null, tablesError: message(e) })
    }
  },

  async measureSizes() {
    if (get().measuring !== null) return
    const started = Date.now()
    set({ measuring: started, tablesError: null })
    try {
      set({ tables: await platform.storeTables(true), measuredIn: Date.now() - started })
    } catch (e) {
      set({ tablesError: message(e) })
    } finally {
      set({ measuring: null })
    }
  },

  async runCheck() {
    if (get().checking !== null) return
    const started = Date.now()
    set({ checking: started, checkError: null })
    try {
      set({ check: await platform.storeCheck(), checkedIn: Date.now() - started })
    } catch (e) {
      set({ checkError: message(e) })
    } finally {
      set({ checking: null })
    }
  },

  async loadInfo() {
    set({ infoError: null })
    try {
      set({ info: await platform.storeInfo(), infoAt: Date.now() })
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

  async open(id, kind, entry) {
    try {
      await platform.openFolder(id, kind, entry)
    } catch (e) {
      set({ error: message(e) })
    }
  },
}))

export const areaBytes = (a: StorageArea) => a.folders.reduce((sum, f) => sum + f.bytes, 0)
