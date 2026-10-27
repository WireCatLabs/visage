import { type ReactNode, useLayoutEffect, useRef } from "react"
import { keepRoom, PANEL_MS, reducedMotion } from "./motion"

/**
 * Follows its content's height with a transition, so a step or a message that swaps for a taller or shorter one
 * slides what is below it instead of shoving it. The box always holds an explicit height: when the content shrinks,
 * the page keeps its length until the transition runs, so the browser never clamps the scroll in between.
 */
export function AutoHeight({ children, className }: { children: ReactNode; className?: string }) {
  const outer = useRef<HTMLDivElement>(null)
  const inner = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    const box = outer.current
    const content = inner.current
    if (!box || !content || typeof ResizeObserver === "undefined") return
    let width = content.offsetWidth
    box.style.height = `${content.offsetHeight}px`
    let settle: ReturnType<typeof setTimeout> | undefined
    // Runs after layout and before paint, so the new height is never drawn unanimated first.
    const observer = new ResizeObserver(() => {
      const next = content.offsetHeight
      const resized = content.offsetWidth !== width
      width = content.offsetWidth
      if (`${next}px` === box.style.height) return
      clearTimeout(settle)
      if (!resized && next < box.offsetHeight) keepRoom(box)
      // A window resize re-wraps the text; following it with a delay would only look slow.
      if (resized || reducedMotion()) {
        box.style.transition = ""
        box.style.overflow = ""
        box.style.height = `${next}px`
        return
      }
      box.style.overflow = "hidden"
      box.style.transition = `height ${PANEL_MS}ms var(--ease-out-quart)`
      box.style.height = `${next}px`
      settle = setTimeout(() => {
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
