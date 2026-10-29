import { useEffect, useMemo } from "react"
import {
  AGENT_KIND,
  buildCheck,
  type CheckItem,
  groupSessions,
  KNOWN_AGENTS,
  overall,
  parseHolder,
  type Session,
  sessionsOf,
  type Tone,
} from "@/domain/agents"
import { type CatalogTool, findTool } from "@/domain/catalog"
import { agentName } from "@/domain/runs"
import { cellAction, type SkillCell, type SkillTarget } from "@/domain/skills"
import { useMessages } from "@/i18n"
import type { Agent } from "@/platform/agents-schemas"
import { platform } from "@/platform/bridge"
import { useLogs } from "../logs/store"
import { useTools } from "../tools/store"
import type { AgentClaim } from "./ClaimRow"
import { useConnect } from "./connect"
import { type AgentsMessages, agentsMessages } from "./messages"
import { useSkillMatrix } from "./skill-matrix"
import { useAgents } from "./store"

// An agent is served by its best copy across the folders it reads.
const PREFER: SkillCell["kind"][] = [
  "current",
  "stale",
  "unversioned",
  "unknown",
  "unsupported",
  "failed",
  "missing",
  "checking",
]
const USABLE = new Set<SkillCell["kind"]>(["current", "stale", "unversioned"])

export type AgentSkill = {
  tool: CatalogTool
  cell: SkillCell
  /** Where an install for this agent writes: the folder its usable copy is in, else the first folder it reads. */
  target: SkillTarget
  busy: boolean
  failure: string | null
  action: "Install" | "Update" | null
  /** The tool's newer release, for a tool too old to report its skill. */
  newer: string | null
}

/** A profile the tool itself reports as not signed in, so commands through it fail whichever agent runs them. */
export type SignedOut = { tool: CatalogTool; profile: string }

export type AgentView = {
  agent: Agent
  skills: AgentSkill[]
  todo: AgentSkill[]
  items: CheckItem[] | null
  tone: Tone | null
  sessions: Session[] | null
  claims: AgentClaim[]
  signedOut: SignedOut[]
}

export type AgentEntry =
  | { type: "pending"; id: string; name: string }
  | { type: "absent"; id: string; name: string; agent: Agent }
  | { type: "found"; id: string; name: string; view: AgentView }
  | { type: "seen"; id: string; name: string; kind: string; sessions: number }

function skillFor(agent: Agent, row: ReturnType<typeof useSkillMatrix>["rows"][number]): AgentSkill {
  const mine = row.cells.filter((c) => agent.reads.includes(c.target))
  const best = PREFER.map((k) => mine.find((c) => c.cell.kind === k)).find(Boolean)
  const cell: SkillCell = best?.cell ?? { kind: "checking" }
  const target = best && USABLE.has(best.cell.kind) ? best.target : (agent.reads[0] ?? "claude")
  const busy = mine.some((c) => c.busy)
  // A tool too old to report has no Install here; its row says that updating the tool helps.
  const action = cell.kind === "unknown" ? null : cellAction(cell)
  return {
    tool: row.tool,
    cell,
    target,
    busy,
    failure: mine.find((c) => c.target === target)?.failure ?? null,
    action,
    newer: row.newer,
  }
}

/** The page's data: agents found, each with its skills, checks, sessions and tasks, from the shared stores. */
export function useAgentsView() {
  const matrix = useSkillMatrix()
  const { detected, agents, found, rows } = matrix
  const load = useAgents((s) => s.load)
  const checking = useAgents((s) => s.refreshing || rows.some((r) => !(r.tool.id in s.skills)))
  const answered = useAgents((s) => s.answered)
  const anyBusy = useAgents((s) => Object.keys(s.busy).length > 0)
  const agentsError = useAgents((s) => s.agentsError)
  const installs = useTools((s) => s.installs)
  const toolsChecked = useTools((s) => s.checked)
  const sources = useLogs((s) => s.sources)
  const connect = useConnect()
  const m = useMessages(agentsMessages)

  const foundIds = (found ?? []).map((a) => a.id).join(",")
  const installedIds = Object.keys(installs)
    .filter((id) => (installs[id]?.length ?? 0) > 0)
    .join(",")
  const skillToolIds = rows.map((r) => r.tool.id).join(",")

  useEffect(() => {
    const tools = useTools.getState()
    if (!toolsChecked && !tools.refreshing) tools.refresh()
  }, [toolsChecked])
  useEffect(() => {
    if (detected) load(skillToolIds ? skillToolIds.split(",") : [])
  }, [detected, skillToolIds, load])

  useEffect(() => {
    if (answered && Object.keys(useLogs.getState().sources).length === 0) useLogs.getState().load()
  }, [answered])
  useEffect(() => {
    if (answered && foundIds && installedIds) useConnect.getState().load(foundIds.split(","), installedIds.split(","))
  }, [answered, foundIds, installedIds])

  const sourceList = Object.values(sources)
  const logsReady = sourceList.length > 0 && sourceList.every((s) => s.state !== "loading")
  const sessions = useMemo(
    () => (logsReady ? groupSessions(Object.values(sources).flatMap((s) => s.runs)) : null),
    [logsReady, sources],
  )
  const unknownRuns = sessions?.find((s) => s.who === "unknown")?.runs ?? 0

  const claims = Object.entries(connect.claims).flatMap(([key, loaded]) => {
    if (loaded.state !== "ready") return []
    const [toolId, profile = ""] = key.split("/")
    const tool = findTool(toolId ?? "")
    if (!tool) return []
    return loaded.data.items.map((claim) => ({ tool, profile, claim, holder: parseHolder(claim.holder) }))
  })
  const claimErrors = Object.entries(connect.claims).flatMap(([key, loaded]) =>
    loaded.state === "error" ? [{ key, error: loaded.error }] : [],
  )
  const signedOutCounts = Object.entries(connect.claims).reduce<Map<string, number>>((m, [key, loaded]) => {
    const [tool = "", profile] = key.split("/")
    // The same cli-core wording also means "linked but never served" for store-backed tools; that is no sign-in to do.
    const linked = connect.profiles[tool]?.some((p) => p.name === profile && p.signedIn === true)
    if (loaded.state === "ready" && loaded.data.signedOut && !linked) m.set(tool, (m.get(tool) ?? 0) + 1)
    return m
  }, new Map())
  const signedOutTasks = [...signedOutCounts].map(([tool, profiles]) => ({ tool, profiles }))
  const otherClaims = claims.filter((c) => c.holder.type !== "agent" || c.holder.agent === null)
  const claimsPending =
    !answered ||
    (foundIds !== "" &&
      (installedIds.split(",").some((id) => findTool(id)?.tasks && !(id in connect.profiles)) ||
        Object.values(connect.claims).some((c) => c.state === "loading")))
  const elsewherePending = claimsPending || (answered && installedIds !== "" && !logsReady)

  const signedOut: SignedOut[] = rows.flatMap((r) =>
    (connect.profiles[r.tool.id] ?? []).flatMap((p) =>
      p.signedIn === false ? [{ tool: r.tool, profile: p.name }] : [],
    ),
  )

  const skillsLoaded = rows.every((r) => r.cells.every((c) => c.cell.kind !== "checking"))
  const viewOf = (agent: Agent): AgentView => {
    const skills = rows.map((r) => skillFor(agent, r))
    const items = skillsLoaded
      ? buildCheck({
          agent,
          tools: rows.map((r) => ({
            id: r.tool.id,
            name: r.tool.name,
            bin: r.tool.bin,
            path: installs[r.tool.id]?.[0]?.path ?? null,
          })),
          reach: connect.agentReach[agent.id] ?? connect.reach,
          skills: Object.fromEntries(
            rows.map((r) => [
              r.tool.id,
              Object.fromEntries(r.cells.map((c) => [c.target, c.cell])) as Partial<Record<SkillTarget, SkillCell>>,
            ]),
          ),
          access: connect.access,
          windows: platform.os === "windows",
          words: m.check,
        })
      : null
    return {
      agent,
      skills,
      todo: skills.filter((s) => s.action !== null && !s.busy),
      items,
      tone: items
        ? overall(
            items,
            rows.map((r) => r.tool),
          )
        : null,
      sessions: sessions ? sessionsOf(sessions, agent.id) : null,
      claims: claims
        .filter((c) => c.holder.type === "agent" && c.holder.agent === agent.id)
        .map((c) => ({ ...c, session: c.holder.type === "agent" ? c.holder.session : null })),
      signedOut,
    }
  }

  // A browser app over MCP (`mcp-client`) is not an agent on this computer; the Logs page groups its runs instead.
  const known = new Set([...Object.values(AGENT_KIND), "mcp-client"])
  const seen = (sessions ?? []).reduce<Map<string, number>>((m, s) => {
    if (s.who === "agent" && s.kind && !known.has(s.kind)) m.set(s.kind, (m.get(s.kind) ?? 0) + 1)
    return m
  }, new Map())

  const entries: AgentEntry[] = [
    ...(agents === null
      ? KNOWN_AGENTS.map((a): AgentEntry => ({ type: "pending", id: a.id, name: a.name }))
      : agents.map(
          (agent): AgentEntry =>
            agent.foundBy === null
              ? { type: "absent", id: agent.id, name: agent.name, agent }
              : { type: "found", id: agent.id, name: agent.name, view: viewOf(agent) },
        )),
    ...[...seen].map(
      ([kind, n]): AgentEntry => ({ type: "seen", id: `seen:${kind}`, name: agentName(kind), kind, sessions: n }),
    ),
  ]

  const checkAll = () => {
    load(rows.map((r) => r.tool.id))
    useLogs.getState().load()
    if (foundIds) useConnect.getState().load(foundIds.split(","), installedIds ? installedIds.split(",") : [])
    for (const id of Object.keys(useConnect.getState().checked)) useConnect.getState().check(id)
  }
  const checkOne = (id: string) => {
    load(rows.map((r) => r.tool.id))
    useConnect.getState().check(id)
  }

  return {
    ...matrix,
    entries,
    checking,
    anyBusy,
    agentsError,
    toolsKnown: detected,
    skillsLoaded,
    checkAll,
    checkOne,
    opened,
    elsewhere: { pending: elsewherePending, otherClaims, claimErrors, signedOutTasks, unknownRuns },
  }
}

// Permissions and MCP answers are read only by an agent's own check, so opening its details runs it once.
function opened(id: string) {
  const c = useConnect.getState()
  if (!c.checked[id] && !c.checking[id]) c.check(id)
}

export type AgentsView = ReturnType<typeof useAgentsView>

/** Other agents found here that read this folder too, so one install serves them as well. */
export function sharers(entries: readonly AgentEntry[], target: SkillTarget, except: string): string[] {
  return entries.flatMap((e) =>
    e.type === "found" && e.id !== except && e.view.agent.reads.includes(target) ? [e.name] : [],
  )
}

/** "3 tools have no skill for Claude Code", or the old-skill wording when nothing is missing. */
export function todoSentence(view: AgentView, m: AgentsMessages): string {
  const missing = view.todo.filter((s) => s.action === "Install").length
  const old = view.todo.length - missing
  const name = view.agent.name
  if (missing > 0 && old > 0) return m.todoMixed(view.todo.length, name, missing, old)
  if (missing > 0) return m.todoMissing(missing, name)
  return m.todoOld(old, name)
}

export const todoInstalls = (view: AgentView) => view.todo.some((s) => s.action === "Install")
