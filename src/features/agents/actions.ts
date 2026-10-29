import { createElement as h } from "react"
import { serverName } from "@/domain/agents"
import { catalogCommand, findTool } from "@/domain/catalog"
import { type SkillTarget, TARGET_FOLDER } from "@/domain/skills"
import type { Claim } from "@/platform/agents-schemas"
import { useConfirm } from "./Confirm"
import { pairKey, useConnect } from "./connect"
import { cellKey, useAgents } from "./store"
import { type AgentView, todoInstalls } from "./view"

/** What the agent's own CLI runs to remove a server; Rust holds the same fixed words (`mcp.rs`). */
const REMOVE: Record<string, (name: string) => string> = {
  claude: (name) => `claude mcp remove ${name} --scope user`,
  codex: (name) => `codex mcp remove ${name}`,
}

export const mcpKey = (agent: string, tool: string, profile: string | null) => `mcp:${agent}:${pairKey(tool, profile)}`

const tool = (id: string) => {
  const t = findTool(id)
  if (!t) throw new Error(`unknown tool: ${id}`)
  return t
}

/** The agent's tab in the list: an Install button that was pressed is gone once its skill is written. */
export const agentTabId = (agent: string) => `agent-tab-${agent}`
const agentTab = (agent: string) => () => document.getElementById(agentTabId(agent))

export function askSkillInstall(
  id: string,
  target: SkillTarget,
  action: "Install" | "Update",
  reader: string,
  agent?: string,
) {
  const t = tool(id)
  if (!t.skill) return
  const key = cellKey(id, target)
  useConfirm.getState().ask({
    text: (m) => ({
      title: action === "Install" ? m.installSkillTitle(t.name, reader) : m.updateSkillTitle(t.name, reader),
      body: h("p", null, m.skillBody(t.name)),
      action: m.action[action],
    }),
    command: catalogCommand(t, t.skill.install, { target }),
    tool: id,
    ...(agent ? { focusAfter: agentTab(agent) } : {}),
    run: async () => {
      await useAgents.getState().install(id, target)
      return !useAgents.getState().failures[key]
    },
    failure: () => useAgents.getState().failures[key],
  })
}

/** Every missing or old skill of one agent, one after another; `also` names the other agents reading each folder. */
export function askAgentSkills(view: AgentView, also: (target: SkillTarget) => string[]) {
  const cells = view.todo.map((s): [string, SkillTarget] => [s.tool.id, s.target])
  const folders = [...new Set(view.todo.map((s) => s.target))]
  const others = [...new Set(folders.flatMap(also))]
  const install = todoInstalls(view)
  useConfirm.getState().ask({
    text: (m) => ({
      title: install
        ? m.installManyTitle(cells.length, view.agent.name)
        : m.updateManyTitle(cells.length, view.agent.name),
      body: h(
        "div",
        { className: "flex flex-col gap-2" },
        h("p", null, m.eachWrites(folders.map((t) => TARGET_FOLDER[t]))),
        others.length > 0 ? h("p", null, m.othersToo(others)) : null,
      ),
      action: install ? m.installAll : m.updateAll,
    }),
    command: view.todo.map((s) => catalogCommand(s.tool, s.tool.skill?.install ?? [], { target: s.target })).join("\n"),
    focusAfter: agentTab(view.agent.id),
    run: async () => {
      await useAgents.getState().installAll(cells)
      return cells.every(([id, target]) => !useAgents.getState().failures[cellKey(id, target)])
    },
    failure: () =>
      cells.map(([id, target]) => useAgents.getState().failures[cellKey(id, target)]).find(Boolean) ?? undefined,
  })
}

export function askMcpRemove(id: string, profile: string | null, agent: { id: string; name: string }) {
  const t = tool(id)
  const remove = REMOVE[agent.id]
  if (!remove) return
  const key = mcpKey(agent.id, id, profile)
  useConfirm.getState().ask({
    text: (m) => ({
      title: m.removeServerTitle(serverName(t.bin, profile), agent.name),
      body: h("p", null, m.removeServerBody(agent.name, t.name)),
      action: m.remove,
    }),
    command: remove(serverName(t.bin, profile)),
    tool: id,
    danger: true,
    run: () => useConnect.getState().remove(id, profile, agent.id),
    failure: () => useConnect.getState().failures[key],
  })
}

export const releaseKey = (id: string, profile: string, task: string) => `task:${pairKey(id, profile)}:${task}`

export function askRelease(id: string, profile: string, claim: Claim, holder: string) {
  const t = tool(id)
  if (!t.tasks) return
  const task = claim.key ?? claim.id
  useConfirm.getState().ask({
    text: (m) => ({ title: m.releaseTitle(task), body: h("p", null, m.releaseBody(holder)), action: m.release }),
    command: catalogCommand(t, t.tasks.release, { profile, task }),
    tool: id,
    danger: true,
    run: () => useConnect.getState().release(id, profile, task),
    failure: () => useConnect.getState().failures[releaseKey(id, profile, task)],
  })
}
