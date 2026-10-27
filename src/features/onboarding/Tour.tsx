import { useCallback, useLayoutEffect, useState } from "react"
import { create } from "zustand"
import { Callout } from "@/ui/Callout"
import { reducedMotion } from "@/ui/motion"

type Stop = { anchor: string; side?: "bottom" | "right"; title: string; text: string }

// Anchors are data-tour attributes on the real elements, so the tour follows the interface instead of a copy of it.
const stops: readonly Stop[] = [
  {
    anchor: '[data-tour="readiness"]',
    title: "Your computer",
    text: "WireCat tools run on Node.js and npm. A green lamp means it is here and new enough; hover a value to see where it was found.",
  },
  {
    anchor: '[data-tour="tool"] [role="img"]',
    title: "Status lamps",
    text: "Green: installed and current. Amber: an update is ready. Red: installed, but it does not start. A hollow ring: not installed.",
  },
  {
    anchor: '[data-tour="tool-action"]',
    title: "One action per tool",
    text: "Install or Update puts the latest version on this computer. Manage opens the tool's profiles, sign-in and health check.",
  },
  {
    anchor: '[data-tour="check-again"]',
    title: "Check again",
    text: "Installed or removed something in a terminal? Check again looks at this computer and npm once more.",
  },
  {
    anchor: '[data-tour="nav-storage"]',
    side: "right",
    title: "Storage",
    text: "How much space each tool's data takes, and a way to delete it once nothing uses it.",
  },
  {
    anchor: '[data-tour="nav-logs"]',
    side: "right",
    title: "Logs",
    text: "What each tool did, run by run: the command, how long it took and what went wrong.",
  },
  {
    anchor: '[data-tour="help"]',
    title: "Help is here",
    text: "Start this tour again, or go back to the setup steps, from this button.",
  },
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
      title={current.stop.title}
      index={index}
      count={found.length}
      onBack={() => setIndex((i) => Math.max(0, i - 1))}
      onNext={() => setIndex((i) => Math.min(found.length - 1, i + 1))}
      onClose={onClose}
    >
      {current.stop.text}
    </Callout>
  )
}
