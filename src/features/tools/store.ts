import { create } from "zustand"
import type { InstallSession } from "@/domain/status"
import { platform } from "@/platform/bridge"
import type { ToolState } from "@/platform/schemas"
import { useSystem } from "../system/store"

type LoadError = { message: string } | null

type ToolsState = {
  installs: Record<string, ToolState["installs"]>
  /** null while asking npm; an empty object when npm could not answer. */
  latest: Record<string, string | null> | null
  sessions: Record<string, InstallSession>
  expanded: string | null
  refreshing: boolean
  error: LoadError
  refresh(): Promise<void>
  install(id: string): Promise<void>
  cancel(id: string): Promise<void>
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
        await runInstall(next)
      }
    } finally {
      draining = false
    }
  }

  const runInstall = async (id: string) => {
    patchSession(id, (s) => ({ ...s, step: "check" }))
    try {
      await platform.install(id, (e) => {
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
    await redetect().catch(() => undefined)
  }

  const redetect = async () => {
    const detected = await platform.detectTools()
    set({ installs: Object.fromEntries(detected.map((d) => [d.id, d.installs])) })
  }

  return {
    installs: {},
    latest: null,
    sessions: {},
    expanded: null,
    refreshing: false,
    error: null,

    async refresh() {
      set({ refreshing: true, error: null })
      try {
        await Promise.all([useSystem.getState().refresh(), redetect()])
      } catch (e) {
        set({ error: { message: message(e) } })
      } finally {
        set({ refreshing: false })
      }
      platform.latestVersions().then(
        (latest) => set({ latest }),
        () => set({ latest: {} }),
      )
    },

    // npm and pnpm do not like two global installs at once, so installs queue and run one by one.
    install(id) {
      const current = get().sessions[id]
      if (current && !current.outcome) return Promise.resolve()
      set((st) => ({ sessions: { ...st.sessions, [id]: { step: "queued", log: [], outcome: null } } }))
      return drain()
    },

    async cancel(id) {
      if (get().sessions[id]?.step === "queued") {
        patchSession(id, (s) => ({
          ...s,
          outcome: { event: "failed", reason: "cancelled", message: "Installation cancelled.", hint: null },
        }))
        return
      }
      await platform.cancelInstall(id)
    },

    dismiss(id) {
      set((st) => {
        const { [id]: _, ...rest } = st.sessions
        return { sessions: rest }
      })
    },

    toggle(id) {
      set((st) => ({ expanded: st.expanded === id ? null : id }))
    },
  }
})
