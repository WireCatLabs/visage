import { Button } from "@/ui/Button"
import { type Progress, percent } from "./backup-store"

const STEP: Record<Progress["step"], string> = {
  starting: "Checking disk space",
  copying: "Copying storage",
  compressing: "Compressing",
}

export function BackupProgress({ progress, onCancel }: { progress: Progress; onCancel: () => void }) {
  const pct = percent(progress)
  return (
    <div className="flex items-center gap-4">
      <span className="w-[10.5rem] shrink-0 text-[0.9rem] text-ink-soft">{STEP[progress.step]}…</span>
      <div
        role="progressbar"
        aria-label={STEP[progress.step]}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pct}
        className="h-1.5 flex-1 overflow-hidden rounded-full bg-app-3"
      >
        <div
          className="h-full rounded-full bg-brand motion-safe:transition-[width] motion-safe:duration-150"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="w-[3rem] shrink-0 text-right font-mono text-[0.875rem] tabular-nums text-ink-soft">{pct}%</span>
      <Button variant="ghost" size="sm" onClick={onCancel}>
        Cancel
      </Button>
    </div>
  )
}
