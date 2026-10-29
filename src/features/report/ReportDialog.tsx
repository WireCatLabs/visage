import { CircleAlert, CircleCheck, ExternalLink, LoaderCircle, LockKeyhole, Send } from "lucide-react"
import { type KeyboardEvent, type ReactNode, useEffect, useId, useRef, useState } from "react"
import { tools } from "@/domain/catalog"
import { issueBody, LIMITS, newIssueUrl, type ReportFields, type ReportProblem, validateReport } from "@/domain/report"
import { ToolIcon } from "@/features/tools/ToolIcon"
import { formatList, useMessages } from "@/i18n"
import { platform } from "@/platform/bridge"
import { AutoHeight } from "@/ui/AutoHeight"
import { Button } from "@/ui/Button"
import { cx } from "@/ui/cx"
import { Dialog } from "@/ui/Dialog"
import { Disclosure } from "@/ui/Disclosure"
import { Monogram } from "@/ui/Logo"
import { Select, type SelectGroup } from "@/ui/Select"
import { reportMessages } from "./messages"
import { attachmentsOf, useReport } from "./store"

const SECURITY_POLICY = "https://github.com/WireCatLabs/.github/blob/main/SECURITY.md"
const control =
  "w-full rounded-[0.35rem] border border-line-strong bg-app px-2.5 py-1.5 text-[0.95rem] leading-normal text-ink placeholder:text-ink-dim disabled:opacity-60 aria-[invalid=true]:border-bad"
const empty: ReportFields = { summary: "", about: "", steps: "", happened: "", expected: "" }

type FieldId = keyof ReportFields

const aboutOptions = (m: { theApp: string; aTool: string }): SelectGroup<string>[] => [
  { label: m.theApp, options: [{ value: "app", label: "WireCat Desktop", icon: <Monogram className="size-4" /> }] },
  {
    label: m.aTool,
    options: tools.map((t) => ({
      value: t.id,
      label: `${t.name} (${t.bin})`,
      icon: <ToolIcon id={t.id} className="size-4" />,
    })),
  },
]

export function ReportDialog() {
  const m = useMessages(reportMessages)
  const { open, prefill, phase, close } = useReport()
  const [fields, setFields] = useState<ReportFields>(empty)
  const [tried, setTried] = useState(false)
  const form = useRef<HTMLFormElement>(null)
  const base = useId()
  const id = (f: FieldId) => `${base}-${f}`

  useEffect(() => {
    if (!open) return
    setFields({
      ...empty,
      summary: prefill.summary ?? "",
      about: prefill.tool ?? "",
      steps: prefill.steps ?? "",
      happened: prefill.details ?? "",
    })
    setTried(false)
  }, [open, prefill])

  const set = (f: FieldId) => (e: { target: { value: string } }) => setFields((s) => ({ ...s, [f]: e.target.value }))
  const problems = tried ? validateReport(fields) : []
  const problem = (f: FieldId) => problems.find((p) => p.field === f)
  const sending = phase === "sending"

  const submit = () => {
    const found = validateReport(fields)
    setTried(true)
    const first = found[0]
    if (first) document.getElementById(id(first.field))?.focus()
    else if (!sending) void useReport.getState().send(fields)
  }

  const onKeyDown = (e: KeyboardEvent<HTMLFormElement>) => {
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault()
      form.current?.requestSubmit()
    }
  }

  return (
    <Dialog
      open={open}
      wide
      scroll
      title={phase === "sent" ? m.sentTitle : m.title}
      onClose={close}
      actions={<Actions fields={fields} />}
    >
      {phase === "sent" ? (
        <Sent />
      ) : (
        <form
          ref={form}
          id="report-form"
          noValidate
          className="flex flex-col gap-5 pb-4"
          onKeyDown={onKeyDown}
          onSubmit={(e) => {
            e.preventDefault()
            submit()
          }}
        >
          <p className="max-w-[70ch] text-[0.875rem]">
            {m.intro(
              <button
                type="button"
                className="font-medium text-brand hover:text-brand-hover"
                onClick={() => platform.openUrl(SECURITY_POLICY)}
              >
                {m.policy}
              </button>,
            )}
          </p>

          <div className="grid gap-5 sm:grid-cols-[minmax(0,1fr)_15rem]">
            <Field
              id={id("summary")}
              label={m.summary}
              problem={problem("summary")}
              aside={<Counter value={fields.summary} limit={LIMITS.summary} id={`${id("summary")}-count`} />}
              extraDescribedBy={`${id("summary")}-count`}
            >
              {(a11y) => (
                <input
                  {...a11y}
                  data-autofocus
                  value={fields.summary}
                  maxLength={LIMITS.summary}
                  onChange={set("summary")}
                  onKeyDown={(e) => {
                    if (e.key !== "Enter" || e.ctrlKey || e.metaKey) return
                    e.preventDefault()
                    document.getElementById(id("about"))?.focus()
                  }}
                  placeholder={m.summaryExample}
                  className={control}
                  disabled={sending}
                />
              )}
            </Field>
            <Field id={id("about")} label={m.about} problem={problem("about")}>
              {(a11y) => (
                <Select
                  {...a11y}
                  value={fields.about}
                  onChange={(about) => setFields((s) => ({ ...s, about }))}
                  options={aboutOptions(m)}
                  className="w-full"
                  disabled={sending}
                />
              )}
            </Field>
          </div>

          <Field id={id("steps")} label={m.steps} optional hint={m.stepsHint}>
            {(a11y) => (
              <textarea
                {...a11y}
                value={fields.steps}
                rows={4}
                maxLength={LIMITS.steps}
                onChange={set("steps")}
                placeholder={m.stepsExample}
                className={cx(control, "resize-y")}
                disabled={sending}
              />
            )}
          </Field>

          <Field id={id("happened")} label={m.happened} problem={problem("happened")} hint={m.happenedHint}>
            {(a11y) => (
              <textarea
                {...a11y}
                value={fields.happened}
                rows={4}
                maxLength={LIMITS.happened}
                onChange={set("happened")}
                placeholder={m.happenedExample}
                className={cx(control, "resize-y")}
                disabled={sending}
              />
            )}
          </Field>

          <Field id={id("expected")} label={m.expected} optional>
            {(a11y) => (
              <textarea
                {...a11y}
                value={fields.expected}
                rows={2}
                maxLength={LIMITS.expected}
                onChange={set("expected")}
                placeholder={m.expectedExample}
                className={cx(control, "resize-y")}
                disabled={sending}
              />
            )}
          </Field>

          <WhatIsSent fields={fields} />
        </form>
      )}
    </Dialog>
  )
}

type A11y = { id: string; "aria-invalid": boolean; "aria-describedby"?: string | undefined }

function Field({
  id,
  label,
  optional = false,
  hint,
  problem,
  aside,
  extraDescribedBy,
  children,
}: {
  id: string
  label: string
  optional?: boolean
  hint?: string
  problem?: ReportProblem | undefined
  aside?: ReactNode
  extraDescribedBy?: string
  children: (a11y: A11y) => ReactNode
}) {
  const m = useMessages(reportMessages)
  const describedBy = [problem && `${id}-error`, hint && `${id}-hint`, extraDescribedBy].filter(Boolean).join(" ")
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <div className="flex items-baseline justify-between gap-3">
        <span className="flex items-baseline gap-1.5">
          <label htmlFor={id} className="text-[0.875rem] font-medium text-ink">
            {label}
          </label>
          {optional && <span className="text-[0.9rem] text-ink-dim">{m.optional}</span>}
        </span>
        {aside}
      </div>
      {hint && (
        <p id={`${id}-hint`} className="-mt-1 text-[0.9rem] leading-snug text-ink-dim">
          {hint}
        </p>
      )}
      {children({ id, "aria-invalid": Boolean(problem), "aria-describedby": describedBy || undefined })}
      {problem && (
        <p id={`${id}-error`} className="flex items-center gap-1.5 text-[0.9rem] text-bad">
          <CircleAlert className="size-3.5 shrink-0" aria-hidden />
          {m.missing[problem.field]}
        </p>
      )}
    </div>
  )
}

function Counter({ value, limit, id }: { value: string; limit: number; id: string }) {
  const m = useMessages(reportMessages)
  const n = value.length
  return (
    <span
      id={id}
      className={cx("font-mono text-[0.85rem] tabular-nums", n >= limit - 10 ? "text-warn-ink" : "text-ink-dim")}
    >
      <span className="sr-only">{m.charactersUsed}</span>
      {n}/{limit}
    </span>
  )
}

function WhatIsSent({ fields }: { fields: ReportFields }) {
  const m = useMessages(reportMessages)
  const { context, contextError, prefill } = useReport()
  const runs = (context?.attachments?.runs as { tool: string; runs: unknown[] }[] | undefined) ?? []
  const runCount = runs.reduce((n, r) => n + (Array.isArray(r.runs) ? r.runs.length : 0), 0)
  const pre =
    "selectable max-h-56 overflow-auto whitespace-pre-wrap rounded-[0.3rem] border border-line bg-app p-2.5 font-mono text-[0.85rem] leading-relaxed text-ink"

  return (
    <section
      aria-label={m.whatIsSent}
      className="flex flex-col gap-3 rounded-[0.45rem] bg-app-2 px-4 py-3.5 text-[0.875rem]"
    >
      <p className="flex gap-2.5">
        <LockKeyhole className="mt-[0.2rem] size-4 shrink-0 text-ink-dim" aria-hidden />
        <span>{m.logsNote(Boolean(prefill.errors?.length))}</span>
      </p>
      {/* Both links are there from the first frame; what they open waits for the context, so the dialog never grows
          or jumps when it arrives. */}
      <div className="flex flex-col gap-2 pl-[1.6rem]">
        <Disclosure summary={m.seeAttached}>
          <AutoHeight swap={Boolean(context)}>
            {context ? (
              <>
                <p className="mb-2">
                  {m.attached({
                    runs: runCount,
                    tools: formatList(runs.map((r) => r.tool)),
                    logLines: prefill.log?.length ?? 0,
                    errors: prefill.errors?.length ?? 0,
                  })}
                </p>
                <pre className={pre}>{JSON.stringify(attachmentsOf(context, prefill), null, 2)}</pre>
              </>
            ) : (
              <Pending error={contextError} />
            )}
          </AutoHeight>
        </Disclosure>
        <Disclosure summary={m.seeIssue}>
          <AutoHeight swap={Boolean(context)}>
            {context ? (
              <pre className={pre}>{`${fields.summary.trim() || "(summary)"}\n\n${issueBody(fields, context)}`}</pre>
            ) : (
              <Pending error={contextError} />
            )}
          </AutoHeight>
        </Disclosure>
      </div>
    </section>
  )
}

function Pending({ error }: { error: string | null }) {
  const m = useMessages(reportMessages)
  if (error) return <p className="text-ink-dim">{m.notAvailable}</p>
  return (
    <p className="flex items-center gap-2 text-ink-dim" role="status">
      <LoaderCircle className="size-3.5 animate-spin" aria-hidden /> {m.collecting}
    </p>
  )
}

function Actions({ fields }: { fields: ReportFields }) {
  const m = useMessages(reportMessages)
  const { phase, error, context, contextError, close } = useReport()
  if (phase === "sent") return <Button onClick={close}>{m.done}</Button>
  const preparing = !context && !contextError
  const alert = phase === "failed" ? error : contextError && m.contextFailed(contextError)
  return (
    <div className="flex w-full flex-wrap items-center justify-end gap-2">
      {alert && (
        <p role="alert" className="mr-auto max-w-[24rem] text-[0.875rem] text-bad">
          {alert}
        </p>
      )}
      {phase === "failed" && context && (
        <Button
          variant="ghost"
          icon={<ExternalLink className="size-4" aria-hidden />}
          onClick={() => platform.openUrl(newIssueUrl(fields, context))}
        >
          {m.openOnGitHub}
        </Button>
      )}
      <Button variant="ghost" onClick={close}>
        {m.cancel}
      </Button>
      <Button
        variant="primary"
        type="submit"
        form="report-form"
        title={m.sendTitle}
        className="min-w-[9.5rem]"
        aria-keyshortcuts="Control+Enter Meta+Enter"
        disabled={!context || phase === "sending"}
        icon={
          phase === "sending" || preparing ? (
            <LoaderCircle className="size-4 animate-spin" aria-hidden />
          ) : (
            <Send className="size-4" aria-hidden />
          )
        }
      >
        {phase === "sending" ? m.sending : preparing ? m.preparing : phase === "failed" ? m.tryAgain : m.send}
      </Button>
    </div>
  )
}

function Sent() {
  const m = useMessages(reportMessages)
  const sent = useReport((s) => s.sent)
  if (!sent) return null
  return (
    <div className="flex flex-col gap-3 pb-4">
      <p className="flex items-center gap-2 text-ink">
        <CircleCheck className="size-5 text-ok" aria-hidden />
        {sent.issueUrl ? m.thanksIssue(sent.issueNumber ?? 0) : m.thanksSaved}
      </p>
      {sent.issueUrl ? (
        <div>
          <Button
            variant="secondary"
            icon={<ExternalLink className="size-4" aria-hidden />}
            onClick={() => sent.issueUrl && platform.openUrl(sent.issueUrl)}
          >
            {m.openIssue}
          </Button>
        </div>
      ) : (
        <p>{m.queued(sent.id)}</p>
      )}
    </div>
  )
}
