import { AlignLeft, Check, LoaderCircle, Undo2, X } from "lucide-react"
import { type ReactNode, useMemo } from "react"
import { useMessages } from "@/i18n"
import { Button } from "@/ui/Button"
import { cx } from "@/ui/cx"
import { Skeleton } from "@/ui/Skeleton"
import { lineOf } from "./diff"
import { JsonEditor } from "./JsonEditor"
import { type ConfigText, configMessages } from "./messages"
import { reasonText } from "./reason"
import { documentText, type Step, useConfig } from "./store"

export function JsonActions({ dirty }: { dirty: boolean }) {
  const m = useMessages(configMessages).editor
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
        {m.format}
      </Button>
      <Button
        size="sm"
        variant="ghost"
        onClick={st.revert}
        disabled={st.draft === null || st.saving}
        icon={<Undo2 className="size-3.5" aria-hidden />}
      >
        {m.revert}
      </Button>
      <Button
        size="sm"
        variant="primary"
        onClick={st.saveDraft}
        disabled={!dirty || st.saving || st.jsonError !== null}
      >
        {st.saving ? m.saving : m.save}
      </Button>
    </div>
  )
}

export function JsonTab() {
  const all = useMessages(configMessages)
  const m = all.editor
  const st = useConfig()
  const text = st.draft ?? documentText(st)
  const marks = useMemo(() => {
    const m = new Map<number, string>()
    if (st.jsonError) m.set(st.jsonError.line, reasonText(all, st.jsonError.message))
    for (const p of st.problems) {
      const line = lineOf(text, p.key)
      if (line) m.set(line, reasonText(all, p.message))
    }
    return m
  }, [st.jsonError, st.problems, text, all])

  return (
    <div>
      {st.settings === null ? (
        <Skeleton className="h-[min(60vh,34rem)] min-h-[16rem] w-full rounded-none" label={all.reading} />
      ) : (
        <JsonEditor
          label={m.label}
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
          <Message tone="bad" where={m.line(st.jsonError.line)}>
            {reasonText(all, st.jsonError.message)}
          </Message>
        )}
        {st.problems.map((p) => (
          <Message key={p.key} tone="bad" where={p.key}>
            {reasonText(all, p.message)}
          </Message>
        ))}
        {st.steps.length > 0 && <Progress steps={st.steps} m={m} />}
      </div>
      <p className="border-line border-t px-[1.3rem] py-2.5 text-[0.9rem] text-ink-dim">
        {m.note(<code className="font-mono">config set</code>, <code className="font-mono">config unset</code>)}
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

function Progress({ steps, m }: { steps: Step[]; m: ConfigText["editor"] }) {
  const longest = longestOf(Object.values(m.steps))
  return (
    <ol aria-label={m.progress} className="flex flex-col gap-1 px-[1.3rem] py-3">
      {steps.map((s) => (
        <li key={`${s.op.kind}-${s.op.key}`} className="flex min-w-0 items-center gap-2.5 text-[0.9rem]">
          <StepIcon state={s.state} />
          <Sized longest={longest} className="shrink-0 text-ink-soft">
            {m.steps[s.state]}
          </Sized>
          <code className="selectable truncate font-mono text-ink">
            {s.op.kind === "set" ? `set ${s.op.key} ${s.op.value}` : `unset ${s.op.key}`}
            {s.op.defaults && " --defaults"}
          </code>
        </li>
      ))}
    </ol>
  )
}

const longestOf = (labels: string[]) => labels.reduce((a, b) => (b.length > a.length ? b : a), "")

/** Takes the room of its longest possible label, so a change of state never moves the column; nothing is duplicated
 * in the text a reader or a test finds. */
function Sized({ longest, className, children }: { longest: string; className: string; children: ReactNode }) {
  return (
    <span
      data-longest={longest}
      className={cx(
        "grid whitespace-nowrap after:invisible after:col-start-1 after:row-start-1 after:content-[attr(data-longest)]",
        className,
      )}
    >
      <span className="col-start-1 row-start-1">{children}</span>
    </span>
  )
}

function StepIcon({ state }: { state: Step["state"] }) {
  if (state === "done") return <Check className="size-4 shrink-0 text-ok" aria-hidden />
  if (state === "failed") return <X className="size-4 shrink-0 text-bad" aria-hidden />
  if (state === "running") return <LoaderCircle className="size-4 shrink-0 animate-spin text-brand" aria-hidden />
  return <span aria-hidden className="mx-[0.3rem] size-[0.4rem] shrink-0 rounded-full bg-idle" />
}
