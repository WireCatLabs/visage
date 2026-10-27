import { create } from "zustand"
import { findTool } from "@/domain/catalog"
import type { Claim, Registrations } from "@/platform/agents-schemas"
import { platform } from "@/platform/bridge"
import type { Profile } from "@/platform/schemas"

export type Loaded<T> = { state: "loading" } | { state: "ready"; data: T } | { state: "error"; error: string }
export type ProfileClaims = Loaded<{ items: Claim[]; more: boolean; signedOut: boolean }>

type ConnectState = {
  reach: Record<string, boolean> | null
  /** By agent id, for agents that run commands with a PATH of their own (Hermes); others use `reach`. */
  agentReach: Record<string, Record<string, boolean>>
  /** By agent id. */
  servers: Record<string, Loaded<Registrations>>
  /** By tool id, from the tool's own profile list (with its sign-in status); tools without profiles are absent. */
  profiles: Record<string, Profile[]>
  /** `<tool>/<profile>`. */
  claims: Record<string, ProfileClaims>
  /** `<tool>/<profile>` → commands its permissions block, or why they could not be read. Filled by Check. */
  access: Record<string, { blocked: number; total: number } | string>
  /** Agent ids whose Check has run in this session. */
  checked: Record<string, boolean>
  checking: Record<string, boolean>
  busy: Record<string, boolean>
  failures: Record<string, string>
  load(agents: readonly string[], tools: readonly string[]): Promise<void>
  loadServers(agent: string): Promise<void>
  /** PATH, MCP registrations (for Advanced) and every profile's permissions; starts no server. */
  check(agent: string): Promise<void>
  /** The PATH this agent's commands get, by tool id; asks again each time. */
  loadReach(agent: string): Promise<Record<string, boolean> | null>
  remove(tool: string, profile: string | null, agent: string): Promise<boolean>
  release(tool: string, profile: string, task: string): Promise<boolean>
}

const message = (e: unknown) => (e instanceof Error ? e.message : String(e))
/** Agents whose commands do not run in an ordinary terminal, so Rust reads their own PATH. */
const OWN_PATH = new Set(["hermes"])

export const pairKey = (tool: string, profile: string | null) => `${tool}/${profile ?? ""}`

export const useConnect = create<ConnectState>((set, get) => {
  const asked: Record<string, number> = {}
  const loadClaims = async (tool: string, profile: string) => {
    const key = pairKey(tool, profile)
    const ask = (asked[key] ?? 0) + 1
    asked[key] = ask
    // A revisit keeps the last answer on screen while asking again, so the tasks box does not vanish and return.
    set((s) => (s.claims[key]?.state === "ready" ? {} : { claims: { ...s.claims, [key]: { state: "loading" } } }))
    const next: ProfileClaims = await platform.taskClaims(tool, profile).then(
      (c) => ({ state: "ready", data: { items: c.items, more: c.more, signedOut: c.signedOut } }),
      (e) => ({ state: "error", error: message(e) }),
    )
    // The last answer stays on screen now, so an older ask finishing late must not replace a newer one.
    if (ask === asked[key]) set((s) => ({ claims: { ...s.claims, [key]: next } }))
  }

  const readAccess = async (tool: string, profile: string) => {
    const next = await platform.permissionsShow(tool, profile).then(
      (p) => (p.commands ? { blocked: p.commands.filter((c) => !c.available).length, total: p.commands.length } : null),
      (e) => message(e),
    )
    if (next !== null) set((s) => ({ access: { ...s.access, [pairKey(tool, profile)]: next } }))
  }

  // A write runs once at a time per key; the failure stays beside the control that started it.
  const write = async (key: string, run: () => Promise<unknown>, after: () => Promise<unknown>) => {
    if (get().busy[key]) return false
    set((s) => ({ busy: { ...s.busy, [key]: true }, failures: without(s.failures, key) }))
    try {
      await run()
      return true
    } catch (e) {
      set((s) => ({ failures: { ...s.failures, [key]: message(e) } }))
      return false
    } finally {
      await after().catch(() => undefined)
      set((s) => ({ busy: without(s.busy, key) }))
    }
  }

  return {
    reach: null,
    agentReach: {},
    servers: {},
    profiles: {},
    claims: {},
    access: {},
    checked: {},
    checking: {},
    busy: {},
    failures: {},

    async load(agents, tools) {
      const withProfiles = tools.filter((id) => findTool(id)?.profiles && !findTool(id)?.partOf)
      const reach = platform
        .terminalReach()
        .then((reach) => set({ reach }))
        .catch(() => set({ reach: null }))
      const servers = agents.map((a) => get().loadServers(a))
      const own = agents.filter((a) => OWN_PATH.has(a)).map((a) => get().loadReach(a))
      const profiles = withProfiles.map(async (id) => {
        const list = (await platform.listProfiles(id).catch(() => null)) ?? []
        set((s) => ({ profiles: { ...s.profiles, [id]: list } }))
        if (!findTool(id)?.tasks) return
        // A profile never signed in has no tasks, and asking would only leave a failed run in the owner's logs.
        const signedOut = Object.fromEntries(
          list
            .filter((p) => p.signedIn === false)
            .map((p): [string, ProfileClaims] => [
              pairKey(id, p.name),
              { state: "ready", data: { items: [], more: false, signedOut: true } },
            ]),
        )
        set((s) => ({ claims: { ...s.claims, ...signedOut } }))
        await Promise.all(list.filter((p) => p.signedIn !== false).map((p) => loadClaims(id, p.name)))
      })
      await Promise.all([reach, ...own, ...servers, ...profiles])
    },

    async loadServers(agent) {
      set((s) => ({ servers: { ...s.servers, [agent]: { state: "loading" } } }))
      const next: Loaded<Registrations> = await platform.mcpRegistrations(agent).then(
        (data) => ({ state: "ready", data }),
        (e) => ({ state: "error", error: message(e) }),
      )
      set((s) => ({ servers: { ...s.servers, [agent]: next } }))
    },

    async check(agent) {
      if (get().checking[agent]) return
      set((s) => ({ checking: { ...s.checking, [agent]: true } }))
      try {
        await Promise.all([
          platform
            .terminalReach()
            .then((reach) => set({ reach }))
            .catch(() => undefined),
          get().loadServers(agent),
          OWN_PATH.has(agent) ? get().loadReach(agent) : undefined,
        ])
        const everyProfile = Object.entries(get().profiles).flatMap(([tool, profiles]) =>
          findTool(tool)?.permissions ? profiles.map((p) => [tool, p.name] as const) : [],
        )
        await Promise.all(everyProfile.map(([tool, profile]) => readAccess(tool, profile)))
      } finally {
        set((s) => ({ checking: without(s.checking, agent), checked: { ...s.checked, [agent]: true } }))
      }
    },

    async loadReach(agent) {
      if (!OWN_PATH.has(agent)) {
        const reach = await platform.terminalReach().catch(() => null)
        if (reach) set({ reach })
        return reach
      }
      const reach = await platform.terminalReach(agent).catch(() => null)
      if (reach) set((s) => ({ agentReach: { ...s.agentReach, [agent]: reach } }))
      return reach
    },

    remove: (tool, profile, agent) =>
      write(
        `mcp:${agent}:${pairKey(tool, profile)}`,
        () => platform.mcpRemove(tool, profile, agent),
        () => get().loadServers(agent),
      ),

    release: (tool, profile, task) =>
      write(
        `task:${pairKey(tool, profile)}:${task}`,
        () => platform.taskRelease(tool, profile, task),
        () => loadClaims(tool, profile),
      ),
  }
})

function without<T>(map: Record<string, T>, key: string): Record<string, T> {
  const { [key]: _, ...rest } = map
  return rest
}
