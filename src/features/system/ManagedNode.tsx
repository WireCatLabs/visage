import { useEffect, useState } from "react"
import { Button } from "@/ui/Button"
import { CopyField } from "@/ui/CopyField"
import { useNode } from "./node-store"
import { useSystem } from "./store"

/** The PATH offer for the Node.js WireCat set up, and, outside the banner, removing it. */
export function ManagedNode({ compact = false }: { compact?: boolean }) {
  const managed = useSystem((s) => s.readiness?.managed ?? null)
  const path = useNode((s) => s.path)
  const busy = useNode((s) => s.busy)
  const error = useNode((s) => s.error)
  const [confirm, setConfirm] = useState(false)

  useEffect(() => {
    useNode.getState().loadPath()
  }, [])

  if (!managed) return null
  const where = path?.shell === "windows" ? "your user PATH" : (path?.file ?? "your shell's startup file")

  return (
    <div className="flex flex-col gap-3 text-[0.95rem]">
      {!compact && (
        <p className="text-ink-soft">
          Node.js <span className="selectable font-mono tabular-nums text-ink">{managed.version}</span> in{" "}
          <span className="selectable font-mono text-[0.875rem] text-ink">{managed.dir}</span>
          {managed.active ? ", used for WireCat tools." : ". Your own Node.js is used first."}
        </p>
      )}

      {!path ? (
        <p className="text-ink-soft">Reading your PATH settings…</p>
      ) : path.added ? (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <p className="min-w-0 flex-1 text-ink-soft">
            On PATH through <span className="selectable font-mono text-[0.875rem] text-ink">{where}</span>. Terminals
            opened from now on find it.
          </p>
          <Button size="sm" variant="ghost" disabled={busy} onClick={() => useNode.getState().setPath(false)}>
            Remove from PATH
          </Button>
        </div>
      ) : (
        <>
          <p className="text-ink-soft">
            {path.automatic ? (
              <>
                “Add to PATH” puts this {path.shell === "windows" ? "folder in front of" : "line at the end of"}{" "}
                <span className="selectable font-mono text-[0.875rem] text-ink">{where}</span>, marked as added by
                WireCat Desktop, so you can remove it here later:
              </>
            ) : (
              <>Your shell ({path.shell}) is not one WireCat edits. Add this line to its startup file yourself:</>
            )}
          </p>
          <CopyField value={path.line} label="Copy the line" />
          {path.automatic && (
            <div>
              <Button size="sm" disabled={busy} onClick={() => useNode.getState().setPath(true)}>
                Add to PATH
              </Button>
            </div>
          )}
        </>
      )}

      {!compact &&
        (confirm ? (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-line border-t pt-3">
            <p className="min-w-0 flex-1 text-ink-soft">
              This deletes the folder above and its PATH line. Tools installed with it must be uninstalled first.
            </p>
            <Button size="sm" variant="ghost" data-autofocus onClick={() => setConfirm(false)}>
              Keep it
            </Button>
            <Button
              size="sm"
              variant="danger"
              disabled={busy}
              onClick={async () => {
                if (await useNode.getState().remove()) setConfirm(false)
              }}
            >
              Remove
            </Button>
          </div>
        ) : (
          <div className="border-line border-t pt-3">
            <Button size="sm" variant="danger" onClick={() => setConfirm(true)}>
              Remove WireCat's Node.js
            </Button>
          </div>
        ))}

      {error && (
        <p role="alert" className="text-bad">
          {error}
        </p>
      )}
    </div>
  )
}
