import { agentName, agentOf, NO_COMMAND_HIDDEN, type Run, termText } from "./runs"
import { cellAction, type SkillCell, type SkillTarget, TARGET_FOLDER } from "./skills"

/** The app's agent ids, as `skills.rs` detects them, and the `kind` the tools record for each in runs and claims. */
export const AGENT_KIND: Record<string, string> = {
  claude: "claude-code",
  codex: "codex",
  cursor: "cursor",
  gemini: "gemini-cli",
  opencode: "opencode",
}

/** Every agent detection reports on, in its order, so the page can draw their rows before it answers. */
export const KNOWN_AGENTS = Object.entries(AGENT_KIND).map(([id, kind]) => ({ id, name: agentName(kind) }))

const agentForKind = (kind: string) => Object.keys(AGENT_KIND).find((id) => AGENT_KIND[id] === kind) ?? null

// Activity

/** One agent session's runs across every tool. `you` ran without an agent; `unknown` is a tool too old to say. */
export type Session = {
  key: string
  who: "agent" | "you" | "unknown"
  kind: string | null
  session: string | null
  first: string
  last: string
  runs: number
  failed: number
  tools: string[]
}

/** The tools that record the agent also record `argv`, so a run with `argv` and no agent was started by a person. */
const whoRan = (run: Run): Session["who"] => (agentOf(run) ? "agent" : Array.isArray(run.argv) ? "you" : "unknown")

export function groupSessions(runs: readonly Run[]): Session[] {
  const sessions = new Map<string, Session>()
  for (const run of runs) {
    const agent = agentOf(run)
    const who = whoRan(run)
    const key = who === "agent" ? `${agent?.kind}:${agent?.session ?? ""}` : who
    const s = sessions.get(key) ?? {
      key,
      who,
      kind: agent?.kind ?? null,
      session: agent?.session ?? null,
      first: run.started_at,
      last: run.started_at,
      runs: 0,
      failed: 0,
      tools: [],
    }
    s.runs++
    if (run.status === "failed") s.failed++
    if (run.started_at < s.first) s.first = run.started_at
    if (run.started_at > s.last) s.last = run.started_at
    if (!s.tools.includes(run.tool)) s.tools.push(run.tool)
    sessions.set(key, s)
  }
  return [...sessions.values()].sort((a, b) => (a.last < b.last ? 1 : a.last > b.last ? -1 : 0))
}

export const sessionsOf = (sessions: readonly Session[], agent: string) =>
  sessions.filter((s) => s.who === "agent" && s.kind === AGENT_KIND[agent])

/** The Logs query that shows one session's runs; an agent that names no session gets all its runs without one. */
export function sessionQuery(s: Session): string {
  if (!s.kind) return ""
  const who = s.session
    ? `${termText("agent", s.kind)} ${termText("session_id", s.session)}`
    : termText("agent", s.kind)
  return `${who} ${NO_COMMAND_HIDDEN}`
}

// Task claims

export type Holder =
  | { type: "agent"; agent: string | null; kind: string; session: string | null }
  | { type: "owner" }
  | { type: "other"; name: string }

const KINDS = new Set(Object.values(AGENT_KIND))

/** cli-core's `holderOf`: `--holder`, then `WIRECAT_HOLDER`, then `<kind>:<session>`, else the agent's name. */
export function parseHolder(holder: string): Holder {
  if (holder === "owner") return { type: "owner" }
  const colon = holder.indexOf(":")
  const kind = colon > 0 ? holder.slice(0, colon) : holder
  if (!KINDS.has(kind)) return { type: "other", name: holder }
  return { type: "agent", agent: agentForKind(kind), kind, session: colon > 0 ? holder.slice(colon + 1) : null }
}

// MCP

/** cli-core's `mcp add` registers a profile as `<bin>-<profile>`; a person following its help may add `<bin>` alone. */
export const serverName = (bin: string, profile: string | null) => (profile ? `${bin}-${profile}` : bin)

export type Connection = { profile: string | null; connected: boolean }

/** Every profile with whether its server is registered, plus a bare `<bin>` entry when there is one. */
export function connections(names: readonly string[], bin: string, profiles: readonly string[]): Connection[] {
  const rows: Connection[] = profiles.map((p) => ({ profile: p, connected: names.includes(serverName(bin, p)) }))
  const extra = names
    .filter((n) => n.startsWith(`${bin}-`) && !profiles.includes(n.slice(bin.length + 1)))
    .map((n) => ({ profile: n.slice(bin.length + 1), connected: true }))
  return [...rows, ...extra, ...(names.includes(bin) ? [{ profile: null, connected: true }] : [])]
}

// Check

export type Tone = "ok" | "warn" | "bad" | "idle"

export type Fix =
  | { kind: "skill"; tool: string; target: SkillTarget; label: "Install" | "Update" }
  | { kind: "command"; command: string }
  /** Something to change on the Tools page: a tool update, or a profile's permissions. */
  | { kind: "tools" }

export type CheckItem = { id: string; tone: Tone; title: string; detail: string; fix?: Fix }

export type CheckTool = { id: string; name: string; bin: string; path: string | null; hasMcp: boolean }

export type CheckInput = {
  agent: { id: string; name: string; reads: readonly SkillTarget[] }
  tools: readonly CheckTool[]
  /** By tool id; absent when the PATH could not be read. */
  reach: Readonly<Record<string, boolean>> | null
  /** By tool id, then by the places this agent reads. */
  skills: Readonly<Record<string, Partial<Record<SkillTarget, SkillCell>>>>
  /** WireCat server names the agent has registered; null when its list could not be read. */
  servers: { names: readonly string[]; canAdd: boolean } | null
  /** `<tool>/<profile>` → the tool's own `mcp check`, or the reason it failed. */
  health: Readonly<Record<string, { healthy: boolean; signedIn: boolean } | string>>
  profiles: Readonly<Record<string, readonly string[]>>
  /** A shell `export` line means nothing on Windows; the folder is named instead. */
  windows?: boolean
  /** `<tool>/<profile>` → commands its permissions block, from the tool's own `commands --json`; absent until Check. */
  access?: Readonly<Record<string, { blocked: number; total: number } | string>>
}

const folderOf = (path: string) => path.replace(/[\\/][^\\/]+$/, "").replace(/^~(?=\/)/, "$HOME")

/** What stops this agent from using the tools, worst first, each with the one thing that fixes it. */
export function buildCheck(input: CheckInput): CheckItem[] {
  const { agent, tools, reach, skills, servers, health, profiles, access } = input
  const items: CheckItem[] = []
  const unconnected: string[] = []
  const unreported: string[] = []

  for (const tool of tools) {
    if (reach && reach[tool.id] === false) {
      items.push({
        id: `${tool.id}:path`,
        tone: "bad",
        title: `${tool.name} is not on a terminal's PATH`,
        detail: input.windows
          ? `${agent.name} runs commands in a terminal, and a new terminal does not find ${tool.bin}. Add ${tool.path ? folderOf(tool.path) : "its folder"} to your user Path in Windows settings, then restart ${agent.name}.`
          : `${agent.name} runs commands in a terminal, and a new terminal does not find ${tool.bin}. Add its folder to PATH in your shell profile, then restart ${agent.name}.`,
        ...(tool.path && !input.windows
          ? { fix: { kind: "command", command: `export PATH="${folderOf(tool.path)}:$PATH"` } }
          : {}),
      })
    }

    const cells = agent.reads.map((target) => ({ target, cell: skills[tool.id]?.[target] }))
    const known = cells.filter((c): c is { target: SkillTarget; cell: SkillCell } => c.cell !== undefined)
    if (known.some((c) => c.cell.kind === "current")) {
      items.push({ id: `${tool.id}:skill`, tone: "ok", title: `${tool.name} skill is current`, detail: "" })
    } else {
      const worst =
        known.find((c) => c.cell.kind === "stale" || c.cell.kind === "unversioned") ??
        known.find((c) => c.cell.kind === "missing" || c.cell.kind === "failed") ??
        known.find((c) => c.cell.kind === "unknown")
      if (worst?.cell.kind === "unknown") unreported.push(tool.name)
      else if (worst) items.push(skillItem(tool, agent.name, worst.target, worst.cell))
    }

    if (!tool.hasMcp) continue
    const names = servers?.names ?? []
    const connected = (profiles[tool.id] ?? []).filter((p) => names.includes(serverName(tool.bin, p)))
    if (servers && connected.length === 0 && !names.includes(tool.bin)) unconnected.push(tool.name)
    for (const profile of connected) {
      const h = health[`${tool.id}/${profile}`]
      if (h === undefined) continue
      const id = `${tool.id}/${profile}:mcp`
      if (typeof h === "string")
        items.push({ id, tone: "bad", title: `${tool.name} (${profile}) MCP failed`, detail: h })
      else if (!h.signedIn)
        items.push({
          id,
          tone: "warn",
          title: `${tool.name} (${profile}) is not signed in`,
          detail: "The MCP server starts, but its commands will fail until the profile signs in.",
          fix: { kind: "command", command: `${tool.bin} ${profile} setup` },
        })
      else items.push({ id, tone: "ok", title: `${tool.name} (${profile}) MCP answers`, detail: "" })
    }
  }

  if (unreported.length > 0) {
    items.push({
      id: "skill:unknown",
      tone: "idle",
      title: `${unreported.join(", ")} cannot report ${unreported.length === 1 ? "its skill" : "their skills"}`,
      detail: "These versions are too old to say which skill is installed. A newer version can.",
      fix: { kind: "tools" },
    })
  }
  const permissions = Object.entries(access ?? {})
  for (const [key, a] of permissions) {
    const [toolId, profile] = key.split("/")
    const tool = tools.find((t) => t.id === toolId)
    if (!tool) continue
    const id = `${key}:permissions`
    if (typeof a === "string") {
      items.push({ id, tone: "idle", title: `${tool.name} (${profile}) permissions could not be read`, detail: a })
    } else if (a.blocked === 0) {
      items.push({ id, tone: "ok", title: `${tool.name} (${profile}) allows every command`, detail: "" })
    } else {
      items.push({
        id,
        tone: a.blocked === a.total ? "warn" : "idle",
        title: `${tool.name} (${profile}): ${a.blocked} of ${a.total} commands are blocked`,
        detail: `Its permissions stop ${agent.name} from running them. Change them in ${tool.name}'s Manage panel.`,
        fix: { kind: "tools" },
      })
    }
  }
  if (permissions.length === 0) {
    items.push({
      id: "permissions",
      tone: "idle",
      title: "Permissions are read when you press Check",
      detail: "Check asks each tool which commands every profile allows.",
    })
  }
  if (unconnected.length > 0) {
    items.push({
      id: "mcp:none",
      tone: "idle",
      title: `No MCP connection: ${unconnected.join(", ")}`,
      detail: `Optional: with the skill, ${agent.name} runs the commands itself. Connect a profile under Tools below.`,
    })
  }
  if (!servers) {
    items.push({
      id: "mcp:list",
      tone: "idle",
      title: `Could not read ${agent.name}'s MCP servers`,
      detail: "The skill alone is enough for an agent that runs commands.",
    })
  }
  const rank: Record<Tone, number> = { bad: 0, warn: 1, idle: 2, ok: 3 }
  return items.sort((a, b) => rank[a.tone] - rank[b.tone])
}

function skillItem(tool: CheckTool, agentName: string, target: SkillTarget, cell: SkillCell): CheckItem {
  const id = `${tool.id}:skill`
  const where = TARGET_FOLDER[target]
  const action = cellAction(cell)
  const fix: Fix | undefined = action ? { kind: "skill", tool: tool.id, target, label: action } : undefined
  const base = { id, ...(fix ? { fix } : {}) }
  switch (cell.kind) {
    case "stale":
      return {
        ...base,
        tone: "warn",
        title: `${tool.name} skill is old (${cell.installed})`,
        detail: `${agentName} reads ${where}; an old skill may name commands that changed.`,
      }
    case "unversioned":
      return { ...base, tone: "warn", title: `${tool.name} skill has no version`, detail: `In ${where}.` }
    case "missing":
      return {
        ...base,
        tone: "warn",
        title: `${tool.name} skill is not installed`,
        detail: `${agentName} reads ${where}. Without the skill it does not know ${tool.bin}'s commands.`,
      }
    default:
      return {
        ...base,
        tone: "bad",
        title: `${tool.name} skill could not be checked`,
        detail: cell.kind === "failed" ? cell.message : "",
      }
  }
}

export function overall(items: readonly CheckItem[]): Tone {
  if (items.some((i) => i.tone === "bad")) return "bad"
  if (items.some((i) => i.tone === "warn")) return "warn"
  return items.some((i) => i.tone === "ok") ? "ok" : "idle"
}
