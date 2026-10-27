import { Check, ChevronDown } from "lucide-react"
import {
  type CSSProperties,
  type KeyboardEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from "react"
import { cx } from "./cx"

export type SelectOption<T extends string> = { value: T; label: string; icon?: ReactNode; disabled?: boolean }
export type SelectGroup<T extends string> = { label: string; options: readonly SelectOption<T>[] }
type Item<T extends string> = SelectOption<T> | SelectGroup<T>

type Props<T extends string> = {
  value: T
  onChange: (value: T) => void
  options: readonly Item<T>[]
  placeholder?: string
  size?: "lg" | "md" | "sm"
  disabled?: boolean
  className?: string
  id?: string
  "aria-label"?: string
  "aria-labelledby"?: string
  "aria-describedby"?: string | undefined
  "aria-invalid"?: boolean
}

const isGroup = <T extends string>(item: Item<T>): item is SelectGroup<T> => "options" in item

const sizes = {
  lg: { button: "h-[2.8rem] pl-3 pr-2.5 text-[1.02rem] gap-2", option: "min-h-[2.3rem] text-[1rem]" },
  md: { button: "h-[2.4rem] pl-2.5 pr-2 text-[0.95rem] gap-2", option: "min-h-[2.1rem] text-[0.95rem]" },
  sm: { button: "h-8 pl-2 pr-1.5 text-[0.875rem] gap-1.5", option: "min-h-[1.85rem] text-[0.875rem]" },
}

const GAP = 4
const EDGE = 8
const MAX_HEIGHT = 288

/**
 * A select-only combobox (WAI-ARIA APG): focus stays on the button and the list follows it with
 * aria-activedescendant. WebKitGTK draws a native <select>'s open list itself, ignoring the theme.
 */
export function Select<T extends string>({
  value,
  onChange,
  options,
  placeholder = "Choose…",
  size = "md",
  disabled = false,
  className,
  id,
  ...aria
}: Props<T>) {
  const flat = options.flatMap((item) => (isGroup(item) ? item.options : [item]))
  const selected = flat.find((o) => o.value === value)
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(-1)
  const [listLabel, setListLabel] = useState<string>()
  const [place, setPlace] = useState<CSSProperties>({ visibility: "hidden" })
  const button = useRef<HTMLButtonElement>(null)
  const list = useRef<HTMLDivElement>(null)
  const typed = useRef({ text: "", at: 0 })
  const base = useId()
  const listId = `${base}-list`
  const optionId = (i: number) => `${base}-${i}`

  const enabled = (i: number) => i >= 0 && i < flat.length && !flat[i]?.disabled
  const step = (from: number, by: 1 | -1) => {
    for (let i = from + by; i >= 0 && i < flat.length; i += by) if (enabled(i)) return i
    return from
  }
  const first = () => step(-1, 1)
  const last = () => step(flat.length, -1)

  const show = (at?: number) => {
    const current = flat.findIndex((o) => o.value === value)
    setActive(at ?? (enabled(current) ? current : first()))
    setListLabel(button.current?.labels?.[0]?.textContent ?? undefined)
    setOpen(true)
  }
  const close = useCallback((refocus: boolean) => {
    setOpen(false)
    if (refocus) button.current?.focus()
  }, [])
  const pick = (i: number) => {
    const o = flat[i]
    if (!o || o.disabled) return
    close(true)
    if (o.value !== value) onChange(o.value)
  }

  const typeAhead = (key: string) => {
    const now = Date.now()
    const t = typed.current
    t.text = now - t.at > 600 ? key : t.text + key
    t.at = now
    const text = t.text.toLowerCase()
    // Repeating one letter cycles through the options that start with it, as a native select does.
    const cycling = text.length > 1 && [...text].every((c) => c === text[0])
    const query = cycling ? (text[0] ?? "") : text
    const from = open ? active : flat.findIndex((o) => o.value === value)
    const start = cycling || query.length === 1 ? from + 1 : Math.max(from, 0)
    for (let n = 0; n < flat.length; n++) {
      const i = (start + n) % flat.length
      if (enabled(i) && flat[i]?.label.toLowerCase().startsWith(query)) return i
    }
    return -1
  }

  const onKeyDown = (e: KeyboardEvent<HTMLButtonElement>) => {
    const { key } = e
    if (!open) {
      if (["ArrowDown", "ArrowUp", "Enter", " "].includes(key)) {
        e.preventDefault()
        show()
      } else if (key === "Home" || key === "End") {
        e.preventDefault()
        show(key === "Home" ? first() : last())
      } else if (key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
        const i = typeAhead(key)
        if (i >= 0) show(i)
      }
      return
    }
    if (key === "Escape") {
      // The native <dialog> would close on this Escape too.
      e.preventDefault()
      e.stopPropagation()
      close(true)
    } else if (key === "Tab") {
      close(false)
    } else if (key === "ArrowDown" || key === "ArrowUp") {
      e.preventDefault()
      if (e.altKey) close(true)
      else setActive((a) => step(a, key === "ArrowDown" ? 1 : -1))
    } else if (key === "Home" || key === "End" || key === "PageUp" || key === "PageDown") {
      e.preventDefault()
      setActive(key === "Home" || key === "PageUp" ? first() : last())
    } else if (key === "Enter" || (key === " " && Date.now() - typed.current.at > 600)) {
      e.preventDefault()
      pick(active)
    } else if (key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
      e.preventDefault()
      const i = typeAhead(key)
      if (i >= 0) setActive(i)
    }
  }

  useLayoutEffect(() => {
    if (!open) return
    const position = () => {
      const b = button.current?.getBoundingClientRect()
      const l = list.current
      if (!b || !l) return
      const natural = Math.min(l.scrollHeight, MAX_HEIGHT)
      const below = window.innerHeight - b.bottom - GAP - EDGE
      const above = b.top - GAP - EDGE
      const up = natural > below && above > below
      const width = Math.max(b.width, l.offsetWidth)
      setPlace({
        left: Math.max(EDGE, Math.min(b.left, window.innerWidth - width - EDGE)),
        minWidth: b.width,
        maxHeight: Math.max(Math.min(MAX_HEIGHT, up ? above : below), 96),
        ...(up ? { bottom: window.innerHeight - b.top + GAP } : { top: b.bottom + GAP }),
      })
    }
    position()
    window.addEventListener("resize", position)
    window.addEventListener("scroll", position, true)
    return () => {
      window.removeEventListener("resize", position)
      window.removeEventListener("scroll", position, true)
      setPlace({ visibility: "hidden" })
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    const outside = (e: PointerEvent) => {
      const t = e.target as Node
      if (!button.current?.contains(t) && !list.current?.contains(t)) close(false)
    }
    document.addEventListener("pointerdown", outside, true)
    return () => document.removeEventListener("pointerdown", outside, true)
  }, [open, close])

  useEffect(() => {
    if (open && active >= 0) document.getElementById(`${base}-${active}`)?.scrollIntoView?.({ block: "nearest" })
  }, [open, active, base])

  const s = sizes[size]
  let index = 0
  const renderOption = (o: SelectOption<T>) => {
    const i = index++
    const isSelected = o.value === value
    return (
      <div
        key={o.value}
        id={optionId(i)}
        role="option"
        tabIndex={-1}
        aria-selected={isSelected}
        aria-disabled={o.disabled || undefined}
        onMouseMove={() => !o.disabled && i !== active && setActive(i)}
        onMouseUp={() => pick(i)}
        className={cx(
          "flex items-center gap-2 rounded-[0.3rem] px-1.5 py-1 text-ink",
          s.option,
          o.disabled ? "cursor-default text-ink-dim" : "cursor-pointer",
          i === active && !o.disabled && "bg-app-3",
        )}
      >
        {o.icon && <span className="grid size-4 shrink-0 place-items-center text-ink-soft">{o.icon}</span>}
        <span className={cx("min-w-0 flex-1 truncate", isSelected && "font-medium")}>{o.label}</span>
        <Check className={cx("size-4 shrink-0 text-brand", !isSelected && "invisible")} aria-hidden />
      </div>
    )
  }

  return (
    <>
      <button
        ref={button}
        id={id}
        type="button"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        aria-activedescendant={open && active >= 0 ? optionId(active) : undefined}
        {...aria}
        disabled={disabled}
        onKeyDown={onKeyDown}
        onClick={() => {
          button.current?.focus()
          if (open) close(false)
          else show()
        }}
        onBlur={() => close(false)}
        className={cx(
          "flex min-w-0 items-center rounded-[0.35rem] border border-line-strong bg-app text-left leading-normal",
          "hover:border-ink-dim/60 aria-[invalid=true]:border-bad disabled:pointer-events-none disabled:opacity-45",
          s.button,
          className,
        )}
      >
        {selected?.icon && (
          <span className="grid size-4 shrink-0 place-items-center text-ink-soft">{selected.icon}</span>
        )}
        <span className={cx("min-w-0 flex-1 truncate", selected ? "text-ink" : "text-ink-dim")}>
          {selected?.label ?? placeholder}
        </span>
        <ChevronDown
          className={cx(
            "size-4 shrink-0 text-ink-dim transition-transform duration-150",
            open && "rotate-180 text-ink",
          )}
          aria-hidden
        />
      </button>
      <div
        ref={list}
        id={listId}
        role="listbox"
        aria-label={open ? (aria["aria-label"] ?? listLabel) : undefined}
        aria-labelledby={aria["aria-labelledby"]}
        hidden={!open}
        style={place}
        onMouseDown={(e) => e.preventDefault()}
        className={cx(
          "fixed z-50 max-w-[min(24rem,calc(100vw-1rem))] overflow-y-auto overscroll-contain rounded-[0.45rem] border border-line bg-app p-1 font-sans text-ink shadow-panel",
          "motion-safe:animate-[select-in_120ms_var(--ease-out-quart)]",
        )}
      >
        {options.map((item) =>
          isGroup(item) ? (
            // biome-ignore lint/a11y/useSemanticElements: a listbox groups its options with role="group"; a fieldset groups form controls
            <div key={`group-${item.label}`} role="group" aria-label={item.label} className="not-first:mt-1">
              <div
                aria-hidden
                className="px-1.5 pt-1.5 pb-1 text-[0.8rem] font-medium tracking-[0.06em] text-ink-dim uppercase"
              >
                {item.label}
              </div>
              {item.options.map(renderOption)}
            </div>
          ) : (
            renderOption(item)
          ),
        )}
      </div>
    </>
  )
}
