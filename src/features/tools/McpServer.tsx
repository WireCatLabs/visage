import { ChevronRight } from "lucide-react"
import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react"
import type { CatalogTool } from "@/domain/catalog"
import { platform } from "@/platform/bridge"
import type { McpServerStatus } from "@/platform/mcp-server-schemas"
import { cx } from "@/ui/cx"
import { Skeleton } from "@/ui/Skeleton"
import { useProfiles } from "./Health"
import { McpServerRow, type RowState } from "./McpServerRow"

const message = (e: unknown) => (e instanceof Error ? e.message : String(e))
const keyOf = (profile: string | null) => profile ?? ""

/** Browser build only: `?mcp=<tool>` opens this section without a click, for review captures. */
function openedByScenario(id: string) {
  if (platform.kind !== "mock") return false
  const params = new URLSearchParams(window.location.search)
  return [params.get("mcp"), params.get("mcp-fail"), params.get("mcp-old")].includes(id)
}

function summaryOf(targets: (string | null)[], states: Record<string, RowState>): string | null {
  const known = targets.map((t) => states[keyOf(t)])
  if (known.some((s) => !s || s.state === "loading")) return null
  if (known.every((s) => s?.state === "error")) return "Could not read it"
  if (known.every((s) => s?.state === "ready" && !s.data.available)) return "Arrives with the next update"
  const on = targets.filter((t) => {
    const s = states[keyOf(t)]
    return s?.state === "ready" && s.data.running
  })
  if (on.length === 0) return "Off"
  return on[0] === null ? "Running" : `Running for ${on.join(", ")}`
}

/**
 * The tool's HTTP MCP server, for ChatGPT and Claude in the browser behind the owner's tunnel. Agents on this computer
 * use the tools directly, so the section starts closed. One row per profile: nothing is chosen for the owner.
 */
export function McpServer({ tool }: { tool: CatalogTool }) {
  const headingId = useId()
  const [open, setOpen] = useState(() => openedByScenario(tool.id))
  const { profiles, error: profilesError } = useProfiles(tool.id)
  const [states, setStates] = useState<Record<string, RowState>>({})
  const calls = useRef<Record<string, number>>({})

  const targets = useMemo<(string | null)[] | undefined>(
    () => (profiles === undefined ? undefined : profiles === null ? [null] : profiles.map((p) => p.name)),
    [profiles],
  )

  const load = useCallback(
    async (profile: string | null) => {
      const k = keyOf(profile)
      const call = (calls.current[k] ?? 0) + 1
      calls.current[k] = call
      setStates((s) => ({ ...s, [k]: s[k]?.state === "ready" ? s[k] : { state: "loading" } }))
      try {
        const data = await platform.mcpServerStatus(tool.id, profile)
        if (calls.current[k] === call) setStates((s) => ({ ...s, [k]: { state: "ready", data } }))
      } catch (e) {
        if (calls.current[k] === call) setStates((s) => ({ ...s, [k]: { state: "error", message: message(e) } }))
      }
    },
    [tool.id],
  )

  useEffect(() => {
    for (const t of targets ?? []) load(t)
  }, [targets, load])

  const settle = (profile: string | null, data: McpServerStatus) => {
    calls.current[keyOf(profile)] = (calls.current[keyOf(profile)] ?? 0) + 1
    setStates((s) => ({ ...s, [keyOf(profile)]: { state: "ready", data } }))
  }

  const summary = targets ? summaryOf(targets, states) : profilesError ? "Could not read the profiles" : null

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
            Lets ChatGPT or Claude in the browser reach {tool.name} through a tunnel you run, such as Tailscale Funnel.
            Agents on this computer do not need it. A browser app logs in once with the code shown here, and then acts
            with the profile's permissions.
          </p>
          {targets === undefined ? (
            profilesError ? (
              <p className="text-[0.9rem] text-bad">Could not read the profiles: {profilesError}</p>
            ) : (
              <Skeleton className="h-[3rem] w-full" label="Reading the profiles" />
            )
          ) : targets.length === 0 ? (
            <p className="text-[0.9rem] text-ink-soft">Add a profile first: the server serves one profile.</p>
          ) : (
            <ul
              className="flex flex-col divide-y divide-line rounded-[0.45rem] border border-line bg-app"
              aria-label={`${tool.name} MCP servers`}
            >
              {targets.map((profile) => (
                <McpServerRow
                  key={keyOf(profile)}
                  tool={tool}
                  profile={profile}
                  row={states[keyOf(profile)] ?? { state: "loading" }}
                  reload={() => load(profile)}
                  settle={(data) => settle(profile, data)}
                />
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  )
}
