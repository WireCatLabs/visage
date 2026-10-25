/** An error the window saw that no screen handled: kept in memory only, attached when a report comes from an error. */
export type AppError = {
  at: string
  kind: "error" | "rejection" | "render"
  name: string
  message: string
  stack: string | null
}

const SIZE = 10
const STACK_LIMIT = 2000
const ring: AppError[] = []

export function recordError(kind: AppError["kind"], e: unknown, stack?: string | null) {
  const error = e instanceof Error ? e : null
  ring.push({
    at: new Date().toISOString(),
    kind,
    name: error?.name ?? typeof e,
    message: error?.message ?? String(e),
    stack: (stack ?? error?.stack ?? null)?.slice(0, STACK_LIMIT) ?? null,
  })
  if (ring.length > SIZE) ring.splice(0, ring.length - SIZE)
}

export const recentErrors = (): readonly AppError[] => [...ring]

export function clearErrors() {
  ring.length = 0
}

export function captureErrors(target: Window = window) {
  target.addEventListener("error", (e) => recordError("error", e.error ?? e.message))
  target.addEventListener("unhandledrejection", (e) => recordError("rejection", e.reason))
}
