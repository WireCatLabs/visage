import { useState } from "react"
import { findTool } from "@/domain/catalog"
import { Button } from "@/ui/Button"
import { Dialog } from "@/ui/Dialog"
import { Lamp, type LampTone } from "@/ui/Lamp"
import { Select } from "@/ui/Select"
import { Skeleton } from "@/ui/Skeleton"
import { ReportThis } from "../report/ReportThis"
import { ToolIcon } from "../tools/ToolIcon"
import { toolName } from "./names"
import { type Keeping, useLogs, useShownLogs } from "./store"

type Ask = { id: string; on: boolean; k: Extract<Keeping, { state: "ready" }> }

export function KeepRuns() {
  const keeping = useShownLogs((s) => s.keeping)
  const setRecord = useLogs((s) => s.setRecord)
  const [ask, setAsk] = useState<Ask | null>(null)
  const ids = Object.keys(keeping)
  if (ids.length === 0) return null

  const refused = ids.flatMap((id) => {
    const k = keeping[id]
    return k?.state === "ready" && k.error ? [[id, k.error] as const] : []
  })
  const name = ask ? toolName(ask.id) : ""
  const bin = ask ? (findTool(ask.id)?.bin ?? ask.id) : ""

  return (
    <section aria-label="Which runs each tool keeps" className="flex flex-wrap items-center gap-x-[0.9rem] gap-y-2">
      <h2 className="text-[0.85rem] text-ink-dim">Runs each tool keeps</h2>
      <ul className="flex flex-wrap items-center gap-[0.6rem]">
        {ids.map((id) => (
          <Chip key={id} id={id} k={keeping[id] as Keeping} first={id === ids[0]} onAsk={setAsk} />
        ))}
      </ul>
      {refused.map(([id, error]) => (
        <p key={id} role="alert" className="flex w-full flex-wrap items-center gap-x-3 text-[0.85rem]">
          <span className="selectable text-bad">
            {toolName(id)} refused the change: {error}
          </span>
          <ReportThis what={`Changing whether ${toolName(id)} keeps runs`} tool={id} error={error} />
        </p>
      ))}

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
        {ask && <AskBody ask={ask} name={name} bin={bin} />}
      </Dialog>
    </section>
  )
}

type Choice = "failed" | "every"
const CHOICES = [
  { value: "failed", label: "Failed runs only" },
  { value: "every", label: "Every run" },
] as const

const tone = (k: Keeping): LampTone =>
  k.state === "loading" ? "busy" : k.state === "error" || k.error ? "bad" : k.record ? "ok" : "idle"

type Ready = Extract<Keeping, { state: "ready" }>

const forDays = (days: number | null) => (days !== null ? ` for ${days} days` : "")

/** "successful runs for 7 days, failed runs for 30"; older tools keep every run for one period. */
function periods(k: Ready): string {
  if (k.successDays === null) return `every run${forDays(k.days)}`
  return `successful runs${forDays(k.successDays)}, failed runs${forDays(k.days)}`
}

function words(k: Keeping): string {
  if (k.state === "loading") return "is reading its settings"
  if (k.state === "error") return `could not say whether it keeps successful runs: ${k.error}`
  const now = k.record ? `keeps ${periods(k)}` : `keeps failed runs only${forDays(k.days)}`
  return [now, k.locked, k.error && `the tool refused the change: ${k.error}`].filter(Boolean).join(". ")
}

const Code = ({ children }: { children: string }) => (
  <code className="font-mono text-[0.88rem] text-ink">{children}</code>
)

function AskBody({ ask, name, bin }: { ask: Ask; name: string; bin: string }) {
  const { k } = ask
  // Going to the tool's own default removes the setting; the other value is written into the defaults.
  const command =
    ask.on === k.everyByDefault
      ? `${bin} config unset --defaults record`
      : `${bin} config set --defaults record ${String(ask.on)}`
  const how =
    ask.on === k.everyByDefault ? (
      <>
        This runs <Code>{command}</Code>, which puts the setting back to the tool's default
      </>
    ) : (
      <>
        This sets <Code>{command}</Code>, the default for every {name} profile
      </>
    )
  if (ask.on)
    return (
      <div className="flex flex-col gap-3">
        <p>
          From now on {name} records every run, also the ones that succeed: it keeps {periods(k)}, then removes them.
          Until then every run takes disk space in the tool's own folder.
        </p>
        <p>
          {how}. A profile that sets <code className="font-mono">record</code> itself keeps its own choice; change that
          on the Config page. Runs that already ended are not recovered.
        </p>
      </div>
    )
  return (
    <div className="flex flex-col gap-3">
      <p>
        From now on {name} keeps a run only when it fails{forDays(k.days)}. Successful runs it already kept stay until
        the tool removes old runs{k.successDays !== null ? `, after ${k.successDays} days` : forDays(k.days)}.
      </p>
      <p>
        {how}. A profile that sets <code className="font-mono">record</code> itself keeps its own choice.
      </p>
    </div>
  )
}

// A chip is as tall as the select it ends with, so the setting arriving moves nothing.
function Chip({ id, k, first, onAsk }: { id: string; k: Keeping; first: boolean; onAsk: (a: Ask) => void }) {
  const name = toolName(id)
  const said = `${name} ${words(k)}`
  return (
    <li
      title={said}
      className="flex h-[2.6rem] items-center gap-[0.5rem] rounded-[0.4rem] border border-line-strong bg-app pr-[0.3rem] pl-[0.7rem]"
    >
      <Lamp tone={tone(k)} size="sm" label={said} />
      <ToolIcon id={id} className="size-[1rem] shrink-0 text-ink-soft" />
      <span className="font-medium text-[0.9rem]">{name}</span>
      {k.state === "loading" && (
        <Skeleton className="h-8 w-[9.4rem]" {...(first && { label: "Reading which runs each tool keeps" })} />
      )}
      {k.state === "error" && (
        <span className="flex w-[9.4rem] items-center">
          <ReportThis what={`Reading ${name} run settings`} tool={id} error={k.error} />
        </span>
      )}
      {k.state === "ready" && (
        <Select<Choice>
          size="sm"
          aria-label={`Which ${name} runs to keep`}
          value={k.record ? "every" : "failed"}
          options={CHOICES}
          disabled={k.saving || Boolean(k.locked)}
          onChange={(v) => {
            if ((v === "every") !== k.record) onAsk({ id, on: v === "every", k })
          }}
          className="w-[9.4rem]"
        />
      )}
    </li>
  )
}
