import { CheckCircle2, ExternalLink, LoaderCircle } from "lucide-react"
import { type FormEvent, useEffect, useId, useState } from "react"
import { findTool } from "@/domain/catalog"
import { qrModules, qrPath } from "@/domain/qr"
import { useMessages } from "@/i18n"
import { platform } from "@/platform/bridge"
import { Button } from "@/ui/Button"
import { ErrorNotice } from "@/ui/ErrorNotice"
import { Skeleton } from "@/ui/Skeleton"
import { useOnboarding } from "../onboarding/store"
import { ReportThis } from "../report/ReportThis"
import { openConnect, openTool } from "../tools/go"
import { AnswerForm } from "./AnswerForm"
import { signinMessages } from "./messages"
import { ENDED, NEEDS_UPDATE, type OpenUrl, type Pairing, type Qr, receivingHistory, useSignIn } from "./store"

const STAGE = "flex min-h-[19rem] flex-col items-center justify-center gap-3 text-center"

const sentence = (s: string) => `${s.charAt(0).toUpperCase()}${s.slice(1)}${/[.!?…]$/.test(s) ? "" : "."}`

export function Stage({ name }: { name: string }) {
  const s = useSignIn()
  const m = useMessages(signinMessages)
  if (s.phase === "starting") {
    return (
      <div className={STAGE}>
        <Skeleton className="size-[17rem]" label={m.starting} />
        <p className="text-[0.9rem]">{m.asking(name)}</p>
      </div>
    )
  }
  if (s.phase === "scan" && s.qr) return <ScanStage qr={s.qr} />
  if (s.phase === "pair" && s.pairing) return <PairStage pairing={s.pairing} />
  if (s.phase === "answer" && s.need) {
    return (
      <div className="flex min-h-[19rem] flex-col items-center justify-center gap-4">
        {s.url && <BrowserLink url={s.url} compact />}
        <AnswerForm need={s.need} sent={s.sent} onAnswer={s.answer} />
      </div>
    )
  }
  if (s.phase === "browser" && s.url) {
    return (
      <div className={STAGE}>
        <BrowserLink url={s.url} />
        <p className="flex items-center gap-2 text-[0.9rem] text-ink-soft">
          <LoaderCircle className="size-4 motion-safe:animate-spin" aria-hidden />
          {m.waitingBrowser}
        </p>
      </div>
    )
  }
  if (s.phase === "progress") {
    const history = receivingHistory(s)
    const slow = s.progress?.step === "waiting"
    return (
      <div className={STAGE}>
        <LoaderCircle className="size-8 text-brand motion-safe:animate-spin" aria-hidden />
        <p className="font-medium text-ink">
          {history
            ? slow
              ? m.historySlow
              : m.historyLinked
            : s.progress?.message
              ? sentence(s.progress.message)
              : m.working}
        </p>
        {history && <p className="max-w-[24rem] text-[0.9rem]">{m.keepOpen(name)}</p>}
      </div>
    )
  }
  if (s.phase === "done" && s.done) {
    const { received, alreadyLinked } = s.done
    return (
      <div className={STAGE}>
        <CheckCircle2 className="size-8 text-ok" aria-hidden />
        <p className="font-medium text-ink">
          {alreadyLinked ? m.alreadySignedIn(name, s.profile ?? "") : m.signedIn(name, s.profile ?? "")}
        </p>
        {received && <p className="text-[0.9rem] tabular-nums">{m.received(received)}</p>}
        <NextAfterSignIn />
      </div>
    )
  }
  if (s.phase === "failed" && s.failure) {
    const needsClientId = s.tool === "zm" && s.failure.message.includes("zoom.client_id")
    return (
      <div className="flex min-h-[19rem] flex-col justify-center gap-4">
        {needsClientId ? (
          <ClientIdForm />
        ) : (
          <ErrorNotice
            action={
              <ReportThis
                what={`Signing in to ${name} as ${s.profile}`}
                tool={s.tool}
                error={s.failure.message}
                onOpen={() => useSignIn.getState().close()}
              />
            }
          >
            {s.failure.code === NEEDS_UPDATE ? m.needsUpdate : s.failure.code === ENDED ? m.ended : s.failure.message}
          </ErrorNotice>
        )}
      </div>
    )
  }
  return <div className={STAGE} />
}

/** The tool has usually opened the page itself; the button opens it again. */
function BrowserLink({ url, compact = false }: { url: OpenUrl; compact?: boolean }) {
  const m = useMessages(signinMessages)
  const host = new URL(url.url).host
  return (
    <div
      className={
        compact ? "flex w-full max-w-[24rem] flex-col gap-2" : "flex max-w-[26rem] flex-col items-center gap-3"
      }
    >
      <p className={compact ? "text-[0.9rem] text-ink-soft" : "text-[0.95rem] text-ink"}>
        {url.purpose ? sentence(url.purpose) : m.continueOn(host)}
      </p>
      <Button
        variant={compact ? "secondary" : "primary"}
        size={compact ? "sm" : "md"}
        className={compact ? "self-start" : undefined}
        icon={<ExternalLink className="size-4" aria-hidden />}
        onClick={() => platform.openUrl(url.url)}
      >
        {m.openHost(host)}
      </Button>
    </div>
  )
}

function PairStage({ pairing }: { pairing: Pairing }) {
  const m = useMessages(signinMessages)
  return (
    <div className={STAGE}>
      <p className="text-[0.9rem]">{pairing.place ? m.typeCodeAt(pairing.place) : m.typeCode}</p>
      <p className="selectable font-mono text-[2.2rem] font-semibold tracking-[0.18em] text-ink tabular-nums">
        {pairing.code}
      </p>
      {pairing.expiresAt && <ExpiresIn at={pairing.expiresAt} />}
    </div>
  )
}

function ScanStage({ qr }: { qr: Qr }) {
  const m = useMessages(signinMessages)
  const scan = qr.scan ? `${qr.scan.charAt(0).toUpperCase()}${qr.scan.slice(1)}.` : null
  return (
    <div className="flex min-h-[19rem] flex-wrap items-center justify-center gap-x-5 gap-y-3">
      <QrImage text={qr.text} />
      <div className="flex min-w-[11rem] flex-1 flex-col gap-2 text-[0.9rem]">
        {scan && <p className="font-medium text-ink">{scan}</p>}
        <p>{m.pointCamera}</p>
        {qr.expiresAt ? <ExpiresIn at={qr.expiresAt} /> : <p className="text-ink-dim">{m.codeChanges}</p>}
      </div>
    </div>
  )
}

/**
 * Drawn from the tool's text, never from a link: the tool prints none. Dark on white in both themes, because a phone
 * camera reads an inverted code badly.
 */
function QrImage({ text }: { text: string }) {
  const m = useMessages(signinMessages)
  const dark = qrModules(text)
  if (!dark) {
    return (
      <pre
        role="img"
        aria-label={m.qrLabel}
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
      aria-label={m.qrLabel}
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
  const m = useMessages(signinMessages)
  const left = () => Math.max(0, Math.round((Date.parse(at) - Date.now()) / 1000))
  const [seconds, setSeconds] = useState(left)
  // biome-ignore lint/correctness/useExhaustiveDependencies: a new code restarts the count
  useEffect(() => {
    setSeconds(left())
    const timer = setInterval(() => setSeconds(left()), 1000)
    return () => clearInterval(timer)
  }, [at])
  return <p className="text-ink-dim tabular-nums">{seconds > 0 ? m.expiresIn(seconds) : m.expired}</p>
}

/** Zoom signs in with an app of the owner's own; its Public Client ID is saved with zm's own `config set`. */
function ClientIdForm() {
  const id = useId()
  const m = useMessages(signinMessages)
  const { tool, profile, start, onFinish } = useSignIn()
  const guide = tool ? findTool(tool)?.signIn?.guide : undefined
  const [value, setValue] = useState("")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!tool || !profile || !value.trim()) return
    setSaving(true)
    setError(null)
    try {
      await platform.settingsSet(tool, null, false, "zoom.client_id", value.trim())
      start(tool, profile, onFinish ?? undefined)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
      setSaving(false)
    }
  }

  return (
    <form onSubmit={submit} className="mx-auto flex w-full max-w-[26rem] flex-col gap-2">
      <p className="text-[0.95rem] text-ink">{m.clientIdIntro}</p>
      {guide && (
        <Button
          variant="ghost"
          size="sm"
          className="self-start"
          icon={<ExternalLink className="size-4" aria-hidden />}
          onClick={() => platform.openUrl(guide)}
        >
          {m.howToMakeApp}
        </Button>
      )}
      <label htmlFor={id} className="mt-1 text-[0.9rem] font-medium text-ink">
        {m.clientId}
      </label>
      <input
        id={id}
        spellCheck={false}
        autoComplete="off"
        value={value}
        disabled={saving}
        onChange={(e) => setValue(e.target.value)}
        className="selectable h-10 w-full rounded-[0.35rem] border border-line-strong bg-app px-3 font-mono text-[1rem] text-ink"
      />
      <p className="min-h-[1.3rem] text-[0.9rem] text-bad">{error}</p>
      <Button type="submit" variant="primary" disabled={saving || !value.trim()} className="self-start">
        {saving ? m.saving : m.saveAndSignIn}
      </Button>
    </form>
  )
}

/** Rule 9: after the goal, what is worth doing next. Not in the first-run setup, which has its own next step. */
function NextAfterSignIn() {
  const tool = useSignIn((s) => (s.tool ? findTool(s.tool) : undefined))
  const close = useSignIn((s) => s.close)
  const onboarding = useOnboarding((s) => s.open)
  const m = useMessages(signinMessages)
  if (!tool || onboarding) return null
  return (
    <div className="mt-2 flex flex-col items-center gap-2">
      {tool.mcpServer && <p className="text-[0.9rem]">{m.nextConnect}</p>}
      <div className="flex flex-wrap justify-center gap-2">
        {tool.mcpServer && (
          <Button
            size="sm"
            onClick={() => {
              close()
              openConnect(tool.id)
            }}
          >
            {m.connectApp}
          </Button>
        )}
        <Button
          size="sm"
          variant="ghost"
          onClick={() => {
            close()
            openTool(tool.id)
          }}
        >
          {m.openTool(tool.name)}
        </Button>
      </div>
    </div>
  )
}
