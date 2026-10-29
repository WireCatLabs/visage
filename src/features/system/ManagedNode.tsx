import { useEffect, useState } from "react"
import { useMessages } from "@/i18n"
import { Button } from "@/ui/Button"
import { CopyField } from "@/ui/CopyField"
import { ErrorNotice } from "@/ui/ErrorNotice"
import { ReportThis } from "../report/ReportThis"
import { systemMessages } from "./messages"
import { useNode } from "./node-store"
import { useSystem } from "./store"

/** The PATH offer for the Node.js WireCat set up, and, outside the banner, removing it. */
export function ManagedNode({ compact = false }: { compact?: boolean }) {
  const managed = useSystem((s) => s.readiness?.managed ?? null)
  const path = useNode((s) => s.path)
  const busy = useNode((s) => s.busy)
  const error = useNode((s) => s.error)
  const [confirm, setConfirm] = useState(false)
  const m = useMessages(systemMessages)

  useEffect(() => {
    useNode.getState().loadPath()
  }, [])

  if (!managed) return null
  const where = (
    <span className="selectable font-mono text-[0.875rem] text-ink">
      {path?.shell === "windows" ? m.userPath : (path?.file ?? m.startupFile)}
    </span>
  )
  const version = <span className="selectable font-mono tabular-nums text-ink">{managed.version}</span>
  const dir = <span className="selectable font-mono text-[0.875rem] text-ink">{managed.dir}</span>

  return (
    <div className="flex flex-col gap-3 text-[0.95rem]">
      {!compact && (
        <p className="text-ink-soft">{managed.active ? m.managedActive(version, dir) : m.managedIdle(version, dir)}</p>
      )}

      {!path ? (
        <p className="text-ink-soft">{m.readingPath}</p>
      ) : path.added ? (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <p className="min-w-0 flex-1 text-ink-soft">{m.onPath(where)}</p>
          <Button size="sm" variant="ghost" disabled={busy} onClick={() => useNode.getState().setPath(false)}>
            {m.removeFromPath}
          </Button>
        </div>
      ) : (
        <>
          <p className="text-ink-soft">
            {path.automatic
              ? path.shell === "windows"
                ? m.addFolder(where)
                : m.addLine(where)
              : m.shellNotEdited(path.shell)}
          </p>
          <CopyField value={path.line} label={m.copyLine} />
          {path.automatic && (
            <div>
              <Button size="sm" disabled={busy} onClick={() => useNode.getState().setPath(true)}>
                {m.addToPath}
              </Button>
            </div>
          )}
        </>
      )}

      {!compact &&
        (confirm ? (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-line border-t pt-3">
            <p className="min-w-0 flex-1 text-ink-soft">{m.removeWarning}</p>
            <Button size="sm" variant="ghost" data-autofocus onClick={() => setConfirm(false)}>
              {m.keepIt}
            </Button>
            <Button
              size="sm"
              variant="danger"
              disabled={busy}
              onClick={async () => {
                if (await useNode.getState().remove()) setConfirm(false)
              }}
            >
              {m.remove}
            </Button>
          </div>
        ) : (
          <div className="border-line border-t pt-3">
            <Button size="sm" variant="danger" onClick={() => setConfirm(true)}>
              {m.removeNode}
            </Button>
          </div>
        ))}

      {error && (
        <ErrorNotice inline action={<ReportThis what="Changing WireCat's Node.js" error={error} />}>
          {error}
        </ErrorNotice>
      )}
    </div>
  )
}
