import { useEffect } from "react"
import { useNav } from "@/features/nav"
import { platform } from "@/platform/bridge"

const BACK = 3
const FORWARD = 4

const editable = (t: EventTarget | null) =>
  t instanceof HTMLElement && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))

const dialogOpen = () => document.querySelector("dialog[open]") !== null

/** The mouse's back and forward buttons, Alt+Left/Right, and Cmd+[ / Cmd+] on macOS step through visited sections. */
export function useSectionHistory(enabled: boolean) {
  useEffect(() => {
    if (!enabled) return
    const step = (dir: "back" | "forward") => {
      if (dialogOpen()) return
      const nav = useNav.getState()
      if (dir === "back") nav.back()
      else nav.forward()
    }
    // The browser and some webviews act on mousedown or mouseup; stopping both keeps them from leaving the page.
    const swallow = (e: MouseEvent) => {
      if (e.button === BACK || e.button === FORWARD) e.preventDefault()
    }
    const onMouseUp = (e: MouseEvent) => {
      if (e.button !== BACK && e.button !== FORWARD) return
      e.preventDefault()
      step(e.button === BACK ? "back" : "forward")
    }
    const mac = platform.os === "macos"
    const onKey = (e: KeyboardEvent) => {
      if (editable(e.target)) return
      const alt = e.altKey && !e.ctrlKey && !e.metaKey && !e.shiftKey
      const cmd = mac && e.metaKey && !e.altKey && !e.ctrlKey && !e.shiftKey
      const dir =
        (alt && e.key === "ArrowLeft") || (cmd && e.key === "[")
          ? "back"
          : (alt && e.key === "ArrowRight") || (cmd && e.key === "]")
            ? "forward"
            : null
      if (!dir) return
      e.preventDefault()
      step(dir)
    }
    window.addEventListener("mousedown", swallow)
    window.addEventListener("mouseup", onMouseUp)
    window.addEventListener("keydown", onKey)
    return () => {
      window.removeEventListener("mousedown", swallow)
      window.removeEventListener("mouseup", onMouseUp)
      window.removeEventListener("keydown", onKey)
    }
  }, [enabled])
}
