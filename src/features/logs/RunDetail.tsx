import { ChevronRight } from "lucide-react"
import { Fragment, useState } from "react"
import { findTool } from "@/domain/catalog"
import {
  agentName,
  agentOf,
  clientOf,
  commandLine,
  errorOf,
  formatDuration,
  orderRecord,
  type Run,
  stepOf,
} from "@/domain/runs"
import { useMessages } from "@/i18n"
import type { RunEvent } from "@/platform/runs-schemas"
import { CopyField } from "@/ui/CopyField"
import { cx } from "@/ui/cx"
import { ErrorNotice } from "@/ui/ErrorNotice"
import { Lamp, type LampTone } from "@/ui/Lamp"
import { Pill } from "@/ui/Pill"
import { Skeleton } from "@/ui/Skeleton"
import { TextButton } from "@/ui/TextButton"
import { ReportThis } from "../report/ReportThis"
import { CopyValue, type FieldOf, JsonTree } from "./JsonTree"
import { logsMessages } from "./messages"
import { type LogsWords, toolName, viaName } from "./names"
import { RunFailure } from "./RunFailure"
import type { Detail } from "./store"

type Filter = (field: string, value: string, negate: boolean) => void

const NOT_FILTERABLE = new Set(["started_at", "completed_at", "directory", "event_count"])

// Indexes drop out of the path, because a field inside a list matches any of its elements.
const runField: FieldOf = (path) => {
  const keys = path.filter((k) => !/^\d+$/.test(k))
  return keys.length === 0 || NOT_FILTERABLE.has(keys[0] as string) ? null : keys.join(".")
}

// A run summary has no events, but it lists their operations and codes.
const eventField: FieldOf = (path) =>
  path.length === 1 ? ({ operation: "operations", error_code: "codes" }[path[0] as string] ?? null) : null

function noSteps(m: LogsWords, run: Run, service: string): string {
  const n = typeof run.requests === "number" ? run.requests : null
  if (run.status === "success") return m.succeededSummary
  if (n === 0) return m.stoppedBefore(service)
  if (n !== null) return m.requestsNotLogged(n, service)
  return m.noStepsLogged
}

type Props = { run: Run; detail: Detail | undefined; onFilter: Filter; onGroup: (field: string) => void }

export function RunDetail({ run, detail, onFilter, onGroup }: Props) {
  const m = useMessages(logsMessages)
  const { tool: _, cli_command: __, conversation: ___, ...summary } = run
  const item = detail?.item ?? null
  const { events = [], ...rest } = item ?? { ...summary, events: undefined }
  const record = orderRecord(rest)
  const json = JSON.stringify(item ? { ...record, events: item.events } : record, null, 2)
  const service = toolName(run.tool)
  const failure = run.status === "failed" || run.status === "partial" ? errorOf(run) : null
  const line = commandLine(run)

  return (
    <div className="flex flex-col gap-[1.1rem] border-line border-t bg-app-2/60 px-[1.3rem] pt-[1rem] pb-[1.3rem]">
      {failure && (
        <RunFailure
          error={failure}
          action={
            // The command line and stack can hold what the owner typed, so they stay in the private attachment; the
            // run id lets the team find them there.
            <ReportThis
              what={`Running a ${service} command`}
              tool={run.tool}
              error={`${[failure.class, failure.message].filter(Boolean).join(": ")} (run ${run.run_id})`}
            />
          }
        />
      )}
      <div className="flex flex-wrap items-center gap-x-[1.2rem] gap-y-2">
        <div className="min-w-[16rem] flex-1">
          <CopyField value={run.run_id} label={m.copyRunId} />
        </div>
        <Facts run={run} />
      </div>
      {line && <CommandLine run={run} line={line} onFilter={onFilter} />}

      <section aria-label={m.steps} className="flex flex-col gap-[0.5rem]">
        <div>
          <h4 className="text-[0.9rem] font-medium text-ink-dim">
            {m.stepsHeading(
              item ? (item.event_count ?? events.length) : null,
              typeof run.events_dropped === "number" && run.events_dropped > 0 ? run.events_dropped : null,
            )}
          </h4>
          <p className="text-[0.9rem] text-ink-dim">{m.stepsHelp(service)}</p>
        </div>
        {detail?.state === "loading" && <Skeleton className="h-[4.5rem] w-full" label={m.readingRun} />}
        {detail?.state === "error" && (
          <ErrorNotice
            action={<ReportThis what="Reading a run's details" tool={run.tool} error={detail.error ?? ""} />}
          >
            {m.couldNotReadRun(detail.error ?? "")}
          </ErrorNotice>
        )}
        {detail?.state === "ready" &&
          (events.length === 0 ? (
            <p className="text-[0.95rem] text-ink-soft">
              {noSteps(m, run, service)} {m.recordBelow}
            </p>
          ) : (
            <Events events={events} onFilter={onFilter} onGroup={onGroup} />
          ))}
      </section>

      <section aria-label={m.runRecord} className="flex flex-col gap-[0.5rem]">
        <div className="flex items-center justify-between gap-3">
          <h4 className="text-[0.9rem] font-medium text-ink-dim">{m.runRecord}</h4>
          <span className="flex items-center gap-1 text-[0.9rem] text-ink-dim">
            {m.copyJson}
            <CopyValue value={json} label={m.copyRunJson} />
          </span>
        </div>
        <div className="overflow-x-auto rounded-[0.45rem] border border-line bg-app py-[0.6rem] pr-[0.6rem] pl-[1.5rem]">
          <JsonTree value={record} fieldOf={runField} onFilter={onFilter} onGroup={onGroup} label={m.runRecord} />
        </div>
      </section>
    </div>
  )
}

function CommandLine({ run, line, onFilter }: { run: Run; line: string; onFilter: Filter }) {
  const m = useMessages(logsMessages)
  const agent = agentOf(run)
  const client = clientOf(run)
  const via = typeof run.via === "string" && run.via !== "cli" ? viaName(m, run.via) : null
  return (
    <section aria-label={m.commandLine} className="flex flex-col gap-[0.4rem]">
      <h4 className="text-[0.9rem] font-medium text-ink-dim">{m.commandLine}</h4>
      <CopyField value={line} label={m.copyCommandLine} />
      <p className="text-[0.9rem] text-ink-dim">
        {agent && (
          <>
            {m.startedBy({
              agent: (
                <button
                  type="button"
                  onClick={() => onFilter("agent", agent.kind, false)}
                  className="font-medium text-ink-soft hover:text-brand"
                >
                  {agent.kind === "mcp-client" && client ? client.name : agentName(agent.kind, m.mcpApp)}
                </button>
              ),
              client: client && agent.kind !== "mcp-client" ? client.name : null,
              via,
              session: agent.session && (
                <TextButton
                  onClick={() => onFilter("session_id", agent.session as string, false)}
                  title={m.onlyThisSession}
                  className="selectable font-mono text-ink-soft hover:text-brand"
                >
                  {agent.session}
                </TextButton>
              ),
            })}{" "}
          </>
        )}
        {m.masked}
      </p>
    </section>
  )
}

function Facts({ run }: { run: Run }) {
  const m = useMessages(logsMessages)
  const facts = [
    run.cli_version ? `${findTool(run.tool)?.bin ?? run.tool} ${String(run.cli_version)}` : null,
    typeof run.requests === "number" ? m.requests(run.requests) : null,
    run.duration_ms !== undefined ? formatDuration(run.duration_ms) : null,
    [run.runtime, run.platform, run.arch].filter(Boolean).join(" · ") || null,
  ].filter(Boolean)
  return (
    <p className="font-mono text-[0.9rem] text-ink-soft tabular-nums">
      {facts.map((f, i) => (
        <Fragment key={String(f)}>
          {i > 0 && <span className="px-[0.45rem] text-ink-dim">/</span>}
          <span className="selectable">{f}</span>
        </Fragment>
      ))}
    </p>
  )
}

const severityTone = (s: unknown): LampTone =>
  s === "error" || s === "fatal" ? "bad" : s === "warn" || s === "warning" ? "warn" : "idle"

const clock = (iso: unknown) => {
  if (typeof iso !== "string") return ""
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  const p = (n: number, w = 2) => String(n).padStart(w, "0")
  return `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}.${p(d.getMilliseconds(), 3)}`
}

function Events(props: { events: RunEvent[]; onFilter: Filter; onGroup: (field: string) => void }) {
  const { events, onFilter, onGroup } = props
  const m = useMessages(logsMessages)
  const [open, setOpen] = useState<number | null>(null)
  return (
    <div className="overflow-x-auto rounded-[0.45rem] border border-line bg-app">
      <table className="w-full min-w-[34rem] table-fixed border-collapse text-[0.95rem]">
        <colgroup>
          <col className="w-[1.8rem]" />
          <col className="w-[7.4rem]" />
          <col />
          <col className="w-[16rem]" />
          <col className="w-[8rem]" />
          <col className="w-[5rem]" />
        </colgroup>
        <thead>
          <tr className="text-left text-[0.9rem] text-ink-dim">
            <th className="sr-only">{m.details}</th>
            <th className="py-[0.4rem] font-medium">{m.time}</th>
            <th className="font-medium">{m.step}</th>
            <th className="font-medium">{m.details}</th>
            <th className="font-medium">{m.outcome}</th>
            <th className="pr-[0.8rem] text-right font-medium">{m.took}</th>
          </tr>
        </thead>
        <tbody>
          {events.map((e, i) => {
            const isOpen = open === i
            const dropped = stepOf(e).kind === "dropped"
            return (
              // biome-ignore lint/suspicious/noArrayIndexKey: events have no id and never reorder
              <Fragment key={i}>
                <tr
                  onClick={() => setOpen(isOpen ? null : i)}
                  className="cursor-pointer border-line border-t font-mono text-[0.9rem] hover:bg-app-2"
                >
                  <td className="pl-[0.4rem]">
                    <button
                      type="button"
                      aria-expanded={isOpen}
                      aria-label={m.stepDetails(i + 1)}
                      onClick={(ev) => {
                        ev.stopPropagation()
                        setOpen(isOpen ? null : i)
                      }}
                      className="grid size-[1.3rem] place-items-center rounded-[0.3rem] text-ink-dim hover:bg-app-3 hover:text-ink"
                    >
                      <ChevronRight
                        aria-hidden
                        className={cx("size-[0.85rem] transition-transform duration-150", isOpen && "rotate-90")}
                      />
                    </button>
                  </td>
                  <td className="py-[0.35rem] text-ink-soft tabular-nums">{clock(e.time)}</td>
                  <StepCells event={e} />
                  <td className={cx("truncate", e.outcome === "error" ? "text-bad" : "text-ink-soft")}>
                    {dropped ? "" : String(e.error_code ?? e.outcome ?? "")}
                  </td>
                  <td className="pr-[0.8rem] text-right text-ink-soft tabular-nums">
                    {typeof e.duration_ms === "number" ? formatDuration(e.duration_ms) : ""}
                  </td>
                </tr>
                {isOpen && (
                  <tr className="border-line border-t">
                    <td colSpan={6} className="bg-app-2/50 py-[0.5rem] pr-[0.6rem] pl-[2.6rem]">
                      <JsonTree
                        value={e}
                        fieldOf={eventField}
                        onFilter={onFilter}
                        onGroup={onGroup}
                        label={m.stepN(i + 1)}
                      />
                    </td>
                  </tr>
                )}
              </Fragment>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

const ARROW = { request: "→", response: "←" } as const

function StepCells({ event }: { event: RunEvent }) {
  const m = useMessages(logsMessages)
  const step = stepOf(event)
  if (step.kind === "dropped")
    return (
      <>
        <td className="truncate pr-[0.8rem] font-sans text-ink-soft" title={m.events["events.dropped"]}>
          {m.droppedSteps(step.dropped)}
        </td>
        <td />
      </>
    )
  const arrow = step.kind === "request" || step.kind === "response" ? ARROW[step.kind] : null
  return (
    <>
      <td className="truncate pr-[0.8rem]" title={m.events[String(event.event)] ?? step.name}>
        <span className={cx("inline-flex min-w-0 items-center gap-[0.4rem]", step.wire && "pl-[1.1rem]")}>
          <Lamp tone={severityTone(event.severity)} size="sm" label={String(event.severity ?? "info")} />
          {arrow && (
            <span aria-hidden className="text-ink-dim">
              {arrow}
            </span>
          )}
          <span className="truncate">{step.name}</span>
          {step.transport && <span className="text-[0.85rem] text-ink-dim">{step.transport}</span>}
        </span>
      </td>
      <td className="truncate pr-[0.8rem] text-ink-soft">
        <span className="inline-flex min-w-0 items-center gap-[0.4rem]">
          {step.retry !== null && <Pill tone="warn">{m.retry(step.retry - 1)}</Pill>}
          {step.waitMs !== null && <Pill tone="warn">{m.waited(formatDuration(step.waitMs))}</Pill>}
          {step.counts && <span className="truncate">{step.counts}</span>}
        </span>
      </td>
    </>
  )
}
