import { Check, X } from "lucide-react"
import { cx } from "./cx"

export type StepState = "done" | "active" | "failed" | "todo"

export function Stepper({ steps }: { steps: readonly { label: string; state: StepState }[] }) {
  return (
    <ol className="grid" style={{ gridTemplateColumns: `repeat(${steps.length}, minmax(0, 1fr))` }}>
      {steps.map((s, i) => (
        <li key={s.label} className="relative flex flex-col items-center gap-3 text-center">
          {i > 0 && (
            <span
              aria-hidden
              className={cx(
                "absolute top-[0.8rem] right-1/2 h-[2px] w-full -translate-y-1/2 transition-colors duration-500",
                s.state === "todo" ? "bg-line-strong" : s.state === "failed" ? "bg-bad/60" : "bg-brand",
              )}
            />
          )}
          <span
            className={cx(
              "relative z-10 grid size-[1.6rem] place-items-center rounded-full transition-colors duration-300",
              s.state === "done" && "bg-ok text-on-status",
              s.state === "active" && "step-pulse bg-brand",
              s.state === "failed" && "bg-bad text-on-status",
              s.state === "todo" && "scale-[0.62] bg-idle",
            )}
          >
            {s.state === "done" && <Check className="size-4" strokeWidth={3} aria-hidden />}
            {s.state === "failed" && <X className="size-4" strokeWidth={3} aria-hidden />}
          </span>
          <span
            className={cx(
              "text-[0.95rem]",
              s.state === "active" ? "font-semibold text-ink" : "text-ink-soft",
              s.state === "failed" && "font-semibold text-bad",
            )}
          >
            {s.label}
            <span className="sr-only">
              {s.state === "done"
                ? ", done"
                : s.state === "active"
                  ? ", in progress"
                  : s.state === "failed"
                    ? ", failed"
                    : ""}
            </span>
          </span>
        </li>
      ))}
    </ol>
  )
}
