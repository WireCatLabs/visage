export type InstallStep = "queued" | "check" | "install" | "remove" | "verify"

export type Operation = "install" | "uninstall"

export type FailReason = "requirements" | "permission" | "network" | "timeout" | "cancelled" | "verify" | "failed"

export type InstallRecord = { path: string; version: string | null; manager: string; problem: string | null }

export type InstallOutcome =
  | { event: "done"; version: string; path: string; shadowedBy: string | null }
  | { event: "removed" }
  | { event: "failed"; reason: FailReason; message: string; hint: string | null }

export type InstallSession = {
  operation: Operation
  step: InstallStep
  log: string[]
  outcome: InstallOutcome | null
}

export type ToolStatus =
  | { kind: "checking" }
  | { kind: "missing" }
  | { kind: "working"; operation: Operation; step: InstallStep }
  | { kind: "broken"; problem: string }
  | { kind: "outdated"; version: string; latest: string }
  | { kind: "ready"; version: string }

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
  return { kind: "ready", version: active.version }
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

export const STEPS: Record<Operation, readonly { step: InstallStep | "done"; label: string }[]> = {
  install: [
    { step: "check", label: "Checking requirements" },
    { step: "install", label: "Installing" },
    { step: "verify", label: "Verifying" },
    { step: "done", label: "Done" },
  ],
  uninstall: [
    { step: "check", label: "Finding copies" },
    { step: "remove", label: "Removing" },
    { step: "verify", label: "Verifying" },
    { step: "done", label: "Done" },
  ],
}
