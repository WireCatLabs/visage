import { RefreshCw } from "lucide-react"
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

  useEffect(() => {
    useTools.getState().refresh()
  }, [])

  return (
    <div className="flex flex-col gap-[1.5rem] px-[2.1rem] pt-[1.6rem] pb-[2.2rem]">
      <div className="flex items-end justify-between gap-4">
        <h1 className="font-display text-[2.85rem] font-extrabold leading-none tracking-[-0.035em]">Tools</h1>
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
        <p role="alert" className="rounded-[0.45rem] border border-bad/40 bg-bad/10 px-4 py-3 text-[0.95rem]">
          Could not inspect this computer: {error.message}
        </p>
      )}
      {systemError && (
        <p role="alert" className="rounded-[0.45rem] border border-bad/40 bg-bad/10 px-4 py-3 text-[0.95rem]">
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
