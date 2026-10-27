import { Check } from "lucide-react"
import { type ReactNode, useCallback, useEffect, useId, useRef, useState } from "react"
import type { CatalogTool } from "@/domain/catalog"
import { platform } from "@/platform/bridge"
import type { TunnelRoute } from "@/platform/cloudflare-schemas"
import type { McpServerStatus, OAuthSettings } from "@/platform/mcp-server-schemas"
import type { FunnelState } from "@/platform/tailscale-schemas"
import { Button } from "@/ui/Button"
import { CopyField } from "@/ui/CopyField"
import { cx } from "@/ui/cx"
import { Disclosure } from "@/ui/Disclosure"
import { ErrorNotice } from "@/ui/ErrorNotice"
import { Lamp } from "@/ui/Lamp"
import { CloudflareGuide, PRIVACY, useCloudflare } from "./CloudflareGuide"
import { cloudflareSteps } from "./cloudflare-steps"
import { APPS, type AppId, type AppStep, connectorName, testPrompt } from "./connect-apps"
import { scenarioOf } from "./connect-scenario"
import {
  appLabel,
  type ConnectStepId,
  currentStep,
  type ReachState,
  reachOf,
  STEP_TITLES,
  serving,
  stepStates,
  type TestState,
  testState,
} from "./connect-steps"
import { LoginCode } from "./LoginCode"
import { formProblem } from "./McpServerDialogs"
import { TailscaleGuide, useTailscale } from "./TailscaleGuide"
import { addressOf, stepsOf } from "./tailscale-steps"

const message = (e: unknown) => (e instanceof Error ? e.message : String(e))
const DEFAULT_PORT = 8765
const POLL_MS = 4000
const STEP_COUNT = 6
/** Tailscale's own figure for a new Funnel name to appear in public DNS. */
const PUBLISH_MS = 10 * 60_000
const RECHECK_MS = 15_000
/** How long the test waits before it suggests what may be wrong. */
const QUIET_MS = 60_000

type Tunnel = "tailscale" | "cloudflare" | "own"
type Phase = "idle" | "tunnel" | "server" | "failed"
type Failure = { at: "tunnel" | "server"; message: string }

const clock = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })

/**
 * From "I want ChatGPT to use my Telegram" to the first call arriving, on one surface that stays until the owner
 * closes it. Each step says what happens before anything runs; a step already done is a tick in the rail.
 */
export function ConnectGuide(props: {
  tool: CatalogTool
  server: McpServerStatus | null
  funnel: FunnelState | null
  /** The tool's paths on the Cloudflare tunnel the app runs, if any. */
  route: TunnelRoute | null
  reload(): Promise<void>
  settle(s: McpServerStatus): void
  onDone(): void
}) {
  const { tool, server, funnel, route, reload, settle, onDone } = props
  const scenario = useRef(scenarioOf(tool.id)).current
  const [app, setApp] = useState<AppId | null>(scenario?.app ?? null)
  const [tunnel, setTunnel] = useState<Tunnel>(scenario?.tunnel ?? "tailscale")
  const [confirmed, setConfirmed] = useState(scenario?.confirmed ?? false)
  const [added, setAdded] = useState(scenario?.added ?? false)
  const [reach, setReach] = useState<ReachState>({ state: "checking" })
  const [goOn, setGoOn] = useState(false)
  const [phase, setPhase] = useState<Phase>("idle")
  const [failure, setFailure] = useState<Failure | null>(null)
  const [approval, setApproval] = useState<string | null>(null)
  const [ownUrl, setOwnUrl] = useState("")
  const [port, setPort] = useState(String(tool.mcpServer?.port ?? DEFAULT_PORT))
  const since = useRef(Date.now()).current

  // A tunnel on this computer only (http://127.0.0.1) has no public name to look up.
  const local = serving(server) && server.connectorUrl.startsWith("http://")
  const reached = (reach.state === "live" || goOn || local) && serving(server)
  const progress = { app, addressReady: confirmed, server, reached, added }
  const current = currentStep(progress)
  const test = testState(server, since)
  const tailscale = useTailscale(current === "address" && tunnel === "tailscale")
  const cloudflare = useCloudflare(current === "address" && tunnel === "cloudflare")

  // A tool that used the Cloudflare tunnel before starts on it again; the record arrives after the first render.
  const offered = useRef(false)
  useEffect(() => {
    if (offered.current || !route) return
    offered.current = true
    setTunnel("cloudflare")
  }, [route])

  // An app that logs in while the owner still reads the instructions moves the guide on by itself.
  useEffect(() => {
    if (current === "connect" && test.state !== "waiting") setAdded(true)
  }, [current, test.state])

  const watching = (current === "connect" || current === "test") && test.state !== "called"
  useEffect(() => {
    if (!watching) return
    const t = setInterval(reload, POLL_MS)
    return () => clearInterval(t)
  }, [watching, reload])

  // Strict mode runs effects twice; the server must start once per press.
  const attempt = useRef(scenario?.confirmed ? 1 : 0)
  const started = useRef(0)
  const start = useCallback(async () => {
    setFailure(null)
    setApproval(null)
    let at: Failure["at"] = "server"
    try {
      if (tunnel === "tailscale" || tunnel === "cloudflare") {
        setPhase("tunnel")
        at = "tunnel"
        const address =
          tunnel === "tailscale"
            ? await platform.tailscaleFunnelOpen(tool.id, Number(port), setApproval)
            : await platform.cloudflareTunnelOpen(tool.id, Number(port))
        setPhase("server")
        at = "server"
        // A failed start leaves Funnel on: turning it off and on again can drop the public name for minutes
        // (BUG-15), and a retry uses the same address. Server details offers to turn it off.
        settle(await platform.mcpServerStart(tool.id, Number(port), address))
      } else {
        setPhase("server")
        settle(await platform.mcpServerStart(tool.id, Number(port), ownUrl.trim().replace(/\/$/, "")))
      }
      setPhase("idle")
    } catch (e) {
      if (message(e) === "Stopped.") {
        setPhase("idle")
        setConfirmed(false)
        return
      }
      setFailure({ at, message: message(e) })
      setPhase("failed")
    }
  }, [tunnel, tool.id, port, ownUrl, settle])

  useEffect(() => {
    if (current !== "start" || started.current === attempt.current) return
    started.current = attempt.current
    start()
  }, [current, start])

  const confirm = () => {
    attempt.current++
    setConfirmed(true)
  }

  const retry = () => {
    started.current = ++attempt.current
    start()
  }

  const back = () => {
    setConfirmed(false)
    setPhase("idle")
    setFailure(null)
  }

  // Focus follows the step, so a keyboard or screen reader user lands on what changed. Not on the first render: the
  // owner's own click put focus where it is.
  const heading = useRef<HTMLHeadingElement>(null)
  const shown = useRef(current)
  useEffect(() => {
    if (shown.current === current) return
    shown.current = current
    heading.current?.focus()
  }, [current])

  const funnelOff = tunnel === "tailscale" && serving(server) && funnel !== null && !funnel.live
  const tunnelOff = serving(server) && route !== null && !route.live && server.connectorUrl.startsWith(route.url)
  const name = app ? APPS[app].name : "the app"

  const summary: Partial<Record<ConnectStepId, string | undefined>> = {
    choose: app ? APPS[app].name : undefined,
    address: serving(server) ? new URL(server.connectorUrl).host : undefined,
    start: serving(server) && server.port ? `Running on port ${server.port}` : undefined,
    reach: reach.state === "live" ? "Published" : goOn ? "Not checked" : undefined,
    connect: added ? "Added" : undefined,
  }

  return (
    <div className="grid min-w-0 gap-4 lg:grid-cols-[14rem_minmax(0,1fr)] lg:gap-6">
      <Rail
        current={current}
        finished={current === "test" && test.state === "called"}
        summary={summary}
        onChoose={current !== "choose" ? () => setApp(null) : undefined}
      />
      <div
        key={current}
        className="step-in flex min-w-0 flex-col gap-3.5 rounded-[0.45rem] border border-line bg-app px-5 py-4"
        aria-live="polite"
      >
        <h5 ref={heading} tabIndex={-1} className="step-heading text-[1.05rem] font-semibold text-ink">
          {current === "test" && test.state === "called" ? `${name} can use ${tool.name}` : STEP_TITLES[current]}
        </h5>
        {current === "choose" && <ChooseStep tool={tool} onChoose={setApp} />}
        {current === "address" && (
          <AddressStep
            tool={tool}
            appName={name}
            tunnel={tunnel}
            setTunnel={setTunnel}
            tailscale={tailscale}
            cloudflare={cloudflare}
            ownUrl={ownUrl}
            setOwnUrl={setOwnUrl}
            port={port}
            setPort={setPort}
            onConfirm={confirm}
          />
        )}
        {current === "start" && (
          <StartStep
            tool={tool}
            tunnel={tunnel}
            phase={phase}
            failure={failure}
            approval={approval}
            onRetry={retry}
            onBack={back}
          />
        )}
        {current === "reach" && serving(server) && (
          <ReachStep
            tool={tool}
            app={app}
            server={server}
            reach={reach}
            setReach={setReach}
            onGoOn={() => setGoOn(true)}
          />
        )}
        {funnelOff && (current === "reach" || current === "connect" || current === "test") && (
          <FunnelOff tool={tool} port={server?.port ?? Number(port)} name={name} reload={reload} />
        )}
        {tunnelOff && (current === "reach" || current === "connect" || current === "test") && (
          <TunnelOff tool={tool} port={route.port} name={name} reload={reload} />
        )}
        {current === "connect" && app && serving(server) && (
          <ConnectStep tool={tool} app={app} server={server} onAdded={() => setAdded(true)} />
        )}
        {current === "test" && app && serving(server) && (
          <TestStep
            tool={tool}
            app={app}
            server={server}
            test={test}
            since={since}
            quietFromStart={scenario?.quiet ?? false}
            onBack={() => setAdded(false)}
            onDone={onDone}
          />
        )}
      </div>
    </div>
  )
}

function Rail(props: {
  current: ConnectStepId
  finished: boolean
  summary: Partial<Record<ConnectStepId, string | undefined>>
  onChoose?: (() => void) | undefined
}) {
  const { current, finished, summary, onChoose } = props
  return (
    <ol className="flex flex-col gap-0.5" aria-label="Steps">
      {stepStates(current, finished).map((step, i) => (
        <li
          key={step.id}
          aria-current={step.state === "current" ? "step" : undefined}
          className="relative flex gap-3 pb-3 last:pb-0"
        >
          {i < STEP_COUNT - 1 && (
            <span
              aria-hidden
              className={cx(
                "absolute top-7 bottom-0 left-[0.7rem] w-[2px] -translate-x-1/2 transition-colors duration-500",
                step.state === "done" ? "bg-ok/60" : "bg-line-strong",
              )}
            />
          )}
          <span
            aria-hidden
            className={cx(
              "relative z-10 grid size-[1.4rem] shrink-0 place-items-center rounded-full text-[0.75rem] font-semibold tabular-nums transition-colors duration-300",
              step.state === "done" && "bg-ok text-on-status",
              step.state === "current" && "bg-brand text-brand-ink",
              step.state === "todo" && "bg-app-3 text-ink-dim",
            )}
          >
            {step.state === "done" ? <Check className="size-3" strokeWidth={3} /> : i + 1}
          </span>
          <span className="flex min-w-0 flex-col pt-px">
            <span
              className={cx(
                "text-[0.92rem]",
                step.state === "current"
                  ? "font-semibold text-ink"
                  : step.state === "done"
                    ? "text-ink"
                    : "text-ink-dim",
              )}
            >
              <span className="sr-only">Step {i + 1}: </span>
              {step.title}
              <span className="sr-only">
                {step.state === "done" ? ", done" : step.state === "current" ? ", current step" : ""}
              </span>
            </span>
            {step.state === "done" && summary[step.id] && (
              <span className="flex min-w-0 items-baseline gap-2 text-[0.8rem] text-ink-dim">
                <span className="truncate">{summary[step.id]}</span>
                {step.id === "choose" && onChoose && (
                  <button
                    type="button"
                    className="shrink-0 text-brand underline hover:text-brand-hover"
                    onClick={onChoose}
                  >
                    Change
                  </button>
                )}
              </span>
            )}
          </span>
        </li>
      ))}
    </ol>
  )
}

function Para({ children }: { children: ReactNode }) {
  return <p className="max-w-[64ch] text-[0.92rem] text-ink-soft">{children}</p>
}

function Note({ children }: { children: ReactNode }) {
  return <p className="max-w-[64ch] text-[0.84rem] text-ink-dim">{children}</p>
}

function Link({ href, children }: { href: string; children: ReactNode }) {
  return (
    <button
      type="button"
      className="text-brand underline hover:text-brand-hover"
      onClick={() => platform.openUrl(href)}
    >
      {children}
    </button>
  )
}

function ChooseStep({ tool, onChoose }: { tool: CatalogTool; onChoose(app: AppId): void }) {
  return (
    <>
      <Para>Which app should use {tool.name}? The steps after this one are written for it.</Para>
      <div className="grid gap-2 sm:grid-cols-3">
        {(["chatgpt", "claude", "other"] as const).map((id) => (
          <button
            key={id}
            type="button"
            onClick={() => onChoose(id)}
            className="flex flex-col items-start gap-0.5 rounded-[0.45rem] border border-line-strong bg-app px-3.5 py-3 text-left transition-colors duration-150 hover:border-brand hover:bg-brand-soft/40"
          >
            <span className="text-[0.98rem] font-semibold text-ink">{APPS[id].name}</span>
            <span className="text-[0.82rem] text-ink-soft">{APPS[id].hint}</span>
          </button>
        ))}
      </div>
    </>
  )
}

const inputClass =
  "h-8 rounded-[0.35rem] border border-line-strong bg-app px-2.5 font-mono text-[0.8rem] text-ink placeholder:font-sans placeholder:text-ink-dim"

function AddressStep(props: {
  tool: CatalogTool
  appName: string
  tunnel: Tunnel
  setTunnel(t: Tunnel): void
  tailscale: ReturnType<typeof useTailscale>
  cloudflare: ReturnType<typeof useCloudflare>
  ownUrl: string
  setOwnUrl(u: string): void
  port: string
  setPort(p: string): void
  onConfirm(): void
}) {
  const { tool, appName, tunnel, setTunnel, tailscale, cloudflare, ownUrl, setOwnUrl, port, setPort, onConfirm } = props
  const id = useId()
  const [problem, setProblem] = useState<string | null>(null)
  const status = tailscale.status
  const steps = status ? stepsOf(status) : []
  const ready = steps.length > 0 && steps.every((s) => s.done)
  const full = steps.find((s) => s.id === "connect" && !s.done && s.missing !== "Waits for the step before it.")
  const address = status ? addressOf(status, tool.id) : null
  const cf = cloudflare.status
  const cfReady = cf !== null && cloudflareSteps(cf).every((s) => s.done)

  const submit = () => {
    const wrong = formProblem(tunnel === "own" ? ownUrl.trim() : "https://x.example.com", port)
    if (wrong) return setProblem(wrong)
    setProblem(null)
    onConfirm()
  }

  if (tunnel === "own")
    return (
      <>
        <Para>
          Type the https address of your tunnel (cloudflared, ngrok, or a Tailscale Funnel you run) and point it at
          127.0.0.1:{port || DEFAULT_PORT} on this computer.
        </Para>
        <label className="flex flex-col gap-1" htmlFor={`${id}-url`}>
          <span className="text-[0.85rem] font-medium text-ink-dim">The tunnel's address</span>
          <input
            id={`${id}-url`}
            className={`${inputClass} w-full max-w-[32rem]`}
            value={ownUrl}
            onChange={(e) => setOwnUrl(e.target.value)}
            placeholder={`https://laptop.tail1234.ts.net/${tool.id}`}
            autoComplete="off"
            spellCheck={false}
          />
        </label>
        <Note>
          With a path such as /{tool.id}, the tunnel must also route /.well-known/oauth-authorization-server/{tool.id}{" "}
          and /.well-known/oauth-protected-resource/{tool.id} here.
        </Note>
        <PortField id={`${id}-port`} port={port} setPort={setPort} />
        {problem && <ErrorNotice inline>{problem}</ErrorNotice>}
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" variant="primary" onClick={submit}>
            Start the server
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setTunnel("tailscale")}>
            Let WireCat set up the address instead
          </Button>
        </div>
      </>
    )

  return (
    <>
      <Para>
        {tool.name} runs on this computer and {appName} runs on its own servers, so it needs an address on the internet
        that leads here. It stays the same, and only the paths of this server are open; every app still has to log in
        with a code from WireCat.
      </Para>
      <TunnelChoice tunnel={tunnel} setTunnel={setTunnel} />
      {tunnel === "cloudflare" ? (
        <>
          <CloudflareGuide cloudflare={cloudflare} />
          {cfReady && cf.hostname && (
            <div className="flex flex-col gap-2.5 rounded-[0.45rem] bg-app-2 px-4 py-3">
              <p className="text-[0.92rem] text-ink">
                The address will be{" "}
                <span className="selectable font-mono">{`https://${cf.hostname}/${tool.id}/mcp`}</span>.
              </p>
              <Note>
                Next, WireCat starts the Cloudflare tunnel for it and {tool.bin}'s server in the background. Both keep
                running until you stop them; after a restart of the computer, start them here again.
              </Note>
              <div className="flex flex-wrap items-center gap-2">
                <Button size="sm" variant="primary" onClick={submit}>
                  Start the server
                </Button>
              </div>
            </div>
          )}
        </>
      ) : (
        <TailscaleGuide tailscale={tailscale} />
      )}
      {tunnel === "tailscale" && full && <p className="text-[0.88rem] text-warn-ink">{full.missing}</p>}
      {tunnel === "tailscale" && ready && (
        <div className="flex flex-col gap-2.5 rounded-[0.45rem] bg-app-2 px-4 py-3">
          <p className="text-[0.92rem] text-ink">
            The address will be{" "}
            <span className="selectable font-mono">
              {address ? `${address}/mcp` : "on this computer's Tailscale name"}
            </span>
            .
          </p>
          <Note>
            Next, WireCat turns on Tailscale Funnel for it and starts {tool.bin}'s server in the background. It keeps
            running until you stop it, and the address stays the same next time.
          </Note>
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" variant="primary" onClick={submit}>
              Start the server
            </Button>
          </div>
        </div>
      )}
      {problem && <ErrorNotice inline>{problem}</ErrorNotice>}
      <Disclosure summary="Use a tunnel I run myself, or another port">
        <div className="flex flex-col gap-2.5">
          <PortField id={`${id}-port`} port={port} setPort={setPort} />
          <div>
            <Button size="sm" onClick={() => setTunnel("own")}>
              Type my tunnel's address
            </Button>
          </div>
        </div>
      </Disclosure>
    </>
  )
}

/** Funnel first: it is free and cannot read the traffic. Cloudflare's cost is said before it is picked (NEED-102). */
function TunnelChoice({ tunnel, setTunnel }: { tunnel: Tunnel; setTunnel(t: Tunnel): void }) {
  const name = useId()
  const options = [
    {
      id: "tailscale",
      title: "Tailscale Funnel",
      hint: "Recommended. Free, and the encryption ends on this computer, so Tailscale cannot read your messages.",
      warn: null,
    },
    {
      id: "cloudflare",
      title: "Cloudflare tunnel (your own domain)",
      hint: "For a Cloudflare account with your own domain on it.",
      warn: PRIVACY,
    },
  ] as const
  return (
    <fieldset className="grid gap-2 sm:grid-cols-2">
      <legend className="sr-only">How the address reaches this computer</legend>
      {options.map((o) => (
        <label
          key={o.id}
          htmlFor={`${name}-${o.id}`}
          className={cx(
            "flex cursor-pointer flex-col gap-1 rounded-[0.45rem] border px-3.5 py-3 transition-colors duration-150 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-brand motion-reduce:transition-none",
            tunnel === o.id ? "border-brand bg-brand-soft/40" : "border-line-strong hover:border-brand",
          )}
        >
          <span className="flex items-center gap-2">
            <input
              id={`${name}-${o.id}`}
              type="radio"
              name={name}
              value={o.id}
              aria-labelledby={`${name}-${o.id}-title`}
              aria-describedby={`${name}-${o.id}-hint`}
              checked={tunnel === o.id}
              onChange={() => setTunnel(o.id)}
              className="accent-brand"
            />
            <span id={`${name}-${o.id}-title`} className="text-[0.95rem] font-semibold text-ink">
              {o.title}
            </span>
          </span>
          <span id={`${name}-${o.id}-hint`} className="flex flex-col gap-1">
            <span className="text-[0.84rem] text-ink-soft">{o.hint}</span>
            {o.warn && <span className="text-[0.84rem] text-warn-ink">{o.warn}</span>}
          </span>
        </label>
      ))}
    </fieldset>
  )
}

function PortField({ id, port, setPort }: { id: string; port: string; setPort(p: string): void }) {
  return (
    <label className="flex flex-col gap-1" htmlFor={id}>
      <span className="text-[0.85rem] font-medium text-ink-dim">Port on this computer</span>
      <input
        id={id}
        className={`${inputClass} w-28`}
        value={port}
        onChange={(e) => setPort(e.target.value)}
        inputMode="numeric"
      />
    </label>
  )
}

function Progress({ state, children }: { state: "busy" | "done" | "todo" | "failed"; children: ReactNode }) {
  const tone = { busy: "busy", done: "ok", todo: "idle", failed: "bad" } as const
  const label = { busy: "In progress", done: "Done", todo: "Not started", failed: "Failed" }[state]
  return (
    <li className="flex items-center gap-2.5">
      <Lamp tone={tone[state]} size="sm" label={label} />
      <span className={cx("text-[0.92rem]", state === "todo" ? "text-ink-dim" : "text-ink")}>{children}</span>
    </li>
  )
}

function StartStep(props: {
  tool: CatalogTool
  tunnel: Tunnel
  phase: Phase
  failure: Failure | null
  approval: string | null
  onRetry(): void
  onBack(): void
}) {
  const { tool, tunnel, phase, failure, approval, onRetry, onBack } = props
  const failedAt = phase === "failed" ? failure?.at : undefined
  const open = phase === "tunnel" ? "busy" : failedAt === "tunnel" ? "failed" : phase === "idle" ? "todo" : "done"
  const server = phase === "server" ? "busy" : failedAt === "server" ? "failed" : "todo"
  return (
    <>
      <ul className="flex flex-col gap-2">
        {tunnel === "tailscale" && <Progress state={open}>Turn on Tailscale Funnel for {tool.bin}'s address</Progress>}
        {tunnel === "cloudflare" && (
          <Progress state={open}>Start the Cloudflare tunnel with {tool.bin}'s paths</Progress>
        )}
        <Progress state={server}>Start {tool.bin}'s server and wait until it answers</Progress>
      </ul>
      {phase === "tunnel" && approval && (
        <p className="text-[0.92rem] text-ink">
          Tailscale asks you to approve Funnel for your network in the page that opened in your browser.{" "}
          <Link href={approval}>Open it again</Link>
        </p>
      )}
      {phase === "tunnel" && tunnel === "tailscale" && (
        <div>
          <Button size="sm" variant="ghost" onClick={() => platform.tailscaleStop()}>
            Stop
          </Button>
        </div>
      )}
      {failure && phase === "failed" && (
        <>
          <ErrorNotice inline>{failure.message}</ErrorNotice>
          <Note>
            {/in use|EADDRINUSE/i.test(failure.message)
              ? "Another program uses this port. Go back, open “Use a tunnel I run myself, or another port”, choose another port and start again."
              : "Nothing was left running. Try again, or go back and change the address or port."}
          </Note>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={onRetry}>
              Try again
            </Button>
            <Button size="sm" variant="ghost" onClick={onBack}>
              Back to the address
            </Button>
          </div>
        </>
      )}
    </>
  )
}

function Field({ label, value, copyLabel }: { label: string; value: string; copyLabel: string }) {
  return (
    <div className="min-w-0">
      <span className="mb-1 block text-[0.8rem] font-medium text-ink-dim">{label}</span>
      <CopyField value={value} label={copyLabel} />
    </div>
  )
}

function Copy({ step, tool, server }: { step: AppStep; tool: CatalogTool; server: McpServerStatus }) {
  if (step.copy === "url" && server.connectorUrl)
    return <CopyField value={server.connectorUrl} label="Copy the server address" />
  if (step.copy === "name") return <CopyField value={connectorName(tool)} label="Copy the name" />
  if (step.copy === "code")
    return server.loginCode ? (
      <LoginCode server={{ ...server, loginCode: server.loginCode }} />
    ) : (
      <Note>The code appears here in a moment.</Note>
    )
  return null
}

function ReachStep(props: {
  tool: CatalogTool
  app: AppId | null
  server: McpServerStatus & { connectorUrl: string }
  reach: ReachState
  setReach(r: ReachState): void
  onGoOn(): void
}) {
  const { tool, app, server, reach, setReach, onGoOn } = props
  const name = app ? APPS[app].name : "the app"
  const [error, setError] = useState<string | null>(null)
  const [checking, setChecking] = useState(false)
  const firstMissing = useRef<number | null>(null)
  const [now, setNow] = useState(Date.now())
  const host = new URL(server.connectorUrl).host
  // Tailscale publishes a Funnel name itself, slowly; on a tunnel of the owner's the record already exists.
  const funnel = host.endsWith(".ts.net")

  const check = useCallback(async () => {
    setChecking(true)
    setError(null)
    try {
      const next = reachOf(await platform.mcpServerPublic(tool.id))
      if (next.state === "publishing") firstMissing.current ??= Date.now()
      setReach(next)
    } catch (e) {
      setError(message(e))
    }
    setChecking(false)
  }, [tool.id, setReach])

  useEffect(() => {
    check()
  }, [check])

  // While Tailscale publishes the name, look again on its own and show how long it has been.
  useEffect(() => {
    if (reach.state !== "publishing") return
    const again = setInterval(check, RECHECK_MS)
    const clock = setInterval(() => setNow(Date.now()), 1000)
    return () => {
      clearInterval(again)
      clearInterval(clock)
    }
  }, [reach.state, check])

  const waited = firstMissing.current === null ? 0 : now - firstMissing.current
  const share = Math.min(waited / PUBLISH_MS, 1)
  const minutes = Math.floor(waited / 60_000)

  return (
    <>
      <Para>
        {name} reaches {tool.bin} from its own servers, so WireCat asks public DNS for{" "}
        <span className="selectable font-mono text-ink">{host}</span> the way {name} will, then opens the address from
        the internet's side.
      </Para>
      <ul className="flex flex-col gap-2">
        <Progress
          state={
            reach.state === "checking" || (checking && reach.state !== "publishing")
              ? "busy"
              : reach.state === "publishing"
                ? "busy"
                : reach.state === "unknown"
                  ? "failed"
                  : "done"
          }
        >
          {reach.state === "publishing"
            ? funnel
              ? "Tailscale is publishing your address…"
              : "Waiting for the address to appear in public DNS…"
            : reach.state === "unknown"
              ? "Public DNS could not be asked from this computer"
              : reach.state === "checking"
                ? "Asking public DNS…"
                : "The address is published"}
        </Progress>
      </ul>
      {reach.state === "publishing" && (
        <div className="flex max-w-[34rem] flex-col gap-1.5">
          <div
            className="h-1.5 overflow-hidden rounded-full bg-app-3"
            role="progressbar"
            aria-label="Waiting for Tailscale to publish the address"
            aria-valuemin={0}
            aria-valuemax={10}
            aria-valuenow={minutes}
            aria-valuetext={`${minutes} of up to 10 minutes`}
          >
            <div
              className="h-full rounded-full bg-brand transition-[width] duration-1000 ease-linear"
              style={{ width: `${Math.max(share * 100, 2)}%` }}
            />
          </div>
          <Note>
            {funnel
              ? "A new Funnel address can take up to 10 minutes to appear on the internet."
              : "A new DNS record usually appears within minutes."}{" "}
            WireCat checks every 15 seconds and moves on by itself{minutes > 0 ? `; ${minutes} min so far` : ""}. Until
            then {name} would say it cannot reach the address, so the next step waits.
          </Note>
          {share >= 1 && (
            <p className="text-[0.9rem] text-warn-ink">
              {funnel
                ? "It is taking longer than Tailscale says. Keep this open; turning Funnel off and on again starts the wait over."
                : `It is taking longer than usual. Check that ${host} is listed on Cloudflare's DNS page for your domain.`}
            </p>
          )}
        </div>
      )}
      {reach.state === "live" && !reach.tested && (
        <Note>
          This computer cannot open its own public address, which is usual, so the last part is tested by {name}.
        </Note>
      )}
      {reach.state === "wrong" && (
        <>
          <ErrorNotice inline>
            The address answers, but not with {tool.bin}'s server (it said {reach.status}).{" "}
            {funnel
              ? "Another Funnel or tunnel may use it. Check Server details, or go back and use another port."
              : `Cloudflare may be checking visitors on your domain (Bot Fight Mode, or "I'm Under Attack" mode), which stops ${name} too; turn it off for the domain in Cloudflare's Security settings. Or another tunnel uses the name.`}
          </ErrorNotice>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={check} disabled={checking}>
              {checking ? "Checking…" : "Check again"}
            </Button>
            <Button size="sm" variant="ghost" onClick={onGoOn}>
              Go on anyway
            </Button>
          </div>
        </>
      )}
      {reach.state === "unknown" && (
        <>
          <Para>
            No public DNS service answered from this computer (some networks block them), so WireCat cannot see whether
            the address is published. If {name} says it cannot reach the address, wait up to 10 minutes after the tunnel
            started and try again there.
          </Para>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="primary" onClick={onGoOn}>
              Go on without the check
            </Button>
            <Button size="sm" variant="ghost" onClick={check} disabled={checking}>
              {checking ? "Checking…" : "Check again"}
            </Button>
          </div>
        </>
      )}
      {error && (
        <>
          <ErrorNotice inline>{error}</ErrorNotice>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={check} disabled={checking}>
              {checking ? "Checking…" : "Check again"}
            </Button>
            <Button size="sm" variant="ghost" onClick={onGoOn}>
              Go on without the check
            </Button>
          </div>
        </>
      )}
    </>
  )
}

function ConnectStep(props: { tool: CatalogTool; app: AppId; server: McpServerStatus; onAdded(): void }) {
  const { tool, app, server, onAdded } = props
  const spec = APPS[app]
  return (
    <>
      <Para>
        {tool.bin}'s server is running. Do this in {spec.name}; WireCat watches for it to log in.
      </Para>
      <ol className="flex flex-col gap-3">
        {spec.steps.map((step, i) => (
          <li key={step.text} className="grid grid-cols-[1.5rem_minmax(0,1fr)] gap-x-2 gap-y-1.5">
            <span className="pt-px text-[0.9rem] font-semibold text-ink-dim tabular-nums">{i + 1}.</span>
            <span className="text-[0.92rem] text-ink">
              {step.text}
              {step.link && (
                <>
                  {" "}
                  <Link href={step.link.href}>{step.link.label}</Link>
                </>
              )}
            </span>
            {step.copy && (
              <div className="col-start-2 max-w-[34rem]">
                <Copy step={step} tool={tool} server={server} />
              </div>
            )}
          </li>
        ))}
      </ol>
      <Note>
        {spec.limits}
        {spec.help && (
          <>
            {" "}
            <Link href={spec.help.href}>{spec.help.label}</Link>.
          </>
        )}
      </Note>
      <DiscoveryHelp tool={tool} app={app} />
      <div className="flex flex-wrap items-center gap-2 pt-1">
        <Button size="sm" variant="primary" onClick={onAdded}>
          I added it, test the connection
        </Button>
      </div>
    </>
  )
}

/** BUG-15: an app that does not find the login settings under a path can be given them by hand. */
function DiscoveryHelp({ tool, app }: { tool: CatalogTool; app: AppId }) {
  const [settings, setSettings] = useState<OAuthSettings | null>(null)
  const [error, setError] = useState<string | null>(null)
  const name = APPS[app].name
  const load = async () => {
    if (settings) return
    try {
      setSettings(await platform.mcpServerOAuth(tool.id))
    } catch (e) {
      setError(message(e))
    }
  }
  return (
    <div onClickCapture={load}>
      <Disclosure summary={`If ${app === "other" ? "the app" : name} says it couldn't discover OAuth settings`}>
        <div className="flex flex-col gap-2.5">
          <Para>
            This message usually means the address is not on the internet yet: the app could not reach the server at
            all. A new address can take up to 10 minutes to appear, and the step “Check the address” waits for it. Wait,
            then add the server in the app again.
          </Para>
          <Note>
            If the address is published and the app still says it, and its form offers advanced OAuth settings, these
            are the values, read from the running server:
          </Note>
          {error && <ErrorNotice inline>{error}</ErrorNotice>}
          {settings && (
            <div className="grid gap-2.5 md:grid-cols-2">
              <Field
                label="Authorization URL"
                value={settings.authorizationEndpoint}
                copyLabel="Copy the authorization URL"
              />
              <Field label="Token URL" value={settings.tokenEndpoint} copyLabel="Copy the token URL" />
              {settings.registrationEndpoint && (
                <Field
                  label="Registration URL"
                  value={settings.registrationEndpoint}
                  copyLabel="Copy the registration URL"
                />
              )}
              <Field label="Issuer" value={settings.issuer} copyLabel="Copy the issuer" />
            </div>
          )}
        </div>
      </Disclosure>
    </div>
  )
}

function FunnelOff(props: { tool: CatalogTool; port: number; name: string; reload(): Promise<void> }) {
  const { tool, port, name, reload } = props
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const turnOn = async () => {
    setBusy(true)
    setError(null)
    try {
      await platform.tailscaleFunnelOpen(tool.id, port, () => {})
      await reload()
    } catch (e) {
      setError(message(e))
    }
    setBusy(false)
  }
  return (
    <div className="flex flex-col gap-2 rounded-[0.2rem] border border-warn/40 bg-warn/10 px-3.5 py-2.5">
      <p className="text-[0.9rem] text-warn-ink">
        Tailscale Funnel is off for this server, so {name} cannot reach it. Turn it on again; the address stays the
        same, though it can take up to 10 minutes to be reachable again.
      </p>
      {error && <ErrorNotice inline>{error}</ErrorNotice>}
      <div>
        <Button size="sm" onClick={turnOn} disabled={busy}>
          {busy ? "Turning Funnel on…" : "Turn Funnel on"}
        </Button>
      </div>
    </div>
  )
}

/** cloudflared stops with the computer; the tools' servers too, but a server started again finds its tunnel off. */
function TunnelOff(props: { tool: CatalogTool; port: number; name: string; reload(): Promise<void> }) {
  const { tool, port, name, reload } = props
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const turnOn = async () => {
    setBusy(true)
    setError(null)
    try {
      await platform.cloudflareTunnelOpen(tool.id, port)
      await reload()
    } catch (e) {
      setError(message(e))
    }
    setBusy(false)
  }
  return (
    <div className="flex flex-col gap-2 rounded-[0.2rem] border border-warn/40 bg-warn/10 px-3.5 py-2.5">
      <p className="text-[0.9rem] text-warn-ink">
        The Cloudflare tunnel is not running, so {name} cannot reach this server. Start it again; the address stays the
        same.
      </p>
      {error && <ErrorNotice inline>{error}</ErrorNotice>}
      <div>
        <Button size="sm" onClick={turnOn} disabled={busy}>
          {busy ? "Starting the tunnel…" : "Start the tunnel"}
        </Button>
      </div>
    </div>
  )
}

function TestStep(props: {
  tool: CatalogTool
  app: AppId
  server: McpServerStatus
  test: TestState
  since: number
  quietFromStart: boolean
  onBack(): void
  onDone(): void
}) {
  const { tool, app, server, test, since, quietFromStart, onBack, onDone } = props
  const name = APPS[app].name
  const [quiet, setQuiet] = useState(quietFromStart)
  useEffect(() => {
    if (test.state !== "waiting" || quiet) return
    const t = setTimeout(() => setQuiet(true), Math.max(QUIET_MS - (Date.now() - since), 0))
    return () => clearTimeout(t)
  }, [test.state, quiet, since])

  const loggedIn = test.state !== "waiting"
  const counts = test.state === "called" || (test.state === "connected" && test.counts)
  return (
    <>
      <ul className="flex flex-col gap-2.5">
        <Progress state={loggedIn ? "done" : "busy"}>
          {loggedIn ? (
            <>
              {appLabel(test.client)} logged in <span className="text-ink-dim">(the name the app gave itself)</span>
            </>
          ) : (
            `Waiting for ${name} to log in…`
          )}
        </Progress>
        {counts || !loggedIn ? (
          <Progress state={test.state === "called" ? "done" : loggedIn ? "busy" : "todo"}>
            {test.state === "called" ? (
              <>
                First call arrived: <span className="selectable font-mono">{test.client.lastTool}</span>
                {test.client.lastToolAt && (
                  <span className="text-ink-dim tabular-nums"> at {clock(test.client.lastToolAt)}</span>
                )}
              </>
            ) : (
              "Waiting for the first call…"
            )}
          </Progress>
        ) : null}
      </ul>
      {!loggedIn && (
        <Para>
          Finish the login in {name}: it opens a WireCat page that asks for the login code from the step before.
        </Para>
      )}
      {loggedIn && test.state !== "called" && (
        <div className="flex flex-col gap-2">
          <Para>
            Now ask {name} something that needs {tool.name}, in a new chat with it turned on:
          </Para>
          <div className="max-w-[34rem]">
            <CopyField value={testPrompt(tool)} label="Copy the test prompt" />
          </div>
          {!counts && (
            <Note>
              This version of {tool.bin} does not report calls, so check the answer in {name}. Update {tool.name} on the
              Tools page to see calls here.
            </Note>
          )}
        </div>
      )}
      {test.state === "called" && (
        <Para>
          {name} reached {tool.bin} through the internet address, logged in and called a tool. From now on this panel
          shows when it last did.
        </Para>
      )}
      {!loggedIn && quiet && <Troubleshoot name={name} tool={tool} app={app} server={server} />}
      <div className="flex flex-wrap items-center gap-2 pt-1">
        {test.state === "called" || (loggedIn && !counts) ? (
          <Button size="sm" variant="primary" onClick={onDone}>
            Finish
          </Button>
        ) : (
          <Button size="sm" variant="ghost" onClick={onBack}>
            Back to the steps in {name}
          </Button>
        )}
      </div>
    </>
  )
}

function Troubleshoot(props: { name: string; tool: CatalogTool; app: AppId; server: McpServerStatus }) {
  const { name, tool, app, server } = props
  return (
    <div className="flex flex-col gap-2 rounded-[0.45rem] bg-app-2 px-4 py-3">
      <p className="text-[0.92rem] font-medium text-ink">
        Nothing has logged in yet. What {name} says decides the fix:
      </p>
      <ul className="flex list-disc flex-col gap-1.5 pl-5 text-[0.88rem] text-ink-soft">
        <li>
          <span className="text-ink">It couldn't reach or connect to the server:</span> check the address is exactly{" "}
          <span className="selectable font-mono text-ink">{server.connectorUrl}</span>, with /mcp at the end. A new
          address can also take up to 10 minutes to appear on the internet; try again in the app after that.
        </li>
        <li>
          <span className="text-ink">The login page says the code is wrong or expired:</span> each code works for 10
          minutes. Type the one in the step before as it is now.
        </li>
        <li>
          <span className="text-ink">No WireCat login page opened:</span> choose OAuth as the authentication in {name},
          and remove and add the server again.
        </li>
      </ul>
      <DiscoveryHelp tool={tool} app={app} />
    </div>
  )
}
