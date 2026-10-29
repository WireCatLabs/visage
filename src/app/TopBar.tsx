import { Minus, Square, X } from "lucide-react"
import type { ReactNode } from "react"
import { useMessages } from "@/i18n"
import { platform, type WindowAction } from "@/platform/bridge"
import { appMessages } from "./messages"

const controls: { action: WindowAction; label: "minimise" | "maximise" | "close"; icon: ReactNode }[] = [
  { action: "minimize", label: "minimise", icon: <Minus className="size-[1.1rem]" aria-hidden /> },
  { action: "toggleMaximize", label: "maximise", icon: <Square className="size-[0.9rem]" aria-hidden /> },
  { action: "close", label: "close", icon: <X className="size-[1.15rem]" aria-hidden /> },
]

// The window has no system title bar on Linux and Windows, so this strip is where it is dragged from.
// macOS keeps its own traffic lights over the sidebar.
export function TopBar({ children }: { children?: ReactNode }) {
  const m = useMessages(appMessages)
  return (
    <header data-tauri-drag-region className="flex h-[3.3rem] shrink-0 justify-end border-line border-b">
      {children && <div className="flex h-full items-center px-[0.6rem]">{children}</div>}
      {platform.os !== "macos" && (
        <div className="flex h-full">
          {controls.map((c) => (
            <button
              key={c.action}
              type="button"
              aria-label={m[c.label]}
              title={m[c.label]}
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
