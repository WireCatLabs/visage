import type { Agent, Chats, Claim, Registrations, SkillReport, Target } from "./agents-schemas"
import { delay } from "./mock-delay"
import type { Platform } from "./types"

// Fictional skill states covering each case: a CLI with `skill status`, one without (unknown),
// memo's doctor fallback, a stale copy and a missing one. `?fail=<tool>` makes that tool's skill install fail.
// MCP: Claude Code has Telegram's personal profile, Cursor a hand-added `memo`; WhatsApp is too old for `mcp check`.
// Tasks: Telegram's personal profile has three claims; Zoom is installed where a terminal does not look.
// Hermes and OpenClaw: only WhatsApp can write a Hermes skill yet; Hermes's gateway answers in Telegram and its shell
// misses the folder Telegram and Max are in. OpenClaw has Discord and WhatsApp channels. `?chats=none` turns both off.

const params = new URLSearchParams(typeof window === "undefined" ? "" : window.location.search)

const AGENTS: Agent[] = [
  { id: "claude", name: "Claude Code", foundBy: "program", reads: ["claude"] },
  { id: "codex", name: "Codex", foundBy: "program", reads: ["agents"] },
  { id: "cursor", name: "Cursor", foundBy: "folder", reads: ["agents", "claude"] },
  { id: "gemini", name: "Gemini CLI", foundBy: null, reads: ["agents"] },
  { id: "opencode", name: "OpenCode", foundBy: null, reads: ["agents", "claude"] },
  { id: "hermes", name: "Hermes Agent", foundBy: "program", reads: ["hermes"] },
  { id: "openclaw", name: "OpenClaw", foundBy: "program", reads: ["agents"] },
]

const CHATS: Record<string, Chats> = {
  hermes: { source: "~/.hermes/gateway_state.json", running: true, channels: ["telegram"] },
  openclaw: { source: "openclaw channels list --json", running: null, channels: ["discord", "whatsapp"] },
}

const UNREAD: Record<string, string> = {
  hermes: "mcp_servers in ~/.hermes/config.yaml",
  openclaw: "openclaw mcp list",
}

// Released with cli-base's `--for hermes`.
const KNOWS_HERMES = new Set(["wa"])

type Copy = { installed: string | null }
const copies: Record<string, Partial<Record<Target, Copy>>> = {
  tg: { claude: { installed: "0.88.0" }, agents: { installed: "0.85.2" } },
  wa: {},
  memo: { claude: { installed: "0.90.0" } },
  drive: { claude: { installed: "0.29.0" }, agents: { installed: "0.29.0" } },
}
// These answer like today's released CLIs: no `skill status` yet.
const NO_STATUS = new Set(["max", "zm"])

const path = (target: Target, id: string) => `~/.${target === "claude" ? "claude" : "agents"}/skills/${id}-cli/SKILL.md`

const SKILL = (name: string) => `---
name: ${name}
description: Read, search and send messages from the terminal. Use when the owner asks about a chat.
---

# ${name}

Start every account command with the profile the owner named: \`tg <profile> chats list\`.
Never pick a profile yourself; ask when none was named.

## Read

- \`tg <profile> chats list --json\` lists chats, newest first.
- \`tg <profile> messages search "<words>" --json\` searches the local store.

## Send

Sending needs the owner's go-ahead in this conversation. Show the text first.
`

const minutes = (n: number) => new Date(Date.now() + n * 60_000).toISOString()
const CLAIMS: Record<string, Claim[]> = {
  "tg/personal": [
    { id: "t-1", key: "Q-15", holder: "claude-code:3b8e51d2-7c4a-4f0e-9a61-0d2c5e7f1a94", until: minutes(18) },
    { id: "t-2", key: "P-4", holder: "codex:019a4c7e-82f1-7d30-b6a5-3e9f0c1d2b74", until: minutes(95) },
    { id: "t-3", key: "Q-21", holder: "web-42", until: minutes(7) },
  ],
}

const CAN_ADD = new Set(["claude", "codex"])
const SOURCE: Record<string, string> = {
  claude: "~/.claude.json",
  codex: "codex mcp list --json",
  cursor: "~/.cursor/mcp.json",
  gemini: "~/.gemini/settings.json",
  opencode: "~/.config/opencode/opencode.json",
}

export function agentsMock(versionOf: (id: string) => string | undefined) {
  const written = new Map<string, string>()
  const servers: Record<string, Set<string>> = {
    claude: new Set(["tg-personal"]),
    codex: new Set(),
    cursor: new Set(["memo"]),
    gemini: new Set(),
    opencode: new Set(),
    hermes: new Set(),
    openclaw: new Set(),
  }
  const claims = structuredClone(CLAIMS)
  const bin = (id: string) => (id === "email" ? "memo" : id)
  const mock: Pick<
    Platform,
    | "detectAgents"
    | "skillStatus"
    | "skillInstall"
    | "skillShow"
    | "terminalReach"
    | "agentChats"
    | "mcpRegistrations"
    | "mcpCheck"
    | "mcpAdd"
    | "mcpRemove"
    | "taskClaims"
    | "taskRelease"
  > = {
    async detectAgents() {
      await delay(300)
      return AGENTS
    },
    async skillStatus(id): Promise<SkillReport> {
      await delay(400 + id.length * 120)
      const version = versionOf(id)
      if (!version) throw new Error("the tool is not installed")
      const own = copies[id] ?? {}
      const places: Target[] = KNOWS_HERMES.has(id) ? ["claude", "agents", "hermes"] : ["claude", "agents"]
      const targets = places.map((target) => {
        const installed = written.get(`${id}:${target}`) ?? own[target]?.installed ?? null
        return { target, path: installed ? path(target, id) : null, installed }
      })
      if (id === "memo") {
        return { source: "doctor", targets: targets.map((t) => ({ ...t, state: t.installed ? null : "missing" })) }
      }
      if (NO_STATUS.has(id)) return { source: "none", targets: [] }
      return {
        source: "status",
        targets: targets.map((t) => ({
          ...t,
          state: !t.installed ? "missing" : t.installed === version ? "current" : "stale",
        })),
      }
    },
    async skillInstall(id, target) {
      await delay(900)
      if (params.get("fail") === id) throw new Error("EACCES: permission denied, open '~/.agents/skills/SKILL.md'")
      if (target === "hermes" && !KNOWS_HERMES.has(id))
        throw new Error("error: option '--for <target>' argument 'hermes' is invalid")
      const version = versionOf(id) ?? null
      if (version) written.set(`${id}:${target}`, version)
      return version
    },
    async skillShow(id) {
      await delay(500)
      return { name: `${id}-cli`, content: SKILL(`${id}-cli`) }
    },
    async terminalReach(agent) {
      await delay(250)
      const missing = agent === "hermes" ? ["tg", "max"] : ["zm"]
      return Object.fromEntries(
        ["tg", "max", "wa", "zm", "drive", "memo"]
          .filter((id) => versionOf(id))
          .map((id) => [id, !missing.includes(id)]),
      )
    },
    async agentChats(agent) {
      await delay(450)
      const chats = CHATS[agent]
      if (!chats) throw new Error(`${agent} is not driven from chats`)
      if (params.get("chats") === "none")
        return { ...chats, running: chats.running === null ? null : false, channels: [] }
      return chats
    },
    async mcpRegistrations(agent): Promise<Registrations> {
      await delay(350)
      const names = [...(servers[agent] ?? [])].sort()
      const unread = UNREAD[agent] ?? null
      const source = unread ?? SOURCE[agent] ?? agent
      return { source, names, canAdd: CAN_ADD.has(agent), canRemove: CAN_ADD.has(agent), unread }
    },
    async mcpCheck(id, profile) {
      await delay(1100)
      if (id === "wa") throw new Error("This version of WhatsApp cannot do this yet. Update it on the Tools page.")
      const signedIn = !(id === "tg" && profile === "work")
      return { healthy: signedIn, signedIn, tools: id === "tg" ? 41 : 23, potentialWrites: id === "tg" ? 9 : 4 }
    },
    async mcpAdd(id, profile, agent, allowWrites) {
      await delay(1200)
      if (params.get("fail") === `mcp-${id}`) throw new Error("claude could not add tg-personal")
      if (!allowWrites)
        throw new Error("this profile offers 9 tools that may write; review its permissions, then pass --allow-writes")
      servers[agent]?.add(`${bin(id)}-${profile}`)
    },
    async mcpRemove(id, profile, agent) {
      await delay(700)
      servers[agent]?.delete(profile ? `${bin(id)}-${profile}` : bin(id))
    },
    async taskClaims(id, profile) {
      await delay(600 + id.length * 100)
      if (id === "wa") throw new Error("the message store was written by a newer version — upgrade this tool")
      const items = claims[`${id}/${profile}`] ?? []
      return { items, open: items.length + 4, more: false, signedOut: false }
    },
    async taskRelease(id, profile, task) {
      await delay(600)
      const key = `${id}/${profile}`
      claims[key] = (claims[key] ?? []).filter((c) => c.id !== task && c.key !== task)
    },
  }
  return mock
}
