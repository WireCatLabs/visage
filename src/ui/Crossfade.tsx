import { type ReactNode, useEffect, useLayoutEffect, useRef, useState } from "react"
import { cx } from "./cx"
import { reducedMotion } from "./motion"

export const FADE_MS = 200

type Layer = { key: string; node: ReactNode }

/**
 * Swaps one view for another (an agent's pane for the next one) by fading the old out over the new, so the area never
 * goes blank. Each `swap` value mounts its own copy, so one view's state (an open disclosure) never leaks into the next.
 * The leaving copy is lifted out of the flow, so a surrounding `AutoHeight` follows only the new view's height.
 */
export function Crossfade({ swap, children, className }: { swap: string; children: ReactNode; className?: string }) {
  const [leaving, setLeaving] = useState<Layer[]>([])
  const [current, setCurrent] = useState(swap)
  const committed = useRef<Layer>({ key: swap, node: children })
  if (current !== swap) {
    setCurrent(swap)
    const old = committed.current
    setLeaving((l) => (reducedMotion() ? [] : [...l.filter((x) => x.key !== swap && x.key !== old.key), old]))
  }
  useLayoutEffect(() => {
    committed.current = { key: swap, node: children }
  })

  useEffect(() => {
    if (leaving.length === 0) return
    const t = setTimeout(() => setLeaving([]), FADE_MS)
    return () => clearTimeout(t)
  }, [leaving])

  // One keyed list, so the view that starts leaving keeps its mounted instance instead of being rebuilt.
  const layers = [...leaving.map((l) => ({ ...l, out: true })), { key: swap, node: children, out: false }]
  return (
    <div className={cx("relative", className)}>
      {layers.map((l) =>
        l.out ? (
          <div key={l.key} inert aria-hidden className="fade-out pointer-events-none absolute inset-x-0 top-0">
            {l.node}
          </div>
        ) : (
          <div key={l.key} className={leaving.length > 0 ? "fade-in" : undefined}>
            {l.node}
          </div>
        ),
      )}
    </div>
  )
}
