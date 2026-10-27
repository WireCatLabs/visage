import { delay } from "./mock-delay"
import type { LastSync, SyncEvent } from "./sync-schemas"
import type { Platform } from "./types"

// Each tool's sync as Rust reports it: stages read from its notes, then the counts. `?sync=<tool>` starts that tool's
// sync for personal (`src/app/scenarios.ts`); `?sync-hold=<tool>` keeps it running; `?sync-fail=<tool>` ends it with
// another sync holding the profile; `?sync-timeout=<tool>` at the time limit; `?sync=never` has no profile synced yet.

const params = new URLSearchParams(typeof window === "undefined" ? "" : window.location.search)
const MIN = 60_000

const LAST: Record<string, { ago: number | null; left?: number }> = {
  "tg:personal": { ago: 12 * MIN },
  "tg:work": { ago: null },
  "max:personal": { ago: 3 * 24 * 60 * MIN },
  "zm:personal": { ago: 26 * 60 * MIN },
  "drive:personal": { ago: null, left: 340 },
  "memo:": { ago: 2 * 60 * MIN },
  "email:personal": { ago: 2 * 60 * MIN },
  "email:": { ago: 2 * 60 * MIN },
}
const finished: Record<string, number> = {}

const STAGES: Record<string, string[]> = {
  tg: ["Fetching messages", "Waiting for the service's rate limit", "Fetching messages"],
  max: ["Fetching messages", "Waiting for the service's rate limit", "Fetching messages"],
  memo: ["Reading mail", "Preparing search"],
  email: ["Reading mail"],
}

const DONE: Record<string, SyncEvent> = {
  tg: { event: "done", summary: { new: 1240, places: 3, failed: 0, left: 0, complete: true } },
  max: { event: "done", summary: { new: 86, places: 2, failed: 1, left: 0, complete: false } },
  zm: { event: "done", summary: { new: 2, places: 0, failed: 0, left: 0, complete: true } },
  drive: { event: "done", summary: { new: 200, places: 0, failed: 0, left: 140, complete: false } },
  memo: { event: "done", summary: { new: 37, places: 2, failed: 0, left: 0, complete: true } },
  email: { event: "done", summary: { new: 0, places: 0, failed: 0, left: 0, complete: true } },
}

export function syncMock(): Pick<Platform, "syncRun" | "syncStop" | "syncLast"> {
  const stops = new Map<string, () => void>()
  const keyOf = (id: string, profile: string | null) => `${id}:${profile ?? ""}`
  return {
    async syncRun(id, profile, onEvent) {
      const key = keyOf(id, profile)
      let stopped = false
      stops.set(key, () => {
        stopped = true
      })
      const wait = async (ms: number) => {
        const until = Date.now() + ms
        while (!stopped && Date.now() < until) await delay(100)
        return stopped
      }
      const hold = params.get("sync-hold") === id
      // tg prints cli-core's progress lines; max, from an older cli-core, only its notes.
      const counts = id === "tg"
      let chatsDone = 0
      let fetched = 0
      if (counts) onEvent({ event: "progress", chats: 40, chatsDone, fetched })
      const stages = STAGES[id] ?? []
      for (let n = 0; hold || n < stages.length; n++) {
        const stage = stages[n % Math.max(1, stages.length)]
        if (stage) onEvent({ event: "stage", stage })
        if (await wait(1800)) break
        if (counts) {
          chatsDone = Math.min(39, chatsDone + 1 + (n % 3))
          fetched += 140 + n * 37
          onEvent({ event: "progress", chats: 40, chatsDone, fetched })
        }
      }
      if (!stopped && stages.length === 0 && (await wait(4000))) stopped = true
      stops.delete(key)
      if (stopped) return onEvent({ event: "stopped" })
      if (params.get("sync-fail") === id) {
        return onEvent({
          event: "failed",
          message: "another sync or knowledge operation holds this profile's lock; retry later",
          code: "provider_unavailable",
          reason: "profile.locked",
          run: "20261027T121457Z-sync-db4f0a",
        })
      }
      if (params.get("sync-timeout") === id) {
        return onEvent({
          event: "failed",
          message: "the command took longer than 2h",
          code: "timeout",
          reason: "command.timed-out",
          run: null,
        })
      }
      finished[key] = Date.now()
      onEvent(DONE[id] ?? { event: "done", summary: { new: 0, places: 0, failed: 0, left: 0, complete: true } })
    },
    async syncStop(id, profile) {
      stops.get(keyOf(id, profile))?.()
    },
    async syncLast(id, profile): Promise<LastSync> {
      await delay(300)
      const key = keyOf(id, profile)
      const at = finished[key]
      if (at) return { at: new Date(at).toISOString(), left: id === "drive" ? 140 : null, known: true }
      const last = params.get("sync") === "never" ? undefined : LAST[key]
      return {
        at: last?.ago == null ? null : new Date(Date.now() - last.ago).toISOString(),
        left: last?.left ?? null,
        known: true,
      }
    },
  }
}
