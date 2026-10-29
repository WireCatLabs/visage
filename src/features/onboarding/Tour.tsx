import { useCallback, useLayoutEffect, useState } from "react"
import { create } from "zustand"
import { useMessages } from "@/i18n"
import { Callout } from "@/ui/Callout"
import { reducedMotion } from "@/ui/motion"
import { onboardingMessages, type TourStop } from "./messages"

type Stop = { anchor: string; side?: "bottom" | "right"; key: TourStop }

// Anchors are data-tour attributes on the real elements, so the tour follows the interface instead of a copy of it.
const stops: readonly Stop[] = [
  { anchor: '[data-tour="readiness"]', key: "readiness" },
  { anchor: '[data-tour="tool"] [role="img"]', key: "lamps" },
  { anchor: '[data-tour="tool-action"]', key: "action" },
  { anchor: '[data-tour="check-again"]', key: "again" },
  { anchor: '[data-tour="nav-storage"]', side: "right", key: "storage" },
  { anchor: '[data-tour="nav-logs"]', side: "right", key: "logs" },
  { anchor: '[data-tour="help"]', key: "help" },
]

type TourState = { open: boolean; returnTo: HTMLElement | null; start(): void; close(): void }

export const useTour = create<TourState>((set, get) => ({
  open: false,
  returnTo: null,
  start: () =>
    set({ open: true, returnTo: document.activeElement instanceof HTMLElement ? document.activeElement : null }),
  close: () => {
    // Started from the setup's last step, the button that opened it is gone by now.
    const back = get().returnTo
    const fallback = document.querySelector<HTMLElement>('[data-tour="help"]')
    ;(back?.isConnected ? back : fallback)?.focus()
    set({ open: false, returnTo: null })
  },
}))

export function Tour() {
  const open = useTour((s) => s.open)
  return open ? <TourSteps /> : null
}

function TourSteps() {
  const close = useTour((s) => s.close)
  const [found, setFound] = useState<{ stop: Stop; el: Element }[] | null>(null)
  const [index, setIndex] = useState(0)
  const m = useMessages(onboardingMessages).tour

  // Measured after the Tools page has rendered; a stop whose element is not on screen is left out.
  useLayoutEffect(() => {
    setFound(
      stops.flatMap((stop) => {
        const el = document.querySelector(stop.anchor)
        return el ? [{ stop, el }] : []
      }),
    )
  }, [])

  const current = found?.[index]
  useLayoutEffect(() => {
    current?.el.scrollIntoView?.({ block: "nearest", behavior: reducedMotion() ? "auto" : "smooth" })
  }, [current])

  useLayoutEffect(() => {
    if (found?.length === 0) close()
  }, [found, close])

  const onClose = useCallback(() => close(), [close])
  if (!found || !current) return null

  return (
    <Callout
      anchor={current.el}
      side={current.stop.side}
      title={m[current.stop.key].title}
      index={index}
      count={found.length}
      onBack={() => setIndex((i) => Math.max(0, i - 1))}
      onNext={() => setIndex((i) => Math.min(found.length - 1, i + 1))}
      onClose={onClose}
    >
      {m[current.stop.key].text}
    </Callout>
  )
}
