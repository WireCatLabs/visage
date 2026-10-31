import { ExternalLink, Search, X } from "lucide-react"
import { Fragment, type KeyboardEvent, useId, useLayoutEffect, useMemo, useRef, useState } from "react"
import type { Parsed } from "@/domain/runs"
import type { QueryOption, QueryOptions } from "@/domain/search"
import { useMessages } from "@/i18n"
import { platform } from "@/platform/bridge"
import { cx } from "@/ui/cx"
import { queryMessages } from "./messages"

export type Span = { start: number; end: number }

type Props = {
  query: string
  /** Only for colouring the terms; whether the query is valid is the caller's to say, in `problem`. */
  parsed: Parsed
  /** Spans to underline; an empty one marks a place, such as where a query ends too early. */
  problems: Span[]
  problem: string | null
  /** The rows for the term at `cursor`; `all` once the owner chose "More fields". */
  suggest: (query: string, cursor: number, all: boolean) => QueryOptions
  words: { label: string; placeholder: string; hint: string }
  docs: string
  onChange: (query: string) => void
  /** Enter with no row chosen. Without it, Enter takes the first row, as the Logs filter does. */
  onSubmit?: () => void
  disabled?: boolean
}

export function QueryBar(props: Props) {
  const { query, parsed, problems, problem, suggest, words, docs, onChange, onSubmit } = props
  const m = useMessages(queryMessages)
  const id = useId()
  const input = useRef<HTMLInputElement>(null)
  const mirror = useRef<HTMLDivElement>(null)
  // With a submit, nothing is chosen until an arrow key moves, so Enter searches instead of taking a row.
  const none = onSubmit ? -1 : 0
  const [cursor, setCursor] = useState(0)
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(none)
  const [all, setAll] = useState(false)
  // Placed as the new text commits, not a frame later, when keys typed meanwhile would land behind it.
  const caret = useRef<number | null>(null)
  // biome-ignore lint/correctness/useExhaustiveDependencies: the caret moves once the accepted text is in the box
  useLayoutEffect(() => {
    if (caret.current === null) return
    input.current?.setSelectionRange(caret.current, caret.current)
    caret.current = null
  }, [query])

  const suggestions = useMemo(() => suggest(query, cursor, all), [suggest, query, cursor, all])
  const showList = open && suggestions.items.length > 0

  const accept = (s: QueryOption) => {
    setActive(none)
    if (s.more) {
      setAll(true)
      input.current?.focus()
      return
    }
    const before = s.whole ? "" : query.slice(0, suggestions.from)
    const after = s.whole ? "" : query.slice(suggestions.to)
    const spacer = s.open || s.insert.endsWith(":") ? "" : " "
    const next = `${before}${s.insert}${spacer}${after.trimStart()}`
    const at = before.length + s.insert.length + spacer.length
    onChange(next)
    setCursor(at)
    setOpen(true)
    caret.current = at
  }

  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape") {
      if (showList) setOpen(false)
      else if (query) onChange("")
      return
    }
    const n = suggestions.items.length
    if (showList && (e.key === "ArrowDown" || e.key === "ArrowUp")) {
      e.preventDefault()
      setActive((a) => (a < 0 ? (e.key === "ArrowDown" ? 0 : n - 1) : (a + (e.key === "ArrowDown" ? 1 : n - 1)) % n))
      return
    }
    const chosen = showList ? suggestions.items[active < 0 && e.key === "Tab" ? 0 : active] : undefined
    if ((e.key === "Enter" || e.key === "Tab") && chosen) {
      e.preventDefault()
      accept(chosen)
      return
    }
    if (e.key === "Enter" && onSubmit) {
      e.preventDefault()
      setOpen(false)
      onSubmit()
    }
  }

  const sync = () => {
    const el = input.current
    if (!el) return
    setCursor(el.selectionStart ?? el.value.length)
    if (mirror.current) mirror.current.scrollLeft = el.scrollLeft
  }

  return (
    <div className="relative min-w-0 flex-1 basis-[26rem]">
      <div
        className={cx(
          "relative flex h-[2.8rem] items-center rounded-[0.4rem] border bg-app transition-colors duration-150",
          "focus-within:border-brand",
          problem ? "border-bad/70" : "border-line-strong",
        )}
      >
        <Search className="pointer-events-none absolute left-[0.8rem] size-[1.15rem] text-ink-dim" aria-hidden />
        <div
          ref={mirror}
          aria-hidden
          className="pointer-events-none absolute inset-y-0 right-[2.6rem] left-[2.5rem] flex items-center overflow-hidden whitespace-pre font-mono text-[1.02rem] no-ligatures"
        >
          <Highlight query={query} parsed={parsed} problems={problems} />
        </div>
        <input
          ref={input}
          role="combobox"
          aria-label={words.label}
          aria-autocomplete="list"
          aria-expanded={showList}
          aria-controls={`${id}-list`}
          aria-activedescendant={showList ? `${id}-${active}` : undefined}
          aria-invalid={problem ? true : undefined}
          aria-describedby={`${id}-hint`}
          spellCheck={false}
          autoComplete="off"
          value={query}
          placeholder={words.placeholder}
          disabled={props.disabled}
          onChange={(e) => {
            onChange(e.target.value)
            setOpen(true)
            setActive(none)
            setCursor(e.target.selectionStart ?? e.target.value.length)
          }}
          onKeyDown={onKey}
          onKeyUp={sync}
          onClick={sync}
          onScroll={sync}
          onFocus={() => setOpen(true)}
          onBlur={() => {
            setOpen(false)
            setAll(false)
          }}
          className="selectable h-full min-w-0 flex-1 bg-transparent no-ligatures pr-[2.6rem] pl-[2.5rem] font-mono text-[1.02rem] text-transparent caret-ink outline-none placeholder:font-sans placeholder:text-ink-dim"
        />
        {query && (
          <button
            type="button"
            onClick={() => {
              onChange("")
              input.current?.focus()
            }}
            aria-label={m.clearSearch}
            title={m.clear}
            className="absolute right-[0.45rem] grid size-[1.9rem] place-items-center rounded-[0.3rem] text-ink-dim hover:bg-app-3 hover:text-ink"
          >
            <X className="size-[0.95rem]" aria-hidden />
          </button>
        )}
      </div>
      {showList && (
        <div
          id={`${id}-list`}
          role="listbox"
          aria-label={m.suggestions}
          className="absolute top-[calc(100%+0.3rem)] left-0 z-20 max-h-[22rem] w-[min(40rem,100%)] overflow-y-auto rounded-[0.45rem] border border-line bg-app p-1 shadow-panel"
        >
          {suggestions.items.map((s, i) => {
            const heading = s.group && s.group !== suggestions.items[i - 1]?.group ? s.group : null
            return (
              <Fragment key={`${s.group ?? ""}:${s.label}`}>
                {heading && (
                  <div
                    role="presentation"
                    className="px-[0.6rem] pt-[0.55rem] pb-[0.2rem] font-medium text-[0.8rem] text-ink-dim uppercase tracking-[0.04em] first:pt-[0.25rem]"
                  >
                    {heading}
                  </div>
                )}
                <div
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
                    "flex cursor-pointer items-baseline gap-3 rounded-[0.35rem] px-[0.6rem] py-[0.3rem]",
                    i === active && "bg-app-3",
                    s.more && "mt-1 border-line border-t pt-[0.45rem] text-brand",
                  )}
                >
                  <span
                    className={cx(
                      "shrink-0 text-[0.95rem] no-ligatures",
                      s.more ? "font-medium font-sans" : "font-mono text-ink",
                    )}
                  >
                    {s.label}
                  </span>
                  {s.note && <span className="min-w-0 flex-1 truncate text-[0.9rem] text-ink-soft">{s.note}</span>}
                  {s.example && (
                    <span className="ml-auto shrink-0 font-mono text-[0.85rem] text-ink-dim no-ligatures">
                      {s.example}
                    </span>
                  )}
                </div>
              </Fragment>
            )
          })}
        </div>
      )}
      <div className="mt-[0.35rem] flex items-baseline justify-between gap-3 text-[0.9rem]">
        <p id={`${id}-hint`} role={problem ? "alert" : undefined} className={problem ? "text-bad" : "text-ink-dim"}>
          {problem ?? words.hint}
        </p>
        <button
          type="button"
          onClick={() => platform.openUrl(docs)}
          className="inline-flex shrink-0 items-center gap-[0.2rem] font-medium text-brand hover:text-brand-hover"
        >
          {m.searchSyntax}
          <ExternalLink className="size-[0.8rem]" aria-hidden />
        </button>
      </div>
    </div>
  )
}

function Highlight({ query, parsed, problems }: Pick<Props, "query" | "parsed" | "problems">) {
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
    if (s.bad && s.start === s.end) {
      parts.push(
        <span key={`at-${s.start}`} className="relative">
          <span className="absolute -bottom-[0.55em] -left-[0.3em] text-[0.8em] text-bad leading-none">▲</span>
        </span>,
      )
      continue
    }
    if (s.bad || !s.term) {
      parts.push(
        <span key={s.start} className="text-ink underline decoration-bad decoration-wavy underline-offset-4">
          {raw}
        </span>,
      )
    } else if (s.term.kind === "field" && raw.includes(":")) {
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
