import { ExternalLink, Search, X } from "lucide-react"
import { type KeyboardEvent, useId, useMemo, useRef, useState } from "react"
import { FACET_LABELS, type Parsed, type QueryProblem, type Run, type Suggestion, suggest } from "@/domain/runs"
import { platform } from "@/platform/bridge"
import { cx } from "@/ui/cx"
import { LOGS_DOCS } from "./names"

const FIELDS = [
  ...Object.keys(FACET_LABELS),
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

type Props = {
  query: string
  parsed: Parsed
  problems: QueryProblem[]
  runs: Run[]
  onChange: (query: string) => void
}

export function QueryBar({ query, parsed, problems, runs, onChange }: Props) {
  const id = useId()
  const input = useRef<HTMLInputElement>(null)
  const mirror = useRef<HTMLDivElement>(null)
  const [cursor, setCursor] = useState(0)
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)

  const suggestions = useMemo(() => suggest(query, cursor, runs, FIELDS), [query, cursor, runs])
  const showList = open && suggestions.items.length > 0

  const accept = (s: Suggestion) => {
    const before = query.slice(0, suggestions.from)
    const after = query.slice(suggestions.to)
    const spacer = s.insert.endsWith(":") ? "" : " "
    const next = `${before}${s.insert}${spacer}${after.trimStart()}`
    const at = before.length + s.insert.length + spacer.length
    onChange(next)
    setCursor(at)
    setActive(0)
    requestAnimationFrame(() => input.current?.setSelectionRange(at, at))
  }

  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape") {
      if (showList) setOpen(false)
      else if (query) onChange("")
      return
    }
    if (!showList) return
    const n = suggestions.items.length
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault()
      setActive((a) => (a + (e.key === "ArrowDown" ? 1 : n - 1)) % n)
    } else if (e.key === "Enter" || e.key === "Tab") {
      const s = suggestions.items[active]
      if (s) {
        e.preventDefault()
        accept(s)
      }
    }
  }

  const sync = () => {
    const el = input.current
    if (!el) return
    setCursor(el.selectionStart ?? el.value.length)
    if (mirror.current) mirror.current.scrollLeft = el.scrollLeft
  }

  const problem = problems[0]

  return (
    <div className="relative min-w-0 flex-1 basis-[26rem]">
      <div
        className={cx(
          "relative flex h-[2.4rem] items-center rounded-[0.35rem] border bg-app transition-colors duration-150",
          "focus-within:border-brand",
          problem ? "border-bad/70" : "border-line-strong",
        )}
      >
        <Search className="pointer-events-none absolute left-[0.7rem] size-[1rem] text-ink-dim" aria-hidden />
        <div
          ref={mirror}
          aria-hidden
          className="pointer-events-none absolute inset-y-0 right-[2.4rem] left-[2.2rem] flex items-center overflow-hidden whitespace-pre font-mono text-[0.95rem]"
        >
          <Highlight query={query} parsed={parsed} problems={problems} />
        </div>
        <input
          ref={input}
          role="combobox"
          aria-label="Search runs"
          aria-autocomplete="list"
          aria-expanded={showList}
          aria-controls={`${id}-list`}
          aria-activedescendant={showList ? `${id}-${active}` : undefined}
          aria-invalid={problem ? true : undefined}
          aria-describedby={`${id}-hint`}
          spellCheck={false}
          autoComplete="off"
          value={query}
          placeholder="status:failed command:sync* -profile:work timeout"
          onChange={(e) => {
            onChange(e.target.value)
            setOpen(true)
            setActive(0)
            setCursor(e.target.selectionStart ?? e.target.value.length)
          }}
          onKeyDown={onKey}
          onKeyUp={sync}
          onClick={sync}
          onScroll={sync}
          onFocus={() => setOpen(true)}
          onBlur={() => setOpen(false)}
          className="selectable h-full min-w-0 flex-1 bg-transparent pr-[2.4rem] pl-[2.2rem] font-mono text-[0.95rem] text-transparent caret-ink outline-none placeholder:font-sans placeholder:text-ink-dim"
        />
        {query && (
          <button
            type="button"
            onClick={() => {
              onChange("")
              input.current?.focus()
            }}
            aria-label="Clear the search"
            title="Clear"
            className="absolute right-[0.35rem] grid size-[1.7rem] place-items-center rounded-[0.3rem] text-ink-dim hover:bg-app-3 hover:text-ink"
          >
            <X className="size-[0.95rem]" aria-hidden />
          </button>
        )}
      </div>
      {showList && (
        <div
          id={`${id}-list`}
          role="listbox"
          aria-label="Suggestions"
          className="absolute top-[calc(100%+0.3rem)] left-0 z-20 max-h-[18rem] w-[min(26rem,100%)] overflow-y-auto rounded-[0.45rem] border border-line bg-app p-1 shadow-panel"
        >
          {suggestions.items.map((s, i) => (
            <div
              key={s.insert}
              id={`${id}-${i}`}
              role="option"
              aria-selected={i === active}
              tabIndex={-1}
              onMouseDown={(e) => {
                e.preventDefault()
                accept(s)
              }}
              onMouseEnter={() => setActive(i)}
              className={cx(
                "flex cursor-pointer items-center justify-between gap-3 rounded-[0.35rem] px-[0.6rem] py-[0.3rem]",
                i === active && "bg-app-3",
              )}
            >
              <span className="truncate font-mono text-[0.95rem] text-ink">{s.label}</span>
              <span className="shrink-0 text-[0.85rem] text-ink-dim tabular-nums">{s.hint}</span>
            </div>
          ))}
        </div>
      )}
      <div className="mt-[0.35rem] flex items-baseline justify-between gap-3 text-[0.85rem]">
        <p id={`${id}-hint`} role={problem ? "alert" : undefined} className={problem ? "text-bad" : "text-ink-dim"}>
          {problem
            ? problem.message
            : "field:value to filter, * matches anything, a leading - excludes. Two values of one field match either."}
        </p>
        <button
          type="button"
          onClick={() => platform.openUrl(LOGS_DOCS)}
          className="inline-flex shrink-0 items-center gap-[0.2rem] font-medium text-brand hover:text-brand-hover"
        >
          Search syntax
          <ExternalLink className="size-[0.8rem]" aria-hidden />
        </button>
      </div>
    </div>
  )
}

function Highlight({ query, parsed, problems }: Omit<Props, "runs" | "onChange">) {
  const parts: React.ReactNode[] = []
  let at = 0
  const spans = [
    ...parsed.terms.map((t) => ({ start: t.start, end: t.end, term: t, bad: false })),
    ...problems.map((p) => ({ start: p.start, end: p.end, term: null, bad: true })),
  ].sort((a, b) => a.start - b.start || Number(b.bad) - Number(a.bad))
  for (const s of spans) {
    if (s.start < at) continue
    parts.push(query.slice(at, s.start))
    const raw = query.slice(s.start, s.end)
    if (s.bad || !s.term) {
      parts.push(
        <span key={s.start} className="text-ink underline decoration-bad decoration-wavy underline-offset-4">
          {raw}
        </span>,
      )
    } else if (s.term.kind === "field") {
      const neg = s.term.negate ? 1 : 0
      const colon = raw.indexOf(":")
      parts.push(
        <span key={s.start}>
          {neg ? <span className="text-bad">-</span> : null}
          <span className="text-ink-soft">{raw.slice(neg, colon)}</span>
          <span className="text-ink-dim">:</span>
          <span className={cx("font-medium", s.term.negate ? "text-bad" : "text-ink")}>{raw.slice(colon + 1)}</span>
        </span>,
      )
    } else {
      parts.push(
        <span key={s.start} className={s.term.negate ? "text-bad" : "text-ink"}>
          {raw}
        </span>,
      )
    }
    at = s.end
  }
  parts.push(query.slice(at))
  return <span className="text-ink">{parts}</span>
}
