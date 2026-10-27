import { type ReactNode, useEffect, useRef, useState } from "react"
import { cx } from "./cx"
import { PANEL_MS, reducedMotion } from "./motion"

type Props = {
  open: boolean
  children: ReactNode
  id?: string
  className?: string
}

/**
 * Opens and closes its content by height. Closed content stays on screen until it has folded away, then unmounts, so
 * whatever it polls or runs on mount stops with it.
 */
export function Collapse({ open, children, id, className }: Props) {
  const [mounted, setMounted] = useState(open)
  const [moving, setMoving] = useState(false)
  const first = useRef(true)
  const last = useRef(children)
  if (open) last.current = children

  useEffect(() => {
    if (first.current) {
      first.current = false
      return
    }
    if (open) setMounted(true)
    const instant = reducedMotion()
    setMoving(!instant)
    // A timer, not transitionend: that event never fires when nothing changed, nor in tests.
    const t = setTimeout(
      () => {
        setMoving(false)
        if (!open) setMounted(false)
      },
      instant ? 0 : PANEL_MS,
    )
    return () => clearTimeout(t)
  }, [open])

  return (
    <div
      id={id}
      inert={!open || undefined}
      data-state={open ? "open" : "closed"}
      className={cx(
        "grid transition-[grid-template-rows] duration-300 ease-out-quart motion-reduce:transition-none",
        open ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
      )}
    >
      {/* Clipped only while it moves, so focus rings and menus inside an open panel are not cut off. */}
      <div className={cx("min-h-0", (!open || moving) && "overflow-hidden")}>
        {(open || mounted) && <div className={className}>{open ? children : last.current}</div>}
      </div>
    </div>
  )
}
