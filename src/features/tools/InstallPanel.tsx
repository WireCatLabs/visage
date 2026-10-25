import { AlertTriangle, CheckCircle2, RotateCcw } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import type { CatalogTool } from "@/domain/catalog"
import { INSTALL_STEPS, type InstallSession } from "@/domain/status"
import { Button } from "@/ui/Button"
import { Stepper, type StepState } from "@/ui/Stepper"
import { useTools } from "./store"

const order = ["check", "install", "verify", "done"] as const

function stepStates(session: InstallSession): { label: string; state: StepState }[] {
  const failed = session.outcome?.event === "failed"
  if (session.step === "queued" && !session.outcome)
    return INSTALL_STEPS.map((s) => ({ label: s.label, state: "todo" }))
  const current =
    session.outcome?.event === "done" ? order.length : order.indexOf(session.step as (typeof order)[number])
  return INSTALL_STEPS.map((s, i) => ({
    label: s.label,
    state: i < current ? "done" : i === current ? (failed ? "failed" : session.outcome ? "done" : "active") : "todo",
  }))
}

export function InstallPanel({ tool }: { tool: CatalogTool }) {
  const session = useTools((s) => s.sessions[tool.id])
  const { install, dismiss } = useTools.getState()
  const [showLog, setShowLog] = useState(false)
  if (!session) return null
  const outcome = session.outcome

  return (
    <div className="border-line border-t bg-app-2/60 px-[1.3rem] pt-[2rem] pb-[1.6rem]">
      <div className="mx-auto max-w-[62rem]">
        <Stepper steps={stepStates(session)} />
      </div>

      <div className="mt-[1.4rem] flex flex-wrap items-center gap-x-4 gap-y-3" aria-live="polite">
        {session.step === "queued" && !outcome && (
          <p className="text-[0.95rem] text-ink-soft">Waiting for the installation in progress to finish.</p>
        )}
        {outcome?.event === "done" && (
          <p className="flex items-center gap-2 text-[0.95rem]">
            <CheckCircle2 className="size-5 text-ok" aria-hidden />
            <span>
              {tool.name} {outcome.version} is installed and runs.
            </span>
          </p>
        )}
        {outcome?.event === "failed" && (
          <div className="flex min-w-0 items-start gap-2 text-[0.95rem]">
            <AlertTriangle className="mt-0.5 size-5 shrink-0 text-bad" aria-hidden />
            <p>
              <span className="font-medium text-ink">{outcome.message}</span>
              {outcome.hint && <span className="text-ink-soft"> {outcome.hint}</span>}
            </p>
          </div>
        )}
        {outcome?.event === "done" && outcome.shadowedBy && (
          <p className="w-full text-[0.9rem] text-warn">
            Another copy at <code className="font-mono">{outcome.shadowedBy}</code> runs first in a terminal.
          </p>
        )}

        <button
          type="button"
          onClick={() => setShowLog((v) => !v)}
          aria-expanded={showLog}
          className="text-[0.95rem] font-medium text-brand hover:text-brand-hover"
        >
          {showLog ? "Hide log" : "Show log"}
        </button>

        <div className="ml-auto flex gap-2">
          {outcome?.event === "failed" && outcome.reason !== "cancelled" && (
            <Button
              size="sm"
              variant="secondary"
              icon={<RotateCcw className="size-4" aria-hidden />}
              onClick={() => install(tool.id)}
            >
              Try again
            </Button>
          )}
          {outcome && (
            <Button size="sm" variant={outcome.event === "done" ? "primary" : "ghost"} onClick={() => dismiss(tool.id)}>
              {outcome.event === "done" ? "Done" : "Close"}
            </Button>
          )}
        </div>
      </div>

      {showLog && <Log lines={session.log} />}
    </div>
  )
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
      aria-label="Installation log"
      className="selectable mt-3 max-h-48 overflow-auto rounded-[0.4rem] border border-line bg-app p-3 font-mono text-[0.8rem] leading-relaxed text-ink-soft"
    >
      {lines.length ? lines.join("\n") : "Waiting for output…"}
    </pre>
  )
}
