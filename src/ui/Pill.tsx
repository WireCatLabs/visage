import type { ReactNode } from "react"
import { cx } from "./cx"

export function Pill({ children, tone = "neutral" }: { children: ReactNode; tone?: "neutral" | "brand" | "warn" }) {
  return (
    <span
      className={cx(
        "inline-flex items-center rounded-[0.3rem] px-[0.45rem] py-[0.1rem] text-[0.8rem] font-medium",
        tone === "neutral" && "bg-app-3 text-ink-soft",
        tone === "brand" && "bg-brand-soft text-brand",
        tone === "warn" && "bg-warn/15 text-warn",
      )}
    >
      {children}
    </span>
  )
}
