import { ExternalLink, RefreshCw, SlidersHorizontal } from "lucide-react"
import { useDeferredValue, useEffect, useId, useMemo, useState } from "react"
import {
  FACET_LABELS,
  FACETS,
  facetCounts,
  formatDay,
  groupRuns,
  inRange,
  matcher,
  newestFirst,
  parseQuery,
  RANGES,
  type RangeId,
  toggleTerm,
  unknownFields,
} from "@/domain/runs"
import { platform } from "@/platform/bridge"
import { Button } from "@/ui/Button"
import { cx } from "@/ui/cx"
import { Lamp } from "@/ui/Lamp"
import { Select } from "@/ui/Select"
import { Skeleton, StableText } from "@/ui/Skeleton"
import { ReportThis } from "../report/ReportThis"
import { Facets } from "./Facets"
import { Groups } from "./Groups"
import { KeepRuns } from "./KeepRuns"
import { LOGS_DOCS, toolName } from "./names"
import { QueryBar } from "./QueryBar"
import { RunsTable } from "./RunsTable"
import { type Source, useLogs, useShownLogs } from "./store"

const STEP = 100

export function LogsPage() {
  const { loadedAt, query, range, groupBy, expanded, details } = useLogs()
  const sources = useShownLogs((s) => s.sources)
  const { load, loadMore, setQuery, setRange, setGroupBy, toggle } = useLogs.getState()
  const [newest, setNewest] = useState(true)
  const [shown, setShown] = useState(STEP)
  const [facetsOpen, setFacetsOpen] = useState(false)
  const deferred = useDeferredValue(query)

  useEffect(() => {
    if (Object.keys(useLogs.getState().sources).length === 0) load()
  }, [load])

  const list = useMemo(() => Object.values(sources), [sources])
  const reading = list.filter((s) => s.state === "loading")
  const withLogs = list.filter((s) => s.state !== "none" && s.state !== "missing")
  const firstLoad = reading.length > 0 && list.every((s) => s.runs.length === 0)
  const now = useMemo(() => new Date(loadedAt), [loadedAt])

  const all = useMemo(() => list.flatMap((s) => s.runs), [list])
  const ranged = useMemo(() => inRange(all, range, loadedAt), [all, range, loadedAt])
  const parsed = useMemo(() => parseQuery(deferred), [deferred])
  const problems = useMemo(() => [...parsed.problems, ...unknownFields(parsed, all)], [parsed, all])
  const matched = useMemo(() => {
    const rows = ranged.filter(matcher(parsed.terms))
    rows.sort(newestFirst)
    return newest ? rows : rows.reverse()
  }, [ranged, parsed, newest])
  const counts = useMemo(
    () => Object.fromEntries(FACETS.map((f) => [f, facetCounts(ranged, parsed.terms, f)])),
    [ranged, parsed],
  )
  const groups = useMemo(() => (groupBy ? groupRuns(matched, groupBy) : []), [matched, groupBy])

  // biome-ignore lint/correctness/useExhaustiveDependencies: a new filter starts the list from the top again
  useEffect(() => setShown(STEP), [deferred, range, newest])

  const onFilter = (field: string, value: string, negate: boolean) => setQuery(toggleTerm(query, field, value, negate))
  const failed = all.filter((r) => r.status === "failed").length
  const oldest = all.reduce((min, r) => (r.started_at < min ? r.started_at : min), all[0]?.started_at ?? "")

  return (
    <div className="flex flex-col gap-[1.5rem] px-[2.1rem] pt-[1.6rem] pb-[2.2rem]">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-[2.1rem] font-extrabold leading-none tracking-[-0.035em]">Logs</h1>
          <p className="mt-3 max-w-[72ch] text-[0.95rem] text-ink-soft">
            What each tool recorded about its own runs. Out of the box a tool keeps a run only when it fails, so this
            list is mostly failures by design. It does not mean everything is broken.{" "}
            <button
              type="button"
              onClick={() => platform.openUrl(LOGS_DOCS)}
              className="inline-flex items-baseline gap-[0.2rem] font-medium text-brand hover:text-brand-hover"
            >
              How to search logs
              <ExternalLink className="size-[0.8rem] self-center" aria-hidden />
            </button>
          </p>
        </div>
        <Button
          onClick={() => load()}
          disabled={reading.length > 0}
          icon={<RefreshCw className={cx("size-4", reading.length > 0 && "animate-spin")} aria-hidden />}
        >
          <StableText value={reading.length > 0 ? "Reading…" : "Read again"} variants={["Reading…", "Read again"]} />
        </Button>
      </div>

      <KeepRuns />

      <Sources list={list} onMore={loadMore} />

      {withLogs.length === 0 && list.length > 0 ? (
        <Empty>
          No installed tool keeps run logs yet. Telegram, MAX and WhatsApp do: install one on the Tools page, and its
          failed runs will show up here.
        </Empty>
      ) : (
        <>
          <div className="flex flex-wrap items-start gap-[0.7rem]">
            <QueryBar query={query} parsed={parsed} problems={problems} runs={ranged} onChange={setQuery} />
            <Range value={range} onChange={setRange} />
            <GroupBy value={groupBy} onChange={setGroupBy} />
            <Button
              size="sm"
              variant="ghost"
              className="mt-[0.2rem] lg:hidden"
              aria-expanded={facetsOpen}
              onClick={() => setFacetsOpen(!facetsOpen)}
              icon={<SlidersHorizontal className="size-4" aria-hidden />}
            >
              Facets
            </Button>
          </div>

          {firstLoad ? (
            <Loading reading={reading} total={withLogs.length} facetsOpen={facetsOpen} newest={newest} />
          ) : (
            <div className="grid gap-[1.5rem] lg:grid-cols-[13.5rem_minmax(0,1fr)]">
              <div className={cx(facetsOpen ? "block" : "hidden", "lg:block")}>
                <Facets
                  counts={counts}
                  terms={parsed.terms}
                  total={ranged.length}
                  groupBy={groupBy}
                  onToggle={onFilter}
                  onGroup={setGroupBy}
                />
              </div>
              <div className="flex min-w-0 flex-col gap-[0.7rem]">
                <Summary
                  matched={matched.length}
                  total={all.length}
                  failed={failed}
                  since={oldest}
                  reading={reading}
                  grouped={groupBy ? groups.length : null}
                />
                <div className="overflow-hidden rounded-[0.2rem] border border-line-strong bg-app">
                  {matched.length === 0 ? (
                    <p className="flex flex-wrap items-center gap-3 px-[1.3rem] py-[1.6rem] text-[0.95rem] text-ink-soft">
                      {all.length === 0
                        ? "Nothing recorded. An empty log means none of these tools has failed lately."
                        : "No run matches this search in the chosen time range."}
                      {query && (
                        <Button size="sm" variant="ghost" onClick={() => setQuery("")}>
                          Clear the search
                        </Button>
                      )}
                      {range !== "all" && all.length > 0 && (
                        <Button size="sm" variant="ghost" onClick={() => setRange("all")}>
                          Look at all loaded runs
                        </Button>
                      )}
                    </p>
                  ) : groupBy ? (
                    <Groups
                      field={groupBy}
                      groups={groups}
                      now={now}
                      onPick={(value) => {
                        setQuery(toggleTerm(query, groupBy, value))
                        setGroupBy(null)
                      }}
                    />
                  ) : (
                    <RunsTable
                      runs={matched.slice(0, shown)}
                      now={now}
                      expanded={expanded}
                      details={details}
                      newest={newest}
                      onSort={() => setNewest(!newest)}
                      onToggle={toggle}
                      onFilter={onFilter}
                      onGroup={setGroupBy}
                    />
                  )}
                </div>
                {!groupBy && matched.length > shown && (
                  <div className="flex items-center justify-center gap-3 text-[0.85rem] text-ink-dim">
                    Showing {shown} of {matched.length}
                    <Button size="sm" onClick={() => setShown(shown + STEP)}>
                      Show {Math.min(STEP, matched.length - shown)} more
                    </Button>
                  </div>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

function Sources({ list, onMore }: { list: Source[]; onMore: (id: string) => void }) {
  return (
    <ul aria-label="Where the runs come from" className="flex flex-wrap gap-x-[1.4rem] gap-y-[0.45rem] text-[0.85rem]">
      {list.map((s) => (
        <li key={s.id} className="flex min-w-0 items-center gap-[0.45rem]">
          <Lamp tone={sourceTone(s)} size="sm" label={sourceWords(s)} />
          <span className="font-medium">{toolName(s.id)}</span>
          <span
            className={cx("truncate", s.state === "error" ? "text-bad" : "text-ink-dim")}
            title={s.error ?? undefined}
          >
            {sourceWords(s)}
          </span>
          {s.state === "error" && (
            <ReportThis what={`Reading ${toolName(s.id)} runs`} tool={s.id} error={s.error ?? "could not be read"} />
          )}
          {s.hasMore && s.state === "ready" && (
            <button
              type="button"
              onClick={() => onMore(s.id)}
              className="font-medium text-brand hover:text-brand-hover"
            >
              Load older
            </button>
          )}
        </li>
      ))}
    </ul>
  )
}

const sourceTone = (s: Source) =>
  s.state === "loading" ? "busy" : s.state === "error" ? "bad" : s.state === "ready" ? "ok" : "idle"

function sourceWords(s: Source): string {
  if (s.state === "none") return "keeps no run logs yet"
  if (s.state === "missing") return "not installed"
  if (s.state === "update") return `arrives with the next update of ${toolName(s.id)}`
  if (s.state === "error") return s.error ?? "could not be read"
  const n = s.runs.length
  const runs = `${n}${s.hasMore ? "+" : ""} ${n === 1 ? "run" : "runs"}`
  return s.state === "loading" ? (n ? `${runs}, reading older…` : "reading…") : runs
}

// The table's own header and rows at their real height, so the first tool's runs land where the placeholders were.
const PLACEHOLDER_ROWS = 20

function Loading(props: { reading: Source[]; total: number; facetsOpen: boolean; newest: boolean }) {
  const { reading, total, facetsOpen, newest } = props
  const done = total - reading.length
  return (
    <div className="grid gap-[1.5rem] lg:grid-cols-[13.5rem_minmax(0,1fr)]">
      <div className={cx(facetsOpen ? "flex" : "hidden", "flex-col gap-[1.1rem] lg:flex")}>
        <Skeleton className="h-[2.6rem] w-full" />
        {FACETS.map((f) => (
          <Skeleton key={f} className="h-[9rem] w-full" />
        ))}
      </div>
      <div className="flex min-w-0 flex-col gap-[0.7rem]">
        <p className="flex flex-wrap items-center gap-x-[0.6rem] text-[0.85rem] text-ink-soft">
          <span>
            Reading {reading.map((s) => toolName(s.id)).join(", ")} run logs… {done} of {total} tools done
          </span>
          <span
            role="progressbar"
            aria-label="Tools read"
            aria-valuemin={0}
            aria-valuemax={total}
            aria-valuenow={done}
            className="h-[0.3rem] w-[8rem] overflow-hidden rounded-full bg-app-3"
          >
            <span
              className="block h-full rounded-full bg-brand transition-[width] duration-500 ease-out-quart"
              style={{ width: `${Math.max(8, (done / Math.max(total, 1)) * 100)}%` }}
            />
          </span>
        </p>
        <div className="overflow-hidden rounded-[0.2rem] border border-line-strong bg-app">
          <RunsTable
            runs={[]}
            placeholders={PLACEHOLDER_ROWS}
            now={new Date()}
            expanded={null}
            details={{}}
            newest={newest}
            onSort={() => {}}
            onToggle={() => {}}
            onFilter={() => {}}
            onGroup={() => {}}
          />
        </div>
      </div>
    </div>
  )
}

function Summary(props: {
  matched: number
  total: number
  failed: number
  since: string
  reading: Source[]
  grouped: number | null
}) {
  const { matched, total, failed, since, reading, grouped } = props
  return (
    <p aria-live="polite" className="flex flex-wrap items-baseline gap-x-[0.6rem] text-[0.85rem] text-ink-soft">
      <span>
        <strong className="font-mono font-semibold text-ink tabular-nums">{matched}</strong>{" "}
        {matched === 1 ? "run matches" : "runs match"}
        {grouped !== null && `, in ${grouped} ${grouped === 1 ? "group" : "groups"}`}
      </span>
      {total > 0 && (
        <span className="text-ink-dim">
          over the last {total} kept runs{since ? ` since ${formatDay(since)}` : ""}; {failed} of them failed
        </span>
      )}
      {reading.length > 0 && (
        <span className="inline-flex items-center gap-[0.4rem] text-ink-dim">
          <Lamp tone="busy" size="sm" />
          still reading {reading.map((s) => toolName(s.id)).join(", ")}
        </span>
      )}
    </p>
  )
}

function Range({ value, onChange }: { value: RangeId; onChange: (r: RangeId) => void }) {
  const name = useId()
  return (
    <fieldset className="inline-flex h-[2.4rem] items-center rounded-[0.45rem] border-0 bg-app-3 p-[3px]">
      <legend className="sr-only">Time range</legend>
      {RANGES.map((r) => (
        <label key={r.id} className="relative h-full">
          <input
            type="radio"
            name={name}
            value={r.id}
            checked={r.id === value}
            onChange={() => onChange(r.id)}
            className="peer sr-only"
          />
          <span className="grid h-full min-w-[2.6rem] cursor-pointer place-items-center rounded-[0.35rem] px-[0.55rem] font-mono text-[0.8rem] text-ink-soft transition-colors duration-150 hover:text-ink peer-checked:bg-app peer-checked:text-ink peer-checked:shadow-panel peer-focus-visible:outline-2 peer-focus-visible:outline-brand">
            {r.id === "all" ? "All" : `Last ${r.label}`}
          </span>
        </label>
      ))}
    </fieldset>
  )
}

const GROUPABLE: string[] = [...FACETS, "cli_version"]

function GroupBy({ value, onChange }: { value: string | null; onChange: (f: string | null) => void }) {
  const id = useId()
  return (
    <div className="flex h-[2.4rem] items-center gap-[0.5rem]">
      <label htmlFor={id} className="shrink-0 whitespace-nowrap text-[0.85rem] text-ink-dim">
        Group by
      </label>
      <Select
        id={id}
        value={value ?? ""}
        onChange={(f) => onChange(f || null)}
        options={[
          { value: "", label: "Nothing" },
          ...[...GROUPABLE, ...(value && !GROUPABLE.includes(value) ? [value] : [])].map((f) => ({
            value: f,
            label: FACET_LABELS[f] ?? f,
          })),
        ]}
        className="min-w-[9rem]"
      />
    </div>
  )
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-[0.2rem] border border-line-strong bg-app px-[1.3rem] py-[1.6rem] text-[0.95rem] text-ink-soft">
      {children}
    </p>
  )
}
