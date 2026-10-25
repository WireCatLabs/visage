import { create } from "zustand"
import { ownerId } from "@/domain/catalog"
import type { InstallSession, Operation } from "@/domain/status"
import { platform } from "@/platform/bridge"
import type { ToolState } from "@/platform/schemas"
import { useSystem } from "../system/store"
import { installedOf, useCompat } from "./compat-store"
import { readSaved, save } from "./saved"

type LoadError = { message: string } | null

type ToolsState = {
  installs: Record<string, ToolState["installs"]>
  /** null while asking npm; an empty object when npm could not answer. */
  latest: Record<string, string | null> | null
  /** Keyed by the package owner's id (`ownerId`): a part's install is its owner's. */
  sessions: Record<string, InstallSession>
  expanded: string | null
  /** A check is running; rows keep showing the last answer meanwhile. */
  refreshing: boolean
  checkingLatest: boolean
  /** The tools answered in this app session; until then `installs` may be the last session's. */
  checked: boolean
  error: LoadError
  /** `fresh` (Check again) asks every copy and npm again instead of reusing answers for unchanged programs. */
  refresh(fresh?: boolean): Promise<void>
  /** Set when the last installed tool was just removed, so the app can offer to delete the data left behind. */
  offerClear: boolean
  install(id: string): Promise<void>
  uninstall(id: string): Promise<void>
  cancel(id: string): Promise<void>
  closeOffer(): void
  dismiss(id: string): void
  toggle(id: string): void
}

const message = (e: unknown) => (e instanceof Error ? e.message : String(e))

export const useTools = create<ToolsState>((set, get) => {
  const patchSession = (id: string, f: (s: InstallSession) => InstallSession) =>
    set((st) => {
      const s = st.sessions[id]
      return s ? { sessions: { ...st.sessions, [id]: f(s) } } : {}
    })

  let draining = false
  const drain = async () => {
    if (draining) return
    draining = true
    try {
      for (;;) {
        const next = Object.entries(get().sessions).find(([, s]) => s.step === "queued" && !s.outcome)?.[0]
        if (!next) break
        await run(next)
      }
    } finally {
      draining = false
    }
  }

  const run = async (id: string) => {
    const operation = get().sessions[id]?.operation ?? "install"
    patchSession(id, (s) => ({ ...s, step: "check" }))
    try {
      await platform[operation](id, (e) => {
        if (e.event === "step") patchSession(id, (s) => ({ ...s, step: e.step }))
        else if (e.event === "log") patchSession(id, (s) => ({ ...s, log: [...s.log.slice(-499), e.line] }))
        else patchSession(id, (s) => ({ ...s, outcome: e }))
      })
    } catch (e) {
      patchSession(id, (s) => ({
        ...s,
        outcome: { event: "failed", reason: "failed", message: message(e), hint: null },
      }))
    }
    await redetect(true).catch(() => undefined)
    if (operation === "install" && get().sessions[id]?.outcome?.event === "done")
      await useCompat.getState().checkAfterInstall(id, () => installedOf(get().installs))
    const st = get()
    const nothingLeft = Object.values(st.installs).every((copies) => copies.length === 0)
    if (operation === "uninstall" && st.sessions[id]?.outcome?.event === "removed" && nothingLeft) {
      set({ offerClear: true })
    }
  }

  // npm and pnpm do not like two global operations at once, so they queue and run one by one.
  const enqueue = (id: string, operation: Operation) => {
    const current = get().sessions[id]
    if (current && !current.outcome) return Promise.resolve()
    set((st) => ({ sessions: { ...st.sessions, [id]: { operation, step: "queued", log: [], outcome: null } } }))
    return drain()
  }

  // Only the real app keeps an answer across starts; the browser build's mock scenarios must each start clean.
  const keep = platform.kind === "tauri"
  const persist = () => {
    if (!keep) return
    const { installs, latest } = get()
    save({ tools: Object.entries(installs).map(([id, copies]) => ({ id, installs: copies })), latest })
  }
  const saved = keep ? readSaved() : null

  const redetect = async (fresh: boolean) => {
    const detected = await platform.detectTools(fresh)
    set({ installs: Object.fromEntries(detected.map((d) => [d.id, d.installs])), checked: true })
    persist()
  }

  return {
    installs: Object.fromEntries((saved?.tools ?? []).map((t) => [t.id, t.installs])),
    latest: saved?.latest ?? null,
    sessions: {},
    offerClear: false,
    expanded: null,
    refreshing: false,
    checkingLatest: false,
    checked: false,
    error: null,

    async refresh(fresh = false) {
      set({ refreshing: true, checkingLatest: true, error: null })
      // npm answers slowly, so the update check runs alongside detection instead of after it.
      platform.latestVersions(fresh).then(
        (latest) => {
          set({ latest, checkingLatest: false })
          persist()
        },
        () => set((st) => ({ latest: st.latest ?? {}, checkingLatest: false })),
      )
      const system = useSystem.getState()
      try {
        await Promise.all([fresh || !system.readiness ? system.refresh() : null, redetect(fresh)])
        useCompat.getState().load()
      } catch (e) {
        set({ error: { message: message(e) } })
      } finally {
        set({ refreshing: false })
      }
    },

    install: (id) => enqueue(ownerId(id), "install"),
    uninstall: (id) => enqueue(ownerId(id), "uninstall"),
    closeOffer: () => set({ offerClear: false }),

    async cancel(given) {
      const id = ownerId(given)
      if (get().sessions[id]?.step === "queued") {
        patchSession(id, (s) => ({
          ...s,
          outcome: { event: "failed", reason: "cancelled", message: "Cancelled before it started.", hint: null },
        }))
        return
      }
      await platform.cancelInstall(id)
    },

    dismiss(id) {
      set((st) => {
        const { [ownerId(id)]: _, ...rest } = st.sessions
        return { sessions: rest }
      })
    },

    toggle(id) {
      set((st) => ({ expanded: st.expanded === id ? null : id }))
    },
  }
})
