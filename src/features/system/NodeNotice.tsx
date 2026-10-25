import { Download, ExternalLink } from "lucide-react"
import { useEffect, useId, useState } from "react"
import { requirements } from "@/domain/catalog"
import { formatBytes } from "@/domain/format"
import { platform } from "@/platform/bridge"
import type { Readiness } from "@/platform/schemas"
import { Button } from "@/ui/Button"
import { CopyField } from "@/ui/CopyField"
import { Stepper, type StepState } from "@/ui/Stepper"
import { ManagedNode } from "./ManagedNode"
import { type NodeStep, useNode } from "./node-store"
import { useSystem } from "./store"

const STEPS: readonly { id: NodeStep; label: string }[] = [
  { id: "check", label: "Check" },
  { id: "download", label: "Download" },
  { id: "verify", label: "Verify" },
  { id: "unpack", label: "Unpack" },
]

/** Asks for Node.js when the tools cannot be installed, and offers to set it up in the user's own folder. */
export function NodeNotice() {
  const r = useSystem((s) => s.readiness)
  const path = useNode((s) => s.path)
  const managedActive = r?.managed?.active ?? false

  useEffect(() => {
    if (managedActive) useNode.getState().loadPath()
  }, [managedActive])

  if (!r) return null
  if (managedActive) {
    // Once it is on PATH there is nothing left to ask; the readiness strip still opens it.
    if (!path || path.added) return null
    return (
      <section
        aria-label="Node.js for WireCat tools"
        className="rounded-[0.2rem] border border-line-strong bg-app px-5 py-4"
      >
        <p className="font-semibold">WireCat set up Node.js {r.managed?.version} for its tools</p>
        <p className="mt-0.5 max-w-[70ch] text-[0.95rem] text-ink-soft">
          Tools install and run with it here. Add it to PATH so they also work in a terminal.
        </p>
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

  useEffect(() => {
    useNode.getState().loadOffer()
  }, [])

  const admin = r.node.ok
  const title = admin
    ? "npm needs administrator rights to install tools"
    : !r.node.version
      ? "Node.js is needed to install WireCat tools"
      : `Node.js ${r.node.version} is too old for WireCat tools`
  const body = admin
    ? `npm installs into ${r.npmPrefix}, a system folder. WireCat can set up its own Node.js in your user folder instead; your current one stays as it is.`
    : `WireCat Desktop runs without it, but its tools need ${requirements.nodeLabel}. WireCat can set it up in your user folder, without administrator rights.`

  return (
    <section
      aria-label="Node.js for WireCat tools"
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
            Set up Node.js for me
          </Button>
          <Button aria-expanded={manual} aria-controls={manualId} onClick={() => setManual((m) => !m)}>
            I'll install it myself
          </Button>
          <p className="min-w-0 text-[0.875rem] text-ink-soft">
            {offer ? (
              <>
                <span className="selectable font-mono tabular-nums text-ink">Node.js {offer.version}</span>
                {offer.bytes ? <span className="font-mono tabular-nums"> · {formatBytes(offer.bytes)}</span> : null}{" "}
                from nodejs.org, checked against its published checksums.
              </>
            ) : offerError ? (
              "The latest LTS from nodejs.org, checked against its published checksums."
            ) : (
              "Asking nodejs.org for the latest LTS…"
            )}
          </p>
        </div>
      )}

      {manual && !running && (
        <div id={manualId} className="flex flex-col gap-2 border-line border-t pt-4">
          <Manual admin={admin} />
        </div>
      )}
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

  const current = STEPS.findIndex((s) => s.id === step)
  const steps = STEPS.map((s, i) => {
    let state: StepState = "todo"
    if (i < current) state = "done"
    else if (i === current) state = failure ? "failed" : "active"
    return { label: s.label, state }
  })
  const pct = total ? Math.min(100, Math.round((received / total) * 100)) : null

  return (
    <div className="flex flex-col gap-4 rounded-[0.45rem] border border-line bg-app px-5 py-4">
      <Stepper steps={steps} />
      {step === "download" && !failure && (
        <div className="flex items-center gap-4">
          <div
            role="progressbar"
            aria-label="Downloading Node.js"
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
            {formatBytes(received)}
            {total ? ` of ${formatBytes(total)}` : ""}
          </span>
        </div>
      )}
      {running && step !== "download" && (
        <p aria-live="polite" className="text-[0.95rem] text-ink-soft">
          {step === "check" && "Asking nodejs.org for the latest LTS…"}
          {step === "verify" && "Comparing the download with the checksum nodejs.org publishes…"}
          {step === "unpack" && `Unpacking into ${offer?.dir ?? "your user folder"}…`}
        </p>
      )}
      {failure && (
        <div role="alert" className="text-[0.95rem]">
          <p className="font-medium text-bad">{failure.message}</p>
          {failure.hint && <p className="mt-0.5 text-ink-soft">{failure.hint}</p>}
        </div>
      )}
      <div className="flex justify-end gap-2">
        {running ? (
          <Button size="sm" onClick={() => useNode.getState().cancel()}>
            Cancel
          </Button>
        ) : (
          <Button size="sm" onClick={() => useNode.getState().setup()}>
            Try again
          </Button>
        )}
      </div>
    </div>
  )
}

const HOW: Record<typeof platform.os, string> = {
  linux:
    "Use nvm or fnm, or your distribution's NodeSource package; the version in the default repositories is often too old.",
  macos: "Use the macOS installer from nodejs.org, Homebrew (brew install node), or nvm.",
  windows: "Use the Windows installer from nodejs.org, or winget install OpenJS.NodeJS.LTS.",
}

function Manual({ admin }: { admin: boolean }) {
  if (admin) {
    return (
      <>
        <p className="max-w-[70ch] text-[0.95rem] text-ink-soft">
          Point npm at a folder in your home, then add that folder's <span className="font-mono">bin</span> to your PATH
          and check again.
        </p>
        <CopyField value="npm config set prefix ~/.npm-global" label="Copy the command" />
      </>
    )
  }
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
      <p className="min-w-0 flex-1 text-[0.95rem] text-ink-soft">
        Install {requirements.nodeLabel}. {HOW[platform.os]} Then check again.
      </p>
      <Button
        size="sm"
        onClick={() => platform.openUrl(requirements.nodeDownload)}
        icon={<ExternalLink className="size-4" aria-hidden />}
      >
        nodejs.org
      </Button>
    </div>
  )
}
