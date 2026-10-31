import { ArrowUp, ExternalLink, RefreshCw, SlidersHorizontal } from "lucide-react"
import { useCallback, useDeferredValue, useEffect, useId, useMemo, useRef, useState } from "react"
import { tools } from "@/domain/catalog"
import {
  CONVERSATION,
  conversations,
  FACETS,
  facetCounts,
  formatDay,
  groupRuns,
  inRange,
  matcher,
  NO_COMMAND,
  newestFirst,
  parseQuery,
  RANGES,
  type RangeId,
  type Run,
  suggest,
  toggleTerm,
  unknownFields,
  withConversations,
  withZeros,
} from "@/domain/runs"
import { type Lang, useLang, useMessages } from "@/i18n"
import { platform } from "@/platform/bridge"
import { Button } from "@/ui/Button"
import { cx } from "@/ui/cx"
import { Lamp } from "@/ui/Lamp"
import { reducedMotion } from "@/ui/motion"
import { Select } from "@/ui/Select"
import { Skeleton, StableText } from "@/ui/Skeleton"
import { QueryBar } from "../query/QueryBar"
import { ReportThis } from "../report/ReportThis"
import { Facets } from "./Facets"
import { Groups } from "./Groups"
import { KeepRuns } from "./KeepRuns"
import { useLive } from "./live"
import { logsMessages } from "./messages"
import { fieldLabel, LOGS_DOCS, type LogsWords, problemText, toolName } from "./names"
import { RunsTable } from "./RunsTable"
import { runKey, type Source, timing, useLogs, useShownLogs } from "./store"

const STEP = 100
const FIELDS = [
  ...Object.keys(logsMessages.en.fields),
  "run_id",
  "operations",
  "codes",
  "duration_ms",
  "requests",
  "provider_error",
  "partial.failures.error_code",
  "unknown_command",
  "error.code",
  "error.provider.key",
  "error.http.endpoint_template",
]
const NONE = new Set<string>()

export function LogsPage() {
  const m = useMessages(logsMessages)
  const { loadedAt, liveRound, reading, asked, live, query, range, groupBy, expanded, details } = useLogs()
  const sources = useShownLogs((s) => s.sources)
  const { load, loadMore, setQuery, setRange, setGroupBy, toggle, setLive } = useLogs.getState()
  const [newest, setNewest] = useState(true)
  const [shown, setShown] = useState(STEP)
  const [facetsOpen, setFacetsOpen] = useState(false)
  const deferred = useDeferredValue(query)
  useLive(live)

  useEffect(() => {
    if (Object.keys(useLogs.getState().sources).length === 0) load()
  }, [load])

  const list = useMemo(() => Object.values(sources), [sources])
  // A tool with no runs yet, Email among them until memo records a mail command, is still a choice in the filter.
  const toolIds = useMemo(() => {
    const owners = Object.keys(sources)
    return [...owners, ...tools.filter((t) => t.partOf && owners.includes(t.partOf)).map((t) => t.id)]
  }, [sources])
  const older = list.filter((s) => s.state === "loading")
  const withLogs = list.filter((s) => s.state !== "none" && s.state !== "missing")
  const firstLoad = loadedAt === null
  const now = useMemo(() => new Date(loadedAt ?? Date.now()), [loadedAt])

  // A live round's new runs go on top. Under a reader who scrolled down they wait behind a "new runs" button,
  // because inserting them would push the rows being read out of place.
  const tableRef = useRef<HTMLDivElement>(null)
  const seen = useRef<Set<string> | null>(null)
  const [released, setReleased] = useState(0)
  // biome-ignore lint/correctness/useExhaustiveDependencies: `released` asks to show held runs again
  const { all, held, fresh } = useMemo(() => {
    const runs = list.flatMap((s) => s.runs)
    const before = seen.current
    if (!liveRound || before === null) return { all: runs, held: 0, fresh: NONE }
    const isNew = (r: Run) => !before.has(runKey(r))
    if (scrolledPast(tableRef.current)) {
      const kept = runs.filter((r) => !isNew(r))
      return { all: kept, held: runs.length - kept.length, fresh: NONE }
    }
    return { all: runs, held: 0, fresh: new Set(runs.filter(isNew).map(runKey)) }
  }, [list, liveRound, released])
  useEffect(() => {
    if (held === 0) seen.current = new Set(all.map(runKey))
  }, [all, held])
  const showHeld = () => {
    tableRef.current?.closest("main")?.scrollTo({ top: 0, behavior: reducedMotion() ? "auto" : "smooth" })
    setReleased((n) => n + 1)
  }

  const keyed = useMemo(() => withConversations(all), [all])
  const ranged = useMemo(() => inRange(keyed, range, loadedAt ?? Date.now()), [keyed, range, loadedAt])
  const parsed = useMemo(() => parseQuery(deferred), [deferred])
  const problems = useMemo(() => [...parsed.problems, ...unknownFields(parsed, all)], [parsed, all])
  const suggestRuns = useCallback(
    (q: string, at: number) => {
      const found = suggest(q, at, ranged, FIELDS, m.fields)
      return { ...found, items: found.items.map((i) => ({ label: i.label, insert: i.insert, note: i.hint })) }
    },
    [ranged, m],
  )
  const matched = useMemo(() => {
    const rows = ranged.filter(matcher(parsed.terms))
    rows.sort(newestFirst)
    return newest ? rows : rows.reverse()
  }, [ranged, parsed, newest])
  const counts = useMemo(
    () =>
      Object.fromEntries(
        FACETS.map((f) => {
          const c = facetCounts(ranged, parsed.terms, f)
          return [f, f === "tool" ? withZeros(c, toolIds) : c]
        }),
      ),
    [ranged, parsed, toolIds],
  )
  const byConversation = groupBy === CONVERSATION
  const groups = useMemo(
    () => (groupBy && groupBy !== CONVERSATION ? groupRuns(matched, groupBy) : []),
    [matched, groupBy],
  )
  // Whole conversations only, as many as fit in the runs shown, so one is never cut in half.
  const { sections, sectionRuns, sectionsTotal } = useMemo(() => {
    if (!byConversation) return { sections: [], sectionRuns: 0, sectionsTotal: 0 }
    const every = conversations(matched)
    if (!newest) every.reverse()
    let runs = 0
    const shownSections = every.filter((c, i) => {
      if (i > 0 && runs + c.runs.length > shown) return false
      runs += c.runs.length
      return true
    })
    return { sections: shownSections, sectionRuns: runs, sectionsTotal: every.length }
  }, [byConversation, matched, newest, shown])
  const bareHidden = useMemo(() => {
    const hides = parsed.terms.some((t) => t.kind === "field" && t.field === NO_COMMAND && t.negate)
    return hides ? ranged.filter(matcher(parsed.terms, NO_COMMAND)).length - matched.length : 0
  }, [parsed, ranged, matched])

  // biome-ignore lint/correctness/useExhaustiveDependencies: a new filter starts the list from the top again
  useEffect(() => setShown(STEP), [deferred, range, newest])

  const onFilter = (field: string, value: string, negate: boolean) => setQuery(toggleTerm(query, field, value, negate))
  const failed = all.filter((r) => r.status === "failed").length
  const oldest = all.reduce((min, r) => (r.started_at < min ? r.started_at : min), all[0]?.started_at ?? "")

  return (
    <div className="flex flex-col gap-[1.5rem] px-[2.1rem] pt-[1.6rem] pb-[2.2rem]">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-[2.1rem] font-extrabold leading-none tracking-[-0.035em]">{m.title}</h1>
          <p className="mt-3 max-w-[72ch] text-[0.95rem] text-ink-soft">
            {m.intro}{" "}
            <button
              type="button"
              onClick={() => platform.openUrl(LOGS_DOCS)}
              className="inline-flex items-baseline gap-[0.2rem] font-medium text-brand hover:text-brand-hover"
            >
              {m.howToSearch}
              <ExternalLink className="size-[0.8rem] self-center" aria-hidden />
            </button>
          </p>
        </div>
        <div className="flex items-center gap-[0.7rem]">
          <Freshness at={loadedAt} reading={reading.length} asked={asked} />
          <Button
            aria-pressed={live}
            onClick={() => setLive(!live)}
            title={live ? m.liveStop : m.liveStart}
            icon={
              <span
                aria-hidden
                className={cx(
                  "size-[0.6rem] rounded-full",
                  live ? "animate-[lamp-pulse_1.4s_ease-in-out_infinite] bg-ok" : "ring-[1.5px] ring-idle ring-inset",
                )}
              />
            }
          >
            {m.live}
          </Button>
          <Button
            onClick={() => load()}
            disabled={reading.length > 0}
            icon={<RefreshCw className={cx("size-4", reading.length > 0 && "animate-spin")} aria-hidden />}
          >
            <StableText value={reading.length > 0 ? m.reading : m.readAgain} variants={[m.reading, m.readAgain]} />
          </Button>
        </div>
      </div>

      <KeepRuns />

      <Sources list={list} onMore={loadMore} />

      {withLogs.length === 0 && list.length > 0 ? (
        <Empty>{m.noLogs}</Empty>
      ) : (
        <>
          <div className="flex flex-wrap items-start gap-[0.7rem]">
            <QueryBar
              query={query}
              parsed={parsed}
              problems={problems}
              problem={problems[0] ? problemText(m, problems[0]) : null}
              suggest={suggestRuns}
              words={{ label: m.searchRuns, placeholder: m.placeholder, hint: m.searchHint }}
              docs={LOGS_DOCS}
              onChange={setQuery}
            />
            <Range value={range} onChange={setRange} />
            <GroupBy value={groupBy} onChange={setGroupBy} />
            <Button
              size="sm"
              variant="ghost"
              className="mt-[0.4rem] lg:hidden"
              aria-expanded={facetsOpen}
              onClick={() => setFacetsOpen(!facetsOpen)}
              icon={<SlidersHorizontal className="size-4" aria-hidden />}
            >
              {m.facets}
            </Button>
          </div>

          {firstLoad ? (
            <Loading
              reading={asked ? reading : withLogs.map((s) => s.id)}
              total={asked || withLogs.length}
              facetsOpen={facetsOpen}
              newest={newest}
            />
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
                  reading={older}
                  grouped={byConversation ? sectionsTotal : groupBy ? groups.length : null}
                  byConversation={byConversation}
                  bareHidden={bareHidden}
                  onShowBare={() => setQuery(toggleTerm(query, NO_COMMAND, "true", true))}
                />
                <div className="sticky top-[0.8rem] z-10 -mb-[0.7rem] flex h-0 justify-center">
                  {held > 0 && (
                    <Button size="sm" variant="primary" className="reveal shadow-panel" onClick={showHeld}>
                      <ArrowUp className="size-4" aria-hidden />
                      {m.newRuns(held)}
                    </Button>
                  )}
                </div>
                <div ref={tableRef} className="overflow-hidden rounded-[0.2rem] border border-line-strong bg-app">
                  {matched.length === 0 ? (
                    <p className="flex flex-wrap items-center gap-3 px-[1.3rem] py-[1.6rem] text-[0.95rem] text-ink-soft">
                      {all.length === 0 ? m.nothingRecorded : m.noMatch}
                      {query && (
                        <Button size="sm" variant="ghost" onClick={() => setQuery("")}>
                          {m.clearSearch}
                        </Button>
                      )}
                      {range !== "all" && all.length > 0 && (
                        <Button size="sm" variant="ghost" onClick={() => setRange("all")}>
                          {m.lookAtAll}
                        </Button>
                      )}
                    </p>
                  ) : byConversation ? (
                    <RunsTable
                      runs={[]}
                      sections={sections}
                      fresh={fresh}
                      now={now}
                      expanded={expanded}
                      details={details}
                      newest={newest}
                      onSort={() => setNewest(!newest)}
                      onToggle={toggle}
                      onFilter={onFilter}
                      onGroup={setGroupBy}
                    />
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
                      fresh={fresh}
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
                {byConversation && sections.length < sectionsTotal && (
                  <div className="flex items-center justify-center gap-3 text-[0.9rem] text-ink-dim">
                    {m.showingConversations(sections.length, sectionsTotal)}
                    <Button size="sm" onClick={() => setShown(Math.max(shown, sectionRuns) + STEP)}>
                      {m.showMore}
                    </Button>
                  </div>
                )}
                {!groupBy && matched.length > shown && (
                  <div className="flex items-center justify-center gap-3 text-[0.9rem] text-ink-dim">
                    {m.showingRuns(shown, matched.length)}
                    <Button size="sm" onClick={() => setShown(shown + STEP)}>
                      {m.showNMore(Math.min(STEP, matched.length - shown))}
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
  const m = useMessages(logsMessages)
  return (
    <ul aria-label={m.sources} className="flex flex-wrap gap-x-[1.4rem] gap-y-[0.45rem] text-[0.9rem]">
      {list.map((s) => (
        <li key={s.id} className="flex min-w-0 items-center gap-[0.45rem]">
          <Lamp tone={sourceTone(s)} size="sm" label={sourceWords(m, s)} />
          <span className="font-medium">{toolName(s.id)}</span>
          {/* As wide as "reading…" from the start, so a count arriving never unwraps the row and moves the tools after it. */}
          <span
            className={cx("min-w-[3.8rem] truncate", s.state === "error" ? "text-bad" : "text-ink-dim")}
            title={s.error ?? undefined}
          >
            {sourceWords(m, s)}
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
              {m.loadOlder}
            </button>
          )}
        </li>
      ))}
    </ul>
  )
}

const sourceTone = (s: Source) =>
  s.state === "loading"
    ? "busy"
    : s.state === "error"
      ? "bad"
      : s.state === "late"
        ? "warn"
        : s.state === "ready"
          ? "ok"
          : "idle"

function sourceWords(m: LogsWords, s: Source): string {
  if (s.state === "late") return m.late(timing.answer / 1000, s.runs.length > 0)
  if (s.state === "none") return m.keepsNoLogs
  if (s.state === "missing") return m.notInstalled
  if (s.state === "update") return m.withNextUpdate(toolName(s.id))
  if (s.state === "error") return s.error ?? m.couldNotBeRead
  const n = s.runs.length
  const runs = m.runCount(n, s.hasMore)
  return s.state === "loading" ? (n ? m.readingOlder(runs) : m.readingShort) : runs
}

// The table's own header and rows at their real height, so the first tool's runs land where the placeholders were.
const PLACEHOLDER_ROWS = 20

function Loading(props: { reading: string[]; total: number; facetsOpen: boolean; newest: boolean }) {
  const { reading, total, facetsOpen, newest } = props
  const m = useMessages(logsMessages)
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
        <p className="flex flex-wrap items-center gap-x-[0.6rem] text-[0.9rem] text-ink-soft">
          <span
            role="progressbar"
            aria-label={m.toolsRead}
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
          <span className="tabular-nums">{m.toolsDone(done, total, reading.map(toolName))}</span>
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
  byConversation: boolean
  bareHidden: number
  onShowBare: () => void
}) {
  const { matched, total, failed, since, reading, grouped, byConversation, bareHidden, onShowBare } = props
  const m = useMessages(logsMessages)
  const lang = useLang()
  const count = <strong className="font-mono font-semibold text-ink tabular-nums">{matched}</strong>
  return (
    <p aria-live="polite" className="flex flex-wrap items-baseline gap-x-[0.6rem] text-[0.9rem] text-ink-soft">
      <span>
        {grouped === null
          ? m.matches(matched, count)
          : byConversation
            ? m.matchesInConversations(matched, count, grouped)
            : m.matchesInGroups(matched, count, grouped)}
      </span>
      {total > 0 && (
        <span className="text-ink-dim">{m.over(total, since ? formatDay(since, lang) : null, failed)}</span>
      )}
      {bareHidden > 0 && (
        <span className="text-ink-dim tabular-nums">
          {m.bareHidden(bareHidden)}{" "}
          <button type="button" onClick={onShowBare} className="font-medium text-brand hover:text-brand-hover">
            {m.showThem}
          </button>
        </span>
      )}
      {reading.length > 0 && (
        <span className="inline-flex items-center gap-[0.4rem] text-ink-dim">
          <Lamp tone="busy" size="sm" />
          {m.stillReading(reading.map((s) => toolName(s.id)))}
        </span>
      )}
    </p>
  )
}

const scrolledPast = (el: HTMLElement | null) => {
  const main = el?.closest("main")
  return Boolean(el && main && el.getBoundingClientRect().top < main.getBoundingClientRect().top)
}

// The short style, because this line ticks every second beside the buttons and must not grow and push them.
function ago(ms: number, lang: Lang) {
  const format = new Intl.RelativeTimeFormat(lang, { style: "short" })
  const s = Math.max(0, Math.round(ms / 1000))
  if (s < 60) return format.format(-s, "second")
  const min = Math.round(s / 60)
  return min < 60 ? format.format(-min, "minute") : format.format(-Math.round(min / 60), "hour")
}

// Its own one-second clock, so only this line renders again as the time passes.
function Freshness({ at, reading, asked }: { at: number | null; reading: number; asked: number }) {
  const m = useMessages(logsMessages)
  const lang = useLang()
  const [, setTick] = useState(0)
  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 1000)
    return () => clearInterval(t)
  }, [])
  const text =
    at === null ? "" : reading ? m.readingTools(asked - reading, asked) : m.updated(ago(Date.now() - at, lang))
  return <span className="min-w-[10.5rem] text-right text-[0.9rem] text-ink-dim tabular-nums">{text}</span>
}

function Range({ value, onChange }: { value: RangeId; onChange: (r: RangeId) => void }) {
  const m = useMessages(logsMessages)
  const name = useId()
  return (
    <fieldset className="inline-flex h-[2.8rem] items-center rounded-[0.45rem] border-0 bg-app-3 p-[3px]">
      <legend className="sr-only">{m.timeRange}</legend>
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
          <span className="grid h-full min-w-[3rem] cursor-pointer place-items-center rounded-[0.35rem] px-[0.7rem] font-mono text-[0.9rem] text-ink-soft transition-colors duration-150 hover:text-ink peer-checked:bg-app peer-checked:text-ink peer-checked:shadow-panel peer-focus-visible:outline-2 peer-focus-visible:outline-brand">
            {m.ranges[r.id]}
          </span>
        </label>
      ))}
    </fieldset>
  )
}

const GROUPABLE: string[] = [CONVERSATION, ...FACETS, "cli_version"]

function GroupBy({ value, onChange }: { value: string | null; onChange: (f: string | null) => void }) {
  const m = useMessages(logsMessages)
  const id = useId()
  return (
    <div className="flex h-[2.8rem] items-center gap-[0.5rem]">
      <label htmlFor={id} className="shrink-0 whitespace-nowrap text-[0.95rem] text-ink-dim">
        {m.groupBy}
      </label>
      <Select
        id={id}
        size="lg"
        value={value ?? ""}
        onChange={(f) => onChange(f || null)}
        options={[
          { value: "", label: m.nothing },
          ...[...GROUPABLE, ...(value && !GROUPABLE.includes(value) ? [value] : [])].map((f) => ({
            value: f,
            label: fieldLabel(m, f),
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
