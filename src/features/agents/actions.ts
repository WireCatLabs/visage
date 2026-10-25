import { createElement as h } from "react"
import { serverName } from "@/domain/agents"
import { catalogCommand, findTool } from "@/domain/catalog"
import { type SkillTarget, TARGET_FOLDER } from "@/domain/skills"
import type { Claim } from "@/platform/agents-schemas"
import { useConfirm } from "./Confirm"
import { pairKey, useConnect } from "./connect"
import { cellKey, useAgents } from "./store"
import { type AgentView, plural, todoAction } from "./view"

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

export function askSkillInstall(id: string, target: SkillTarget, action: string, reader: string, agent?: string) {
  const t = tool(id)
  if (!t.skill) return
  const key = cellKey(id, target)
  useConfirm.getState().ask({
    title: `${action} the ${t.name} skill for ${reader}?`,
    body: h("p", null, `${t.name} writes its own skill file, the version that comes with it.`),
    command: catalogCommand(t, t.skill.install, { target }),
    tool: id,
    action,
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
  useConfirm.getState().ask({
    title: `${todoAction(view) === "Install all" ? "Install" : "Update"} ${plural(cells.length, "skill")} for ${view.agent.name}?`,
    body: h(
      "div",
      { className: "flex flex-col gap-2" },
      h(
        "p",
        null,
        `Each tool writes its own skill file into ${folders.map((t) => TARGET_FOLDER[t]).join(" and ")}, one after another.`,
      ),
      others.length > 0 ? h("p", null, `${others.join(", ")} read the same folder and get these skills too.`) : null,
    ),
    command: view.todo.map((s) => catalogCommand(s.tool, s.tool.skill?.install ?? [], { target: s.target })).join("\n"),
    action: todoAction(view),
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
    title: `Remove the ${serverName(t.bin, profile)} MCP server from ${agent.name}?`,
    body: h(
      "p",
      null,
      `${agent.name} stops starting this MCP server. The skill and the tool stay, and ${agent.name} keeps using ${t.name} through its commands.`,
    ),
    command: remove(serverName(t.bin, profile)),
    tool: id,
    action: "Remove",
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
    title: `Release ${task}?`,
    body: h(
      "p",
      null,
      `${holder} holds this task. Release it when that session has stopped, so another agent can take it.`,
    ),
    command: catalogCommand(t, t.tasks.release, { profile, task }),
    tool: id,
    action: "Release",
    danger: true,
    run: () => useConnect.getState().release(id, profile, task),
    failure: () => useConnect.getState().failures[releaseKey(id, profile, task)],
  })
}
