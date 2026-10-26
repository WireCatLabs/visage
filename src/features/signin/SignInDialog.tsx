import { CheckCircle2, LoaderCircle } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import { findTool } from "@/domain/catalog"
import { qrModules, qrPath } from "@/domain/qr"
import type { SignInEvent } from "@/platform/signin-schemas"
import { Button } from "@/ui/Button"
import { Dialog } from "@/ui/Dialog"
import { ErrorNotice } from "@/ui/ErrorNotice"
import { Skeleton } from "@/ui/Skeleton"
import { ReportThis } from "../report/ReportThis"
import { type Phase, running, useSignIn } from "./store"

type Qr = Extract<SignInEvent, { event: "qr" }>

const STAGE = "flex min-h-[19rem] flex-col items-center justify-center gap-3 text-center"

/** Signs a profile in with the tool's own sign-in, drawn in the window: the QR code, then the phone's history. */
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
    <Dialog
      open={s.tool !== null}
      wide
      title={`Sign in to ${name}`}
      onClose={s.close}
      actions={<Actions phase={s.phase} stopping={s.stopping} />}
    >
      <div ref={body} className="flex flex-col gap-3">
        <p>
          Links {name} to the profile <code className="font-mono text-ink">{s.profile}</code> as a new device.
        </p>
        {s.notes.length > 0 && (
          <p className="selectable rounded-[0.2rem] border border-warn/40 bg-warn/10 px-3 py-2 text-[0.85rem] leading-snug text-ink">
            {s.notes.join(" ")}
          </p>
        )}
        <Stage name={name} />
        <p role="status" className="sr-only">
          {announcement(s.phase, s.codes, s.slow, s.stopping)}
        </p>
      </div>
    </Dialog>
  )
}

function announcement(phase: Phase, codes: number, slow: boolean, stopping: boolean) {
  if (stopping) return "Stopping the sign-in."
  if (phase === "scan") return codes === 1 ? "The QR code is ready to scan." : ""
  if (phase === "history") return slow ? "Still waiting for the phone's history." : "Linked. Receiving the history."
  if (phase === "done") return "Signed in. Press Done to close."
  return ""
}

function Stage({ name }: { name: string }) {
  const { phase, qr, slow, done, failure, tool, profile } = useSignIn()
  if (phase === "starting") {
    return (
      <div className={STAGE}>
        <Skeleton className="size-[17rem]" label="Starting the sign-in" />
        <p className="text-[0.9rem]">Asking {name} for a code…</p>
      </div>
    )
  }
  if (phase === "scan" && qr) return <ScanStage qr={qr} />
  if (phase === "history") {
    return (
      <div className={STAGE}>
        <LoaderCircle className="size-8 text-brand motion-safe:animate-spin" aria-hidden />
        <p className="font-medium text-ink">
          {slow ? "Still waiting for the phone's history." : "Linked. Receiving your chat history from the phone."}
        </p>
        <p className="max-w-[24rem] text-[0.9rem]">
          Keep {name} open on the phone; it can take a minute. Stopping now keeps what has arrived.
        </p>
      </div>
    )
  }
  if (phase === "done" && done) {
    return (
      <div className={STAGE}>
        <CheckCircle2 className="size-8 text-ok" aria-hidden />
        <p className="font-medium text-ink">
          {done.alreadyLinked ? "This profile was already signed in." : "Signed in."}
        </p>
        {done.received && (
          <p className="text-[0.9rem] tabular-nums">
            Received {count(done.received.chats, "chat")}, {count(done.received.messages, "message")} and{" "}
            {count(done.received.people, "person", "people")} from the phone.
          </p>
        )}
      </div>
    )
  }
  if (phase === "failed" && failure) {
    return (
      <div className="flex min-h-[19rem] flex-col justify-center">
        <ErrorNotice
          action={
            <ReportThis
              what={`Signing in to ${name} as ${profile}`}
              tool={tool}
              error={failure.message}
              onOpen={() => useSignIn.getState().close()}
            />
          }
        >
          {failure.message}
        </ErrorNotice>
      </div>
    )
  }
  return <div className={STAGE} />
}

const count = (n: number, one: string, many = `${one}s`) => `${n.toLocaleString("en")} ${n === 1 ? one : many}`

function ScanStage({ qr }: { qr: Qr }) {
  const scan = qr.scan ? `${qr.scan.charAt(0).toUpperCase()}${qr.scan.slice(1)}.` : null
  return (
    <div className="flex min-h-[19rem] flex-wrap items-center justify-center gap-x-5 gap-y-3">
      <QrImage text={qr.text} />
      <div className="flex min-w-[11rem] flex-1 flex-col gap-2 text-[0.9rem]">
        {scan && <p className="font-medium text-ink">{scan}</p>}
        <p>Point the phone's camera at this code.</p>
        {qr.expiresAt ? (
          <ExpiresIn at={qr.expiresAt} />
        ) : (
          <p className="text-ink-dim">The code changes every few seconds; the new one appears here by itself.</p>
        )}
      </div>
    </div>
  )
}

/**
 * Drawn from the tool's text, never from a link: the tool prints none. Dark on white in both themes, because a phone
 * camera reads an inverted code badly.
 */
function QrImage({ text }: { text: string }) {
  const dark = qrModules(text)
  if (!dark) {
    return (
      <pre
        role="img"
        aria-label="QR code to scan with your phone"
        className="rounded-[0.35rem] bg-black p-2 font-mono text-[0.5rem] leading-none text-white"
      >
        {text}
      </pre>
    )
  }
  const size = dark.length
  return (
    <svg
      role="img"
      aria-label="QR code to scan with your phone"
      viewBox={`0 0 ${size} ${size}`}
      shapeRendering="crispEdges"
      className="size-[17rem] shrink-0 rounded-[0.35rem] border border-line"
    >
      <rect width={size} height={size} fill="#ffffff" />
      <path d={qrPath(dark)} fill="#000000" />
    </svg>
  )
}

function ExpiresIn({ at }: { at: string }) {
  const left = () => Math.max(0, Math.round((Date.parse(at) - Date.now()) / 1000))
  const [seconds, setSeconds] = useState(left)
  // biome-ignore lint/correctness/useExhaustiveDependencies: a new code restarts the count
  useEffect(() => {
    setSeconds(left())
    const timer = setInterval(() => setSeconds(left()), 1000)
    return () => clearInterval(timer)
  }, [at])
  return (
    <p className="text-ink-dim tabular-nums">
      {seconds > 0 ? `This code expires in ${seconds} s.` : "This code has expired; a new one is on its way."}
    </p>
  )
}

function Actions({ phase, stopping }: { phase: Phase; stopping: boolean }) {
  const { stop, close, start, tool, profile, onFinish } = useSignIn()
  if (running(phase)) {
    return (
      <Button variant="secondary" onClick={stop} disabled={stopping}>
        {stopping ? "Stopping…" : phase === "history" ? "Stop and keep what came" : "Cancel"}
      </Button>
    )
  }
  if (phase === "failed") {
    return (
      <>
        <Button variant="ghost" onClick={close}>
          Close
        </Button>
        <Button
          variant="secondary"
          onClick={() => tool && profile && start(tool, profile, onFinish ?? undefined)}
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
