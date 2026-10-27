import { ChevronRight } from "lucide-react"
import { useCallback, useEffect, useId, useRef, useState } from "react"
import type { CatalogTool } from "@/domain/catalog"
import { platform } from "@/platform/bridge"
import type { TunnelRoute } from "@/platform/cloudflare-schemas"
import type { McpServerStatus } from "@/platform/mcp-server-schemas"
import type { FunnelState } from "@/platform/tailscale-schemas"
import { Button } from "@/ui/Button"
import { Collapse } from "@/ui/Collapse"
import { cx } from "@/ui/cx"
import { Disclosure } from "@/ui/Disclosure"
import { Lamp } from "@/ui/Lamp"
import { focusInPlace, PANEL_MS } from "@/ui/motion"
import { Skeleton } from "@/ui/Skeleton"
import { ConnectGuide } from "./ConnectGuide"
import { scenarioOf } from "./connect-scenario"
import { activityOf, appLabel, busiest } from "./connect-steps"
import { forgetKept, useKept } from "./kept"
import { McpServerRow, type RowState } from "./McpServerRow"

const CODE_POLL_MS = 3000

const message = (e: unknown) => (e instanceof Error ? e.message : String(e))

/** Browser build only: these scenarios open the section without a click, for review captures. */
function openedByScenario(id: string) {
  if (platform.kind !== "mock") return false
  const params = new URLSearchParams(window.location.search)
  if (scenarioOf(id)) return true
  return [
    params.get("mcp"),
    params.get("mcp-fail"),
    params.get("mcp-old"),
    params.get("funnel-old"),
    params.get("code-used"),
  ].includes(id)
}

function summaryOf(row: RowState): string | null {
  if (row.state === "loading") return null
  if (row.state === "error") return "Could not read it"
  const s = row.data
  if (!s.available) return "Arrives with the next update"
  if (!s.running) return s.clients.length > 0 ? "Server off" : "No app connected"
  const used = busiest(s)
  if (used) return `${used.claimedName ?? "An app"} · ${activityOf(used)}`
  return s.clients.length > 0
    ? `${s.clients.length} app${s.clients.length > 1 ? "s" : ""} logged in`
    : "Server running, no app yet"
}

/**
 * Lets ChatGPT or Claude in the browser use the tool: its HTTP MCP server behind a tunnel, set up by a guide whose goal
 * is a working call from the app, not a running server. One server serves every profile; the app names one in each
 * call. Agents on this computer use the tools directly, so the section starts closed.
 */
export function McpServer({ tool }: { tool: CatalogTool }) {
  const headingId = useId()
  const [open, setOpen] = useKept(`mcp:${tool.id}`, "open", () => openedByScenario(tool.id))
  // Sent here from another surface ("Connect an AI app" after a sign-in): shown once the tool's panel has opened.
  const [reveal, setReveal] = useKept(`mcp:${tool.id}`, "reveal", false)
  const toggle = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    if (!reveal) return
    const t = setTimeout(() => {
      setReveal(false)
      focusInPlace(toggle.current, "start")
    }, PANEL_MS)
    return () => clearTimeout(t)
  }, [reveal, setReveal])
  const [row, setRow] = useState<RowState>({ state: "loading" })
  const [guiding, setGuiding] = useKept<boolean | null>(`mcp:${tool.id}`, "guiding", () =>
    scenarioOf(tool.id) ? true : null,
  )
  // A new run of the guide starts from its first step; a finished one is forgotten.
  const [round, setRound] = useKept(`mcp:${tool.id}`, "round", 0)
  const guide = (on: boolean) => {
    forgetKept(`connect:${tool.id}`)
    setRound((r) => r + 1)
    setGuiding(on)
  }
  const calls = useRef(0)
  const [funnels, setFunnels] = useState<FunnelState[]>([])
  const [route, setRoute] = useState<TunnelRoute | null>(null)

  // Only funnels and tunnel routes the app set up; a missing Tailscale or cloudflared simply has none.
  const loadFunnels = useCallback(async () => {
    const [f, r] = await Promise.allSettled([platform.tailscaleFunnels(), platform.cloudflareRoutes()])
    setFunnels(f.status === "fulfilled" ? f.value.filter((x) => x.tool === tool.id) : [])
    setRoute(r.status === "fulfilled" ? (r.value.find((x) => x.tool === tool.id) ?? null) : null)
  }, [tool.id])

  useEffect(() => {
    if (open) loadFunnels()
  }, [open, loadFunnels])

  const load = useCallback(async () => {
    const call = ++calls.current
    setRow((r) => (r.state === "ready" ? r : { state: "loading" }))
    try {
      const data = await platform.mcpServerStatus(tool.id)
      if (calls.current === call) setRow({ state: "ready", data })
    } catch (e) {
      if (calls.current === call) setRow({ state: "error", message: message(e) })
    }
  }, [tool.id])

  useEffect(() => {
    load()
  }, [load])

  // Each code works for one login, so the one on screen goes stale when an app logs in. Each read runs the tool once:
  // only while the code is in view and the window is in front, and once more on coming back to it.
  const codeShown = open && row.state === "ready" && row.data.loginCode !== null
  useEffect(() => {
    if (!codeShown) return
    const looking = () => document.visibilityState === "visible" && document.hasFocus()
    const check = () => {
      if (looking()) load()
    }
    const t = setInterval(check, CODE_POLL_MS)
    window.addEventListener("focus", check)
    document.addEventListener("visibilitychange", check)
    return () => {
      clearInterval(t)
      window.removeEventListener("focus", check)
      document.removeEventListener("visibilitychange", check)
    }
  }, [codeShown, load])

  const settle = useCallback(
    (data: McpServerStatus) => {
      calls.current++
      setRow({ state: "ready", data })
      loadFunnels()
    },
    [loadFunnels],
  )

  const reload = useCallback(async () => {
    await Promise.all([load(), loadFunnels()])
  }, [load, loadFunnels])

  const data = row.state === "ready" ? row.data : null
  const connected = data?.running === true && data.clients.length > 0
  // Decided once, from the first answer: the guide never gives way to the overview because the server it started
  // now has a logged-in app. Only Finish closes it.
  const ready = data !== null
  useEffect(() => {
    if (ready && guiding === null) setGuiding(!connected)
  }, [ready, guiding, connected, setGuiding])
  const showGuide = data?.available === true && (guiding ?? !connected)
  const funnel = funnels.find((f) => f.shared) ?? null
  const summary = summaryOf(row)

  return (
    <section aria-labelledby={headingId} className="flex min-w-0 flex-col border-line border-t pt-4 lg:col-span-2">
      <h4 id={headingId}>
        <button
          ref={toggle}
          type="button"
          aria-expanded={open}
          aria-controls={`${headingId}-body`}
          onClick={() => setOpen((o) => !o)}
          className="group flex w-full min-w-0 flex-wrap items-baseline gap-x-3 gap-y-1 rounded text-left"
        >
          <span className="flex items-center gap-1.5 text-[1.02rem] font-semibold text-ink group-hover:text-brand">
            <ChevronRight
              className={cx(
                "size-4 shrink-0 self-center text-ink-dim transition-transform duration-150 motion-reduce:transition-none",
                open && "rotate-90",
              )}
              aria-hidden
            />
            Connect an AI app
          </span>
          {!open && (
            <span className="min-w-0 text-[0.9rem] font-normal text-ink-soft tabular-nums">
              {summary ?? <Skeleton chars={18} />}
            </span>
          )}
        </button>
      </h4>
      <Collapse open={open} id={`${headingId}-body`} className="flex min-w-0 flex-col gap-4 pt-3">
        <p className="max-w-[72ch] text-[0.92rem] text-ink-soft">
          Let ChatGPT or Claude in the browser use {tool.name}, within each profile's permissions. WireCat gives this
          computer an internet address, starts {tool.bin}'s server, shows what to click in the app and checks that the
          app gets through. Nothing starts until you press Start the server.
        </p>
        {row.state === "loading" && <Skeleton className="h-[12rem] w-full" label="Reading the server's state" />}
        {data && !data.available && (
          <p className="text-[0.92rem] text-ink-soft">
            This version of {tool.name} cannot do it yet. It arrives with the next update of {tool.bin}.
          </p>
        )}
        {data && showGuide && (
          <ConnectGuide
            key={round}
            tool={tool}
            server={data}
            funnel={funnel}
            route={route}
            reload={reload}
            settle={settle}
            onDone={() => guide(false)}
            onAgain={() => guide(true)}
          />
        )}
        {data?.available === true && !showGuide && <Connected data={data} onConnect={() => guide(true)} />}
        {row.state !== "loading" && (
          <Disclosure summary="Server details">
            <ul
              className="flex flex-col divide-y divide-line rounded-[0.45rem] border border-line bg-app"
              aria-label={`${tool.name} MCP server`}
            >
              <McpServerRow
                tool={tool}
                row={row}
                funnel={funnel}
                route={route}
                leftovers={funnels.filter((f) => !f.shared && f.live)}
                reload={reload}
                onStart={() => guide(true)}
              />
            </ul>
          </Disclosure>
        )}
      </Collapse>
    </section>
  )
}

/** After setup: which apps use the tool and what each did last. */
function Connected({ data, onConnect }: { data: McpServerStatus; onConnect(): void }) {
  return (
    <div className="flex flex-col gap-3">
      <ul className="flex flex-col divide-y divide-line rounded-[0.45rem] border border-line bg-app">
        {data.clients.map((c) => (
          <li
            key={`${c.claimedName}-${c.lastLoginAt}`}
            className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2.5"
          >
            <Lamp tone={data.running ? "ok" : "idle"} size="sm" label={data.running ? "Connected" : "Server off"} />
            <span className="text-[0.95rem] text-ink">
              Calls itself <span className="selectable font-mono">{appLabel(c)}</span>
            </span>
            <span className="text-[0.88rem] text-ink-soft tabular-nums">{activityOf(c)}</span>
          </li>
        ))}
      </ul>
      {!data.running && (
        <p className="text-[0.88rem] text-warn-ink">The server is off, so these apps cannot reach it now.</p>
      )}
      <div>
        <Button size="sm" onClick={onConnect}>
          {data.running ? "Connect another app" : "Start and connect"}
        </Button>
      </div>
    </div>
  )
}
