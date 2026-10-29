import { CircleHelp, Compass, Info, Sparkles } from "lucide-react"
import { type KeyboardEvent, useEffect, useId, useRef, useState } from "react"
import { useMessages } from "@/i18n"
import { cx } from "@/ui/cx"
import { onboardingMessages } from "./messages"

type Props = { onTour: () => void; onWelcome: () => void; onAbout: () => void }

const MOVES: Record<string, (at: number, count: number) => number> = {
  ArrowDown: (at, n) => (at + 1) % n,
  ArrowUp: (at, n) => (at - 1 + n) % n,
  Home: () => 0,
  End: (_, n) => n - 1,
}

export function HelpMenu({ onTour, onWelcome, onAbout }: Props) {
  const [open, setOpen] = useState(false)
  const root = useRef<HTMLDivElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  const listId = useId()
  const m = useMessages(onboardingMessages).help

  const items = () => [...(root.current?.querySelectorAll<HTMLButtonElement>("[role=menuitem]") ?? [])]

  useEffect(() => {
    if (!open) return
    root.current?.querySelector<HTMLButtonElement>("[role=menuitem]")?.focus()
    const onDown = (e: MouseEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key !== "Escape") return
      setOpen(false)
      trigger.current?.focus()
    }
    document.addEventListener("mousedown", onDown)
    document.addEventListener("keydown", onKey)
    return () => {
      document.removeEventListener("mousedown", onDown)
      document.removeEventListener("keydown", onKey)
    }
  }, [open])

  const onMenuKey = (e: KeyboardEvent) => {
    if (e.key === "Tab") return setOpen(false)
    const move = MOVES[e.key]
    if (!move) return
    e.preventDefault()
    const all = items()
    all[move(all.indexOf(document.activeElement as HTMLButtonElement), all.length)]?.focus()
  }

  const pick = (action: () => void) => () => {
    setOpen(false)
    trigger.current?.focus()
    action()
  }

  const item =
    "flex h-[2.4rem] w-full items-center gap-[0.7rem] rounded-[0.35rem] px-[0.7rem] pr-[1rem] text-left text-[0.95rem] whitespace-nowrap text-ink hover:bg-app-3 focus-visible:bg-app-3"
  const icon = "size-[1.1rem] text-ink-soft"

  return (
    <div ref={root} className="relative flex h-full items-center">
      <button
        ref={trigger}
        type="button"
        data-tour="help"
        aria-label={m.help}
        title={m.help}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={(e) => {
          if (e.key !== "ArrowDown" || open) return
          e.preventDefault()
          setOpen(true)
        }}
        className={cx(
          "grid size-[2.2rem] place-items-center rounded-[0.4rem] text-ink-soft hover:bg-app-3 hover:text-ink",
          open && "bg-app-3 text-ink",
        )}
      >
        <CircleHelp className="size-[1.2rem]" strokeWidth={1.8} aria-hidden />
      </button>
      {open && (
        <div
          id={listId}
          role="menu"
          aria-label={m.help}
          tabIndex={-1}
          onKeyDown={onMenuKey}
          className="absolute top-[calc(100%-0.3rem)] right-0 z-30 flex w-max min-w-[14rem] flex-col rounded-[0.6rem] border border-line bg-app p-[0.3rem] shadow-panel motion-safe:animate-[select-in_120ms_var(--ease-out-quart)]"
        >
          <button type="button" role="menuitem" className={item} onClick={pick(onTour)}>
            <Compass className={icon} strokeWidth={1.8} aria-hidden />
            {m.tour}
          </button>
          <button type="button" role="menuitem" className={item} onClick={pick(onWelcome)}>
            <Sparkles className={icon} strokeWidth={1.8} aria-hidden />
            {m.welcome}
          </button>
          <hr className="mx-[0.4rem] my-[0.3rem] border-line" />
          <button type="button" role="menuitem" className={item} onClick={pick(onAbout)}>
            <Info className={icon} strokeWidth={1.8} aria-hidden />
            {m.about}
          </button>
        </div>
      )}
    </div>
  )
}
