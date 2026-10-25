import { Button } from "@/ui/Button"
import { type Progress, percent } from "./backup-store"

const STEP: Record<Progress["step"], string> = {
  starting: "Checking disk space",
  copying: "Copying storage",
  compressing: "Compressing",
  encrypting: "Encrypting",
}

export function BackupProgress({ progress, onCancel }: { progress: Progress; onCancel: () => void }) {
  const pct = percent(progress)
  // The tool seals in one run and prints nothing until it ends, so there is no share done to show.
  const unknown = progress.step === "encrypting"
  return (
    <div className="flex items-center gap-4">
      <span className="w-[10.5rem] shrink-0 text-[0.9rem] text-ink-soft">{STEP[progress.step]}…</span>
      <div
        role="progressbar"
        aria-label={STEP[progress.step]}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={unknown ? undefined : pct}
        className="h-1.5 flex-1 overflow-hidden rounded-full bg-app-3"
      >
        <div
          className={
            unknown
              ? "h-full w-full rounded-full bg-brand/60 motion-safe:animate-pulse"
              : "h-full rounded-full bg-brand motion-safe:transition-[width] motion-safe:duration-150"
          }
          style={unknown ? undefined : { width: `${pct}%` }}
        />
      </div>
      <span className="w-[3rem] shrink-0 text-right font-mono text-[0.875rem] tabular-nums text-ink-soft">
        {unknown ? "" : `${pct}%`}
      </span>
      {/* Stopping the tool mid-seal leaves its plain copy of the whole store beside it, so sealing runs to the end. */}
      {unknown ? (
        <span className="w-[4.6rem] shrink-0 text-right text-[0.8rem] text-ink-dim">Can't stop</span>
      ) : (
        <Button variant="ghost" size="sm" className="w-[4.6rem]" onClick={onCancel}>
          Cancel
        </Button>
      )}
    </div>
  )
}
