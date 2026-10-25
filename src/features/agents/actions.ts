import { createElement as h } from "react"
import { serverName } from "@/domain/agents"
import { catalogCommand, findTool } from "@/domain/catalog"
import type { SkillTarget } from "@/domain/skills"
import type { Claim } from "@/platform/agents-schemas"
import { useConfirm } from "./Confirm"
import { pairKey, useConnect } from "./connect"
import { cellKey, useAgents } from "./store"

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

export function askSkillInstall(id: string, target: SkillTarget, action: string, reader: string) {
  const t = tool(id)
  if (!t.skill) return
  const key = cellKey(id, target)
  useConfirm.getState().ask({
    title: `${action} the ${t.name} skill for ${reader}?`,
    body: h("p", null, `${t.name} writes its own skill file, the version that comes with it.`),
    command: catalogCommand(t, t.skill.install, { target }),
    tool: id,
    action,
    run: async () => {
      await useAgents.getState().install(id, target)
      return !useAgents.getState().failures[key]
    },
    failure: () => useAgents.getState().failures[key],
  })
}

export function askSkillInstallAll(cells: readonly [string, SkillTarget][]) {
  useConfirm.getState().ask({
    title: `Update ${cells.length} old ${cells.length === 1 ? "skill" : "skills"}?`,
    body: h("p", null, "Each tool writes its own skill file, one after another."),
    command: cells
      .map(([id, target]) => catalogCommand(tool(id), tool(id).skill?.install ?? [], { target }))
      .join("\n"),
    action: "Update all",
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
