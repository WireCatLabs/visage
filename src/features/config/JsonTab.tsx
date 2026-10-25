import { AlignLeft, Check, LoaderCircle, Undo2, X } from "lucide-react"
import { type ReactNode, useMemo } from "react"
import { Button } from "@/ui/Button"
import { Skeleton } from "@/ui/Skeleton"
import { lineOf } from "./diff"
import { JsonEditor } from "./JsonEditor"
import { documentText, type Step, useConfig } from "./store"

export function JsonActions({ dirty }: { dirty: boolean }) {
  const st = useConfig()
  return (
    <div className="flex items-center gap-2 py-2">
      <Button
        size="sm"
        variant="ghost"
        onClick={st.formatDraft}
        disabled={st.draft === null || st.jsonError !== null || st.saving}
        icon={<AlignLeft className="size-3.5" aria-hidden />}
      >
        Format
      </Button>
      <Button
        size="sm"
        variant="ghost"
        onClick={st.revert}
        disabled={st.draft === null || st.saving}
        icon={<Undo2 className="size-3.5" aria-hidden />}
      >
        Revert
      </Button>
      <Button
        size="sm"
        variant="primary"
        onClick={st.saveDraft}
        disabled={!dirty || st.saving || st.jsonError !== null}
      >
        {st.saving ? "Saving…" : "Save"}
      </Button>
    </div>
  )
}

export function JsonTab() {
  const st = useConfig()
  const text = st.draft ?? documentText(st)
  const marks = useMemo(() => {
    const m = new Map<number, string>()
    if (st.jsonError) m.set(st.jsonError.line, st.jsonError.message)
    for (const p of st.problems) {
      const line = lineOf(text, p.key)
      if (line) m.set(line, p.message)
    }
    return m
  }, [st.jsonError, st.problems, text])

  return (
    <div>
      {st.settings === null ? (
        <Skeleton className="h-[min(60vh,34rem)] min-h-[16rem] w-full rounded-none" label="Reading settings" />
      ) : (
        <JsonEditor
          label="Settings as JSON"
          value={text}
          onChange={st.edit}
          onSave={() => {
            if (!st.saving) st.saveDraft()
          }}
          marks={marks}
          readOnly={st.saving}
        />
      )}
      <div aria-live="polite" className="border-line border-t empty:hidden">
        {st.jsonError && (
          <Message tone="bad" where={`Line ${st.jsonError.line}`}>
            {st.jsonError.message}
          </Message>
        )}
        {st.problems.map((p) => (
          <Message key={p.key} tone="bad" where={p.key}>
            {p.message}
          </Message>
        ))}
        {st.steps.length > 0 && <Progress steps={st.steps} />}
      </div>
      <p className="border-line border-t px-[1.3rem] py-2.5 text-[0.85rem] text-ink-dim">
        Saving runs one <span className="font-mono">config set</span> or <span className="font-mono">config unset</span>{" "}
        per changed setting and stops at the first one the tool refuses. Masked values (•••) and locked settings cannot
        be changed here.
      </p>
    </div>
  )
}

function Message({ tone, where, children }: { tone: "bad"; where: string; children: ReactNode }) {
  return (
    <p
      role={tone === "bad" ? "alert" : undefined}
      className="selectable flex gap-3 px-[1.3rem] py-2 text-[0.95rem] text-bad"
    >
      <span className="shrink-0 font-mono">{where}</span>
      <span className="min-w-0">{children}</span>
    </p>
  )
}

const STEP_LABEL: Record<Step["state"], string> = {
  waiting: "Waiting",
  running: "Saving",
  done: "Saved",
  failed: "Refused",
  skipped: "Not tried",
}

function Progress({ steps }: { steps: Step[] }) {
  return (
    <ol aria-label="Save progress" className="flex flex-col gap-1 px-[1.3rem] py-3">
      {steps.map((s) => (
        <li key={`${s.op.kind}-${s.op.key}`} className="flex min-w-0 items-center gap-2.5 text-[0.85rem]">
          <StepIcon state={s.state} />
          <span className="w-[4.6rem] shrink-0 text-ink-soft">{STEP_LABEL[s.state]}</span>
          <span className="selectable truncate font-mono text-ink">
            {s.op.kind === "set" ? `set ${s.op.key} ${s.op.value}` : `unset ${s.op.key}`}
            {s.op.defaults && " --defaults"}
          </span>
        </li>
      ))}
    </ol>
  )
}

function StepIcon({ state }: { state: Step["state"] }) {
  if (state === "done") return <Check className="size-4 shrink-0 text-ok" aria-hidden />
  if (state === "failed") return <X className="size-4 shrink-0 text-bad" aria-hidden />
  if (state === "running") return <LoaderCircle className="size-4 shrink-0 animate-spin text-brand" aria-hidden />
  return <span aria-hidden className="mx-[0.3rem] size-[0.4rem] shrink-0 rounded-full bg-idle" />
}
