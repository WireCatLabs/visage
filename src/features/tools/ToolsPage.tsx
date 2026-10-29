import { LoaderCircle, RefreshCw } from "lucide-react"
import { useEffect } from "react"
import { tools } from "@/domain/catalog"
import { useMessages } from "@/i18n"
import { cx } from "@/ui/cx"
import { ErrorNotice } from "@/ui/ErrorNotice"
import { Skeleton, StableText } from "@/ui/Skeleton"
import { ReportThis } from "../report/ReportThis"
import { NodeNotice } from "../system/NodeNotice"
import { useSystem } from "../system/store"
import { useCompat } from "./compat-store"
import { toolsMessages } from "./messages"
import { StorageSummary } from "./StorageFit"
import { useTools } from "./store"
import { ToolRow } from "./ToolRow"
import { ToolsIntro } from "./ToolsIntro"
import { UpgradeWarning } from "./UpgradeWarning"

export function ToolsPage() {
  const m = useMessages(toolsMessages).page
  const refreshing = useTools((s) => s.refreshing)
  const error = useTools((s) => s.error)
  const systemError = useSystem((s) => s.error)
  const latestUnknown = useTools((s) => s.latest !== null && Object.keys(s.latest).length === 0)
  const askingNpm = useTools((s) => s.checkingLatest)
  // The storage line answers only after every tool is found and asked, and grows a button once npm answers; its slot
  // keeps that room throughout, unless nothing is installed or no answer is coming.
  const compat = useCompat((s) => s.compat)
  const mayHaveTools = useTools((s) => !s.checked || Object.values(s.installs).some((copies) => copies.length > 0))
  const storageSlot = mayHaveTools && !error && compat !== null
  const progress = refreshing ? m.looking : askingNpm ? m.askingNpm : null

  useEffect(() => {
    useTools.getState().refresh()
  }, [])

  return (
    <div className="flex flex-col gap-[1.5rem] px-[2.1rem] pt-[1.6rem] pb-[2.2rem]">
      <div className="flex items-end justify-between gap-4">
        <div className="flex min-w-0 items-baseline gap-[1.2rem]">
          <h1 className="font-display text-[2.1rem] font-extrabold leading-none tracking-[-0.035em]">{m.title}</h1>
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
          data-tour="check-again"
          onClick={() => useTools.getState().refresh(true)}
          disabled={refreshing}
          className="inline-flex items-center gap-1.5 rounded-[0.35rem] px-2 py-1 text-[0.875rem] text-ink-dim transition-colors hover:bg-app-3 hover:text-ink disabled:opacity-60"
        >
          <RefreshCw className={cx("size-4", refreshing && "animate-spin")} aria-hidden />
          <StableText value={refreshing ? m.checking : m.checkAgain} variants={[m.checkAgain, m.checking]} />
        </button>
      </div>

      <ToolsIntro />
      <NodeNotice />
      {error && (
        <ErrorNotice action={<ReportThis what="Looking for WireCat tools" error={error.message} />}>
          {m.inspectFailed(error.message)}
        </ErrorNotice>
      )}
      {systemError && (
        <ErrorNotice action={<ReportThis what="Checking Node.js and npm" error={systemError} />}>
          {m.systemFailed(systemError)}
        </ErrorNotice>
      )}

      {storageSlot ? (
        <div className="flex min-h-[3.4rem] flex-col justify-center">
          {compat === undefined ? (
            <Skeleton className="h-[3.4rem] w-full rounded-[0.2rem]" label={m.checkingStorage} />
          ) : (
            <StorageSummary />
          )}
        </div>
      ) : (
        <StorageSummary />
      )}

      <ul aria-label={m.list} className="overflow-hidden rounded-[0.2rem] border border-line-strong bg-app">
        {tools.map((t) => (
          <ToolRow key={t.id} tool={t} />
        ))}
      </ul>

      <UpgradeWarning />

      {latestUnknown && <p className="text-[0.9rem] text-ink-dim">{m.latestUnknown}</p>}
    </div>
  )
}
