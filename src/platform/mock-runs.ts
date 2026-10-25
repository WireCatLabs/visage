import { recordOn } from "./mock-settings"
import type { RunDetail, RunEvent, RunItem } from "./runs-schemas"
import type { Platform } from "./types"

// Fictional runs for the browser build. `?runs=none` shows tools with nothing kept, `?runs=fail` makes MAX fail,
// `?runs=old` gives Zoom, Drive and Memo a version from before their `runs` commands.
const params = new URLSearchParams(typeof window === "undefined" ? "" : window.location.search)
const scenario = params.get("runs")
const delay = (ms: number) => new Promise((r) => setTimeout(r, ms))

type Plan = {
  count: number
  wait: number
  version: string
  commands: string[]
  profiles: string[]
  /** The tool's own request name; the messengers' come from ERRORS. */
  op?: string
}

const PLAN: Record<string, Plan> = {
  tg: {
    count: 214,
    wait: 500,
    version: "0.88.0",
    commands: ["messages send", "chats list", "sync", "messages search", "media download", "contacts list", "tg"],
    profiles: ["personal", "work", "newsbot"],
  },
  max: {
    count: 63,
    wait: 900,
    version: "0.74.0",
    commands: ["messages send", "chats list", "max", "max", "max", "account login"],
    profiles: ["personal", "studio"],
  },
  wa: {
    count: 38,
    wait: 1300,
    version: "0.6.0",
    commands: ["messages send", "chats list", "sync"],
    profiles: ["phone"],
  },
  zm: {
    count: 17,
    wait: 700,
    version: "0.45.0",
    commands: ["meetings sync", "meetings transcript", "recordings download", "zm"],
    profiles: ["work"],
    op: "GET /v2/users/:id/recordings",
  },
  drive: {
    count: 24,
    wait: 1100,
    version: "0.33.0",
    commands: ["sync", "files list", "search", "drive"],
    profiles: ["personal", "studio"],
    op: "GET /drive/v3/files",
  },
  memo: {
    count: 31,
    wait: 600,
    version: "0.104.0",
    commands: ["sync", "mail import", "search all", "memo"],
    profiles: [""],
    op: "himalaya.envelope.list",
  },
}

const OLD: Record<string, string> = {
  zm: `unknown command 'list' — "runs" is not a command, so it was read as a profile name — which left "list" to be one.`,
  drive: "unknown command 'list'",
  memo: "unknown command 'runs'",
}

const ERRORS: Record<string, { op: string; weight: number }> = {
  rate_limited: { op: "messages.getHistory", weight: 6 },
  timeout: { op: "updates.getDifference", weight: 4 },
  auth_required: { op: "auth.checkSession", weight: 3 },
  network_error: { op: "connect", weight: 3 },
  not_found: { op: "chats.resolve", weight: 2 },
  validation_error: { op: "input", weight: 2 },
  flood_wait: { op: "messages.sendMessage", weight: 1 },
}

function rng(seed: number) {
  let s = seed
  return () => {
    s = (s + 0x6d2b79f5) | 0
    let t = Math.imul(s ^ (s >>> 15), 1 | s)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const pick = <T>(r: () => number, xs: readonly T[]): T => xs[Math.floor(r() * xs.length)] as T
const weighted = (r: () => number) => {
  const entries = Object.entries(ERRORS)
  let n = r() * entries.reduce((sum, [, e]) => sum + e.weight, 0)
  for (const [code, e] of entries) {
    n -= e.weight
    if (n <= 0) return code
  }
  return "rate_limited"
}

const stamp = (d: Date) =>
  d
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d+Z$/, "Z")
const hex = (r: () => number) =>
  Math.floor(r() * 0xffffff)
    .toString(16)
    .padStart(6, "0")

type MockRun = RunItem & { events: RunEvent[] }

function build(tool: string, now: number): MockRun[] {
  const plan = PLAN[tool]
  if (!plan) return []
  const r = rng(tool.charCodeAt(0) * 997 + tool.length)
  const runs: MockRun[] = []
  let t = now - 20 * 60_000
  for (let i = 0; i < plan.count; i++) {
    t -= (30 / plan.count) * 86_400_000 * (0.3 + r() * 1.4)
    const command = pick(r, plan.commands)
    const roll = r()
    // Started with no command it knows, the tool records its own name and stops before any request.
    const bare = command === tool
    const status = bare
      ? "failed"
      : roll < 0.8
        ? "failed"
        : roll < 0.87
          ? "partial"
          : roll < 0.995
            ? "success"
            : "running"
    const code = bare ? "validation_error" : status === "failed" || status === "partial" ? weighted(r) : undefined
    const op = plan.op ?? (code ? (ERRORS[code]?.op ?? "request") : "messages.getHistory")
    const duration = Math.round(code === "timeout" ? 30_000 + r() * 2000 : 40 + r() * (r() < 0.2 ? 9000 : 1400))
    const started = new Date(t)
    const requests = code === "validation_error" ? 0 : 1 + Math.floor(r() * 6)
    const events: RunEvent[] =
      requests === 0
        ? []
        : Array.from({ length: requests }, (_, k) => {
            const last = k === requests - 1 && code
            return {
              time: new Date(t + k * 180).toISOString(),
              severity: last ? "error" : "info",
              event: last ? "provider.response" : "provider.request",
              operation: last ? op : (plan.op ?? "messages.getHistory"),
              duration_ms: Math.round(20 + r() * 400),
              outcome: last ? "error" : "ok",
              ...(last
                ? {
                    error_code: code,
                    retry: {
                      attempt: k + 1,
                      safe: code !== "auth_required",
                      after_ms: code === "flood_wait" ? 27_000 : 2000,
                    },
                    http: { method: "POST", status: code === "not_found" ? 404 : code === "rate_limited" ? 429 : 500 },
                  }
                : { page: { limit: 100, offset: k * 100 } }),
            }
          })
    const profile = pick(r, plan.profiles)
    runs.push({
      run_id: `${stamp(started)}-${command.replace(/\s+/g, "-")}-${hex(r)}`,
      command,
      ...(profile ? { profile } : {}),
      started_at: started.toISOString(),
      ...(status === "running" ? {} : { completed_at: new Date(t + duration).toISOString(), duration_ms: duration }),
      status,
      cli_version: i < plan.count / 3 ? plan.version : "0.5.2",
      runtime: "node 24.19.0",
      platform: "linux",
      arch: "x64",
      requests,
      ...(code ? { error_code: code, kept_because_failed: true } : {}),
      operations: requests ? [op] : [],
      codes: code ? [code] : [],
      ...(status === "partial"
        ? {
            partial: {
              failed: 2,
              stop_reason: "rate_limited",
              failures: [
                { id: "msg-1042", stage: "download", error_code: code ?? "timeout", attachment: 1 },
                { id: "msg-1043", stage: "download", error_code: "timeout" },
              ],
            },
          }
        : {}),
      events,
    })
  }
  return runs
}

const cache = new Map<string, MockRun[]>()
const runsOf = (tool: string) => {
  let runs = cache.get(tool)
  if (!runs) {
    runs = build(tool, Date.now())
    cache.set(tool, runs)
  }
  return runs
}

export const runsMock: Pick<Platform, "listRuns" | "showRun"> = {
  async listRuns(id, _query, limit, page) {
    await delay(PLAN[id]?.wait ?? 300)
    if (!PLAN[id]) throw new Error("This tool does not keep run logs yet.")
    if (scenario === "fail" && id === "max") throw new Error("max runs list: the program did not finish in time")
    if (scenario === "old" && OLD[id]) throw new Error(OLD[id])
    // A tool keeps a successful run only when its profile records every run.
    const all = scenario === "none" ? [] : runsOf(id).filter((r) => r.status !== "success" || recordOn(id, r.profile))
    const items = all.slice((page - 1) * limit, page * limit).map(({ events: _, ...run }) => run)
    return { items, page: { has_more: all.length > page * limit } }
  },
  async showRun(id, run): Promise<RunDetail> {
    await delay(250)
    const found = runsOf(id).find((r) => r.run_id === run)
    if (!found) throw new Error(`no recorded run "${run}"`)
    return {
      item: {
        ...found,
        directory: `~/.local/state/${id}-cli/runs/${found.started_at.slice(0, 10)}/${run}`,
        event_count: found.events.length,
      },
    }
  },
}
