import { useEffect, useState } from "react"
import type { McpServerStatus } from "@/platform/mcp-server-schemas"
import { CopyField } from "@/ui/CopyField"
import { cx } from "@/ui/cx"

const MARK_MS = 20_000

type Seen = { code: string; expiresAt: string; newest: string }

const newestLogin = (s: McpServerStatus) =>
  s.clients.reduce((max, c) => (c.lastLoginAt > max ? c.lastLoginAt : max), "")

/**
 * The server's login code, which works for one login: after an app logs in, the tool shows a new one. When the code
 * changes before it ran out, this says so, naming the app that logged in once its login shows in the status.
 */
export function LoginCode({
  server,
}: {
  server: McpServerStatus & { loginCode: { code: string; expiresAt: string } }
}) {
  const { code, expiresAt } = server.loginCode
  const newest = newestLogin(server)
  const [seen, setSeen] = useState<Seen>({ code, expiresAt, newest })
  // The newest login before the code changed: the app that used it logged in after that.
  const [usedAfter, setUsedAfter] = useState<string | null>(null)

  if (seen.code !== code) {
    setSeen({ code, expiresAt, newest })
    // A code that ran out is simply renewed; nobody used it.
    setUsedAfter(Date.parse(seen.expiresAt) > Date.now() ? seen.newest : null)
  } else if (newest > seen.newest && usedAfter === null) {
    // An app that refreshes its token moves its login time without using a code.
    setSeen({ ...seen, newest })
  }

  useEffect(() => {
    if (usedAfter === null) return
    const t = setTimeout(() => setUsedAfter(null), MARK_MS)
    return () => clearTimeout(t)
  }, [usedAfter])

  const user =
    usedAfter === null
      ? null
      : server.clients
          .filter((c) => c.lastLoginAt > usedAfter)
          .sort((a, b) => (a.lastLoginAt < b.lastLoginAt ? 1 : -1))[0]
  const name = user ? (user.claimedName === null ? "an app with no name" : `“${user.claimedName}”`) : null

  return (
    <div className="flex flex-col gap-1">
      <div
        className={cx(
          "rounded-[0.45rem] motion-safe:transition-shadow motion-safe:duration-300",
          usedAfter !== null && "ring-2 ring-brand/50",
        )}
      >
        <CopyField key={code} value={code} label="Copy the login code" />
      </div>
      <span className="text-[0.85rem] text-ink-dim tabular-nums" aria-live="polite">
        {usedAfter === null ? (
          <>Each code works for one login. After an app logs in, a new one appears here.</>
        ) : (
          <span className="font-medium text-ink">New code — the last one was used{name ? ` by ${name}` : ""}.</span>
        )}
      </span>
    </div>
  )
}
