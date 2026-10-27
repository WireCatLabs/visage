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
 * whatever it polls or runs on mount stops with it. Fully closed, it takes no room, not even a flex gap.
 */
export function Collapse({ open, children, id, className }: Props) {
  const [mounted, setMounted] = useState(open)
  // The rows open a frame after the content mounts, so the browser has a closed height to animate from.
  const [rows, setRows] = useState(open)
  const [moving, setMoving] = useState(false)
  const first = useRef(true)
  const last = useRef(children)
  if (open) last.current = children

  useEffect(() => {
    if (first.current) {
      first.current = false
      return
    }
    const instant = reducedMotion()
    setMoving(!instant)
    let frame = 0
    if (open) {
      setMounted(true)
      frame = requestAnimationFrame(() => setRows(true))
    } else setRows(false)
    // A timer, not transitionend: that event never fires when nothing changed, nor in tests.
    const t = setTimeout(
      () => {
        setMoving(false)
        if (!open) setMounted(false)
      },
      instant ? 0 : PANEL_MS,
    )
    return () => {
      cancelAnimationFrame(frame)
      clearTimeout(t)
    }
  }, [open])

  return (
    <div
      id={id}
      hidden={!open && !mounted}
      inert={!open || undefined}
      aria-hidden={!open || undefined}
      data-state={open ? "open" : "closed"}
      className={cx(
        "grid transition-[grid-template-rows] duration-300 ease-out-quart motion-reduce:transition-none",
        open && rows ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
      )}
    >
      {/* Clipped only while it moves, so focus rings and menus inside an open panel are not cut off. */}
      <div className={cx("min-h-0", (!open || moving || !rows) && "overflow-hidden")}>
        {(open || mounted) && <div className={className}>{open ? children : last.current}</div>}
      </div>
    </div>
  )
}
