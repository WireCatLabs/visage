import { Terminal } from "lucide-react"
import { useEffect, useRef } from "react"
import { findTool, signInMethods } from "@/domain/catalog"
import { platform } from "@/platform/bridge"
import { Button } from "@/ui/Button"
import { Dialog } from "@/ui/Dialog"
import { Stage } from "./Stages"
import { NEEDS_UPDATE, type Phase, receivingHistory, running, useSignIn } from "./store"

/**
 * Signs a profile in with the tool's own sign-in, drawn in the window: a QR code, a code for the phone, a page to
 * open, the questions the tool asks, then its progress.
 */
export function SignInDialog() {
  const s = useSignIn()
  const tool = s.tool ? findTool(s.tool) : undefined
  const name = tool?.name ?? s.tool ?? ""
  const body = useRef<HTMLDivElement>(null)
  const ended = !running(s.phase)

  // The button that had focus goes away when the sign-in ends; its replacement takes focus instead of the page.
  useEffect(() => {
    if (ended) body.current?.closest("dialog")?.querySelector<HTMLElement>("[data-autofocus]")?.focus()
  }, [ended])

  return (
    <Dialog open={s.tool !== null} wide title={`Sign in to ${name}`} onClose={s.close} actions={<Actions />}>
      <div ref={body} className="flex flex-col gap-3">
        <p>
          Signs <code className="font-mono text-ink">{s.profile}</code> in to {name} on this computer.
        </p>
        {s.notes.length > 0 && (
          <p className="selectable rounded-[0.2rem] border border-warn/40 bg-warn/10 px-3 py-2 text-[0.9rem] leading-snug text-ink">
            {s.notes.join(" ")}
          </p>
        )}
        <Stage name={name} />
        <p role="status" className="sr-only">
          {announcement(s.phase, s.codes, s.progress?.step === "waiting", s.stopping, s.need?.prompt)}
        </p>
      </div>
    </Dialog>
  )
}

function announcement(phase: Phase, codes: number, slow: boolean, stopping: boolean, prompt?: string) {
  if (stopping) return "Stopping the sign-in."
  if (phase === "scan") return codes === 1 ? "The QR code is ready to scan." : ""
  if (phase === "pair") return "A code to type on the phone is ready."
  if (phase === "browser") return "Continue in the browser."
  if (phase === "answer") return prompt ? `The sign-in asks for the ${prompt}.` : ""
  if (phase === "progress") return slow ? "Still waiting." : "Working."
  if (phase === "done") return "Signed in. Press Done to close."
  return ""
}

function Actions() {
  const s = useSignIn()
  const { stop, close, start, tool, profile, onFinish, phase, stopping, method } = s
  const entry = tool ? findTool(tool) : undefined
  const others = entry ? signInMethods(entry).filter((m) => m.id !== method) : []
  if (running(phase)) {
    return (
      <>
        {others.map((m) =>
          tool && profile && phase !== "progress" ? (
            <Button key={m.id} variant="ghost" onClick={() => start(tool, profile, onFinish ?? undefined, m.id)}>
              Use {m.label.toLowerCase()} instead
            </Button>
          ) : null,
        )}
        <Button variant="secondary" onClick={stop} disabled={stopping}>
          {stopping ? "Stopping…" : receivingHistory(s) ? "Stop and keep what came" : "Cancel"}
        </Button>
      </>
    )
  }
  if (phase === "failed") {
    // A tool too old to sign in here still signs in at a terminal.
    const terminal = s.failure?.code === NEEDS_UPDATE && tool && profile && entry?.setup
    return (
      <>
        <Button variant="ghost" onClick={close}>
          Close
        </Button>
        {terminal && (
          <Button
            variant="secondary"
            icon={<Terminal className="size-4" aria-hidden />}
            onClick={() => {
              platform.openSetup(tool, profile).catch(() => {})
              close()
            }}
          >
            Open terminal
          </Button>
        )}
        <Button
          variant="secondary"
          onClick={() => tool && profile && start(tool, profile, onFinish ?? undefined, method ?? undefined)}
          data-autofocus
        >
          Try again
        </Button>
      </>
    )
  }
  return (
    <Button variant="primary" onClick={close} data-autofocus>
      Done
    </Button>
  )
}
