import { create } from "zustand"
import { CHAT_AGENTS, type CheckTool } from "@/domain/agents"
import type { SkillTarget } from "@/domain/skills"
import type { Chats } from "@/platform/agents-schemas"
import { platform } from "@/platform/bridge"
import { type Loaded, useConnect } from "./connect"
import { cellKey, useAgents } from "./store"

export type StepState = "waiting" | "running" | "ok" | "warn" | "failed"

export type Step = { key: string; label: string; state: StepState; detail: string | null; command: string | null }

/** What Connect runs, in order: each chosen tool's skill, then read only for each chosen profile, then the PATH. */
export type ConnectPlan = {
  agent: { id: string; name: string }
  installs: { tool: string; name: string; target: SkillTarget }[]
  readOnly: { tool: string; name: string; profile: string; groups: string[] }[]
  /** The chosen tools, with where they are installed, for the PATH check. */
  tools: CheckTool[]
  /** What to tell the owner when the agent does not find some of them. */
  pathFix: (missing: CheckTool[]) => { title: string; detail: string; command: string | null }
}

type Flow = {
  agent: string | null
  phase: "choose" | "running" | "done"
  /** Nothing is chosen until the owner ticks it. */
  tools: string[]
  /** `<tool>/<profile>` to set read only. */
  readOnly: string[]
  chats: Loaded<Chats> | null
  steps: Step[]
  open(agent: string): void
  close(): void
  toggleTool(id: string): void
  toggleReadOnly(key: string): void
  run(plan: ConnectPlan): Promise<void>
}

const message = (e: unknown) => (e instanceof Error ? e.message : String(e))
const toggled = (list: readonly string[], x: string) => (list.includes(x) ? list.filter((y) => y !== x) : [...list, x])

export const useConnectFlow = create<Flow>((set, get) => {
  const update = (key: string, patch: Partial<Step>) =>
    set((s) => ({ steps: s.steps.map((step) => (step.key === key ? { ...step, ...patch } : step)) }))

  return {
    agent: null,
    phase: "choose",
    tools: [],
    readOnly: [],
    chats: null,
    steps: [],

    open(agent) {
      set({ agent, phase: "choose", tools: [], readOnly: [], steps: [], chats: null })
      if (!CHAT_AGENTS.has(agent)) return
      set({ chats: { state: "loading" } })
      platform.agentChats(agent).then(
        (data) => get().agent === agent && set({ chats: { state: "ready", data } }),
        (e) => get().agent === agent && set({ chats: { state: "error", error: message(e) } }),
      )
    },
    close: () => set({ agent: null }),
    toggleTool: (id) =>
      set((s) => {
        const tools = toggled(s.tools, id)
        return { tools, readOnly: s.readOnly.filter((k) => tools.includes(k.split("/")[0] ?? "")) }
      }),
    toggleReadOnly: (key) => set((s) => ({ readOnly: toggled(s.readOnly, key) })),

    async run(plan) {
      const steps: Step[] = [
        ...plan.installs.map((i) => ({
          key: `skill:${i.tool}`,
          label: `${i.name} skill`,
          state: "waiting" as const,
          detail: null,
          command: null,
        })),
        ...plan.readOnly.map((r) => ({
          key: `ro:${r.tool}/${r.profile}`,
          label: `${r.name} (${r.profile}) read only`,
          state: "waiting" as const,
          detail: null,
          command: null,
        })),
        { key: "path", label: `${plan.agent.name} finds the tools`, state: "waiting", detail: null, command: null },
      ]
      set({ phase: "running", steps })

      for (const i of plan.installs) {
        const key = `skill:${i.tool}`
        update(key, { state: "running" })
        await useAgents.getState().install(i.tool, i.target)
        const failure = useAgents.getState().failures[cellKey(i.tool, i.target)]
        update(key, failure ? { state: "failed", detail: failure } : { state: "ok", detail: "Written" })
      }

      for (const r of plan.readOnly) {
        const key = `ro:${r.tool}/${r.profile}`
        update(key, { state: "running" })
        try {
          // A profile-level key hides the same key in the defaults, so writing readonly over a group the owner
          // blocked anywhere would open it for reading. Those groups keep their Block.
          const before = await platform.permissionsShow(r.tool, r.profile)
          const blocked = (g: string) =>
            before.levels.some((l) => l.level === "deny" && (l.key === g || l.key.startsWith(`${g}.`)))
          const kept = r.groups.filter(blocked)
          for (const group of r.groups.filter((g) => !blocked(g)))
            await platform.settingsSet(r.tool, r.profile, false, `permissions.${group}`, "readonly")
          // The catalog's groups may not name every key, and a narrower level the owner set still wins, so the
          // tool's own answer says what is left, and what this opened that was closed before.
          const after = await platform.permissionsShow(r.tool, r.profile)
          const wasOpen = new Set((before.commands ?? []).filter((c) => c.available).map((c) => c.path.join(" ")))
          const opened = (after.commands ?? []).filter((c) => c.available && !wasOpen.has(c.path.join(" ")))
          const writes = after.commands?.filter((c) => c.writes && c.available).length ?? null
          const notes = [
            kept.length > 0 ? `Kept Block on ${kept.join(", ")}.` : "",
            opened.length > 0 && before.commands
              ? `Now allowed and blocked before: ${opened.map((c) => c.path.join(" ")).join(", ")}. Block them again in ${r.name}'s Permissions on the Tools page.`
              : "",
          ].filter(Boolean)
          const base =
            writes === 0
              ? "Every command that changes something is blocked."
              : writes === null
                ? "Set; this version cannot say which commands it now blocks."
                : `Set, but ${writes} ${writes === 1 ? "command that changes things is" : "commands that change things are"} still allowed. Change them in ${r.name}'s Permissions on the Tools page.`
          update(key, {
            state: writes === 0 && opened.length === 0 ? "ok" : "warn",
            detail: [base, ...notes].join(" "),
          })
        } catch (e) {
          update(key, { state: "failed", detail: message(e) })
        }
      }

      update("path", { state: "running" })
      const reach = await useConnect.getState().loadReach(plan.agent.id)
      if (!reach) update("path", { state: "warn", detail: "WireCat could not read the PATH it runs commands with." })
      else {
        const missing = plan.tools.filter((t) => reach[t.id] === false)
        if (missing.length === 0)
          update("path", { state: "ok", detail: `${plan.agent.name} finds every tool you chose` })
        else {
          const fix = plan.pathFix(missing)
          update("path", { state: "failed", label: fix.title, detail: fix.detail, command: fix.command })
        }
      }
      set({ phase: "done" })
      useConnect.getState().check(plan.agent.id)
    },
  }
})
