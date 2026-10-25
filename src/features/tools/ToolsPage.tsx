import { LoaderCircle, RefreshCw } from "lucide-react"
import { useEffect } from "react"
import { tools } from "@/domain/catalog"
import { cx } from "@/ui/cx"
import { NodeNotice } from "../system/NodeNotice"
import { useSystem } from "../system/store"
import { useTools } from "./store"
import { ToolRow } from "./ToolRow"

export function ToolsPage() {
  const refreshing = useTools((s) => s.refreshing)
  const error = useTools((s) => s.error)
  const systemError = useSystem((s) => s.error)
  const latestUnknown = useTools((s) => s.latest !== null && Object.keys(s.latest).length === 0)
  const askingNpm = useTools((s) => s.latest === null)
  const progress = refreshing
    ? "Looking for WireCat tools on this computer…"
    : askingNpm
      ? "Checking npm for newer versions…"
      : null

  useEffect(() => {
    useTools.getState().refresh()
  }, [])

  return (
    <div className="flex flex-col gap-[1.5rem] px-[2.1rem] pt-[1.6rem] pb-[2.2rem]">
      <div className="flex items-end justify-between gap-4">
        <div className="flex min-w-0 items-baseline gap-[1.2rem]">
          <h1 className="font-display text-[2.1rem] font-extrabold leading-none tracking-[-0.035em]">Tools</h1>
          <p aria-live="polite" className="flex min-w-0 items-center gap-1.5 text-[0.9rem] text-ink-soft">
            {progress && (
              <>
                <LoaderCircle className="size-4 shrink-0 animate-spin text-brand" aria-hidden />
                <span className="truncate">{progress}</span>
              </>
            )}
          </p>
        </div>
        <button
          type="button"
          onClick={() => useTools.getState().refresh()}
          disabled={refreshing}
          className="inline-flex items-center gap-1.5 rounded-[0.35rem] px-2 py-1 text-[0.875rem] text-ink-dim transition-colors hover:bg-app-3 hover:text-ink disabled:opacity-60"
        >
          <RefreshCw className={cx("size-4", refreshing && "animate-spin")} aria-hidden />
          {refreshing ? "Checking…" : "Check again"}
        </button>
      </div>

      <NodeNotice />
      {error && (
        <p role="alert" className="rounded-[0.2rem] border border-bad/40 bg-bad/10 px-4 py-3 text-[0.95rem]">
          Could not inspect this computer: {error.message}
        </p>
      )}
      {systemError && (
        <p role="alert" className="rounded-[0.2rem] border border-bad/40 bg-bad/10 px-4 py-3 text-[0.95rem]">
          Could not check Node.js and npm: {systemError}
        </p>
      )}

      <ul aria-label="WireCat tools" className="overflow-hidden rounded-[0.2rem] border border-line-strong bg-app">
        {tools.map((t) => (
          <ToolRow key={t.id} tool={t} />
        ))}
      </ul>

      {latestUnknown && (
        <p className="text-[0.85rem] text-ink-dim">
          Could not ask npm for the latest versions, so updates are not shown.
        </p>
      )}
    </div>
  )
}
