import { cx } from "./cx"

export type LampTone = "ok" | "warn" | "bad" | "idle" | "busy"

const tones: Record<LampTone, string> = {
  ok: "bg-ok",
  warn: "bg-warn",
  bad: "bg-bad",
  idle: "bg-transparent ring-[1.5px] ring-inset ring-idle",
  busy: "bg-brand animate-[lamp-pulse_1.4s_ease-in-out_infinite]",
}

export function Lamp({ tone, size = "md", label }: { tone: LampTone; size?: "sm" | "md"; label?: string }) {
  const className = cx(
    "inline-block shrink-0 rounded-full transition-colors duration-300",
    size === "md" ? "size-[1.4rem]" : "size-[0.85rem]",
    tones[tone],
  )
  if (!label) return <span aria-hidden className={className} />
  return <span role="img" aria-label={label} className={className} />
}
