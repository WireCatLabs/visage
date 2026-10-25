import { X } from "lucide-react"
import { type ReactNode, useEffect, useId, useLayoutEffect, useRef, useState } from "react"
import { Button } from "./Button"

type Props = {
  anchor: Element | null
  /** Where the callout sits relative to its anchor; it flips when there is no room. */
  side?: "bottom" | "right" | undefined
  title: string
  children: ReactNode
  index: number
  count: number
  onBack: () => void
  onNext: () => void
  onClose: () => void
}

type Box = { top: number; left: number; width: number; height: number }

const GAP = 12
const MARGIN = 16
const RING = 6

const measure = (el: Element | null): Box | null => {
  if (!el) return null
  const r = el.getBoundingClientRect()
  return { top: r.top, left: r.left, width: r.width, height: r.height }
}

function place(target: Box | null, size: { w: number; h: number }, side: "bottom" | "right") {
  const vw = window.innerWidth
  const vh = window.innerHeight
  const clamp = (v: number, max: number) => Math.max(MARGIN, Math.min(v, max - MARGIN))
  if (!target) return { top: (vh - size.h) / 2, left: (vw - size.w) / 2 }
  if (side === "right" && target.left + target.width + GAP + size.w < vw - MARGIN) {
    return {
      top: clamp(target.top + target.height / 2 - size.h / 2, vh - size.h),
      left: target.left + target.width + GAP + RING,
    }
  }
  const below = target.top + target.height + GAP + RING
  const top = below + size.h < vh - MARGIN ? below : target.top - GAP - RING - size.h
  return { top: clamp(top, vh - size.h), left: clamp(target.left, vw - size.w) }
}

/**
 * One step of a guided tour: a ring around a real element, the rest of the window dimmed, and a small panel
 * beside it. It does not trap focus or block the page, so the owner can still click what it points at.
 */
export function Callout({ anchor, side = "bottom", title, children, index, count, onBack, onNext, onClose }: Props) {
  const titleId = useId()
  const panel = useRef<HTMLDivElement>(null)
  const [target, setTarget] = useState<Box | null>(() => measure(anchor))
  const [size, setSize] = useState<{ w: number; h: number } | null>(null)

  useLayoutEffect(() => {
    const update = () => setTarget(measure(anchor))
    update()
    window.addEventListener("resize", update)
    window.addEventListener("scroll", update, true)
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(update)
    if (anchor) observer?.observe(anchor)
    return () => {
      window.removeEventListener("resize", update)
      window.removeEventListener("scroll", update, true)
      observer?.disconnect()
    }
  }, [anchor])

  // biome-ignore lint/correctness/useExhaustiveDependencies: each step brings new content, so it is measured again
  useLayoutEffect(() => {
    const el = panel.current
    if (el) setSize({ w: el.offsetWidth, h: el.offsetHeight })
  }, [index, title])

  // biome-ignore lint/correctness/useExhaustiveDependencies: focus moves to the new step's button
  useEffect(() => {
    panel.current?.querySelector<HTMLButtonElement>("[data-primary]")?.focus()
  }, [index])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault()
        onClose()
      }
    }
    document.addEventListener("keydown", onKey)
    return () => document.removeEventListener("keydown", onKey)
  }, [onClose])

  const pos = place(target, size ?? { w: 0, h: 0 }, side)
  const last = index === count - 1

  return (
    <>
      <div
        aria-hidden
        className="pointer-events-none fixed z-40 rounded-[0.45rem] transition-[top,left,width,height] duration-300 ease-out-quart"
        style={
          target
            ? {
                top: target.top - RING,
                left: target.left - RING,
                width: target.width + RING * 2,
                height: target.height + RING * 2,
                boxShadow: "0 0 0 2px var(--brand), 0 0 0 200vmax rgb(0 0 0 / 30%)",
              }
            : { inset: 0, borderRadius: 0, background: "rgb(0 0 0 / 30%)" }
        }
      />
      <div
        ref={panel}
        role="dialog"
        aria-modal="false"
        aria-labelledby={titleId}
        onKeyDown={(e) => {
          if (e.key === "ArrowRight" && !last) onNext()
          if (e.key === "ArrowLeft" && index > 0) onBack()
        }}
        className="fixed z-50 flex w-[min(23rem,calc(100vw-2rem))] flex-col gap-2 rounded-[0.6rem] border border-line bg-app p-[1.1rem] text-ink shadow-panel transition-[top,left] duration-300 ease-out-quart"
        style={{ top: pos.top, left: pos.left, visibility: size ? "visible" : "hidden" }}
      >
        <div className="flex items-start justify-between gap-3">
          <h2 id={titleId} className="text-[1.08rem] font-semibold leading-tight">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close the tour"
            className="-mt-1 -mr-1 grid size-7 shrink-0 place-items-center rounded-[0.35rem] text-ink-dim hover:bg-app-3 hover:text-ink"
          >
            <X className="size-4" aria-hidden />
          </button>
        </div>
        <div className="text-[0.95rem] leading-relaxed text-ink-soft">{children}</div>
        <div className="mt-2 flex items-center gap-2">
          <span className="flex-1 font-mono text-[0.8rem] text-ink-dim tabular-nums">
            {index + 1} of {count}
          </span>
          {index > 0 && (
            <Button size="sm" variant="ghost" onClick={onBack}>
              Back
            </Button>
          )}
          <Button data-primary size="sm" variant="primary" onClick={last ? onClose : onNext}>
            {last ? "Done" : "Next"}
          </Button>
        </div>
      </div>
    </>
  )
}
