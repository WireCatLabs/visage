import { Terminal } from "lucide-react"
import { useEffect, useRef } from "react"
import { findTool, signInMethods } from "@/domain/catalog"
import { useMessages } from "@/i18n"
import { platform } from "@/platform/bridge"
import { Button } from "@/ui/Button"
import { Dialog } from "@/ui/Dialog"
import { type SigninMessages, signinMessages } from "./messages"
import { Stage } from "./Stages"
import { NEEDS_UPDATE, type Phase, receivingHistory, running, useSignIn } from "./store"

/**
 * Signs a profile in with the tool's own sign-in, drawn in the window: a QR code, a code for the phone, a page to
 * open, the questions the tool asks, then its progress.
 */
export function SignInDialog() {
  const s = useSignIn()
  const m = useMessages(signinMessages)
  const tool = s.tool ? findTool(s.tool) : undefined
  const name = tool?.name ?? s.tool ?? ""
  const body = useRef<HTMLDivElement>(null)
  const ended = !running(s.phase)

  // The button that had focus goes away when the sign-in ends; its replacement takes focus instead of the page.
  useEffect(() => {
    if (ended) body.current?.closest("dialog")?.querySelector<HTMLElement>("[data-autofocus]")?.focus()
  }, [ended])

  return (
    <Dialog open={s.tool !== null} wide title={m.title(name)} onClose={s.close} actions={<Actions />}>
      <div ref={body} className="flex flex-col gap-3">
        <p>{m.intro(<code className="font-mono text-ink">{s.profile}</code>, name)}</p>
        {s.notes.length > 0 && (
          <p className="selectable rounded-[0.2rem] border border-warn/40 bg-warn/10 px-3 py-2 text-[0.9rem] leading-snug text-ink">
            {s.notes.join(" ")}
          </p>
        )}
        <Stage name={name} />
        <p role="status" className="sr-only">
          {announcement(m.announce, s.phase, s.codes, s.progress?.step === "waiting", s.stopping, s.need?.prompt)}
        </p>
      </div>
    </Dialog>
  )
}

function announcement(
  m: SigninMessages["announce"],
  phase: Phase,
  codes: number,
  slow: boolean,
  stopping: boolean,
  prompt?: string,
) {
  if (stopping) return m.stopping
  if (phase === "scan") return codes === 1 ? m.qrReady : ""
  if (phase === "pair") return m.pairReady
  if (phase === "browser") return m.browser
  if (phase === "answer") return prompt ? m.asks(prompt) : ""
  if (phase === "progress") return slow ? m.slow : m.working
  if (phase === "done") return m.done
  return ""
}

function Actions() {
  const s = useSignIn()
  const m = useMessages(signinMessages)
  const { stop, close, start, tool, profile, onFinish, phase, stopping, method } = s
  const entry = tool ? findTool(tool) : undefined
  const others = entry ? signInMethods(entry).filter((m) => m.id !== method) : []
  if (running(phase)) {
    return (
      <>
        {others.map((method) =>
          tool && profile && phase !== "progress" ? (
            <Button
              key={method.id}
              variant="ghost"
              onClick={() => start(tool, profile, onFinish ?? undefined, method.id)}
            >
              {m.switchTo(method.id, method.label)}
            </Button>
          ) : null,
        )}
        <Button variant="secondary" onClick={stop} disabled={stopping}>
          {stopping ? m.stopping : receivingHistory(s) ? m.stopKeep : m.cancel}
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
          {m.close}
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
            {m.openTerminal}
          </Button>
        )}
        <Button
          variant="secondary"
          onClick={() => tool && profile && start(tool, profile, onFinish ?? undefined, method ?? undefined)}
          data-autofocus
        >
          {m.tryAgain}
        </Button>
      </>
    )
  }
  return (
    <Button variant="primary" onClick={close} data-autofocus>
      {m.done}
    </Button>
  )
}
