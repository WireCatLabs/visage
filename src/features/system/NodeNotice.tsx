import { Download, ExternalLink } from "lucide-react"
import { useEffect, useId, useState } from "react"
import { requirements } from "@/domain/catalog"
import { formatBytes } from "@/domain/format"
import { useMessages } from "@/i18n"
import { platform } from "@/platform/bridge"
import type { Readiness } from "@/platform/schemas"
import { Button } from "@/ui/Button"
import { Collapse } from "@/ui/Collapse"
import { CopyField } from "@/ui/CopyField"
import { ErrorNotice } from "@/ui/ErrorNotice"
import { Stepper, type StepState } from "@/ui/Stepper"
import { ReportThis } from "../report/ReportThis"
import { ManagedNode } from "./ManagedNode"
import { systemMessages } from "./messages"
import { type NodeStep, useNode } from "./node-store"
import { useSystem } from "./store"

const STEPS: readonly NodeStep[] = ["check", "download", "verify", "unpack"]

const NODEJS_ORG = "nodejs.org"

/** Asks for Node.js when the tools cannot be installed, and offers to set it up in the user's own folder. */
export function NodeNotice() {
  const r = useSystem((s) => s.readiness)
  const path = useNode((s) => s.path)
  const m = useMessages(systemMessages)
  const managedActive = r?.managed?.active ?? false

  useEffect(() => {
    if (managedActive) useNode.getState().loadPath()
  }, [managedActive])

  if (!r) return null
  if (managedActive) {
    // Once it is on PATH there is nothing left to ask; the readiness strip still opens it.
    if (!path || path.added) return null
    return (
      <section aria-label={m.nodeForTools} className="rounded-[0.2rem] border border-line-strong bg-app px-5 py-4">
        <p className="font-semibold">{m.managedTitle(r.managed?.version ?? "")}</p>
        <p className="mt-0.5 max-w-[70ch] text-[0.95rem] text-ink-soft">{m.managedBody}</p>
        <div className="mt-4">
          <ManagedNode compact />
        </div>
      </section>
    )
  }
  if (r.node.ok && r.npmPrefixWritable !== false) return null
  return <NeedsNode r={r} />
}

function NeedsNode({ r }: { r: Readiness }) {
  const offer = useNode((s) => s.offer)
  const offerError = useNode((s) => s.offerError)
  const running = useNode((s) => s.running)
  const failure = useNode((s) => s.failure)
  const [manual, setManual] = useState(false)
  const manualId = useId()
  const m = useMessages(systemMessages)

  useEffect(() => {
    useNode.getState().loadOffer()
  }, [])

  const admin = r.node.ok
  const title = admin ? m.adminTitle : !r.node.version ? m.missingTitle : m.oldTitle(r.node.version)
  const body = admin ? m.adminBody(r.npmPrefix ?? "") : m.needBody(requirements.nodeLabel)

  return (
    <section
      aria-label={m.nodeForTools}
      className="flex flex-col gap-4 rounded-[0.2rem] border border-warn/40 bg-warn/10 px-5 py-4"
    >
      <div>
        <p className="font-semibold">{title}</p>
        <p className="mt-0.5 max-w-[70ch] text-[0.95rem] text-ink-soft">{body}</p>
      </div>

      {running || (failure && failure.reason !== "cancelled") ? (
        <Progress />
      ) : (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <Button
            variant="primary"
            onClick={() => useNode.getState().setup()}
            icon={<Download className="size-4" aria-hidden />}
          >
            {m.setUp}
          </Button>
          <Button aria-expanded={manual} aria-controls={manualId} onClick={() => setManual((m) => !m)}>
            {m.installMyself}
          </Button>
          <p className="min-w-0 text-[0.875rem] text-ink-soft">
            {offer
              ? m.offer(
                  <>
                    <span className="selectable font-mono tabular-nums text-ink">{`Node.js ${offer.version}`}</span>
                    {offer.bytes ? <span className="font-mono tabular-nums"> · {formatBytes(offer.bytes)}</span> : null}
                  </>,
                  NODEJS_ORG,
                )
              : offerError
                ? m.offerUnknown(NODEJS_ORG)
                : m.asking(NODEJS_ORG)}
          </p>
        </div>
      )}

      <Collapse open={manual && !running} id={manualId} className="flex flex-col gap-2 border-line border-t pt-4">
        <Manual admin={admin} />
      </Collapse>
    </section>
  )
}

function Progress() {
  const step = useNode((s) => s.step)
  const running = useNode((s) => s.running)
  const failure = useNode((s) => s.failure)
  const received = useNode((s) => s.received)
  const total = useNode((s) => s.total)
  const offer = useNode((s) => s.offer)
  const m = useMessages(systemMessages)

  const current = step ? STEPS.indexOf(step) : -1
  const steps = STEPS.map((id, i) => {
    let state: StepState = "todo"
    if (i < current) state = "done"
    else if (i === current) state = failure ? "failed" : "active"
    return { label: m.steps[id], state }
  })
  const pct = total ? Math.min(100, Math.round((received / total) * 100)) : null

  return (
    <div className="flex flex-col gap-4 rounded-[0.45rem] border border-line bg-app px-5 py-4">
      <Stepper steps={steps} />
      {step === "download" && !failure && (
        <div className="flex items-center gap-4">
          <div
            role="progressbar"
            aria-label={m.downloading}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={pct ?? undefined}
            className="h-1.5 flex-1 overflow-hidden rounded-full bg-app-3"
          >
            <div
              className="h-full rounded-full bg-brand transition-[width] duration-150 ease-out-quart"
              style={{ width: `${pct ?? 0}%` }}
            />
          </div>
          <span className="shrink-0 font-mono text-[0.875rem] tabular-nums text-ink-soft">
            {total ? m.ofTotal(formatBytes(received), formatBytes(total)) : formatBytes(received)}
          </span>
        </div>
      )}
      {running && step !== "download" && (
        <p aria-live="polite" className="text-[0.95rem] text-ink-soft">
          {step === "check" && m.asking(NODEJS_ORG)}
          {step === "verify" && m.verifying(NODEJS_ORG)}
          {step === "unpack" && (offer?.dir ? m.unpackInto(offer.dir) : m.unpackHome)}
        </p>
      )}
      {failure && (
        <ErrorNotice
          inline
          className="text-[0.95rem]"
          detail={failure.hint}
          action={
            <ReportThis what="Setting up Node.js" error={[failure.message, failure.hint].filter(Boolean).join(" ")} />
          }
        >
          <span className="font-medium">{failure.message}</span>
        </ErrorNotice>
      )}
      <div className="flex justify-end gap-2">
        {running ? (
          <Button size="sm" onClick={() => useNode.getState().cancel()}>
            {m.cancel}
          </Button>
        ) : (
          <Button size="sm" onClick={() => useNode.getState().setup()}>
            {m.tryAgain}
          </Button>
        )}
      </div>
    </div>
  )
}

function Manual({ admin }: { admin: boolean }) {
  const m = useMessages(systemMessages)
  if (admin) {
    return (
      <>
        <p className="max-w-[70ch] text-[0.95rem] text-ink-soft">
          {m.adminManual(<code className="font-mono">bin</code>)}
        </p>
        <CopyField value="npm config set prefix ~/.npm-global" label={m.copyCommand} />
      </>
    )
  }
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
      <p className="min-w-0 flex-1 text-[0.95rem] text-ink-soft">{m.install[platform.os](requirements.nodeLabel)}</p>
      <Button
        size="sm"
        onClick={() => platform.openUrl(requirements.nodeDownload)}
        icon={<ExternalLink className="size-4" aria-hidden />}
      >
        {NODEJS_ORG}
      </Button>
    </div>
  )
}
