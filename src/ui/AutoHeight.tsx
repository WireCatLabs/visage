import { type ReactNode, useLayoutEffect, useRef } from "react"
import { PANEL_MS, reducedMotion } from "./motion"

/**
 * Follows its content's height with a transition, so a step or a message that swaps for a taller or shorter one
 * slides what is below it instead of shoving it.
 */
export function AutoHeight({ children, className }: { children: ReactNode; className?: string }) {
  const outer = useRef<HTMLDivElement>(null)
  const inner = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    const box = outer.current
    const content = inner.current
    if (!box || !content || typeof ResizeObserver === "undefined") return
    let height = content.offsetHeight
    let settle: ReturnType<typeof setTimeout> | undefined
    // Runs after layout and before paint, so the new height is never drawn unanimated first.
    const observer = new ResizeObserver(() => {
      const next = content.offsetHeight
      if (next === height) return
      const from = box.style.height ? box.offsetHeight : height
      height = next
      if (reducedMotion()) return
      clearTimeout(settle)
      box.style.transition = "none"
      box.style.height = `${from}px`
      box.style.overflow = "hidden"
      void box.offsetHeight
      box.style.transition = `height ${PANEL_MS}ms var(--ease-out-quart)`
      box.style.height = `${next}px`
      settle = setTimeout(() => {
        box.style.height = ""
        box.style.overflow = ""
        box.style.transition = ""
      }, PANEL_MS)
    })
    observer.observe(content)
    return () => {
      observer.disconnect()
      clearTimeout(settle)
    }
  }, [])

  return (
    <div ref={outer} className={className}>
      <div ref={inner}>{children}</div>
    </div>
  )
}
