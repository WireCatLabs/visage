import { describe, expect, it } from "vitest"
import type { McpClient, McpServerStatus, PublicCheck } from "@/platform/mcp-server-schemas"
import { activityOf, ago, busiest, currentStep, reachOf, testState } from "./connect-steps"

const client = (more: Partial<McpClient> = {}): McpClient => ({
  claimedName: "ChatGPT",
  lastLoginAt: "2026-10-27T10:00:00Z",
  lastRequestAt: null,
  lastTool: null,
  lastToolAt: null,
  toolCallsToday: 0,
  ...more,
})

const server = (more: Partial<McpServerStatus> = {}): McpServerStatus => ({
  available: true,
  running: true,
  listening: true,
  startedHere: true,
  startedAt: null,
  port: 8765,
  connectorUrl: "https://h.ts.net/tg/mcp",
  loginCode: null,
  outdated: false,
  clients: [],
  ...more,
})

const at = (iso: string) => Date.parse(iso)

describe("the guide's step", () => {
  it("goes choose, address, start, reach, connect, test; a running server skips address and start", () => {
    const off = server({ running: false, listening: false, connectorUrl: null })
    const p = { app: null, addressReady: false, server: off, reached: false, added: false }
    expect(currentStep(p)).toBe("choose")
    expect(currentStep({ ...p, app: "chatgpt" })).toBe("address")
    expect(currentStep({ ...p, app: "chatgpt", addressReady: true })).toBe("start")
    expect(currentStep({ ...p, app: "claude", server: server() })).toBe("reach")
    expect(currentStep({ ...p, app: "claude", server: server(), reached: true })).toBe("connect")
    expect(currentStep({ ...p, app: "claude", server: server(), reached: true, added: true })).toBe("test")
    expect(currentStep({ ...p, app: "claude", addressReady: true, server: server({ listening: false }) })).toBe("start")
  })
})

describe("the address check", () => {
  const check = (dns: PublicCheck["dns"], answer: PublicCheck["answer"] = { kind: "notTried" }): PublicCheck => ({
    host: "h.ts.net",
    dns,
    answer,
  })

  it("waits while public DNS has no name, and is live once it has, tested from here or not", () => {
    expect(reachOf(null)).toEqual({ state: "checking" })
    expect(reachOf(check("missing"))).toEqual({ state: "publishing" })
    expect(reachOf(check("live", { kind: "ok" }))).toEqual({ state: "live", tested: true })
    expect(reachOf(check("live", { kind: "unreached", reason: "refused" }))).toEqual({ state: "live", tested: false })
  })

  it("says when something else answers, or when no DNS service could be asked", () => {
    expect(reachOf(check("live", { kind: "wrong", status: 502 }))).toEqual({ state: "wrong", status: 502 })
    expect(reachOf(check("unknown"))).toEqual({ state: "unknown" })
  })
})

describe("the connection test", () => {
  const since = at("2026-10-27T11:00:00Z")

  it("ignores an app that logged in before the guide opened", () => {
    expect(testState(server({ clients: [client()] }), since)).toEqual({ state: "waiting" })
  })

  it("sees a new login, or an old app reaching the server now, and whether the tool counts calls", () => {
    const joined = client({ lastLoginAt: "2026-10-27T11:01:00Z" })
    expect(testState(server({ clients: [joined] }), since)).toEqual({
      state: "connected",
      client: joined,
      counts: true,
    })
    const back = client({ lastRequestAt: "2026-10-27T11:02:00Z" })
    expect(testState(server({ clients: [back] }), since)).toMatchObject({ state: "connected", client: back })
    const old = client({ lastLoginAt: "2026-10-27T11:01:00Z", toolCallsToday: null })
    expect(testState(server({ clients: [old] }), since)).toMatchObject({ counts: false })
  })

  it("is done when any app calls a tool after the guide opened", () => {
    const called = client({ lastTool: "tg_read", lastToolAt: "2026-10-27T11:03:00Z", toolCallsToday: 1 })
    expect(testState(server({ clients: [client(), called] }), since)).toEqual({ state: "called", client: called })
    const before = client({ lastTool: "tg_read", lastToolAt: "2026-10-27T10:00:00Z" })
    expect(testState(server({ clients: [before] }), since)).toEqual({ state: "waiting" })
  })
})

describe("activity", () => {
  const now = at("2026-10-27T12:00:00Z")

  it("says how long ago in plain words", () => {
    expect(ago("2026-10-27T11:59:30Z", now)).toBe("just now")
    expect(ago("2026-10-27T11:58:00Z", now)).toBe("2 min ago")
    expect(ago("2026-10-27T09:00:00Z", now)).toBe("3 h ago")
    expect(ago("2026-10-26T12:00:00Z", now)).toBe("yesterday")
    expect(ago("2026-10-24T12:00:00Z", now)).toBe("3 days ago")
  })

  it("reads the last call, else the last request, else the login", () => {
    const called = client({ lastTool: "tg_read", lastToolAt: "2026-10-27T11:58:00Z", toolCallsToday: 14 })
    expect(activityOf(called, now)).toBe("last call 2 min ago · tg_read · 14 today")
    expect(activityOf(client({ lastRequestAt: "2026-10-27T11:58:00Z" }), now)).toBe("connected 2 min ago, no calls yet")
    expect(activityOf(client(), now)).toBe("logged in 2 h ago")
  })

  it("picks the app that called last, only while the server runs", () => {
    const a = client({ claimedName: "A", lastTool: "x", lastToolAt: "2026-10-27T11:00:00Z" })
    const b = client({ claimedName: "B", lastTool: "y", lastToolAt: "2026-10-27T11:30:00Z" })
    expect(busiest(server({ clients: [a, client(), b] }))?.claimedName).toBe("B")
    expect(busiest(server({ running: false, clients: [a] }))).toBeNull()
  })
})
