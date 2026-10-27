import { useEffect, useState } from "react"
import type { CatalogTool } from "@/domain/catalog"
import { platform } from "@/platform/bridge"
import type { TunnelRoute } from "@/platform/cloudflare-schemas"
import type { McpServerStatus } from "@/platform/mcp-server-schemas"
import type { FunnelState } from "@/platform/tailscale-schemas"
import { Button } from "@/ui/Button"
import { CopyField } from "@/ui/CopyField"
import { cx } from "@/ui/cx"
import { ErrorNotice } from "@/ui/ErrorNotice"
import { Lamp, type LampTone } from "@/ui/Lamp"
import { Skeleton } from "@/ui/Skeleton"
import { activityOf } from "./connect-steps"
import { LoginCode } from "./LoginCode"
import { ForgetLogins } from "./McpServerDialogs"

export type RowState =
  | { state: "loading" }
  | { state: "ready"; data: McpServerStatus }
  | { state: "error"; message: string }

type Busy = "stopping" | "copying" | "closing" | null

const message = (e: unknown) => (e instanceof Error ? e.message : String(e))

const clock = (iso: string) => {
  const when = new Date(iso)
  const time = when.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
  return when.toDateString() === new Date().toDateString() ? time : `${when.toLocaleDateString()} ${time}`
}

function lampOf(row: RowState, busy: Busy): { tone: LampTone; label: string } {
  if (busy === "stopping" || row.state === "loading") return { tone: "busy", label: "Checking" }
  if (row.state === "error") return { tone: "bad", label: "Could not read it" }
  const s = row.data
  if (!s.available) return { tone: "idle", label: "Not available yet" }
  if (!s.running) return { tone: "idle", label: "Off" }
  if (s.outdated || !s.listening) return { tone: "warn", label: s.outdated ? "Runs an older version" : "Starting" }
  return { tone: "ok", label: "Running" }
}

function stateText(s: McpServerStatus, tool: CatalogTool) {
  if (!s.available) return `Arrives with the next update of ${tool.name}`
  if (!s.running) return "Off"
  const since = s.startedAt ? ` since ${clock(s.startedAt)}` : ""
  return `${s.listening ? "Running" : "Starting"}${since} on port ${s.port ?? "?"}${s.startedHere ? "" : ", started in a terminal"}`
}

export function McpServerRow(props: {
  tool: CatalogTool
  row: RowState
  /** The Tailscale Funnel the app set up for this server, if any. */
  funnel: FunnelState | null
  /** The tool's paths on the Cloudflare tunnel the app runs, if any. */
  route: TunnelRoute | null
  /** Whole-port funnels from when a server spoke for one profile, still on. */
  leftovers: FunnelState[]
  reload(): void
  /** Opens the "Connect an AI app" guide, which starts the server. */
  onStart(): void
}) {
  const { tool, row, funnel, route, leftovers, reload, onStart } = props
  const [busy, setBusy] = useState<Busy>(null)
  const [failure, setFailure] = useState<string | null>(null)
  const [forgetting, setForgetting] = useState(false)
  const name = tool.bin
  const data = row.state === "ready" ? row.data : null
  const lamp = lampOf(row, busy)

  // The tool renews the code when it runs out; read the new one then, so the one on screen always works.
  const expiresAt = data?.loginCode?.expiresAt
  useEffect(() => {
    if (!expiresAt) return
    const wait = Math.max(Date.parse(expiresAt) - Date.now() + 1500, 1000)
    const t = setTimeout(reload, wait)
    return () => clearTimeout(t)
  }, [expiresAt, reload])

  const stop = async () => {
    setBusy("stopping")
    setFailure(null)
    try {
      await platform.mcpServerStop(tool.id)
      if (funnel?.live) await platform.tailscaleFunnelClose(tool.id)
      if (route) await platform.cloudflareTunnelClose(tool.id)
    } catch (e) {
      setFailure(message(e))
    }
    setBusy(null)
    reload()
  }

  const closeFunnel = async () => {
    setBusy("closing")
    setFailure(null)
    try {
      await platform.tailscaleFunnelClose(tool.id)
    } catch (e) {
      setFailure(message(e))
    }
    setBusy(null)
    reload()
  }

  const copyConfig = async () => {
    setBusy("copying")
    setFailure(null)
    try {
      await navigator.clipboard.writeText(await platform.mcpServerConfig(tool.id))
    } catch (e) {
      setFailure(message(e))
    }
    setBusy(null)
  }

  return (
    <li className="flex flex-col gap-3 px-4 py-3">
      <div className="flex min-h-8 flex-wrap items-center gap-x-3 gap-y-2">
        <Lamp tone={lamp.tone} size="sm" label={lamp.label} />
        <span className="selectable font-mono text-[0.95rem] text-ink">{name}</span>
        <span className="min-w-0 text-[0.9rem] text-ink-soft tabular-nums">
          {data ? stateText(data, tool) : row.state === "error" ? "Could not read it" : <Skeleton chars={22} />}
        </span>
        <span className="ml-auto flex gap-2">
          {data?.available && !data.running && (
            <Button size="sm" onClick={onStart} aria-label={`Start the MCP server for ${name}`}>
              Start
            </Button>
          )}
          {data?.running && data.startedHere && (
            <Button size="sm" onClick={stop} disabled={busy !== null} aria-label={`Stop the MCP server for ${name}`}>
              {busy === "stopping" ? "Stopping…" : "Stop"}
            </Button>
          )}
          {row.state === "error" && (
            <Button size="sm" variant="ghost" onClick={reload}>
              Check again
            </Button>
          )}
        </span>
      </div>
      {row.state === "error" && <ErrorNotice inline>{row.message}</ErrorNotice>}
      {failure && <ErrorNotice inline>{failure}</ErrorNotice>}
      {data?.running && !data.startedHere && (
        <p className="text-[0.85rem] text-ink-soft">It was started in a terminal, so stop it there.</p>
      )}
      {data?.outdated && (
        <p className="text-[0.85rem] text-warn-ink">
          It runs an older version of {tool.bin}. Stop and start it to update.
        </p>
      )}
      {data && funnel && <FunnelLine data={data} funnel={funnel} busy={busy} onClose={closeFunnel} />}
      {data?.running && route && data.connectorUrl?.startsWith(route.url) && (
        <p className={cx("pl-[1.6rem] text-[0.85rem]", route.live ? "text-ink-soft" : "text-warn-ink")}>
          {route.live
            ? "Reachable from the internet through your Cloudflare tunnel, which WireCat runs. Stop takes it off the tunnel."
            : "Your Cloudflare tunnel is off, so browser apps cannot reach the server. Stop and start it to start the tunnel again."}
        </p>
      )}
      {!funnel?.live &&
        leftovers.map((old) => (
          <div key={old.url} className="flex flex-wrap items-center gap-x-3 gap-y-2 pl-[1.6rem]">
            <p className="text-[0.85rem] text-warn-ink">
              An older Tailscale Funnel{old.profile ? ` for profile ${old.profile}` : ""} still sends{" "}
              <span className="selectable font-mono">{old.url}</span> to this computer. Starting the server replaces it.
            </p>
            <Button size="sm" onClick={closeFunnel} disabled={busy !== null}>
              {busy === "closing" ? "Turning off…" : "Turn it off"}
            </Button>
          </div>
        ))}
      {data?.running && <Running data={data} />}
      {data?.available && (data.clients.length > 0 || data.running) && (
        <Clients data={data} onForget={() => setForgetting(true)} />
      )}
      {data?.available && tool.mcpServer?.config && (
        <div className="pl-[1.6rem]">
          <Button size="sm" variant="ghost" onClick={copyConfig} disabled={busy !== null}>
            {busy === "copying" ? "Copying…" : "Copy config for desktop apps"}
          </Button>
        </div>
      )}
      <ForgetLogins
        tool={tool}
        open={forgetting}
        onClose={() => setForgetting(false)}
        onDone={() => {
          setForgetting(false)
          reload()
        }}
      />
    </li>
  )
}

function FunnelLine(props: { data: McpServerStatus; funnel: FunnelState; busy: Busy; onClose(): void }) {
  const { data, funnel, busy, onClose } = props
  const ours = data.connectorUrl?.startsWith(funnel.url) ?? false
  if (data.running && funnel.live && ours)
    return (
      <p className="pl-[1.6rem] text-[0.85rem] text-ink-soft">
        Reachable from the internet through Tailscale Funnel, which WireCat set up. Stop turns it off.
      </p>
    )
  if (data.running && !funnel.live && ours)
    return (
      <p className="pl-[1.6rem] text-[0.85rem] text-warn-ink">
        Tailscale Funnel for this address is off, so browser apps cannot reach the server. Stop and start it to turn
        Funnel on again.
      </p>
    )
  if (!data.running && funnel.live)
    return (
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 pl-[1.6rem]">
        <p className="text-[0.85rem] text-warn-ink">
          Tailscale Funnel still sends <span className="selectable font-mono">{funnel.url}</span> to this computer,
          though the server is off.
        </p>
        <Button size="sm" onClick={onClose} disabled={busy !== null}>
          {busy === "closing" ? "Turning off…" : "Turn Funnel off"}
        </Button>
      </div>
    )
  return null
}

function Running({ data }: { data: McpServerStatus }) {
  return (
    <div className="grid gap-3 pl-[1.6rem] md:grid-cols-2">
      {data.connectorUrl && (
        <div className="min-w-0">
          <h5 className="mb-1.5 text-[0.85rem] font-medium text-ink-dim">Address for the browser app</h5>
          <CopyField value={data.connectorUrl} label="Copy the connector address" />
        </div>
      )}
      <div className="min-w-0">
        <h5 className="mb-1.5 text-[0.85rem] font-medium text-ink-dim">
          Login code
          {data.loginCode && <span className="font-normal"> · until {clock(data.loginCode.expiresAt)}</span>}
        </h5>
        {data.loginCode ? (
          <LoginCode server={{ ...data, loginCode: data.loginCode }} />
        ) : (
          <p className="text-[0.85rem] text-ink-soft">Not shown yet. It appears once the server listens.</p>
        )}
      </div>
    </div>
  )
}

function Clients({ data, onForget }: { data: McpServerStatus; onForget(): void }) {
  return (
    <div className="flex flex-col gap-1.5 pl-[1.6rem]">
      <h5 className="text-[0.85rem] font-medium text-ink-dim">Logged-in apps</h5>
      {data.clients.length === 0 ? (
        <p className="text-[0.85rem] text-ink-soft">None yet.</p>
      ) : (
        <>
          <ul className="flex flex-col gap-1 text-[0.875rem]">
            {data.clients.map((c) => (
              <li key={`${c.claimedName}-${c.lastLoginAt}`} className="flex flex-wrap gap-x-2">
                <span className="text-ink">
                  {c.claimedName === null ? (
                    "An app with no name"
                  ) : (
                    <>
                      Calls itself <span className="selectable font-mono">“{c.claimedName}”</span>
                    </>
                  )}
                </span>
                <span className="text-ink-dim tabular-nums">
                  last login {clock(c.lastLoginAt)}
                  {c.lastTool ? ` · ${activityOf(c)}` : ""}
                </span>
              </li>
            ))}
          </ul>
          <p className="max-w-[70ch] text-[0.8rem] text-ink-dim">
            Any app can give itself any name. If you do not recognise one, forget all logins.
          </p>
          <div>
            <Button size="sm" variant="danger" onClick={onForget}>
              Forget all logins
            </Button>
          </div>
        </>
      )}
    </div>
  )
}
