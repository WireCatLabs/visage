import { AlertTriangle, CheckCircle2, RotateCcw } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import { type CatalogTool, ownerId, packageNames, samePackage } from "@/domain/catalog"
import { formatBytes } from "@/domain/format"
import { type DataDeletion, type InstallSession, STEPS } from "@/domain/status"
import { Button } from "@/ui/Button"
import { ErrorNotice } from "@/ui/ErrorNotice"
import { Stepper, type StepState } from "@/ui/Stepper"
import { ReportThis } from "../report/ReportThis"
import { useTools } from "./store"

function stepStates(session: InstallSession): { label: string; state: StepState }[] {
  const steps = STEPS[session.operation]
  const failed = session.outcome?.event === "failed"
  if (session.step === "queued" && !session.outcome) return steps.map((s) => ({ label: s.label, state: "todo" }))
  const finished = session.outcome?.event === "done" || session.outcome?.event === "removed"
  const current = finished ? steps.length : steps.findIndex((s) => s.step === session.step)
  return steps.map((s, i) => ({
    label: s.label,
    state: i < current ? "done" : i === current ? (failed ? "failed" : session.outcome ? "done" : "active") : "todo",
  }))
}

export function InstallPanel({ tool }: { tool: CatalogTool }) {
  const session = useTools((s) => s.sessions[ownerId(tool.id)])
  const shared = samePackage(tool.id).length > 1
  const { install, uninstall, dismiss } = useTools.getState()
  const [showLog, setShowLog] = useState(false)
  if (!session) return null
  const outcome = session.outcome

  return (
    <div className="border-line border-t bg-app-2/60 px-[1.3rem] pt-[2rem] pb-[1.6rem]">
      <div className="mx-auto max-w-[62rem]">
        <Stepper steps={stepStates(session)} />
      </div>

      <div className="mt-[1.45rem] flex flex-wrap items-center gap-x-4 gap-y-3" aria-live="polite">
        {session.step === "queued" && !outcome && (
          <p className="text-[0.95rem] text-ink-soft">Waiting for the operation in progress to finish.</p>
        )}
        {outcome?.event === "done" && (
          <p className="flex items-center gap-2 text-[0.95rem]">
            <CheckCircle2 className="size-5 text-ok" aria-hidden />
            <span>
              {packageNames(tool.id)} {outcome.version} {shared ? "are installed and run" : "is installed and runs"}.
            </span>
          </p>
        )}
        {outcome?.event === "removed" && (
          <p className="flex items-center gap-2 text-[0.95rem]">
            <CheckCircle2 className="size-5 text-ok" aria-hidden />
            <span>
              {packageNames(tool.id)} {shared ? "are" : "is"} uninstalled.{" "}
              {session.data ? (
                <DataResult data={session.data} />
              ) : (
                "The data stays on this computer until you delete it in Storage."
              )}
            </span>
          </p>
        )}
        {outcome?.event === "removed" && session.data?.state === "failed" && (
          <ErrorNotice
            inline
            className="w-full"
            action={<ReportThis what={`Deleting ${tool.name}'s data`} tool={tool.id} error={session.data.message} />}
          >
            {session.data.message}
          </ErrorNotice>
        )}
        {outcome?.event === "failed" && (
          <div className="flex min-w-0 items-start gap-2 text-[0.95rem]">
            <AlertTriangle className="mt-0.5 size-5 shrink-0 text-bad" aria-hidden />
            <p>
              <span className="font-medium text-ink">{outcome.message}</span>
              {outcome.hint && <span className="text-ink-soft"> {outcome.hint}</span>}
              {session.data && <span className="text-ink-soft"> Its data was not touched.</span>}
            </p>
          </div>
        )}
        {outcome?.event === "done" && outcome.shadowedBy && (
          <p className="w-full text-[0.9rem] text-warn-ink">
            Another copy at <code className="font-mono">{outcome.shadowedBy}</code> runs first in a terminal.
          </p>
        )}

        <button
          type="button"
          onClick={() => setShowLog((v) => !v)}
          aria-expanded={showLog}
          className="text-[1.05rem] font-medium text-brand hover:text-brand-hover"
        >
          {showLog ? "Hide log" : "Show log"}
        </button>

        <div className="ml-auto flex gap-2">
          {outcome?.event === "failed" && outcome.reason !== "cancelled" && (
            <ReportThis
              what={`${session.operation === "install" ? "Installing" : "Uninstalling"} ${tool.name}`}
              tool={tool.id}
              error={[outcome.message, outcome.hint].filter(Boolean).join(" ")}
              log={session.log.slice(-200)}
            />
          )}
          {outcome?.event === "failed" && outcome.reason !== "cancelled" && (
            <Button
              size="sm"
              variant="secondary"
              icon={<RotateCcw className="size-4" aria-hidden />}
              onClick={() =>
                session.operation === "install" ? install(tool.id) : uninstall(tool.id, session.data?.bytes)
              }
            >
              Try again
            </Button>
          )}
          {outcome?.event === "done" && session.operation === "install" && tool.profiles && (
            <Button
              size="sm"
              variant="secondary"
              onClick={() => {
                dismiss(tool.id)
                useTools.setState({ expanded: tool.id })
              }}
            >
              Add an account
            </Button>
          )}
          {outcome && (
            <Button
              size="sm"
              variant={outcome.event === "failed" ? "ghost" : "primary"}
              onClick={() => dismiss(tool.id)}
            >
              {outcome.event === "failed" ? "Close" : "Done"}
            </Button>
          )}
        </div>
      </div>

      {showLog && <Log lines={session.log} />}
    </div>
  )
}

function DataResult({ data }: { data: DataDeletion }) {
  if (data.state === "deleted") return <>Its data ({formatBytes(data.bytes)}) is deleted.</>
  if (data.state === "failed") return <>Its data could not be deleted:</>
  return <>Deleting its data…</>
}

function Log({ lines }: { lines: string[] }) {
  const ref = useRef<HTMLPreElement>(null)
  // biome-ignore lint/correctness/useExhaustiveDependencies: scroll to the bottom whenever a line arrives
  useEffect(() => {
    ref.current?.scrollTo({ top: ref.current.scrollHeight })
  }, [lines.length])
  return (
    <pre
      ref={ref}
      role="log"
      // biome-ignore lint/a11y/noNoninteractiveTabindex: a scrollable region must be reachable by keyboard (WCAG 2.1.1)
      tabIndex={0}
      aria-label="Output log"
      className="selectable mt-3 max-h-48 overflow-auto rounded-[0.4rem] border border-line bg-app p-3 font-mono text-[0.8rem] leading-relaxed text-ink-soft"
    >
      {lines.length ? lines.join("\n") : "Waiting for output…"}
    </pre>
  )
}
