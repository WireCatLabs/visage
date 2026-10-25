import type { StoreInfo } from "./archive-schemas"
import type { BackupEvent, BackupFile, ResetPreview } from "./backup-schemas"
import { DATA } from "./mock-archive"
import { delay } from "./mock-delay"
import type { Platform } from "./types"

// `?backups=none` starts with no backups; `?backup-fail=disk` refuses for want of disk space. `?clear=old` has a tool
// older than `store reset --dry-run`, so Clear stays off; `?clear=busy` has a sync holding the store, so it refuses.

const params = new URLSearchParams(typeof window === "undefined" ? "" : window.location.search)
const STORE = "~/.local/share/WireCat/wirecat.db"
const STORE_BYTES = 1_449_984_000
const FOLDER = "~/WireCat backups"
const DAY = 86_400_000

const stamp = (at: number) => {
  const d = new Date(at)
  const p = (n: number) => String(n).padStart(2, "0")
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}`
}

const file = (at: number, bytes: number): BackupFile => ({
  name: `wirecat-store-${stamp(at)}.zip`,
  bytes,
  modified: at,
})

export function backupMock(asksArchive: () => string | null) {
  const now = Date.now()
  const files: BackupFile[] =
    params.get("backups") === "none" ? [] : [file(now - 2 * DAY, 391_118_848), file(now - 9 * DAY, 377_487_360)]
  let cancelled = false
  let cleared = false

  const api: Pick<
    Platform,
    "storeBackup" | "cancelStoreBackup" | "listBackups" | "openBackups" | "storeResetPreview" | "storeReset"
  > = {
    async storeBackup(onEvent: (e: BackupEvent) => void) {
      cancelled = false
      const started = Date.now()
      await delay(300)
      if (params.get("backup-fail") === "disk") {
        onEvent({
          event: "failed",
          message:
            "Not enough free disk space. The backup needs about 2.0 GB free in ~/WireCat backups, and there is 812 MB. Free some space and try again.",
        })
        return
      }
      const total = cleared ? 1_204_224 : STORE_BYTES
      for (const phase of ["copying", "compressing"] as const) {
        for (let i = 0; i <= 20; i++) {
          if (cancelled) return onEvent({ event: "cancelled" })
          onEvent({ event: phase, done: Math.round((total * i) / 20), total })
          await delay(110)
        }
      }
      const made = file(Date.now(), Math.round(total * 0.27))
      if (!files.some((f) => f.name === made.name)) files.unshift(made)
      onEvent({ event: "done", file: made, folder: FOLDER, storeBytes: total, millis: Date.now() - started })
    },
    async cancelStoreBackup() {
      cancelled = true
    },
    async listBackups() {
      await delay(200)
      return { folder: FOLDER, files: [...files] }
    },
    async openBackups() {},
    async storeResetPreview(): Promise<ResetPreview | null> {
      await delay(700)
      const answeredBy = asksArchive()
      if (!answeredBy) return null
      const old = params.get("clear") === "old"
      return {
        answeredBy,
        bin: answeredBy,
        supported: !old,
        exists: !old,
        files: old ? [] : [STORE, `${STORE}-wal`, `${STORE}-shm`],
        bytes: old ? 0 : STORE_BYTES,
        schema: old ? null : 33,
        tables: old ? [] : DATA.map(([name, rows]) => ({ name, rows: cleared ? 0 : rows })),
        inUse: old ? null : params.get("clear") === "busy",
      }
    },
    async storeReset() {
      await delay(1200)
      if (params.get("clear") === "busy") {
        throw new Error(
          "Storage is in use: a sync, an import, a server or an agent's WireCat MCP connection has it open. Nothing was deleted. Try again when it finishes, or close the agent sessions that use WireCat. (the store is open in process 4242 — stop it first)",
        )
      }
      cleared = true
      return 33
    },
  }

  /** After a clear the archive counts nothing, so the page shows what an emptied store looks like. */
  const afterClear = (info: StoreInfo | null): StoreInfo | null =>
    info && cleared
      ? {
          ...info,
          fileBytes: 1_204_224,
          walBytes: 0,
          rows: Object.fromEntries(Object.keys(info.rows).map((k) => [k, 0])),
          breakdown: null,
        }
      : info

  return { api, afterClear }
}
