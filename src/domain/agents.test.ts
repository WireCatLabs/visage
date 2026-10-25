import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import {
  agentPathFix,
  buildCheck,
  type CheckInput,
  connections,
  groupSessions,
  KNOWN_AGENTS,
  overall,
  parseHolder,
  sessionQuery,
} from "./agents"
import type { Run } from "./runs"

const run = (over: Partial<Run>): Run => ({
  tool: "tg",
  run_id: Math.random().toString(36),
  command: "chats list",
  status: "success",
  started_at: "2026-10-25T10:00:00.000Z",
  ...over,
})

describe("groupSessions", () => {
  it("groups runs by agent and session, newest session first, and keeps older runs apart", () => {
    const sessions = groupSessions([
      run({ agent: { kind: "claude-code", session_id: "s1" }, argv: [], started_at: "2026-10-25T09:00:00.000Z" }),
      run({ tool: "max", agent: { kind: "claude-code", session_id: "s1" }, argv: [], status: "failed" }),
      run({ agent: { kind: "codex", session_id: null }, argv: [], started_at: "2026-10-25T11:00:00.000Z" }),
      run({ argv: ["personal", "chats", "list"] }),
      run({}),
      run({}),
    ])
    expect(sessions.map((s) => [s.key, s.runs, s.failed])).toEqual([
      ["codex:", 1, 0],
      ["claude-code:s1", 2, 1],
      ["you", 1, 0],
      ["unknown", 2, 0],
    ])
    const claude = sessions[1]
    expect(claude?.tools).toEqual(["tg", "max"])
    expect(claude?.first).toBe("2026-10-25T09:00:00.000Z")
    expect(claude && sessionQuery(claude)).toBe("agent:claude-code session_id:s1 -no_command:true")
    expect(sessions[0] && sessionQuery(sessions[0])).toBe("agent:codex -no_command:true")
  })
})

describe("parseHolder", () => {
  it("reads cli-core's holder ids", () => {
    expect(parseHolder("claude-code:3b8e")).toEqual({
      type: "agent",
      agent: "claude",
      kind: "claude-code",
      session: "3b8e",
    })
    expect(parseHolder("codex")).toEqual({ type: "agent", agent: "codex", kind: "codex", session: null })
    expect(parseHolder("gemini-cli")).toMatchObject({ agent: "gemini" })
    expect(parseHolder("owner")).toEqual({ type: "owner" })
    expect(parseHolder("web-42")).toEqual({ type: "other", name: "web-42" })
  })
})

describe("connections", () => {
  it("lists every profile, extra registered names and a bare entry", () => {
    expect(connections(["tg-personal", "tg-old", "tg", "max-personal"], "tg", ["personal", "work"])).toEqual([
      { profile: "personal", connected: true },
      { profile: "work", connected: false },
      { profile: "old", connected: true },
      { profile: null, connected: true },
    ])
  })
})

describe("buildCheck", () => {
  const base: CheckInput = {
    agent: { id: "claude", name: "Claude Code", reads: ["claude"] },
    tools: [
      { id: "tg", name: "Telegram", bin: "tg", path: "~/.local/share/pnpm/tg" },
      { id: "zm", name: "Zoom", bin: "zm", path: "/usr/lib/node/bin/zm" },
      { id: "max", name: "MAX", bin: "max", path: null },
    ],
    reach: { tg: true, zm: false, max: true },
    skills: {
      tg: { claude: { kind: "current", installed: "0.88.0" } },
      zm: { claude: { kind: "missing" } },
      max: { claude: { kind: "unknown" } },
    },
  }

  it("gives Hermes one shell-profile line for every tool its gateway's shell misses", () => {
    const items = buildCheck({
      ...base,
      agent: { id: "hermes", name: "Hermes Agent", reads: ["hermes"] },
      reach: { tg: false, zm: false, max: true },
      skills: { tg: { hermes: { kind: "unsupported" } }, zm: { hermes: { kind: "unsupported" } } },
    })
    const path = items.find((i) => i.id === "path:agent")
    expect(path?.title).toBe("Hermes Agent cannot find Telegram, Zoom")
    expect(path?.detail).toMatch(/bash -l.*~\/\.profile/)
    expect(path?.fix).toEqual({
      kind: "command",
      command: 'export PATH="$HOME/.local/share/pnpm:/usr/lib/node/bin:$PATH"',
    })
    expect(items.some((i) => i.id.endsWith(":path"))).toBe(false)
    expect(items.find((i) => i.id === "skill:unsupported")?.title).toBe(
      "Telegram, Zoom cannot write a skill for Hermes Agent yet",
    )
    expect(overall(items, base.tools)).toBe("warn")
    expect(overall(items, base.tools.slice(0, 2))).toBe("bad")
  })

  it("gives OpenClaw one pathPrepend list, since setting it replaces the list", () => {
    const openclaw = { id: "openclaw", name: "OpenClaw" }
    const fix = agentPathFix(openclaw, base.tools.slice(0, 2))
    expect(fix?.command).toBe(
      `openclaw config set tools.exec.pathPrepend '["~/.local/share/pnpm","/usr/lib/node/bin"]' --strict-json`,
    )
    expect(fix?.detail).toMatch(/replaces the whole list.*gateway is stopped/)
    expect(agentPathFix({ id: "claude", name: "Claude Code" }, base.tools)).toBeNull()
    expect(agentPathFix(openclaw, base.tools, true)).toBeNull()
  })

  it("lists what to fix worst first, each with its fix", () => {
    const items = buildCheck(base)
    const by = (id: string) => items.find((i) => i.id === id)
    expect(items[0]?.id).toBe("zm:path")
    expect(by("zm:path")?.fix).toEqual({ kind: "command", command: 'export PATH="/usr/lib/node/bin:$PATH"' })
    expect(by("zm:skill")).toMatchObject({ tone: "warn", fix: { kind: "skill", tool: "zm", target: "claude" } })
    expect(by("skill:unknown")?.title).toBe("MAX cannot report its skill")
    expect(items.some((i) => /mcp/i.test(i.id + i.title + i.detail))).toBe(false)
    expect(overall(items)).toBe("bad")
    expect(overall(items, base.tools)).toBe("warn")
    expect(
      overall(
        items,
        base.tools.filter((t) => t.id === "zm"),
      ),
    ).toBe("bad")
  })

  it("is fine when everything answers", () => {
    const items = buildCheck({
      ...base,
      tools: base.tools.slice(0, 1),
    })
    expect(overall(items)).toBe("ok")
    expect(items.filter((i) => i.tone !== "ok" && i.tone !== "idle")).toEqual([])
  })

  it("says how many commands each profile's permissions block, once Check has read them", () => {
    expect(buildCheck(base).find((i) => i.id === "permissions")?.title).toMatch(/when you check this agent/)
    const items = buildCheck({ ...base, access: { "tg/work": { blocked: 3, total: 50 }, "tg/personal": "no answer" } })
    expect(items.find((i) => i.id === "tg/work:permissions")).toMatchObject({
      title: "Telegram (work): 3 of 50 commands are blocked",
      fix: { kind: "tools" },
    })
    expect(items.find((i) => i.id === "tg/personal:permissions")?.detail).toBe("no answer")
    expect(items.some((i) => i.id === "permissions")).toBe(false)
  })

  it("names the folder instead of a shell line on Windows", () => {
    const item = buildCheck({ ...base, windows: true }).find((i) => i.id === "zm:path")
    expect(item?.fix).toBeUndefined()
    expect(item?.detail).toMatch(/Add \/usr\/lib\/node\/bin to your user Path/)
  })

  it("turns the home folder into $HOME so the line works in a shell", () => {
    const items = buildCheck({ ...base, reach: { tg: false } })
    expect(items.find((i) => i.id === "tg:path")?.fix).toEqual({
      kind: "command",
      command: 'export PATH="$HOME/.local/share/pnpm:$PATH"',
    })
  })
})

describe("KNOWN_AGENTS", () => {
  it("matches the agents skills.rs detects, in its order, so the placeholder rows are the real rows", () => {
    const rust = readFileSync("src-tauri/src/skills.rs", "utf8")
    const block = rust.slice(rust.indexOf("const AGENTS"), rust.indexOf("];", rust.indexOf("const AGENTS")))
    const specs = [...block.matchAll(/id: "([^"]+)",\s*name: "([^"]+)"/g)].map(([, id, name]) => ({ id, name }))
    expect(KNOWN_AGENTS).toEqual(specs)
  })
})
