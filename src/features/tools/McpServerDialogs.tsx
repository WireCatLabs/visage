import { useEffect, useId, useState } from "react"
import type { CatalogTool } from "@/domain/catalog"
import { platform } from "@/platform/bridge"
import type { McpServerStatus } from "@/platform/mcp-server-schemas"
import { Button } from "@/ui/Button"
import { Dialog } from "@/ui/Dialog"
import { ErrorNotice } from "@/ui/ErrorNotice"
import { TailscaleGuide, useTailscale } from "./TailscaleGuide"
import { stepsOf } from "./tailscale-steps"

const message = (e: unknown) => (e instanceof Error ? e.message : String(e))
const DEFAULT_PORT = 8765

/** Rust checks both again; this only keeps an obvious typo from a round trip. One plain path is the tool's share. */
export function formProblem(url: string, port: string): string | null {
  const path = "(/[a-z0-9_][a-z0-9._-]{0,39})?/?"
  const local = new RegExp(`^http://(localhost|127\\.0\\.0\\.1)(:\\d+)?${path}$`, "i").test(url)
  if (!local && !new RegExp(`^https://[a-z0-9.-]+(:\\d+)?${path}$`, "i").test(url))
    return "Type the tunnel's https address, such as https://laptop.tail1234.ts.net, or with a path of its own: …/tg"
  const n = Number(port)
  if (!Number.isInteger(n) || n < 1024 || n > 65535) return "Choose a port from 1024 to 65535"
  return null
}

const inputClass =
  "h-8 rounded-[0.35rem] border border-line-strong bg-app px-2.5 font-mono text-[0.8rem] text-ink placeholder:font-sans placeholder:text-ink-dim"

type Tunnel = "tailscale" | "own"
type Phase = "funnel" | "server" | null

export function StartServer(props: {
  tool: CatalogTool
  open: boolean
  onClose(): void
  onStarted(s: McpServerStatus): void
}) {
  const { tool, open, onClose, onStarted } = props
  const id = useId()
  const [tunnel, setTunnel] = useState<Tunnel>("tailscale")
  const [url, setUrl] = useState("")
  const offered = String(tool.mcpServer?.port ?? DEFAULT_PORT)
  const [port, setPort] = useState(offered)
  const [phase, setPhase] = useState<Phase>(null)
  const [approval, setApproval] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const tailscale = useTailscale(open && tunnel === "tailscale")
  const name = tool.bin
  const busy = phase !== null
  const ready = tailscale.status !== null && stepsOf(tailscale.status).every((s) => s.done)

  useEffect(() => {
    if (open) setError(null)
  }, [open])

  const startOwn = async () => {
    const problem = formProblem(url.trim(), port)
    if (problem) return setError(problem)
    setPhase("server")
    try {
      onStarted(await platform.mcpServerStart(tool.id, Number(port), url.trim().replace(/\/$/, "")))
    } catch (e) {
      setError(message(e))
    }
    setPhase(null)
  }

  // Funnel first, so a first-time approval in the browser happens before anything runs; the server's address is the
  // one Funnel got. A server that then fails to start takes its Funnel down with it.
  const startTailscale = async () => {
    const problem = formProblem("https://x.ts.net", port)
    if (problem) return setError(problem)
    setPhase("funnel")
    setApproval(null)
    try {
      const address = await platform.tailscaleFunnelOpen(tool.id, Number(port), setApproval)
      setUrl(address)
      setPhase("server")
      try {
        onStarted(await platform.mcpServerStart(tool.id, Number(port), address))
      } catch (e) {
        await platform.tailscaleFunnelClose(tool.id).catch(() => {})
        throw e
      }
    } catch (e) {
      if (message(e) !== "Stopped.") setError(message(e))
    }
    setPhase(null)
  }

  const cancel = () => {
    if (phase === "funnel") platform.tailscaleStop()
    else if (!busy) onClose()
  }

  return (
    <Dialog
      open={open}
      wide
      scroll
      title={`Start the MCP server for ${name}`}
      onClose={cancel}
      actions={
        <>
          <Button variant="ghost" onClick={cancel} disabled={phase === "server"}>
            {phase === "funnel" ? "Stop" : "Cancel"}
          </Button>
          <Button
            type="submit"
            form={`${id}-form`}
            variant="primary"
            disabled={busy || (tunnel === "tailscale" && !ready)}
          >
            {phase === "funnel" ? "Turning Funnel on…" : phase === "server" ? "Starting…" : "Start"}
          </Button>
        </>
      }
    >
      <form
        id={`${id}-form`}
        className="flex flex-col gap-4 pb-3"
        onSubmit={(e) => {
          e.preventDefault()
          if (tunnel === "tailscale") startTailscale()
          else startOwn()
        }}
      >
        <p>
          It runs in the background until you stop it, and listens only on this computer. A tunnel makes it reachable
          from the internet for the browser app.
        </p>
        <fieldset className="flex flex-col gap-2" disabled={busy}>
          <legend className="mb-2 text-[0.85rem] font-medium text-ink-dim">How the browser app reaches it</legend>
          <TunnelChoice
            name={`${id}-tunnel`}
            value="tailscale"
            checked={tunnel === "tailscale"}
            onChange={setTunnel}
            title="Tailscale Funnel, set up by WireCat"
            detail="A fixed address. The guide below walks you through it; most of it is one click."
          />
          <TunnelChoice
            name={`${id}-tunnel`}
            value="own"
            checked={tunnel === "own"}
            onChange={setTunnel}
            title="A tunnel I run myself"
            detail="cloudflared, ngrok or your own Tailscale Funnel: you type its https address."
          />
        </fieldset>
        {tunnel === "tailscale" ? (
          <TailscaleGuide tailscale={tailscale} tool={tool.id} />
        ) : (
          <label className="flex flex-col gap-1" htmlFor={`${id}-url`}>
            <span className="text-[0.85rem] font-medium text-ink-dim">The tunnel's address</span>
            <span className="text-[0.8rem] text-ink-dim">
              Add a path such as /{tool.id} when several tools share the address; the tunnel then also routes
              /.well-known/oauth-authorization-server/{tool.id} and /.well-known/oauth-protected-resource/{tool.id}{" "}
              here.
            </span>
            <input
              id={`${id}-url`}
              className={`${inputClass} w-full`}
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder={`https://laptop.tail1234.ts.net/${tool.id}`}
              autoComplete="off"
              spellCheck={false}
              data-autofocus
            />
          </label>
        )}
        <div className="flex flex-col gap-1">
          <label className="flex flex-col gap-1" htmlFor={`${id}-port`}>
            <span className="text-[0.85rem] font-medium text-ink-dim">Port on this computer</span>
            <input
              id={`${id}-port`}
              className={`${inputClass} w-28`}
              value={port}
              onChange={(e) => setPort(e.target.value)}
              inputMode="numeric"
              disabled={busy}
            />
          </label>
          <span className="text-[0.8rem] text-ink-dim">
            {tunnel === "own" ? `Point the tunnel at 127.0.0.1:${port || offered}. ` : ""}Each running server needs a
            port of its own.
          </span>
        </div>
        <p className="text-[0.85rem]">
          A browser app that logs in reaches every {tool.name} profile and can do what each profile's permissions allow,
          including sending.
        </p>
        <div className="min-h-[1.5rem]" aria-live="polite">
          {phase === "funnel" && approval && (
            <p className="text-[0.9rem] text-ink">
              Tailscale asks you to approve Funnel for your network in the page that opened in your browser.{" "}
              <button type="button" className="text-brand underline" onClick={() => platform.openUrl(approval)}>
                Open it again
              </button>
            </p>
          )}
          {phase === "server" && tunnel === "tailscale" && url && (
            <p className="text-[0.9rem]">
              Funnel is on at <span className="selectable font-mono text-ink">{url}</span>. Starting the server…
            </p>
          )}
          {error && <ErrorNotice inline>{error}</ErrorNotice>}
        </div>
      </form>
    </Dialog>
  )
}

function TunnelChoice(props: {
  name: string
  value: Tunnel
  checked: boolean
  onChange(v: Tunnel): void
  title: string
  detail: string
}) {
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-[0.45rem] border border-line px-3 py-2.5 has-[:checked]:border-brand has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-brand">
      <input
        type="radio"
        name={props.name}
        value={props.value}
        checked={props.checked}
        onChange={() => props.onChange(props.value)}
        className="mt-1 accent-brand"
      />
      <span className="flex flex-col">
        <span className="text-[0.95rem] font-medium text-ink">{props.title}</span>
        <span className="text-[0.85rem] text-ink-soft">{props.detail}</span>
      </span>
    </label>
  )
}

export function ForgetLogins(props: { tool: CatalogTool; open: boolean; onClose(): void; onDone(): void }) {
  const { tool, open, onClose, onDone } = props
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const name = tool.bin

  useEffect(() => {
    if (open) setError(null)
  }, [open])

  const forget = async () => {
    setBusy(true)
    try {
      await platform.mcpServerRevoke(tool.id)
      onDone()
    } catch (e) {
      setError(message(e))
    }
    setBusy(false)
  }

  return (
    <Dialog
      open={open}
      title={`Forget every login to ${name}?`}
      onClose={busy ? () => {} : onClose}
      actions={
        <>
          <Button variant="ghost" onClick={onClose} disabled={busy} autoFocus>
            Keep them
          </Button>
          <Button variant="danger" onClick={forget} disabled={busy}>
            {busy ? "Forgetting…" : "Forget all logins"}
          </Button>
        </>
      }
    >
      <p>Every browser app loses access at once and must log in again with a new code. The server keeps running.</p>
      {error && (
        <div className="mt-3">
          <ErrorNotice inline>{error}</ErrorNotice>
        </div>
      )}
    </Dialog>
  )
}
