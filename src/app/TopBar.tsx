import { Minus, Square, X } from "lucide-react"
import type { ReactNode } from "react"
import { platform, type WindowAction } from "@/platform/bridge"

const controls: { action: WindowAction; label: string; icon: ReactNode }[] = [
  { action: "minimize", label: "Minimise", icon: <Minus className="size-[1.1rem]" aria-hidden /> },
  { action: "toggleMaximize", label: "Maximise", icon: <Square className="size-[0.9rem]" aria-hidden /> },
  { action: "close", label: "Close", icon: <X className="size-[1.15rem]" aria-hidden /> },
]

// The window has no system title bar on Linux and Windows, so this strip is where it is dragged from.
// macOS keeps its own traffic lights over the sidebar.
export function TopBar() {
  return (
    <header data-tauri-drag-region className="flex h-[3.3rem] shrink-0 justify-end border-line border-b">
      {platform.os !== "macos" && (
        <div className="flex h-full">
          {controls.map((c) => (
            <button
              key={c.action}
              type="button"
              aria-label={c.label}
              title={c.label}
              onClick={() => platform.window(c.action)}
              className={
                c.action === "close"
                  ? "grid w-[3.4rem] place-items-center text-ink-soft transition-colors hover:bg-bad hover:text-white"
                  : "grid w-[3.4rem] place-items-center text-ink-soft transition-colors hover:bg-app-3 hover:text-ink"
              }
            >
              {c.icon}
            </button>
          ))}
        </div>
      )}
    </header>
  )
}
