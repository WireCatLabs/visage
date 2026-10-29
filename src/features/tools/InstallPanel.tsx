import { AlertTriangle, CheckCircle2, RotateCcw } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import { type CatalogTool, ownerId, samePackage } from "@/domain/catalog"
import { formatBytes } from "@/domain/format"
import { type DataDeletion, type InstallOutcome, type InstallSession, STEPS } from "@/domain/status"
import { formatList, useMessages } from "@/i18n"
import { Button } from "@/ui/Button"
import { Collapse } from "@/ui/Collapse"
import { ErrorNotice } from "@/ui/ErrorNotice"
import { Stepper, type StepState } from "@/ui/Stepper"
import { ReportThis } from "../report/ReportThis"
import { type ToolsText, toolsMessages } from "./messages"
import { useTools } from "./store"

type Words = ToolsText["install"]

/** The tool's package as one name list, in the reader's language: "Memo and Email". */
export const packageNamesOf = (id: string) => formatList(samePackage(id).map((t) => t.name))

function stepStates(session: InstallSession, m: Words): { label: string; state: StepState }[] {
  const labels = m.steps[session.operation]
  const steps = STEPS[session.operation].map((s) => ({ step: s.step, label: labels[s.step] ?? s.label }))
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
  const m = useMessages(toolsMessages).install
  if (!session) return null
  const outcome = session.outcome
  const names = packageNamesOf(tool.id)

  return (
    <div className="border-line border-t bg-app-2/60 px-[1.3rem] pt-[2rem] pb-[1.6rem]">
      <div className="mx-auto max-w-[62rem]">
        <Stepper steps={stepStates(session, m)} />
      </div>

      <div className="mt-[1.45rem] flex flex-wrap items-center gap-x-4 gap-y-3" aria-live="polite">
        {session.step === "queued" && !outcome && <p className="text-[0.95rem] text-ink-soft">{m.waiting}</p>}
        {outcome?.event === "done" && (
          <p className="flex items-center gap-2 text-[0.95rem]">
            <CheckCircle2 className="size-5 text-ok" aria-hidden />
            <span>{m.installed(names, outcome.version, shared)}</span>
          </p>
        )}
        {outcome?.event === "removed" && (
          <p className="flex items-center gap-2 text-[0.95rem]">
            <CheckCircle2 className="size-5 text-ok" aria-hidden />
            <span>
              {m.removed(names, shared)} {session.data ? <DataResult data={session.data} m={m} /> : m.dataKept}
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
            <FailureText outcome={outcome} operation={session.operation} untouched={Boolean(session.data)} m={m} />
          </div>
        )}
        {outcome?.event === "done" && outcome.shadowedBy && (
          <p className="w-full text-[0.9rem] text-warn-ink">
            {m.shadowed(<code className="font-mono">{outcome.shadowedBy}</code>)}
          </p>
        )}

        <button
          type="button"
          onClick={() => setShowLog((v) => !v)}
          aria-expanded={showLog}
          className="text-[1.05rem] font-medium text-brand hover:text-brand-hover"
        >
          {showLog ? m.hideLog : m.showLog}
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
              {m.tryAgain}
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
              {m.addAccount}
            </Button>
          )}
          {outcome && (
            <Button
              size="sm"
              variant={outcome.event === "failed" ? "ghost" : "primary"}
              onClick={() => dismiss(tool.id)}
            >
              {outcome.event === "failed" ? m.close : m.done}
            </Button>
          )}
        </div>
      </div>

      <Collapse open={showLog}>
        <Log lines={session.log} m={m} />
      </Collapse>
    </div>
  )
}

function DataResult({ data, m }: { data: DataDeletion; m: Words }) {
  if (data.state === "deleted") return <>{m.dataDeleted(formatBytes(data.bytes))}</>
  if (data.state === "failed") return <>{m.dataFailed}</>
  return <>{m.dataDeleting}</>
}

type Failed = Extract<InstallOutcome, { event: "failed" }>

/** Rust's reasons with one fixed sentence are told in the reader's language; the rest name the program or path. */
function FailureText(props: { outcome: Failed; operation: InstallSession["operation"]; untouched: boolean; m: Words }) {
  const { outcome, operation, untouched, m } = props
  const [message, hint] =
    outcome.reason === "cancelled"
      ? [m.cancelled[operation], null]
      : outcome.reason === "timeout"
        ? [m.timedOut[operation], m.timedOutHint]
        : outcome.reason === "network"
          ? [m.network, m.networkHint]
          : [outcome.message, outcome.hint]
  return (
    <p>
      <span className="font-medium text-ink">{message}</span>
      {hint && <span className="text-ink-soft"> {hint}</span>}
      {untouched && <span className="text-ink-soft"> {m.dataUntouched}</span>}
    </p>
  )
}

function Log({ lines, m }: { lines: string[]; m: Words }) {
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
      aria-label={m.log}
      className="selectable mt-3 max-h-48 overflow-auto rounded-[0.4rem] border border-line bg-app p-3 font-mono text-[0.85rem] leading-relaxed text-ink-soft"
    >
      {lines.length ? lines.join("\n") : m.waitingOutput}
    </pre>
  )
}
