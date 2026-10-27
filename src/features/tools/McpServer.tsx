import { ChevronRight } from "lucide-react"
import { useCallback, useEffect, useId, useRef, useState } from "react"
import type { CatalogTool } from "@/domain/catalog"
import { platform } from "@/platform/bridge"
import type { McpServerStatus } from "@/platform/mcp-server-schemas"
import type { FunnelState } from "@/platform/tailscale-schemas"
import { cx } from "@/ui/cx"
import { Skeleton } from "@/ui/Skeleton"
import { McpServerRow, type RowState } from "./McpServerRow"

const message = (e: unknown) => (e instanceof Error ? e.message : String(e))

/** Browser build only: `?mcp=<tool>` opens this section without a click, for review captures. */
function openedByScenario(id: string) {
  if (platform.kind !== "mock") return false
  const params = new URLSearchParams(window.location.search)
  if (params.has("tailscale") && id === "tg") return true
  return [params.get("mcp"), params.get("mcp-fail"), params.get("mcp-old"), params.get("funnel-old")].includes(id)
}

function summaryOf(row: RowState): string | null {
  if (row.state === "loading") return null
  if (row.state === "error") return "Could not read it"
  if (!row.data.available) return "Arrives with the next update"
  return row.data.running ? "Running" : "Off"
}

/**
 * The tool's HTTP MCP server, for ChatGPT and Claude in the browser behind the owner's tunnel. One server serves every
 * profile: the browser app names the profile in each call, and asks the owner when it is not clear. Agents on this
 * computer use the tools directly, so the section starts closed.
 */
export function McpServer({ tool }: { tool: CatalogTool }) {
  const headingId = useId()
  const [open, setOpen] = useState(() => openedByScenario(tool.id))
  const [row, setRow] = useState<RowState>({ state: "loading" })
  const calls = useRef(0)
  const [funnels, setFunnels] = useState<FunnelState[]>([])

  // Only funnels the app set up; a missing Tailscale simply has none.
  const loadFunnels = useCallback(async () => {
    try {
      setFunnels((await platform.tailscaleFunnels()).filter((f) => f.tool === tool.id))
    } catch {
      setFunnels([])
    }
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

  const settle = (data: McpServerStatus) => {
    calls.current++
    setRow({ state: "ready", data })
  }

  const summary = summaryOf(row)

  return (
    <section
      aria-labelledby={headingId}
      className="flex min-w-0 flex-col gap-3 border-line border-t pt-4 lg:col-span-2"
    >
      <h4 id={headingId}>
        <button
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
            MCP server — for chat apps in the browser
          </span>
          {!open && (
            <span className="min-w-0 text-[0.9rem] font-normal text-ink-soft tabular-nums">
              {summary ?? <Skeleton chars={18} />}
            </span>
          )}
        </button>
      </h4>
      {open && (
        <div id={`${headingId}-body`} className="flex min-w-0 flex-col gap-3">
          <p className="max-w-[70ch] text-[0.9rem] text-ink-soft">
            Lets ChatGPT or Claude in the browser reach {tool.name} through a tunnel: Tailscale Funnel, which WireCat
            sets up for you, or one you run. Agents on this computer do not need it. A browser app logs in once with the
            code shown here and reaches every profile, each with its own permissions; it names the profile in each call.
          </p>
          <ul
            className="flex flex-col divide-y divide-line rounded-[0.45rem] border border-line bg-app"
            aria-label={`${tool.name} MCP server`}
          >
            <McpServerRow
              tool={tool}
              row={row}
              funnel={funnels.find((f) => f.shared) ?? null}
              leftovers={funnels.filter((f) => !f.shared && f.live)}
              reload={() => {
                load()
                loadFunnels()
              }}
              settle={(data) => {
                settle(data)
                loadFunnels()
              }}
            />
          </ul>
        </div>
      )}
    </section>
  )
}
