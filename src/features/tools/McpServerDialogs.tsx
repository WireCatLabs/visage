import { useEffect, useId, useState } from "react"
import type { CatalogTool } from "@/domain/catalog"
import { platform } from "@/platform/bridge"
import type { McpServerStatus } from "@/platform/mcp-server-schemas"
import { Button } from "@/ui/Button"
import { Dialog } from "@/ui/Dialog"
import { ErrorNotice } from "@/ui/ErrorNotice"

const message = (e: unknown) => (e instanceof Error ? e.message : String(e))
const DEFAULT_PORT = 8765

/** Rust checks both again; this only keeps an obvious typo from a round trip. */
export function formProblem(url: string, port: string): string | null {
  const local = /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?\/?$/.test(url)
  if (!local && !/^https:\/\/[a-z0-9.-]+(:\d+)?\/?$/i.test(url))
    return "Type the tunnel's https address alone, such as https://laptop.tail1234.ts.net"
  const n = Number(port)
  if (!Number.isInteger(n) || n < 1024 || n > 65535) return "Choose a port from 1024 to 65535"
  return null
}

const inputClass =
  "h-8 rounded-[0.35rem] border border-line-strong bg-app px-2.5 font-mono text-[0.8rem] text-ink placeholder:font-sans placeholder:text-ink-dim"

export function StartServer(props: {
  tool: CatalogTool
  profile: string | null
  open: boolean
  onClose(): void
  onStarted(s: McpServerStatus): void
}) {
  const { tool, profile, open, onClose, onStarted } = props
  const id = useId()
  const [url, setUrl] = useState("")
  const offered = String(tool.mcpServer?.port ?? DEFAULT_PORT)
  const [port, setPort] = useState(offered)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const name = profile ? `${tool.bin} ${profile}` : tool.bin

  useEffect(() => {
    if (open) setError(null)
  }, [open])

  const start = async () => {
    const problem = formProblem(url.trim(), port)
    if (problem) {
      setError(problem)
      return
    }
    setBusy(true)
    setError(null)
    try {
      onStarted(await platform.mcpServerStart(tool.id, profile, Number(port), url.trim().replace(/\/$/, "")))
    } catch (e) {
      setError(message(e))
    }
    setBusy(false)
  }

  return (
    <Dialog
      open={open}
      title={`Start the MCP server for ${name}`}
      onClose={busy ? () => {} : onClose}
      actions={
        <>
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button type="submit" form={`${id}-form`} disabled={busy}>
            {busy ? "Starting…" : "Start"}
          </Button>
        </>
      }
    >
      <form
        id={`${id}-form`}
        className="flex flex-col gap-3"
        onSubmit={(e) => {
          e.preventDefault()
          start()
        }}
      >
        <p>
          It runs in the background until you stop it, and listens only on this computer. Your tunnel, such as Tailscale
          Funnel or cloudflared, makes it reachable from the internet for the browser app.
        </p>
        <label className="flex flex-col gap-1" htmlFor={`${id}-url`}>
          <span className="text-[0.85rem] font-medium text-ink-dim">The tunnel's address</span>
          <input
            id={`${id}-url`}
            className={`${inputClass} w-full`}
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://laptop.tail1234.ts.net"
            autoComplete="off"
            spellCheck={false}
            autoFocus
          />
        </label>
        <div className="flex flex-col gap-1">
          <label className="flex flex-col gap-1" htmlFor={`${id}-port`}>
            <span className="text-[0.85rem] font-medium text-ink-dim">Port on this computer</span>
            <input
              id={`${id}-port`}
              className={`${inputClass} w-28`}
              value={port}
              onChange={(e) => setPort(e.target.value)}
              inputMode="numeric"
            />
          </label>
          <span className="text-[0.8rem] text-ink-dim">
            Point the tunnel at 127.0.0.1:{port || offered}. Each running server needs a port of its own.
          </span>
        </div>
        <p className="text-[0.85rem]">
          A browser app that logs in can do what this profile's permissions allow, including sending.
        </p>
        <div className="min-h-[1.5rem]">{error && <ErrorNotice inline>{error}</ErrorNotice>}</div>
      </form>
    </Dialog>
  )
}

export function ForgetLogins(props: {
  tool: CatalogTool
  profile: string | null
  open: boolean
  onClose(): void
  onDone(): void
}) {
  const { tool, profile, open, onClose, onDone } = props
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const name = profile ? `${tool.bin} ${profile}` : tool.bin

  useEffect(() => {
    if (open) setError(null)
  }, [open])

  const forget = async () => {
    setBusy(true)
    try {
      await platform.mcpServerRevoke(tool.id, profile)
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
