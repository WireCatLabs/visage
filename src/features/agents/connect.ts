import { create } from "zustand"
import { serverName } from "@/domain/agents"
import { findTool } from "@/domain/catalog"
import type { Claim, McpHealth, Registrations } from "@/platform/agents-schemas"
import { platform } from "@/platform/bridge"

export type Loaded<T> = { state: "loading" } | { state: "ready"; data: T } | { state: "error"; error: string }
export type ProfileClaims = Loaded<{ items: Claim[]; more: boolean }>

type ConnectState = {
  reach: Record<string, boolean> | null
  /** By agent id. */
  servers: Record<string, Loaded<Registrations>>
  /** By tool id; tools without profiles are absent. */
  profiles: Record<string, string[]>
  /** `<tool>/<profile>` → the tool's own `mcp check`, or why it failed. */
  health: Record<string, McpHealth | string>
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
  /** The tool's own `mcp check` for every profile this agent has connected. */
  check(agent: string): Promise<void>
  probe(tool: string, profile: string): Promise<McpHealth | string>
  add(tool: string, profile: string, agent: string, allowWrites: boolean): Promise<boolean>
  remove(tool: string, profile: string | null, agent: string): Promise<boolean>
  release(tool: string, profile: string, task: string): Promise<boolean>
}

const message = (e: unknown) => (e instanceof Error ? e.message : String(e))
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
      (c) => ({ state: "ready", data: { items: c.items, more: c.more } }),
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
    servers: {},
    profiles: {},
    health: {},
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
      const profiles = withProfiles.map(async (id) => {
        const list = await platform.listProfiles(id).catch(() => null)
        const names = (list ?? []).map((p) => p.name)
        set((s) => ({ profiles: { ...s.profiles, [id]: names } }))
        if (findTool(id)?.tasks) await Promise.all(names.map((p) => loadClaims(id, p)))
      })
      await Promise.all([reach, ...servers, ...profiles])
    },

    async loadServers(agent) {
      set((s) => ({ servers: { ...s.servers, [agent]: { state: "loading" } } }))
      const next: Loaded<Registrations> = await platform.mcpRegistrations(agent).then(
        (data) => ({ state: "ready", data }),
        (e) => ({ state: "error", error: message(e) }),
      )
      set((s) => ({ servers: { ...s.servers, [agent]: next } }))
    },

    async probe(tool, profile) {
      const result = await platform.mcpCheck(tool, profile).catch((e) => message(e))
      set((s) => ({ health: { ...s.health, [pairKey(tool, profile)]: result } }))
      return result
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
        ])
        const servers = get().servers[agent]
        const names = servers?.state === "ready" ? servers.data.names : []
        const pairs = Object.entries(get().profiles).flatMap(([tool, profiles]) =>
          findTool(tool)?.mcp
            ? profiles.filter((p) => names.includes(serverName(findTool(tool)?.bin ?? tool, p))).map((p) => [tool, p])
            : [],
        )
        const everyProfile = Object.entries(get().profiles).flatMap(([tool, profiles]) =>
          findTool(tool)?.permissions ? profiles.map((p) => [tool, p] as const) : [],
        )
        await Promise.all([
          ...pairs.map(([tool, profile]) => get().probe(tool as string, profile as string)),
          ...everyProfile.map(([tool, profile]) => readAccess(tool, profile)),
        ])
      } finally {
        set((s) => ({ checking: without(s.checking, agent), checked: { ...s.checked, [agent]: true } }))
      }
    },

    add: (tool, profile, agent, allowWrites) =>
      write(
        `mcp:${agent}:${pairKey(tool, profile)}`,
        () => platform.mcpAdd(tool, profile, agent, allowWrites),
        () => get().loadServers(agent),
      ),

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
