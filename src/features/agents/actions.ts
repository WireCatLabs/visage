import { createElement as h } from "react"
import { serverName } from "@/domain/agents"
import { catalogCommand, findTool } from "@/domain/catalog"
import type { SkillTarget } from "@/domain/skills"
import type { Claim } from "@/platform/agents-schemas"
import { useConfirm } from "./Confirm"
import { pairKey, useConnect } from "./connect"
import { cellKey, useAgents } from "./store"

const CLIENT: Record<string, string> = { claude: "claude-code", codex: "codex" }

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

/** Starts the profile's server once to count what it offers, then asks; nothing is registered before the owner agrees. */
export async function askMcpAdd(id: string, profile: string, agent: { id: string; name: string }) {
  const t = tool(id)
  const client = CLIENT[agent.id]
  if (!t.mcp || !client) return
  const key = mcpKey(agent.id, id, profile)
  const connect = useConnect.getState()
  useConnect.setState((s) => ({ busy: { ...s.busy, [key]: true }, failures: without(s.failures, key) }))
  const health = await connect.probe(id, profile)
  useConnect.setState((s) => ({ busy: without(s.busy, key) }))
  if (typeof health === "string") {
    useConnect.setState((s) => ({ failures: { ...s.failures, [key]: health } }))
    return
  }
  const writes = health.potentialWrites > 0
  const lines = [
    `The server offers ${health.tools} ${health.tools === 1 ? "command" : "commands"}` +
      (writes
        ? `; ${health.potentialWrites} of them can change things, such as sending a message.`
        : ", all read-only."),
    `${agent.name} can use what this profile's permissions allow.`,
    ...(health.signedIn ? [] : [`${profile} is not signed in yet, so its commands fail until you sign in.`]),
  ]
  useConfirm.getState().ask({
    title: `Connect ${t.name} (${profile}) to ${agent.name}?`,
    body: h(
      "div",
      { className: "flex flex-col gap-2" },
      lines.map((l) => h("p", { key: l }, l)),
    ),
    command: `${catalogCommand(t, t.mcp.add, { profile, client })}${writes ? " --allow-writes" : ""}`,
    action: "Connect",
    run: () => useConnect.getState().add(id, profile, agent.id, writes),
    failure: () => useConnect.getState().failures[key],
  })
}

export function askMcpRemove(id: string, profile: string | null, agent: { id: string; name: string }) {
  const t = tool(id)
  const remove = REMOVE[agent.id]
  if (!remove) return
  const key = mcpKey(agent.id, id, profile)
  useConfirm.getState().ask({
    title: `Disconnect ${t.name}${profile ? ` (${profile})` : ""} from ${agent.name}?`,
    body: h(
      "p",
      null,
      `${agent.name} stops starting this MCP server. The skill and the tool stay; connecting again takes one click.`,
    ),
    command: remove(serverName(t.bin, profile)),
    action: "Disconnect",
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
    action: "Release",
    danger: true,
    run: () => useConnect.getState().release(id, profile, task),
    failure: () => useConnect.getState().failures[releaseKey(id, profile, task)],
  })
}

function without<T>(map: Record<string, T>, key: string): Record<string, T> {
  const { [key]: _, ...rest } = map
  return rest
}
