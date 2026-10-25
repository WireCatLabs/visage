import { Bug, CircleHelp, Compass, Sparkles } from "lucide-react"
import { useEffect, useId, useRef, useState } from "react"
import { cx } from "@/ui/cx"

type Props = { onTour: () => void; onWelcome: () => void; onReport: () => void }

export function HelpMenu({ onTour, onWelcome, onReport }: Props) {
  const [open, setOpen] = useState(false)
  const root = useRef<HTMLDivElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  const listId = useId()

  useEffect(() => {
    if (!open) return
    root.current?.querySelector<HTMLButtonElement>("[data-item]")?.focus()
    const onDown = (e: MouseEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
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

  const pick = (action: () => void) => () => {
    setOpen(false)
    trigger.current?.focus()
    action()
  }

  const item =
    "flex h-[2.4rem] w-full items-center gap-[0.7rem] rounded-[0.35rem] px-[0.7rem] pr-[1rem] text-left text-[0.95rem] whitespace-nowrap text-ink hover:bg-app-3"

  return (
    <div ref={root} className="relative flex h-full items-center">
      <button
        ref={trigger}
        type="button"
        data-tour="help"
        aria-label="Help"
        title="Help"
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => setOpen((o) => !o)}
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
          className="absolute top-[calc(100%-0.3rem)] right-0 z-30 flex w-max min-w-[14rem] flex-col rounded-[0.6rem] border border-line bg-app p-[0.3rem] shadow-panel"
        >
          <button type="button" data-item className={item} onClick={pick(onTour)}>
            <Compass className="size-[1.1rem] text-ink-soft" strokeWidth={1.8} aria-hidden />
            Take the tour
          </button>
          <button type="button" data-item className={item} onClick={pick(onWelcome)}>
            <Sparkles className="size-[1.1rem] text-ink-soft" strokeWidth={1.8} aria-hidden />
            Show the welcome again
          </button>
          <button type="button" data-item className={item} onClick={pick(onReport)}>
            <Bug className="size-[1.1rem] text-ink-soft" strokeWidth={1.8} aria-hidden />
            Report a problem
          </button>
        </div>
      )}
    </div>
  )
}
