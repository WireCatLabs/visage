/** Rule 9's one motion vocabulary: how long a panel takes to open or close, and how focus moves without a jump. */
export const PANEL_MS = 300

export const reducedMotion = () => window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false

export function scrollerOf(el: Element | null): HTMLElement | null {
  for (let node = el?.parentElement ?? null; node; node = node.parentElement) {
    const { overflowY } = getComputedStyle(node)
    if (overflowY === "auto" || overflowY === "scroll") return node
  }
  return null
}

/** Scrolls only when `el` is out of sight, and only as far as needed. */
export function revealIfHidden(el: Element | null) {
  if (!el) return
  const box = el.getBoundingClientRect()
  const view = scrollerOf(el)?.getBoundingClientRect() ?? { top: 0, bottom: window.innerHeight }
  if (box.top >= view.top && box.bottom <= view.bottom) return
  el.scrollIntoView?.({ block: "nearest", behavior: reducedMotion() ? "auto" : "smooth" })
}

/** Focus for keyboard and screen readers that never moves the page by itself: `focus()` alone scrolls. */
export function focusInPlace(el: HTMLElement | null) {
  if (!el) return
  el.focus({ preventScroll: true })
  revealIfHidden(el)
}

/**
 * Keeps `el` where it is on screen while panels around it open and close. A panel closing above it would pull it up;
 * one closing below it would shrink the page and clamp the scroll, which reads as "jumped to the top". The page keeps
 * the room it had until the reader scrolls back up into it, so neither happens.
 */
export function holdInPlace(el: HTMLElement, ms = PANEL_MS + 100) {
  const scroller = scrollerOf(el)
  const page = scroller?.firstElementChild
  if (!scroller || !(page instanceof HTMLElement)) return
  const top = el.getBoundingClientRect().top
  reserve(scroller, page, scroller.scrollTop + scroller.clientHeight)
  const end = performance.now() + ms
  const tick = () => {
    if (!el.isConnected) return
    const drift = el.getBoundingClientRect().top - top
    if (Math.abs(drift) >= 1) scroller.scrollTop += drift
    if (performance.now() < end) requestAnimationFrame(tick)
  }
  requestAnimationFrame(tick)
}

const reserved = new WeakMap<HTMLElement, () => void>()

function reserve(scroller: HTMLElement, page: HTMLElement, height: number) {
  reserved.get(scroller)?.()
  page.style.minHeight = `${height}px`
  const shrink = () => {
    const need = scroller.scrollTop + scroller.clientHeight
    if (scroller.scrollTop <= 0 || !page.isConnected) return release()
    if (need < Number.parseFloat(page.style.minHeight)) page.style.minHeight = `${need}px`
  }
  const release = () => {
    page.style.minHeight = ""
    scroller.removeEventListener("scroll", shrink)
    reserved.delete(scroller)
  }
  scroller.addEventListener("scroll", shrink, { passive: true })
  reserved.set(scroller, release)
}
