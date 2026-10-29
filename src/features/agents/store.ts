import { create } from "zustand"
import type { SkillTarget } from "@/domain/skills"
import type { Agent, SkillReport } from "@/platform/agents-schemas"
import { platform } from "@/platform/bridge"

type ToolSkill = { report: SkillReport | null; error: string | null }

type AgentsState = {
  agents: Agent[] | null
  agentsError: string | null
  /** By tool id; absent while that tool is being asked. */
  skills: Record<string, ToolSkill>
  /** `<tool>:<target>` → the version an install in this session wrote. */
  written: Record<string, string | null>
  busy: Record<string, boolean>
  failures: Record<string, string>
  /** Asking again; the last answers stay on screen meanwhile. */
  refreshing: boolean
  /** Every tool answered once this session; the page asks for logs and claims only after, so skills come first. */
  answered: boolean
  /** Asks every installed tool at once; each row fills in as its tool answers. */
  load(installed: readonly string[]): Promise<void>
  install(id: string, target: SkillTarget): Promise<void>
  /** One at a time: each install is a separate process writing to the same folders. */
  installAll(cells: readonly [string, SkillTarget][]): Promise<void>
}

export const cellKey = (id: string, target: SkillTarget) => `${id}:${target}`

const message = (e: unknown) => (e instanceof Error ? e.message : String(e))

export const useAgents = create<AgentsState>((set, get) => ({
  agents: null,
  agentsError: null,
  skills: {},
  written: {},
  busy: {},
  failures: {},
  refreshing: false,
  answered: false,

  async load(installed) {
    set({ refreshing: true, failures: {} })
    const agents = platform
      .detectAgents()
      .then((agents) => set({ agents, agentsError: null }))
      .catch((e) => set({ agents: [], agentsError: message(e) }))
    const skills = installed.map((id) =>
      platform
        .skillStatus(id)
        .then((report) => ({ report, error: null }))
        .catch((e) => ({ report: null, error: message(e) }))
        .then((result) => set((s) => ({ skills: { ...s.skills, [id]: result } }))),
    )
    await Promise.all([agents, ...skills])
    set({ refreshing: false, answered: true })
  },

  async install(id, target) {
    const key = cellKey(id, target)
    if (get().busy[key]) return
    set((s) => ({ busy: { ...s.busy, [key]: true }, failures: without(s.failures, key) }))
    try {
      const version = await platform.skillInstall(id, target)
      set((s) => ({ written: { ...s.written, [key]: version } }))
      const report = await platform.skillStatus(id).catch(() => null)
      if (report) set((s) => ({ skills: { ...s.skills, [id]: { report, error: null } } }))
    } catch (e) {
      set((s) => ({ failures: { ...s.failures, [key]: message(e) } }))
    } finally {
      set((s) => ({ busy: without(s.busy, key) }))
    }
  },

  async installAll(cells) {
    for (const [id, target] of cells) await get().install(id, target)
  },
}))

function without<T>(map: Record<string, T>, key: string): Record<string, T> {
  const { [key]: _, ...rest } = map
  return rest
}
