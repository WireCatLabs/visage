import { create } from "zustand"
import type { BackupFile, Backups, ResetPreview } from "@/platform/backup-schemas"
import { platform } from "@/platform/bridge"
import { useStorage } from "./store"

export type Progress = { step: "starting" | "copying" | "compressing" | "encrypting"; done: number; total: number }
/** A failed clear: the backup before it did not finish, or what the tool answered. */
export type ClearError = { backupFailed: true } | { backupFailed: false; message: string }
export type Made = { file: BackupFile; folder: string; storeBytes: number; millis: number }

type BackupState = {
  /** `undefined` while reading the folder. */
  backups: Backups | undefined
  listError: string | null
  progress: Progress | null
  made: Made | null
  backupError: string | null
  /** `undefined` while asking the tool; `null` when no messenger tool is installed. */
  preview: ResetPreview | null | undefined
  previewError: string | null
  clearing: boolean
  clearError: ClearError | null
  /** The empty store's schema once a clear finished. */
  cleared: number | null
  loadBackups(): Promise<void>
  /** Resolves true once the backup is in the backups folder. The password goes to the tool and is not kept here. */
  backup(password?: string): Promise<boolean>
  cancel(): Promise<void>
  open(name: string | null): Promise<void>
  loadPreview(): Promise<void>
  /** With `backupFirst`, nothing is cleared unless the backup finishes. */
  clear(backupFirst: boolean): Promise<boolean>
}

const message = (e: unknown) => (e instanceof Error ? e.message : String(e))

export const useBackups = create<BackupState>((set, get) => ({
  backups: undefined,
  listError: null,
  progress: null,
  made: null,
  backupError: null,
  preview: undefined,
  previewError: null,
  clearing: false,
  clearError: null,
  cleared: null,

  async loadBackups() {
    try {
      set({ backups: await platform.listBackups(), listError: null })
    } catch (e) {
      set({ listError: message(e) })
    }
  },

  async backup(password) {
    if (get().progress) return false
    set({ progress: { step: "starting", done: 0, total: 0 }, backupError: null, made: null })
    // The result arrives as an event; the call itself only says the command was refused.
    const finished = new Promise<boolean>((resolve) => {
      platform
        .storeBackup((e) => {
          if (e.event === "copying" || e.event === "compressing") {
            set({ progress: { step: e.event, done: e.done, total: e.total } })
          } else if (e.event === "encrypting") {
            set({ progress: { step: "encrypting", done: 0, total: 0 } })
          } else if (e.event === "done") {
            set({
              progress: null,
              made: { file: e.file, folder: e.folder, storeBytes: e.storeBytes, millis: e.millis },
            })
            resolve(true)
          } else {
            set({ progress: null, backupError: e.event === "failed" ? e.message : null })
            resolve(false)
          }
        }, password)
        .catch((e) => {
          set({ progress: null, backupError: message(e) })
          resolve(false)
        })
    })
    const ok = await finished
    await get().loadBackups()
    return ok
  },

  async cancel() {
    await platform.cancelStoreBackup()
  },

  async open(name) {
    try {
      await platform.openBackups(name)
    } catch (e) {
      set({ listError: message(e) })
    }
  },

  async loadPreview() {
    set({ preview: undefined, previewError: null })
    try {
      set({ preview: await platform.storeResetPreview() })
    } catch (e) {
      set({ preview: null, previewError: message(e) })
    }
  },

  async clear(backupFirst) {
    set({ clearError: null, cleared: null })
    if (backupFirst && !(await get().backup())) {
      set({ clearError: { backupFailed: true } })
      return false
    }
    set({ clearing: true })
    try {
      set({ cleared: await platform.storeReset() })
      return true
    } catch (e) {
      set({ clearError: { backupFailed: false, message: message(e) } })
      return false
    } finally {
      set({ clearing: false })
      const storage = useStorage.getState()
      storage.loadInfo()
      storage.loadTables()
      storage.load()
      get().loadPreview()
    }
  },
}))

export const percent = (p: Progress) => (p.total > 0 ? Math.min(100, Math.round((p.done / p.total) * 100)) : 0)
