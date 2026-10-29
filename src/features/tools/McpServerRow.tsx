import { useEffect, useState } from "react"
import type { CatalogTool } from "@/domain/catalog"
import { formatDate, type Lang, useLang, useMessages } from "@/i18n"
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
import { mcpMessages } from "./messages-mcp"

type Words = (typeof mcpMessages)["en"]["row"]

export type RowState =
  | { state: "loading" }
  | { state: "ready"; data: McpServerStatus }
  | { state: "error"; message: string }

type Busy = "stopping" | "copying" | "closing" | null

const message = (e: unknown) => (e instanceof Error ? e.message : String(e))

const clock = (iso: string, lang: Lang) => {
  const when = new Date(iso)
  const today = when.toDateString() === new Date().toDateString()
  return formatDate(
    when,
    today ? { hour: "2-digit", minute: "2-digit" } : { dateStyle: "short", timeStyle: "short" },
    lang,
  )
}

function lampOf(row: RowState, busy: Busy, m: Words): { tone: LampTone; label: string } {
  if (busy === "stopping" || row.state === "loading") return { tone: "busy", label: m.checking }
  if (row.state === "error") return { tone: "bad", label: m.unreadable }
  const s = row.data
  if (!s.available) return { tone: "idle", label: m.unavailable }
  if (!s.running) return { tone: "idle", label: m.off }
  if (s.outdated || !s.listening) return { tone: "warn", label: s.outdated ? m.older : m.starting }
  return { tone: "ok", label: m.running }
}

function stateText(s: McpServerStatus, tool: CatalogTool, m: Words, lang: Lang) {
  if (!s.available) return m.later(tool.name)
  if (!s.running) return m.off
  return m.state(s.listening, s.startedAt ? clock(s.startedAt, lang) : null, String(s.port ?? "?"), !s.startedHere)
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
  const m = useMessages(mcpMessages).row
  const lang = useLang()
  const lamp = lampOf(row, busy, m)

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
          {data ? stateText(data, tool, m, lang) : row.state === "error" ? m.unreadable : <Skeleton chars={22} />}
        </span>
        <span className="ml-auto flex gap-2">
          {data?.available && !data.running && (
            <Button size="sm" onClick={onStart} aria-label={m.startLabel(name)}>
              {m.start}
            </Button>
          )}
          {data?.running && data.startedHere && (
            <Button size="sm" onClick={stop} disabled={busy !== null} aria-label={m.stopLabel(name)}>
              {busy === "stopping" ? m.stopping : m.stop}
            </Button>
          )}
          {row.state === "error" && (
            <Button size="sm" variant="ghost" onClick={reload}>
              {m.again}
            </Button>
          )}
        </span>
      </div>
      {row.state === "error" && <ErrorNotice inline>{row.message}</ErrorNotice>}
      {failure && <ErrorNotice inline>{failure}</ErrorNotice>}
      {data?.running && !data.startedHere && <p className="text-[0.9rem] text-ink-soft">{m.inTerminal}</p>}
      {data?.outdated && <p className="text-[0.9rem] text-warn-ink">{m.outdated(tool.bin)}</p>}
      {data && funnel && <FunnelLine data={data} funnel={funnel} busy={busy} m={m} onClose={closeFunnel} />}
      {data?.running && route && data.connectorUrl?.startsWith(route.url) && (
        <p className={cx("pl-[1.6rem] text-[0.9rem]", route.live ? "text-ink-soft" : "text-warn-ink")}>
          {route.live ? m.tunnelLive : m.tunnelOff}
        </p>
      )}
      {!funnel?.live &&
        leftovers.map((old) => (
          <div key={old.url} className="flex flex-wrap items-center gap-x-3 gap-y-2 pl-[1.6rem]">
            <p className="text-[0.9rem] text-warn-ink">
              {m.leftover(<span className="selectable font-mono">{old.url}</span>, old.profile ?? null)}
            </p>
            <Button size="sm" onClick={closeFunnel} disabled={busy !== null}>
              {busy === "closing" ? m.turningOff : m.turnOff}
            </Button>
          </div>
        ))}
      {data?.running && <Running data={data} m={m} lang={lang} />}
      {data?.available && (data.clients.length > 0 || data.running) && (
        <Clients data={data} m={m} lang={lang} onForget={() => setForgetting(true)} />
      )}
      {data?.available && tool.mcpServer?.config && (
        <div className="pl-[1.6rem]">
          <Button size="sm" variant="ghost" onClick={copyConfig} disabled={busy !== null}>
            {busy === "copying" ? m.copying : m.copyConfig}
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

function FunnelLine(props: { data: McpServerStatus; funnel: FunnelState; busy: Busy; m: Words; onClose(): void }) {
  const { data, funnel, busy, m, onClose } = props
  const ours = data.connectorUrl?.startsWith(funnel.url) ?? false
  if (data.running && funnel.live && ours)
    return <p className="pl-[1.6rem] text-[0.9rem] text-ink-soft">{m.funnelLive}</p>
  if (data.running && !funnel.live && ours)
    return <p className="pl-[1.6rem] text-[0.9rem] text-warn-ink">{m.funnelOff}</p>
  if (!data.running && funnel.live)
    return (
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 pl-[1.6rem]">
        <p className="text-[0.9rem] text-warn-ink">
          {m.funnelLeft(<span className="selectable font-mono">{funnel.url}</span>)}
        </p>
        <Button size="sm" onClick={onClose} disabled={busy !== null}>
          {busy === "closing" ? m.turningOff : m.turnFunnelOff}
        </Button>
      </div>
    )
  return null
}

function Running({ data, m, lang }: { data: McpServerStatus; m: Words; lang: Lang }) {
  return (
    <div className="grid gap-3 pl-[1.6rem] md:grid-cols-2">
      {data.connectorUrl && (
        <div className="min-w-0">
          <h5 className="mb-1.5 text-[0.9rem] font-medium text-ink-dim">{m.address}</h5>
          <CopyField value={data.connectorUrl} label={m.copyAddress} />
        </div>
      )}
      <div className="min-w-0">
        <h5 className="mb-1.5 text-[0.9rem] font-medium text-ink-dim">
          {m.code}
          {data.loginCode && <span className="font-normal">{m.until(clock(data.loginCode.expiresAt, lang))}</span>}
        </h5>
        {data.loginCode ? (
          <LoginCode server={{ ...data, loginCode: data.loginCode }} />
        ) : (
          <p className="text-[0.9rem] text-ink-soft">{m.noCode}</p>
        )}
      </div>
    </div>
  )
}

function Clients(props: { data: McpServerStatus; m: Words; lang: Lang; onForget(): void }) {
  const { data, m, lang, onForget } = props
  return (
    <div className="flex flex-col gap-1.5 pl-[1.6rem]">
      <h5 className="text-[0.9rem] font-medium text-ink-dim">{m.apps}</h5>
      {data.clients.length === 0 ? (
        <p className="text-[0.9rem] text-ink-soft">{m.none}</p>
      ) : (
        <>
          <ul className="flex flex-col gap-1 text-[0.875rem]">
            {data.clients.map((c) => (
              <li key={`${c.claimedName}-${c.lastLoginAt}`} className="flex flex-wrap gap-x-2">
                <span className="text-ink">
                  {c.claimedName === null
                    ? m.noName
                    : m.callsItself(<span className="selectable font-mono">“{c.claimedName}”</span>)}
                </span>
                <span className="text-ink-dim tabular-nums">
                  {m.lastLogin(clock(c.lastLoginAt, lang))}
                  {c.lastTool ? ` · ${activityOf(c, Date.now(), lang)}` : ""}
                </span>
              </li>
            ))}
          </ul>
          <p className="max-w-[70ch] text-[0.85rem] text-ink-dim">{m.anyName}</p>
          <div>
            <Button size="sm" variant="danger" onClick={onForget}>
              {m.forget}
            </Button>
          </div>
        </>
      )}
    </div>
  )
}
