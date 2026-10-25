import type { Agent, SkillReport, Target } from "./agents-schemas"
import type { Platform } from "./types"

// Fictional skill states covering each case: a CLI with `skill status`, one without (unknown),
// memo's doctor fallback, a stale copy and a missing one. `?fail=<tool>` makes that tool's skill install fail.

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms))
const params = new URLSearchParams(typeof window === "undefined" ? "" : window.location.search)

const AGENTS: Agent[] = [
  { id: "claude", name: "Claude Code", foundBy: "program", reads: ["claude"] },
  { id: "codex", name: "Codex", foundBy: "program", reads: ["agents"] },
  { id: "cursor", name: "Cursor", foundBy: "folder", reads: ["agents", "claude"] },
  { id: "gemini", name: "Gemini CLI", foundBy: null, reads: ["agents"] },
  { id: "opencode", name: "OpenCode", foundBy: null, reads: ["agents", "claude"] },
]

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

export function agentsMock(versionOf: (id: string) => string | undefined) {
  const written = new Map<string, string>()
  const mock: Pick<Platform, "detectAgents" | "skillStatus" | "skillInstall"> = {
    async detectAgents() {
      await delay(300)
      return AGENTS
    },
    async skillStatus(id): Promise<SkillReport> {
      await delay(400 + id.length * 120)
      const version = versionOf(id)
      if (!version) throw new Error("the tool is not installed")
      const own = copies[id] ?? {}
      const targets = (["claude", "agents"] as const).map((target) => {
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
      const version = versionOf(id) ?? null
      if (version) written.set(`${id}:${target}`, version)
      return version
    },
  }
  return mock
}
