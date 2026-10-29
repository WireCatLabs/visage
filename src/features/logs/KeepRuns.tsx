import { useState } from "react"
import { findTool } from "@/domain/catalog"
import { useMessages } from "@/i18n"
import { Button } from "@/ui/Button"
import { Dialog } from "@/ui/Dialog"
import { Lamp, type LampTone } from "@/ui/Lamp"
import { Select } from "@/ui/Select"
import { Skeleton } from "@/ui/Skeleton"
import { ReportThis } from "../report/ReportThis"
import { ToolIcon } from "../tools/ToolIcon"
import { logsMessages } from "./messages"
import { type LogsWords, toolName } from "./names"
import { type Keeping, useLogs, useShownLogs } from "./store"

type Ask = { id: string; on: boolean; k: Extract<Keeping, { state: "ready" }> }

export function KeepRuns() {
  const m = useMessages(logsMessages)
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
    <section aria-label={m.keepingRegion} className="flex flex-wrap items-center gap-x-[0.9rem] gap-y-2">
      <h2 className="text-[0.9rem] text-ink-dim">{m.keepingHeading}</h2>
      <ul className="flex flex-wrap items-center gap-[0.6rem]">
        {ids.map((id) => (
          <Chip key={id} id={id} k={keeping[id] as Keeping} first={id === ids[0]} onAsk={setAsk} />
        ))}
      </ul>
      {refused.map(([id, error]) => (
        <p key={id} role="alert" className="flex w-full flex-wrap items-center gap-x-3 text-[0.9rem]">
          <span className="selectable text-bad">{m.refused(toolName(id), error)}</span>
          <ReportThis what={`Changing whether ${toolName(id)} keeps runs`} tool={id} error={error} />
        </p>
      ))}

      <Dialog
        open={ask !== null}
        title={ask?.on ? m.askEvery(name) : m.askFailedOnly(name)}
        onClose={() => setAsk(null)}
        actions={
          <>
            <Button variant="ghost" onClick={() => setAsk(null)} autoFocus>
              {m.leaveIt}
            </Button>
            <Button
              onClick={() => {
                const a = ask
                setAsk(null)
                if (a) setRecord(a.id, a.on)
              }}
            >
              {ask?.on ? m.keepEvery : m.keepFailedOnly}
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

const tone = (k: Keeping): LampTone =>
  k.state === "loading" ? "busy" : k.state === "error" || k.error ? "bad" : k.record ? "ok" : "idle"

type Ready = Extract<Keeping, { state: "ready" }>

/** "successful runs for 7 days, failed runs for 30 days"; older tools keep every run for one period. */
const periods = (m: LogsWords, k: Ready) =>
  k.successDays === null ? m.periodsEvery(k.days) : m.periodsSplit(k.successDays, k.days)

/** `k.locked` is the reason Rust gives, in English (src-tauri/src/settings.rs). */
function said(m: LogsWords, name: string, k: Keeping): string {
  if (k.state === "loading") return m.chipReading(name)
  if (k.state === "error") return m.chipError(name, k.error ?? m.noRecordSetting)
  const now = k.record ? m.chipKeeps(name, periods(m, k)) : m.chipFailedOnly(name, k.days)
  return [now, k.locked, k.error && m.chipRefused(k.error)].filter(Boolean).join(". ")
}

const Code = ({ children }: { children: string }) => (
  <code className="font-mono text-[0.88rem] text-ink">{children}</code>
)

function AskBody({ ask, name, bin }: { ask: Ask; name: string; bin: string }) {
  const m = useMessages(logsMessages)
  const { k } = ask
  // Going to the tool's own default removes the setting; the other value is written into the defaults.
  const command =
    ask.on === k.everyByDefault
      ? `${bin} config unset --defaults record`
      : `${bin} config set --defaults record ${String(ask.on)}`
  const how = ask.on === k.everyByDefault ? m.howUnset(<Code>{command}</Code>) : m.howSet(<Code>{command}</Code>, name)
  const record = <code className="font-mono">record</code>
  if (ask.on)
    return (
      <div className="flex flex-col gap-3">
        <p>{m.everyBody(name, periods(m, k))}</p>
        <p>
          {how} {m.everyProfiles(record)}
        </p>
      </div>
    )
  return (
    <div className="flex flex-col gap-3">
      <p>{m.failedOnlyBody(name, k.days, k.successDays)}</p>
      <p>
        {how} {m.failedOnlyProfiles(record)}
      </p>
    </div>
  )
}

// A chip is as tall as the select it ends with, so the setting arriving moves nothing.
function Chip({ id, k, first, onAsk }: { id: string; k: Keeping; first: boolean; onAsk: (a: Ask) => void }) {
  const m = useMessages(logsMessages)
  const name = toolName(id)
  const words = said(m, name, k)
  return (
    <li
      title={words}
      className="flex h-[2.6rem] items-center gap-[0.5rem] rounded-[0.4rem] border border-line-strong bg-app pr-[0.3rem] pl-[0.7rem]"
    >
      <Lamp tone={tone(k)} size="sm" label={words} />
      <ToolIcon id={id} className="size-[1rem] shrink-0 text-ink-soft" />
      <span className="font-medium text-[0.9rem]">{name}</span>
      {k.state === "loading" && <Skeleton className="h-8 w-[9.4rem]" {...(first && { label: m.readingKeeping })} />}
      {k.state === "error" && (
        <span className="flex w-[9.4rem] items-center">
          <ReportThis
            what={`Reading ${name} run settings`}
            tool={id}
            error={k.error ?? logsMessages.en.noRecordSetting}
          />
        </span>
      )}
      {k.state === "ready" && (
        <Select<Choice>
          size="sm"
          aria-label={m.whichRuns(name)}
          value={k.record ? "every" : "failed"}
          options={[
            { value: "failed", label: m.choiceFailed },
            { value: "every", label: m.choiceEvery },
          ]}
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
