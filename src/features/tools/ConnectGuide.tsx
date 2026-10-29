import { Check } from "lucide-react"
import { type ReactNode, useCallback, useEffect, useId, useRef, useState } from "react"
import { type CatalogTool, tools } from "@/domain/catalog"
import { formatDate, useLang, useMessages } from "@/i18n"
import { platform } from "@/platform/bridge"
import type { TunnelRoute } from "@/platform/cloudflare-schemas"
import type { McpServerStatus, OAuthSettings } from "@/platform/mcp-server-schemas"
import type { FunnelState } from "@/platform/tailscale-schemas"
import { AutoHeight } from "@/ui/AutoHeight"
import { Button } from "@/ui/Button"
import { Collapse } from "@/ui/Collapse"
import { CopyField } from "@/ui/CopyField"
import { cx } from "@/ui/cx"
import { Disclosure } from "@/ui/Disclosure"
import { ErrorNotice } from "@/ui/ErrorNotice"
import { Lamp } from "@/ui/Lamp"
import { focusInPlace } from "@/ui/motion"
import { useNav } from "../nav"
import { CloudflareGuide, useCloudflare } from "./CloudflareGuide"
import { cloudflareSteps } from "./cloudflare-steps"
import { APPS, type AppId, type AppStep, connectorName, testPrompt } from "./connect-apps"
import { scenarioOf } from "./connect-scenario"
import {
  appLabel,
  type ConnectStepId,
  currentStep,
  type ReachState,
  reachOf,
  serving,
  stepStates,
  type TestState,
  testState,
} from "./connect-steps"
import { openConnect } from "./go"
import { useKept } from "./kept"
import { LoginCode } from "./LoginCode"
import { formProblem } from "./McpServerDialogs"
import { connectMessages } from "./messages-connect"
import { tunnelMessages } from "./messages-tunnel"
import { useTools } from "./store"
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
  /** Starts the guide again for another app. */
  onAgain(): void
}) {
  const { tool, server, funnel, route, reload, settle, onDone, onAgain } = props
  const m = useMessages(connectMessages)
  const scenario = useRef(scenarioOf(tool.id)).current
  // Kept outside the component, so leaving the page mid-guide and coming back lands on the same step.
  const kept = `connect:${tool.id}`
  const [app, setApp] = useKept<AppId | null>(kept, "app", scenario?.app ?? null)
  const [tunnel, setTunnel] = useKept<Tunnel>(kept, "tunnel", scenario?.tunnel ?? "tailscale")
  const [confirmed, setConfirmed] = useKept(kept, "confirmed", scenario?.confirmed ?? false)
  const [added, setAdded] = useKept(kept, "added", scenario?.added ?? false)
  const [reach, setReach] = useKept<ReachState>(kept, "reach", { state: "checking" })
  const [goOn, setGoOn] = useKept(kept, "goOn", false)
  const [phase, setPhase] = useState<Phase>("idle")
  const [failure, setFailure] = useState<Failure | null>(null)
  const [approval, setApproval] = useState<string | null>(null)
  const [ownUrl, setOwnUrl] = useKept(kept, "ownUrl", "")
  const [port, setPort] = useKept(kept, "port", String(tool.mcpServer?.port ?? DEFAULT_PORT))
  const [since] = useKept(kept, "since", () => Date.now())
  // Mutable like refs, but outlive the component: a start already pressed is not pressed again on coming back.
  const [runs] = useKept(kept, "runs", () => ({ attempt: scenario?.confirmed ? 1 : 0, started: 0, offered: false }))

  // A tunnel on this computer only (http://127.0.0.1) has no public name to look up.
  const local = serving(server) && server.connectorUrl.startsWith("http://")
  const reached = (reach.state === "live" || goOn || local) && serving(server)
  const progress = { app, addressReady: confirmed, server, reached, added }
  const current = currentStep(progress)
  const test = testState(server, since)
  const tailscale = useTailscale(current === "address" && tunnel === "tailscale")
  const cloudflare = useCloudflare(current === "address" && tunnel === "cloudflare")

  // A tool that used the Cloudflare tunnel before starts on it again; the record arrives after the first render.
  useEffect(() => {
    if (runs.offered || !route) return
    runs.offered = true
    setTunnel("cloudflare")
  }, [route, runs, setTunnel])

  // An app that logs in while the owner still reads the instructions moves the guide on by itself.
  useEffect(() => {
    if (current === "connect" && test.state !== "waiting") setAdded(true)
  }, [current, test.state, setAdded])

  const watching = (current === "connect" || current === "test") && test.state !== "called"
  useEffect(() => {
    if (!watching) return
    const t = setInterval(reload, POLL_MS)
    return () => clearInterval(t)
  }, [watching, reload])

  // Strict mode runs effects twice; the server must start once per press.
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
  }, [tunnel, tool.id, port, ownUrl, settle, setConfirmed])

  // biome-ignore lint/correctness/useExhaustiveDependencies: `runs` is mutated like a ref; a press changes `current`
  useEffect(() => {
    if (current !== "start" || runs.started === runs.attempt) return
    runs.started = runs.attempt
    start()
  }, [current, start])

  const confirm = () => {
    runs.attempt++
    setConfirmed(true)
  }

  const retry = () => {
    runs.started = ++runs.attempt
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
    focusInPlace(heading.current)
  }, [current])

  const funnelOff = tunnel === "tailscale" && serving(server) && funnel !== null && !funnel.live
  const tunnelOff = serving(server) && route !== null && !route.live && server.connectorUrl.startsWith(route.url)
  const name = app && app !== "other" ? m.apps[app].name : m.theApp

  const summary: Partial<Record<ConnectStepId, string | undefined>> = {
    choose: app ? m.apps[app].name : undefined,
    address: serving(server) ? new URL(server.connectorUrl).host : undefined,
    start: serving(server) && server.port ? m.rail.runningOn(server.port) : undefined,
    reach: reach.state === "live" ? m.rail.published : goOn ? m.rail.notChecked : undefined,
    connect: added ? m.rail.added : undefined,
  }

  return (
    <div className="grid min-w-0 gap-4 lg:grid-cols-[14rem_minmax(0,1fr)] lg:gap-6">
      <Rail
        current={current}
        finished={current === "test" && test.state === "called"}
        summary={summary}
        onChoose={current !== "choose" ? () => setApp(null) : undefined}
      />
      <AutoHeight swap={current} className="min-w-0">
        <div
          key={current}
          className="step-in flex min-w-0 flex-col gap-3.5 rounded-[0.45rem] border border-line bg-app px-5 py-4"
          aria-live="polite"
        >
          <h5 ref={heading} tabIndex={-1} className="step-heading scroll-mt-3 text-[1.05rem] font-semibold text-ink">
            {current === "test" && test.state === "called"
              ? m.calledTitle(app ? m.apps[app].name : name, tool.name)
              : current === "connect" && app && app !== "other"
                ? m.addIn(name)
                : m.steps[current]}
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
          {/* The address check can pass in one look; its result stays in sight, so the step is not missed. */}
          {current === "connect" && serving(server) && !local && (
            <ul>
              <Progress state={reach.state === "live" ? "done" : "todo"}>
                {reach.state === "live"
                  ? m.reach.live(new URL(server.connectorUrl).host)
                  : m.reach.unchecked(new URL(server.connectorUrl).host)}
              </Progress>
            </ul>
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
              onAgain={onAgain}
            />
          )}
        </div>
      </AutoHeight>
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
  const m = useMessages(connectMessages)
  return (
    <ol className="flex flex-col gap-0.5" aria-label={m.rail.label}>
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
              "relative z-10 grid size-[1.4rem] shrink-0 place-items-center rounded-full text-[0.85rem] font-semibold tabular-nums transition-colors duration-300",
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
              <span className="sr-only">{m.rail.step(i + 1)}</span>
              {m.steps[step.id]}
              <span className="sr-only">
                {step.state === "done" ? m.rail.done : step.state === "current" ? m.rail.current : ""}
              </span>
            </span>
            {step.state === "done" && summary[step.id] && (
              <span className="flex min-w-0 items-baseline gap-2 text-[0.85rem] text-ink-dim">
                <span className="truncate">{summary[step.id]}</span>
                {step.id === "choose" && onChoose && (
                  <button
                    type="button"
                    className="shrink-0 text-brand underline hover:text-brand-hover"
                    onClick={onChoose}
                  >
                    {m.rail.change}
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
  return <p className="max-w-[64ch] text-[0.9rem] text-ink-dim">{children}</p>
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
  const m = useMessages(connectMessages)
  return (
    <>
      <Para>{m.choose(tool.name)}</Para>
      <div className="grid gap-2 sm:grid-cols-3">
        {(["chatgpt", "claude", "other"] as const).map((id) => (
          <button
            key={id}
            type="button"
            onClick={() => onChoose(id)}
            className="flex flex-col items-start gap-0.5 rounded-[0.45rem] border border-line-strong bg-app px-3.5 py-3 text-left transition-colors duration-150 hover:border-brand hover:bg-brand-soft/40"
          >
            <span className="text-[0.98rem] font-semibold text-ink">{m.apps[id].name}</span>
            <span className="text-[0.9rem] text-ink-soft">{m.apps[id].hint}</span>
          </button>
        ))}
      </div>
    </>
  )
}

const exampleUrl = (tool: string) => `https://laptop.tail1234.ts.net/${tool}`

const inputClass =
  "h-8 rounded-[0.35rem] border border-line-strong bg-app px-2.5 font-mono text-[0.85rem] text-ink placeholder:font-sans placeholder:text-ink-dim"

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
  const m = useMessages(connectMessages).address
  const tm = useMessages(tunnelMessages).tailscale
  const id = useId()
  const [problem, setProblem] = useState<"url" | "port" | null>(null)
  const status = tailscale.status
  const steps = status ? stepsOf(status) : []
  const ready = steps.length > 0 && steps.every((s) => s.done)
  const full = steps.find((s) => s.id === "connect" && !s.done && s.missing !== "blocked")
  const address = status ? addressOf(status, tool.id) : null
  const tailscaleUrl = address && `${address}/mcp`
  const cf = cloudflare.status
  const cfReady = cf !== null && cloudflareSteps(cf).every((s) => s.done)
  const cfUrl = cf?.hostname && `https://${cf.hostname}/${tool.id}/mcp`

  const submit = () => {
    const wrong = formProblem(tunnel === "own" ? ownUrl.trim() : "https://x.example.com", port)
    if (wrong) return setProblem(wrong)
    setProblem(null)
    onConfirm()
  }

  return (
    <>
      <Para>{m.intro(tool.name, appName)}</Para>
      <TunnelChoice tunnel={tunnel} setTunnel={setTunnel} />
      {/* The choice opens its own part in place; the others fold away, so nothing above it moves. */}
      <div>
        <Collapse open={tunnel === "cloudflare"} className="flex flex-col gap-3.5">
          <CloudflareGuide cloudflare={cloudflare} />
          {cfReady && cf.hostname && (
            <div className="flex flex-col gap-2.5 rounded-[0.45rem] bg-app-2 px-4 py-3">
              <p className="text-[0.92rem] text-ink">
                {m.willBe(<span className="selectable font-mono">{cfUrl}</span>)}
              </p>
              <Note>{m.cloudflareNext(tool.bin)}</Note>
              <div className="flex flex-wrap items-center gap-2">
                <Button size="sm" variant="primary" onClick={submit}>
                  {m.start}
                </Button>
              </div>
            </div>
          )}
        </Collapse>
        <Collapse open={tunnel === "tailscale"} className="flex flex-col gap-3.5">
          <TailscaleGuide tailscale={tailscale} />
          {full?.missing && <p className="text-[0.88rem] text-warn-ink">{tm.missing[full.missing]}</p>}
          {ready && (
            <div className="flex flex-col gap-2.5 rounded-[0.45rem] bg-app-2 px-4 py-3">
              <p className="text-[0.92rem] text-ink">
                {tailscaleUrl
                  ? m.willBe(<span className="selectable font-mono">{tailscaleUrl}</span>)
                  : m.onTailscaleName}
              </p>
              <Note>{m.tailscaleNext(tool.bin)}</Note>
              <div className="flex flex-wrap items-center gap-2">
                <Button size="sm" variant="primary" onClick={submit}>
                  {m.start}
                </Button>
              </div>
            </div>
          )}
        </Collapse>
        <Collapse open={tunnel === "own"} className="flex flex-col gap-3.5">
          <Para>{m.ownIntro(port || String(DEFAULT_PORT))}</Para>
          <label className="flex flex-col gap-1" htmlFor={`${id}-url`}>
            <span className="text-[0.9rem] font-medium text-ink-dim">{m.ownLabel}</span>
            <input
              id={`${id}-url`}
              className={`${inputClass} w-full max-w-[32rem]`}
              value={ownUrl}
              onChange={(e) => setOwnUrl(e.target.value)}
              placeholder={exampleUrl(tool.id)}
              autoComplete="off"
              spellCheck={false}
            />
          </label>
          <Note>{m.ownPaths(tool.id)}</Note>
          <PortField id={`${id}-own-port`} port={port} setPort={setPort} />
          <div>
            <Button size="sm" variant="primary" onClick={submit}>
              {m.start}
            </Button>
          </div>
        </Collapse>
      </div>
      {problem && <ErrorNotice inline>{m.problem[problem]}</ErrorNotice>}
      {tunnel !== "own" && (
        <Disclosure summary={m.otherPort}>
          <PortField id={`${id}-port`} port={port} setPort={setPort} />
        </Disclosure>
      )}
    </>
  )
}

function TunnelChoice({ tunnel, setTunnel }: { tunnel: Tunnel; setTunnel(t: Tunnel): void }) {
  const m = useMessages(connectMessages)
  const privacy = useMessages(tunnelMessages).cloudflare.privacy
  const name = useId()
  const options = [
    { id: "tailscale", ...m.address.tailscale, warn: null },
    { id: "cloudflare", ...m.address.cloudflare, warn: privacy },
    { id: "own", ...m.address.own, warn: null },
  ] as const
  return (
    <fieldset className="grid gap-2 sm:grid-cols-3">
      <legend className="sr-only">{m.address.legend}</legend>
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
            <span className="text-[0.9rem] text-ink-soft">{o.hint}</span>
            {o.warn && <span className="text-[0.9rem] text-warn-ink">{o.warn}</span>}
          </span>
        </label>
      ))}
    </fieldset>
  )
}

function PortField({ id, port, setPort }: { id: string; port: string; setPort(p: string): void }) {
  const m = useMessages(connectMessages)
  return (
    <label className="flex flex-col gap-1" htmlFor={id}>
      <span className="text-[0.9rem] font-medium text-ink-dim">{m.address.port}</span>
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
  const label = useMessages(connectMessages).progress[state]
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
  const m = useMessages(connectMessages).start
  const failedAt = phase === "failed" ? failure?.at : undefined
  const open = phase === "tunnel" ? "busy" : failedAt === "tunnel" ? "failed" : phase === "idle" ? "todo" : "done"
  const server = phase === "server" ? "busy" : failedAt === "server" ? "failed" : "todo"
  return (
    <>
      <ul className="flex flex-col gap-2">
        {tunnel === "tailscale" && <Progress state={open}>{m.funnel(tool.bin)}</Progress>}
        {tunnel === "cloudflare" && <Progress state={open}>{m.tunnel(tool.bin)}</Progress>}
        <Progress state={server}>{m.server(tool.bin)}</Progress>
      </ul>
      {phase === "tunnel" && approval && (
        <p className="text-[0.92rem] text-ink">{m.approve(<Link href={approval}>{m.openAgain}</Link>)}</p>
      )}
      {phase === "tunnel" && tunnel === "tailscale" && (
        <div>
          <Button size="sm" variant="ghost" onClick={() => platform.tailscaleStop()}>
            {m.stop}
          </Button>
        </div>
      )}
      {failure && phase === "failed" && (
        <>
          <ErrorNotice inline>{failure.message}</ErrorNotice>
          <Note>{/in use|EADDRINUSE/i.test(failure.message) ? m.portInUse : m.nothingLeft}</Note>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={onRetry}>
              {m.tryAgain}
            </Button>
            <Button size="sm" variant="ghost" onClick={onBack}>
              {m.back}
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
      <span className="mb-1 block text-[0.85rem] font-medium text-ink-dim">{label}</span>
      <CopyField value={value} label={copyLabel} />
    </div>
  )
}

function Copy({ step, tool, server }: { step: AppStep; tool: CatalogTool; server: McpServerStatus }) {
  const m = useMessages(connectMessages).copy
  if (step.copy === "url" && server.connectorUrl) return <CopyField value={server.connectorUrl} label={m.address} />
  if (step.copy === "name") return <CopyField value={connectorName(tool)} label={m.name} />
  if (step.copy === "code")
    return server.loginCode ? (
      <LoginCode server={{ ...server, loginCode: server.loginCode }} />
    ) : (
      <Note>{m.codeSoon}</Note>
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
  const all = useMessages(connectMessages)
  const m = all.reach
  const name = app && app !== "other" ? all.apps[app].name : all.theApp
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
        {m.intro(
          app ? all.apps[app].name : name,
          tool.bin,
          <span className="selectable font-mono text-ink">{host}</span>,
        )}
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
              ? m.publishingFunnel
              : m.publishingDns
            : reach.state === "unknown"
              ? m.dnsUnknown
              : reach.state === "checking"
                ? m.asking
                : m.published}
        </Progress>
      </ul>
      {reach.state === "publishing" && (
        <div className="flex max-w-[34rem] flex-col gap-1.5">
          <div
            className="h-1.5 overflow-hidden rounded-full bg-app-3"
            role="progressbar"
            aria-label={m.barLabel}
            aria-valuemin={0}
            aria-valuemax={10}
            aria-valuenow={minutes}
            aria-valuetext={m.barValue(minutes)}
          >
            <div
              className="h-full rounded-full bg-brand transition-[width] duration-1000 ease-linear"
              style={{ width: `${Math.max(share * 100, 2)}%` }}
            />
          </div>
          <Note>{m.wait(funnel, minutes, name)}</Note>
          {share >= 1 && <p className="text-[0.9rem] text-warn-ink">{funnel ? m.slowFunnel : m.slowDns(host)}</p>}
        </div>
      )}
      {reach.state === "live" && !reach.tested && <Note>{m.selfUnreachable(name)}</Note>}
      {reach.state === "wrong" && (
        <>
          <ErrorNotice inline>
            {funnel ? m.wrongFunnel(tool.bin, reach.status) : m.wrongTunnel(tool.bin, reach.status, name)}
          </ErrorNotice>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={check} disabled={checking}>
              {checking ? m.checking : m.again}
            </Button>
            <Button size="sm" variant="ghost" onClick={onGoOn}>
              {m.goOn}
            </Button>
          </div>
        </>
      )}
      {reach.state === "unknown" && (
        <>
          <Para>{m.unknownHelp(name)}</Para>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="primary" onClick={onGoOn}>
              {m.goOnUnchecked}
            </Button>
            <Button size="sm" variant="ghost" onClick={check} disabled={checking}>
              {checking ? m.checking : m.again}
            </Button>
          </div>
        </>
      )}
      {error && (
        <>
          <ErrorNotice inline>{error}</ErrorNotice>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={check} disabled={checking}>
              {checking ? m.checking : m.again}
            </Button>
            <Button size="sm" variant="ghost" onClick={onGoOn}>
              {m.goOnUnchecked}
            </Button>
          </div>
        </>
      )}
    </>
  )
}

function ConnectStep(props: { tool: CatalogTool; app: AppId; server: McpServerStatus; onAdded(): void }) {
  const { tool, app, server, onAdded } = props
  const m = useMessages(connectMessages)
  const spec = APPS[app]
  const words = m.apps[app]
  return (
    <>
      <Para>{m.connect.intro(tool.bin, app === "other" ? m.theApp : words.name)}</Para>
      <ol className="flex flex-col gap-3">
        {spec.steps.map((step, i) => (
          <li key={step.text} className="grid grid-cols-[1.5rem_minmax(0,1fr)] gap-x-2 gap-y-1.5">
            <span className="pt-px text-[0.9rem] font-semibold text-ink-dim tabular-nums">{i + 1}.</span>
            <span className="text-[0.92rem] text-ink">
              {m.appSteps[step.text]}
              {step.link && (
                <>
                  {" "}
                  <Link href={step.link.href}>{m.appLinks[step.link.label]}</Link>
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
        {words.limits}
        {spec.help && (
          <>
            {" "}
            <Link href={spec.help}>{words.help}</Link>.
          </>
        )}
      </Note>
      <DiscoveryHelp tool={tool} app={app} />
      <div className="flex flex-wrap items-center gap-2 pt-1">
        <Button size="sm" variant="primary" onClick={onAdded}>
          {m.connect.added}
        </Button>
      </div>
    </>
  )
}

/** BUG-15: an app that does not find the login settings under a path can be given them by hand. */
function DiscoveryHelp({ tool, app }: { tool: CatalogTool; app: AppId }) {
  const [settings, setSettings] = useState<OAuthSettings | null>(null)
  const [error, setError] = useState<string | null>(null)
  const all = useMessages(connectMessages)
  const m = all.connect
  const name = app === "other" ? all.theApp : all.apps[app].name
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
      <Disclosure summary={m.discovery(name)}>
        <div className="flex flex-col gap-2.5">
          <Para>{m.discoveryWhy}</Para>
          <Note>{m.discoveryValues}</Note>
          {error && <ErrorNotice inline>{error}</ErrorNotice>}
          {settings && (
            <div className="grid gap-2.5 md:grid-cols-2">
              <Field label={m.authorization} value={settings.authorizationEndpoint} copyLabel={m.copyAuthorization} />
              <Field label={m.token} value={settings.tokenEndpoint} copyLabel={m.copyToken} />
              {settings.registrationEndpoint && (
                <Field label={m.registration} value={settings.registrationEndpoint} copyLabel={m.copyRegistration} />
              )}
              <Field label={m.issuer} value={settings.issuer} copyLabel={m.copyIssuer} />
            </div>
          )}
        </div>
      </Disclosure>
    </div>
  )
}

function FunnelOff(props: { tool: CatalogTool; port: number; name: string; reload(): Promise<void> }) {
  const { tool, port, name, reload } = props
  const m = useMessages(connectMessages).off
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
      <p className="text-[0.9rem] text-warn-ink">{m.funnel(name)}</p>
      {error && <ErrorNotice inline>{error}</ErrorNotice>}
      <div>
        <Button size="sm" onClick={turnOn} disabled={busy}>
          {busy ? m.turningOn : m.turnOn}
        </Button>
      </div>
    </div>
  )
}

/** cloudflared stops with the computer; the tools' servers too, but a server started again finds its tunnel off. */
function TunnelOff(props: { tool: CatalogTool; port: number; name: string; reload(): Promise<void> }) {
  const { tool, port, name, reload } = props
  const m = useMessages(connectMessages).off
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
      <p className="text-[0.9rem] text-warn-ink">{m.tunnel(name)}</p>
      {error && <ErrorNotice inline>{error}</ErrorNotice>}
      <div>
        <Button size="sm" onClick={turnOn} disabled={busy}>
          {busy ? m.starting : m.start}
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
  onAgain(): void
}) {
  const { tool, app, server, test, since, quietFromStart, onBack, onDone, onAgain } = props
  const all = useMessages(connectMessages)
  const m = all.test
  const lang = useLang()
  const name = app === "other" ? all.theApp : all.apps[app].name
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
              {m.loggedIn(appLabel(test.client, lang))} <span className="text-ink-dim">{m.selfNamed}</span>
            </>
          ) : (
            m.waitingLogin(name)
          )}
        </Progress>
        {counts || !loggedIn ? (
          <Progress state={test.state === "called" ? "done" : loggedIn ? "busy" : "todo"}>
            {test.state === "called" ? (
              <>
                {m.firstCall} <span className="selectable font-mono">{test.client.lastTool}</span>
                {test.client.lastToolAt && (
                  <span className="text-ink-dim tabular-nums">
                    {m.at(formatDate(test.client.lastToolAt, { hour: "2-digit", minute: "2-digit" }, lang))}
                  </span>
                )}
              </>
            ) : (
              m.waitingCall
            )}
          </Progress>
        ) : null}
      </ul>
      {!loggedIn && <Para>{m.finishLogin(name)}</Para>}
      {loggedIn && test.state !== "called" && (
        <div className="flex flex-col gap-2">
          <Para>{m.askNow(name, tool.name)}</Para>
          <div className="max-w-[34rem]">
            <CopyField value={testPrompt(tool, all)} label={m.copyPrompt} />
          </div>
          {!counts && <Note>{m.noCounts(tool.bin, name, tool.name)}</Note>}
        </div>
      )}
      {test.state === "called" && (
        <>
          <Para>{m.reached(all.apps[app].name, tool.bin)}</Para>
          <NextSteps tool={tool} name={name} onAgain={onAgain} />
        </>
      )}
      {!loggedIn && quiet && <Troubleshoot name={name} tool={tool} app={app} server={server} />}
      <div className="flex flex-wrap items-center gap-2 pt-1">
        {test.state === "called" || (loggedIn && !counts) ? (
          <Button size="sm" variant="primary" onClick={onDone}>
            {m.finish}
          </Button>
        ) : (
          <Button size="sm" variant="ghost" onClick={onBack}>
            {m.back(name)}
          </Button>
        )}
      </div>
    </>
  )
}

/** Rule 9: the goal is reached, so say what else is worth doing from here. */
function NextSteps({ tool, name, onAgain }: { tool: CatalogTool; name: string; onAgain(): void }) {
  const all = useMessages(connectMessages)
  const m = all.next
  const installs = useTools((s) => s.installs)
  const others = tools.filter((t) => t.mcpServer && t.id !== tool.id && (installs[t.id]?.length ?? 0) > 0)
  return (
    <div className="flex flex-col gap-2.5 rounded-[0.45rem] bg-app-2 px-4 py-3">
      <p className="text-[0.92rem] font-medium text-ink">{m.title}</p>
      <div className="flex max-w-[34rem] flex-col gap-1">
        <span className="text-[0.9rem] text-ink-soft">{m.ask(name)}</span>
        <CopyField value={testPrompt(tool, all)} label={m.copyPrompt} />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" onClick={onAgain}>
          {m.another}
        </Button>
        {others.map((t) => (
          <Button key={t.id} size="sm" variant="ghost" onClick={() => openConnect(t.id)}>
            {m.too(t.name)}
          </Button>
        ))}
        <Button size="sm" variant="ghost" onClick={() => useNav.getState().go("logs")}>
          {m.logs}
        </Button>
      </div>
    </div>
  )
}

function Troubleshoot(props: { name: string; tool: CatalogTool; app: AppId; server: McpServerStatus }) {
  const { name, tool, app, server } = props
  const m = useMessages(connectMessages).trouble
  return (
    <div className="flex flex-col gap-2 rounded-[0.45rem] bg-app-2 px-4 py-3">
      <p className="text-[0.92rem] font-medium text-ink">{m.title(name)}</p>
      <ul className="flex list-disc flex-col gap-1.5 pl-5 text-[0.88rem] text-ink-soft">
        <li>
          <span className="text-ink">{m.unreachable}</span>{" "}
          {m.unreachableFix(<span className="selectable font-mono text-ink">{server.connectorUrl}</span>)}
        </li>
        <li>
          <span className="text-ink">{m.badCode}</span> {m.badCodeFix}
        </li>
        <li>
          <span className="text-ink">{m.noPage}</span> {m.noPageFix(name)}
        </li>
      </ul>
      <DiscoveryHelp tool={tool} app={app} />
    </div>
  )
}
