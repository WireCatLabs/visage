import { useEffect } from "react"
import { create } from "zustand"
import { createJSONStorage, persist } from "zustand/middleware"
import { platform } from "@/platform/bridge"
import { reducedMotion } from "@/ui/motion"

/** The owner's interface size, in percent of the default. */
export const MIN_SCALE = 80
export const MAX_SCALE = 150
export const SCALE_STEP = 10
export const DEFAULT_SCALE = 100
const SCALE_MS = 200

export const clampScale = (percent: number) =>
  Number.isFinite(percent)
    ? Math.min(MAX_SCALE, Math.max(MIN_SCALE, Math.round(percent / SCALE_STEP) * SCALE_STEP))
    : DEFAULT_SCALE

type ScaleState = { percent: number; set(percent: number): void }

// Read before the first paint by the inline script in index.html; keep the key and shape in step with it.
export const useScale = create<ScaleState>()(
  persist((set) => ({ percent: DEFAULT_SCALE, set: (percent) => set({ percent: clampScale(percent) }) }), {
    name: "wirecat.scale",
    storage: createJSONStorage(() => localStorage),
    merge: (saved, current) => ({ ...current, percent: clampScale((saved as { percent?: number })?.percent ?? NaN) }),
  }),
)

const readVar = () => Number(document.documentElement.style.getPropertyValue("--ui-scale")) || 1
const writeVar = (scale: number) => document.documentElement.style.setProperty("--ui-scale", String(scale))

/**
 * Every size is in rem, so a new root size moves everything below the top of the page. What the owner is using (the
 * focused slider) or else what is at the top of the scrolling page is held where it was on each frame: Chrome's scroll
 * anchoring would only do the second, WebKitGTK does neither.
 */
function holdPlace() {
  const main = document.querySelector("main")
  if (!main) return () => undefined
  const box = main.getBoundingClientRect()
  const focused = document.activeElement
  const anchor =
    focused && focused !== document.body && main.contains(focused)
      ? focused
      : main.scrollTop > 0
        ? document.elementFromPoint(box.left + box.width / 2, box.top + 1)
        : null
  if (!anchor || !main.contains(anchor)) return () => undefined
  const offset = anchor.getBoundingClientRect().top - box.top
  return () => {
    main.scrollTop += anchor.getBoundingClientRect().top - main.getBoundingClientRect().top - offset
  }
}

let frame = 0

function applyScale(percent: number) {
  cancelAnimationFrame(frame)
  const to = percent / 100
  const from = readVar()
  if (from === to) return
  const hold = holdPlace()
  if (reducedMotion()) {
    writeVar(to)
    hold()
    return
  }
  const start = performance.now()
  const tick = () => {
    const t = Math.min(1, (performance.now() - start) / SCALE_MS)
    const eased = 1 - (1 - t) ** 4
    writeVar(from + (to - from) * eased)
    hold()
    if (t < 1) frame = requestAnimationFrame(tick)
  }
  frame = requestAnimationFrame(tick)
}

/** Keeps `--ui-scale` on `<html>` in step with the choice; the first paint already has the saved one. */
export function useApplyScale() {
  const percent = useScale((s) => s.percent)
  useEffect(() => applyScale(percent), [percent])
}

/** What a key press asks of the scale: Ctrl (Cmd on macOS) with `=` / `+`, `-`, or `0`, on any keyboard layout. */
export function scaleKey(e: KeyboardEvent, mac: boolean): "bigger" | "smaller" | "reset" | null {
  const mod = mac ? e.metaKey && !e.ctrlKey : e.ctrlKey && !e.metaKey
  if (!mod || e.altKey) return null
  if (e.code === "Equal" || e.code === "NumpadAdd" || e.key === "=" || e.key === "+") return "bigger"
  if (e.code === "Minus" || e.code === "NumpadSubtract" || e.key === "-") return "smaller"
  if (e.code === "Digit0" || e.code === "Numpad0" || e.key === "0") return "reset"
  return null
}

export function useScaleKeys() {
  useEffect(() => {
    const mac = platform.os === "macos"
    const onKey = (e: KeyboardEvent) => {
      const ask = scaleKey(e, mac)
      if (!ask) return
      e.preventDefault()
      const { percent, set } = useScale.getState()
      set(ask === "reset" ? DEFAULT_SCALE : percent + (ask === "bigger" ? SCALE_STEP : -SCALE_STEP))
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [])
}
