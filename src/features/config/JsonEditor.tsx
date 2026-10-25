import { type KeyboardEvent, type ReactNode, useRef } from "react"
import { cx } from "@/ui/cx"

const TOKEN = /("(?:\\.|[^"\\\n])*")(\s*:)?|(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)|\b(true|false|null)\b|([{}[\],:])/g

function highlight(text: string): ReactNode[] {
  const out: ReactNode[] = []
  let last = 0
  for (const m of text.matchAll(TOKEN)) {
    const at = m.index ?? 0
    if (at > last) out.push(text.slice(last, at))
    const [whole, str, colon, num, word] = m
    const tone = str
      ? colon
        ? "text-brand"
        : str.includes("•••")
          ? "text-ink-dim"
          : "text-ink"
      : num || word
        ? "text-warn-ink"
        : "text-ink-dim"
    out.push(
      <span key={at} className={tone}>
        {str ?? whole}
      </span>,
    )
    if (colon) out.push(colon)
    last = at + whole.length
  }
  out.push(text.slice(last))
  // A trailing newline needs a character after it, or the overlay is one line shorter than the textarea.
  out.push(" ")
  return out
}

type Props = {
  label: string
  value: string
  onChange: (text: string) => void
  onSave: () => void
  marks: ReadonlyMap<number, string>
  readOnly?: boolean
}

/** A textarea with a highlighted copy underneath: native editing, undo and selection, at no bundle cost. */
export function JsonEditor({ label, value, onChange, onSave, marks, readOnly }: Props) {
  const area = useRef<HTMLTextAreaElement>(null)
  const under = useRef<HTMLPreElement>(null)
  const gutter = useRef<HTMLDivElement>(null)
  const lines = value.split("\n").length

  const sync = () => {
    const a = area.current
    if (!a) return
    if (under.current) {
      under.current.scrollTop = a.scrollTop
      under.current.scrollLeft = a.scrollLeft
    }
    if (gutter.current) gutter.current.scrollTop = a.scrollTop
  }

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
      e.preventDefault()
      onSave()
    }
  }

  const box = "m-0 px-3 py-2.5 font-mono text-[0.85rem] leading-[1.6] whitespace-pre"

  return (
    <div className="grid h-[min(60vh,34rem)] min-h-[16rem] grid-cols-[auto_minmax(0,1fr)] overflow-hidden bg-app">
      <div
        ref={gutter}
        aria-hidden
        className="overflow-hidden border-line border-r bg-app-2 py-2.5 font-mono text-[0.85rem] leading-[1.6] text-ink-dim tabular-nums select-none"
      >
        {Array.from({ length: lines }, (_, i) => {
          const mark = marks.get(i + 1)
          return (
            <div
              // biome-ignore lint/suspicious/noArrayIndexKey: a line number is its own identity
              key={i}
              title={mark}
              className={cx("min-w-[3.2rem] px-3 text-right", mark && "bg-bad/12 font-semibold text-bad")}
            >
              {i + 1}
            </div>
          )
        })}
      </div>
      <div className="relative min-w-0">
        <pre
          ref={under}
          aria-hidden
          className={cx(box, "pointer-events-none absolute inset-0 overflow-hidden text-ink")}
        >
          {highlight(value)}
        </pre>
        <textarea
          ref={area}
          aria-label={label}
          aria-invalid={marks.size > 0}
          value={value}
          readOnly={readOnly}
          onChange={(e) => onChange(e.target.value)}
          onScroll={sync}
          onKeyDown={onKeyDown}
          spellCheck={false}
          autoCapitalize="off"
          autoComplete="off"
          autoCorrect="off"
          wrap="off"
          className={cx(
            box,
            "selectable absolute inset-0 block size-full resize-none overflow-auto border-0 bg-transparent text-transparent caret-ink outline-none",
            "focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brand",
          )}
        />
      </div>
    </div>
  )
}
