export type InstallStep = "queued" | "check" | "install" | "remove" | "verify"

export type Operation = "install" | "uninstall"

export type FailReason = "requirements" | "permission" | "network" | "timeout" | "cancelled" | "verify" | "failed"

export type InstallRecord = { path: string; version: string | null; manager: string; problem: string | null }

export type InstallOutcome =
  | { event: "done"; version: string; path: string; shadowedBy: string | null }
  | { event: "removed" }
  | { event: "failed"; reason: FailReason; message: string; hint: string | null }

/** Deleting the tool's own folders after an uninstall the owner asked for; `bytes` is what the dialog showed. */
export type DataDeletion =
  | { state: "waiting" | "deleting" | "deleted"; bytes: number }
  | { state: "failed"; bytes: number; message: string }

export type InstallSession = {
  operation: Operation
  step: InstallStep
  log: string[]
  outcome: InstallOutcome | null
  /** Only on an uninstall whose dialog had "Also delete … data" checked. */
  data?: DataDeletion
  /** Rows of the package whose panel the owner already closed; the package's other rows keep theirs. */
  closed?: string[]
}

export type ToolStatus =
  | { kind: "checking" }
  | { kind: "missing" }
  | { kind: "working"; operation: Operation; step: InstallStep }
  | { kind: "broken"; problem: string }
  | { kind: "outdated"; version: string; latest: string }
  /** `checkingUpdates` while npm has not answered yet: the tool may still turn out to be outdated. */
  | { kind: "ready"; version: string; checkingUpdates: boolean }

export function toolStatus(
  installs: readonly InstallRecord[] | undefined,
  latest: string | null | undefined,
  session?: InstallSession,
): ToolStatus {
  if (session && !session.outcome) return { kind: "working", operation: session.operation, step: session.step }
  if (!installs) return { kind: "checking" }
  const active = installs[0]
  if (!active) return { kind: "missing" }
  if (!active.version) return { kind: "broken", problem: active.problem ?? "does not start" }
  if (latest && isNewer(latest, active.version)) return { kind: "outdated", version: active.version, latest }
  return { kind: "ready", version: active.version, checkingUpdates: latest === undefined }
}

const parts = (v: string) =>
  v
    .split("-")[0]
    ?.split(".")
    .map((n) => Number.parseInt(n, 10) || 0) ?? []

export function isNewer(candidate: string, current: string): boolean {
  const a = parts(candidate)
  const b = parts(current)
  for (let i = 0; i < 3; i++) {
    const x = a[i] ?? 0
    const y = b[i] ?? 0
    if (x !== y) return x > y
  }
  return false
}

// Labels for each step are in src/features/tools/messages.tsx, keyed by step.
export const STEPS: Record<Operation, readonly { step: InstallStep | "done" }[]> = {
  install: [{ step: "check" }, { step: "install" }, { step: "verify" }, { step: "done" }],
  uninstall: [{ step: "check" }, { step: "remove" }, { step: "verify" }, { step: "done" }],
}
