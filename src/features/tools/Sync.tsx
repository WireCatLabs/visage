import { AlertTriangle, CheckCircle2, CircleStop, LoaderCircle, RefreshCw, X } from "lucide-react"
import { useEffect } from "react"
import { type CatalogTool, ownerId, signsInHere, syncNeedsProfile, syncsHere } from "@/domain/catalog"
import { toolStatus } from "@/domain/status"
import { advice, clock, type SyncFailure, type SyncWhat, share } from "@/domain/sync"
import { useMessages } from "@/i18n"
import { platform } from "@/platform/bridge"
import type { LastSync } from "@/platform/sync-schemas"
import { AutoHeight } from "@/ui/AutoHeight"
import { Button } from "@/ui/Button"
import { cx } from "@/ui/cx"
import { Skeleton, StableText } from "@/ui/Skeleton"
import { useLogs } from "../logs/store"
import { useNav } from "../nav"
import { ReportThis } from "../report/ReportThis"
import { useSignIn } from "../signin/store"
import { useElapsed } from "../storage/useElapsed"
import { ago } from "./connect-steps"
import { type SyncText, syncMessages } from "./messages-sync"
import { useTools } from "./store"
import { blockedBy, type SyncRun, syncKey, useSync } from "./sync-store"

type Words = SyncText

const NO_FAILURE: SyncFailure = { message: "", code: null, reason: null, run: null }

/**
 * "Last synced 12 min ago". With no time the tool still may have synced: a run log keeps a success only when asked
 * (`--record`, which the app passes), and drive sets its time only once nothing is left to fetch.
 */
export function lastLine(last: LastSync, what: SyncWhat, m: Words): string {
  if (!last.known) return m.lastUnknown
  const left = last.left && last.left > 0 ? m.left(what, last.left) : null
  if (last.at) return [m.lastSynced(ago(last.at)), left].filter(Boolean).join(" · ")
  return left ? m.notFinished(left) : m.noneRecorded
}

/** One profile's sync in the Manage panel: the button, when it last ran, its progress and its result. */
export function SyncControl({ tool, profile }: { tool: CatalogTool; profile: string | null }) {
  const key = syncKey(tool.id, profile)
  const run = useSync((s) => s.runs[key])
  const last = useSync((s) => s.last[key])
  const blocked = useSync((s) => run?.phase !== "running" && blockedBy(s.runs, tool.id, profile))
  const { start, stop } = useSync.getState()
  const what: SyncWhat = tool.sync?.what ?? "messages"
  const running = run?.phase === "running"
  const m = useMessages(syncMessages).sync

  useEffect(() => {
    void useSync.getState().loadLast(tool.id, profile)
  }, [tool.id, profile])

  if (!syncsHere(tool)) return null
  const label = m.region(profile ? `${tool.name} ${profile}` : tool.name)

  return (
    <section className="flex flex-col gap-1.5" aria-label={label}>
      <div className="flex min-h-[2.25rem] items-center gap-3">
        <div className="min-w-0 flex-1" aria-live="polite">
          {running ? (
            <Progress run={run} m={m} />
          ) : run ? (
            <Outcome run={run} what={what} m={m} />
          ) : last ? (
            <p className="truncate text-[0.875rem] text-ink-soft tabular-nums">{lastLine(last, what, m)}</p>
          ) : (
            <Skeleton chars={22} label={m.readingLast} />
          )}
        </div>
        {running ? (
          <Button
            size="sm"
            variant="secondary"
            onClick={() => stop(tool.id, profile)}
            disabled={run.stopping}
            icon={<CircleStop className="size-4" aria-hidden />}
          >
            <StableText value={run.stopping ? m.stopping : m.stop} variants={[m.stop, m.stopping]} />
          </Button>
        ) : (
          <Button
            size="sm"
            variant={run ? "secondary" : "primary"}
            onClick={() => start(tool.id, profile)}
            disabled={blocked}
            title={blocked ? m.anotherRunning : undefined}
            icon={<RefreshCw className="size-4" aria-hidden />}
          >
            <StableText value={run ? m.syncAgain : m.syncNow} variants={[m.syncNow, m.syncAgain]} />
          </Button>
        )}
      </div>
      <AutoHeight swap={running ? "running" : (run?.phase ?? "idle")}>
        {run && !running ? <Next run={run} tool={tool} profile={profile} what={what} m={m} /> : null}
      </AutoHeight>
    </section>
  )
}

function Progress({ run, m }: { run: SyncRun; m: Words }) {
  const elapsed = useElapsed(run.startedAt)
  const counted = run.progress ? m.progress(run.progress) : null
  const stage = run.stopping ? m.stoppingKeeping : (counted ?? run.stage ?? m.starting)
  const pct = run.stopping ? null : share(run.progress)
  return (
    <div className="flex flex-col gap-1">
      <div
        role="progressbar"
        aria-label={m.syncing}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pct ?? undefined}
        aria-valuetext={stage}
        className="h-1.5 w-full max-w-[22rem] overflow-hidden rounded-full bg-app-3"
      >
        {pct === null ? (
          <div className="bar-indeterminate h-full rounded-full bg-brand" />
        ) : (
          <div
            className="h-full rounded-full bg-brand motion-safe:transition-[width] motion-safe:duration-300"
            style={{ width: `${Math.max(3, pct)}%` }}
          />
        )}
      </div>
      <p className="flex gap-2 text-[0.9rem] text-ink-soft tabular-nums">
        <span className="truncate">
          {stage}
          {counted ? "" : "…"}
        </span>
        <span className="shrink-0 font-mono text-ink-dim">{clock(elapsed)}</span>
      </p>
    </div>
  )
}

function Outcome({ run, what, m }: { run: SyncRun; what: SyncWhat; m: Words }) {
  const took = run.endedAt ? clock(run.endedAt - run.startedAt) : null
  if (run.phase === "done" && run.summary) {
    return (
      <p className="reveal flex items-center gap-2 text-[0.9rem] font-medium text-ink">
        <CheckCircle2 className="size-4 shrink-0 text-ok" aria-hidden />
        <span className="truncate">{m.result(what, run.summary)}</span>
        {took && (
          <span className="shrink-0 font-mono text-[0.85rem] font-normal text-ink-dim tabular-nums">{took}</span>
        )}
      </p>
    )
  }
  if (run.phase === "stopped") {
    return (
      <p className="reveal flex items-center gap-2 text-[0.9rem] font-medium text-ink">
        <CircleStop className="size-4 shrink-0 text-ink-soft" aria-hidden />
        {m.stopped}
      </p>
    )
  }
  return (
    <p className="reveal flex items-center gap-2 text-[0.9rem] font-medium text-ink">
      <AlertTriangle className="size-4 shrink-0 text-warn" aria-hidden />
      <span className="truncate">{m.advice[advice(run.failure ?? NO_FAILURE).kind]}</span>
    </p>
  )
}

function Next(props: { run: SyncRun; tool: CatalogTool; profile: string | null; what: SyncWhat; m: Words }) {
  const { run, tool: entry, profile, what, m } = props
  const dismiss = () => useSync.getState().dismiss(entry.id, profile)
  const outdated = useTools(
    (s) =>
      toolStatus(
        s.installs[entry.id],
        s.latest ? (s.latest[entry.id] ?? null) : undefined,
        s.sessions[ownerId(entry.id)],
      ).kind === "outdated",
  )
  const close = (
    <Button
      size="sm"
      variant="ghost"
      onClick={dismiss}
      aria-label={m.dismiss}
      icon={<X className="size-4" aria-hidden />}
    />
  )
  let body: React.ReactNode
  if (run.phase === "done" && run.summary) {
    body = <p>{m.next(what, run.summary) ?? m.done(what)}</p>
  } else if (run.phase === "stopped") {
    body = <p>{m.stoppedNext}</p>
  } else {
    const failure = run.failure ?? NO_FAILURE
    const a = advice(failure)
    body = (
      <div className="flex flex-col gap-2">
        <p>{m.adviceText(a.kind, profile ?? entry.name, failure.message, Boolean(a.logs))}</p>
        <div className="flex flex-wrap items-center gap-3">
          {a.signIn && entry.setup && profile && (
            <Button
              size="sm"
              onClick={() =>
                signsInHere(entry)
                  ? useSignIn.getState().start(entry.id, profile)
                  : platform.openSetup(entry.id, profile)
              }
            >
              {m.signIn}
            </Button>
          )}
          {a.update && outdated && (
            <Button size="sm" onClick={() => useTools.getState().install(entry.id)}>
              {m.update(entry.name)}
            </Button>
          )}
          {a.report && (
            <ReportThis
              what={`Syncing ${entry.name}`}
              tool={entry.id}
              error={failure.message || syncMessages.en.sync.adviceText("failed", "", "", false)}
            />
          )}
        </div>
        {(failure.code || failure.run) && (
          <div>
            <Button size="sm" variant="ghost" onClick={() => openRun(entry, failure.run)}>
              {m.openRun}
            </Button>
          </div>
        )}
      </div>
    )
  }
  return (
    <div
      className={cx(
        "reveal flex items-start gap-2 rounded-[0.35rem] px-3 py-2 text-[0.875rem] text-ink-soft",
        run.phase === "failed" ? "bg-warn/10" : "bg-app",
      )}
    >
      <div className="min-w-0 flex-1">{body}</div>
      {close}
    </div>
  )
}

/** The Logs page, at the failed run when the tool named it, else at this tool's failed syncs. */
function openRun(entry: CatalogTool, run: string | null) {
  const words = (entry.sync?.run ?? []).filter((w) => w !== "{profile}" && !w.startsWith("-"))
  const logs = useLogs.getState()
  logs.setQuery(run ? `run_id:${run}` : `command:"${words.join(" ")}" status:failed`)
  logs.setRange("all")
  useNav.getState().go("logs")
}

/** The Tools row's compact line: a running sync, its result, or when the only profile last synced. */
export function useRowSync(entry: CatalogTool, installed: boolean) {
  const profiles = useSync((s) => s.profiles[entry.id])
  useEffect(() => {
    if (installed) useSync.getState().loadRow(entry.id)
  }, [entry.id, installed])
  const single = !syncNeedsProfile(entry) ? null : profiles?.length === 1 ? (profiles[0] ?? null) : undefined
  const runs = useSync((s) => s.runs)
  const lastAll = useSync((s) => s.last)
  if (!installed || !syncsHere(entry)) return null
  const mine = Object.entries(runs).filter(([k]) => k.startsWith(`${entry.id}:`))
  const active = mine.find(([, r]) => r.phase === "running") ?? mine.at(-1)
  const profileOf = (k: string) => k.slice(entry.id.length + 1) || null
  if (active) return { profile: profileOf(active[0]), run: active[1], last: null, canStart: false }
  const last = single === undefined ? undefined : lastAll[syncKey(entry.id, single)]
  // Until the time is read the tagline stays, so the row never shows a placeholder in its place.
  if (single === undefined || !last) return null
  return { profile: single, run: null, last, canStart: true }
}

export function RowSyncLine({ entry, info }: { entry: CatalogTool; info: NonNullable<ReturnType<typeof useRowSync>> }) {
  const what = entry.sync?.what ?? "messages"
  const who = info.profile && syncNeedsProfile(entry) ? `${info.profile} · ` : ""
  const m = useMessages(syncMessages).sync
  const elapsed = useElapsed(info.run?.phase === "running" ? info.run.startedAt : null)
  if (info.run?.phase === "running") {
    return (
      <span className="flex min-w-0 items-center gap-2 tabular-nums">
        <LoaderCircle className="size-3.5 shrink-0 motion-safe:animate-spin text-brand" aria-hidden />
        <span className="truncate">
          {who}
          {info.run.stopping
            ? m.stopping
            : ((info.run.progress && m.progress(info.run.progress)) ?? `${info.run.stage ?? m.syncing}…`)}{" "}
          {clock(elapsed)}
        </span>
      </span>
    )
  }
  if (info.run) {
    const text =
      info.run.phase === "done" && info.run.summary
        ? m.result(what, info.run.summary)
        : info.run.phase === "stopped"
          ? m.rowStopped
          : m.rowFailed(m.advice[advice(info.run.failure ?? NO_FAILURE).kind])
    return (
      <span className="truncate">
        {who}
        {text}
      </span>
    )
  }
  return info.last ? (
    <span className="reveal truncate tabular-nums">
      {who}
      {lastLine(info.last, what, m)}
    </span>
  ) : null
}

/** The row's own Sync or Stop, beside the name, for a tool with one profile or none. */
export function RowSyncButton({
  entry,
  info,
}: {
  entry: CatalogTool
  info: NonNullable<ReturnType<typeof useRowSync>>
}) {
  const { start, stop } = useSync.getState()
  const running = info.run?.phase === "running"
  const name = info.profile ? `${entry.name} ${info.profile}` : entry.name
  const m = useMessages(syncMessages).sync
  if (!running && !info.canStart && !info.run) return null
  return (
    <button
      type="button"
      className="inline-flex size-9 items-center justify-center rounded-[0.35rem] text-ink-soft transition-colors duration-150 hover:bg-app-3 hover:text-ink disabled:opacity-45"
      aria-label={running ? m.stopSyncing(name) : m.syncNamed(name)}
      title={running ? m.stopTitle : m.syncNow}
      disabled={running && info.run?.stopping}
      onClick={() => (running ? stop(entry.id, info.profile) : start(entry.id, info.profile))}
    >
      {running ? (
        <CircleStop className="size-[1.15rem]" aria-hidden />
      ) : (
        <RefreshCw className="size-[1.15rem]" aria-hidden />
      )}
    </button>
  )
}
