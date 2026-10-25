import { useEffect } from "react"
import { timing, useLogs } from "./store"

const selecting = () => {
  const s = document.getSelection()
  return Boolean(s && !s.isCollapsed && s.toString().trim())
}

/** Someone reading a run, copying text, or not looking at the window: a new round would only get in the way. */
export const livePaused = () =>
  document.visibilityState === "hidden" || useLogs.getState().expanded !== null || selecting()

const PAUSED_CHECK = 1000

/**
 * While `on`, reads the runs again `timing.live` after the last round ended. Each round waits for the one before,
 * so a slow round is followed by the full pause, never by another round straight away.
 */
export function useLive(on: boolean) {
  useEffect(() => {
    if (!on) return
    let stopped = false
    let timer: ReturnType<typeof setTimeout> | undefined
    const next = (ms: number) => {
      timer = setTimeout(tick, ms)
    }
    const tick = async () => {
      if (stopped) return
      if (livePaused()) return next(PAUSED_CHECK)
      await useLogs.getState().load({ live: true })
      if (!stopped) next(timing.live)
    }
    const at = useLogs.getState().loadedAt
    next(at === null ? timing.live : Math.max(0, timing.live - (Date.now() - at)))
    return () => {
      stopped = true
      clearTimeout(timer)
    }
  }, [on])
}
