import { useState } from "react"
import { findTool } from "@/domain/catalog"
import { Button } from "@/ui/Button"
import { Dialog } from "@/ui/Dialog"
import { Skeleton } from "@/ui/Skeleton"
import { ToolIcon } from "../tools/ToolIcon"
import { toolName } from "./names"
import { type Keeping, useLogs } from "./store"

type Ask = { id: string; on: boolean; days: number | null }

export function KeepRuns() {
  const keeping = useLogs((s) => s.keeping)
  const setRecord = useLogs((s) => s.setRecord)
  const [ask, setAsk] = useState<Ask | null>(null)
  const ids = Object.keys(keeping)
  if (ids.length === 0) return null

  const name = ask ? toolName(ask.id) : ""
  const bin = ask ? (findTool(ask.id)?.bin ?? ask.id) : ""

  return (
    <section aria-label="Which runs each tool keeps" className="rounded-[0.2rem] border border-line-strong bg-app">
      <ul>
        {ids.map((id) => (
          <Row key={id} id={id} k={keeping[id] as Keeping} onAsk={setAsk} />
        ))}
      </ul>

      <Dialog
        open={ask !== null}
        title={ask?.on ? `Keep every ${name} run?` : `Stop keeping successful ${name} runs?`}
        onClose={() => setAsk(null)}
        actions={
          <>
            <Button variant="ghost" onClick={() => setAsk(null)} autoFocus>
              Leave it as it is
            </Button>
            <Button
              onClick={() => {
                const a = ask
                setAsk(null)
                if (a) setRecord(a.id, a.on)
              }}
            >
              {ask?.on ? "Keep every run" : "Keep failed runs only"}
            </Button>
          </>
        }
      >
        {ask?.on ? (
          <div className="flex flex-col gap-3">
            <p>
              From now on {name} records every run, also the ones that succeed. Each run is kept
              {ask.days !== null ? ` for ${ask.days} days` : " for as long as the tool keeps runs"} and then removed;
              until then every run takes disk space in the tool's own folder.
            </p>
            <p>
              This sets{" "}
              <code className="font-mono text-[0.88rem] text-ink">{`${bin} config set --defaults record true`}</code>,
              the default for every {name} profile. A profile that sets <code className="font-mono">record</code> itself
              keeps its own choice; change that on the Config page. Runs that already ended are not recovered.
            </p>
          </div>
        ) : (
          <p>
            From now on {name} keeps a run only when it fails, as it does out of the box. Successful runs it already
            kept stay until the tool removes old runs{typeof ask?.days === "number" ? `, after ${ask.days} days` : ""}.
            This runs{" "}
            <code className="font-mono text-[0.88rem] text-ink">{`${bin} config unset --defaults record`}</code>, which
            puts the setting back to the tool's default.
          </p>
        )}
      </Dialog>
    </section>
  )
}

function Row({ id, k, onAsk }: { id: string; k: Keeping; onAsk: (a: Ask) => void }) {
  return (
    <li className="flex min-h-[3rem] flex-wrap items-center gap-x-[0.9rem] gap-y-1 border-line border-b px-[1.3rem] py-[0.5rem] last:border-b-0">
      <span className="flex w-[8.5rem] shrink-0 items-center gap-[0.5rem] font-medium">
        <ToolIcon id={id} className="size-[1.05rem] shrink-0 text-ink-soft" />
        {toolName(id)}
      </span>
      {k.state === "loading" && (
        <Skeleton className="h-[1.2rem] w-[18rem]" label={`Reading ${toolName(id)} settings`} />
      )}
      {k.state === "error" && (
        <span className="min-w-0 flex-1 text-[0.95rem] text-ink-soft">
          Could not read whether it keeps successful runs: <span className="selectable text-bad">{k.error}</span>
        </span>
      )}
      {k.state === "ready" && (
        <>
          <span className="min-w-0 flex-1 text-[0.95rem] text-ink-soft">
            {k.record ? (
              <>
                <span className="text-ink">Keeps every run</span>
                {k.days !== null ? `, for ${k.days} days.` : "."}
              </>
            ) : (
              <>
                <span className="text-ink">Successful runs are not kept</span>, only failed ones.
              </>
            )}
            {k.locked && <span className="block text-[0.85rem] text-ink-dim">{k.locked}</span>}
            {k.error && (
              <span role="alert" className="selectable block text-[0.85rem] text-bad">
                The tool refused the change: {k.error}
              </span>
            )}
          </span>
          {!k.locked && (
            <Button
              size="sm"
              variant={k.record ? "ghost" : "secondary"}
              disabled={k.saving}
              onClick={() => onAsk({ id, on: !k.record, days: k.days })}
            >
              {k.saving ? "Saving…" : k.record ? "Keep failed runs only…" : "Keep every run…"}
            </Button>
          )}
        </>
      )}
    </li>
  )
}
