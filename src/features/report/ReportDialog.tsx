import { CircleAlert, CircleCheck, ExternalLink, LoaderCircle, LockKeyhole, Send } from "lucide-react"
import { type KeyboardEvent, type ReactNode, useEffect, useId, useRef, useState } from "react"
import { tools } from "@/domain/catalog"
import { issueBody, LIMITS, newIssueUrl, type ReportFields, type ReportProblem, validateReport } from "@/domain/report"
import { ToolIcon } from "@/features/tools/ToolIcon"
import { platform } from "@/platform/bridge"
import { Button } from "@/ui/Button"
import { cx } from "@/ui/cx"
import { Dialog } from "@/ui/Dialog"
import { Disclosure } from "@/ui/Disclosure"
import { Monogram } from "@/ui/Logo"
import { Select, type SelectGroup } from "@/ui/Select"
import { attachmentsOf, useReport } from "./store"

const SECURITY_POLICY = "https://github.com/WireCatLabs/.github/blob/main/SECURITY.md"
const control =
  "w-full rounded-[0.35rem] border border-line-strong bg-app px-2.5 py-1.5 text-[0.95rem] leading-normal text-ink placeholder:text-ink-dim disabled:opacity-60 aria-[invalid=true]:border-bad"
const empty: ReportFields = { summary: "", about: "", steps: "", happened: "", expected: "" }

type FieldId = keyof ReportFields

const aboutOptions: SelectGroup<string>[] = [
  { label: "The app", options: [{ value: "app", label: "WireCat Desktop", icon: <Monogram className="size-4" /> }] },
  {
    label: "A tool",
    options: tools.map((t) => ({
      value: t.id,
      label: `${t.name} (${t.bin})`,
      icon: <ToolIcon id={t.id} className="size-4" />,
    })),
  },
]

export function ReportDialog() {
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
      title={phase === "sent" ? "Report sent" : "Report a problem"}
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
            Your report becomes a public issue on GitHub, so you can follow it. Email addresses, phone numbers and
            tokens in your text are masked before it leaves this computer. For a security problem, use the{" "}
            <button
              type="button"
              className="font-medium text-brand hover:text-brand-hover"
              onClick={() => platform.openUrl(SECURITY_POLICY)}
            >
              security policy
            </button>{" "}
            instead.
          </p>

          <div className="grid gap-5 sm:grid-cols-[minmax(0,1fr)_15rem]">
            <Field
              id={id("summary")}
              label="Summary"
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
                  placeholder="Installing Google Drive stops at “Verifying”"
                  className={control}
                  disabled={sending}
                />
              )}
            </Field>
            <Field id={id("about")} label="About" problem={problem("about")}>
              {(a11y) => (
                <Select
                  {...a11y}
                  value={fields.about}
                  onChange={(about) => setFields((s) => ({ ...s, about }))}
                  options={aboutOptions}
                  className="w-full"
                  disabled={sending}
                />
              )}
            </Field>
          </div>

          <Field
            id={id("steps")}
            label="What were you doing?"
            optional
            hint="The steps that lead to the problem, one per line. Numbered steps help the most."
          >
            {(a11y) => (
              <textarea
                {...a11y}
                value={fields.steps}
                rows={4}
                maxLength={LIMITS.steps}
                onChange={set("steps")}
                placeholder={"1. Opened Tools\n2. Pressed Install on Google Drive\n3. Waited at “Verifying”"}
                className={cx(control, "resize-y")}
                disabled={sending}
              />
            )}
          </Field>

          <Field
            id={id("happened")}
            label="What happened?"
            problem={problem("happened")}
            hint="What you saw. Copy the exact message if there was one."
          >
            {(a11y) => (
              <textarea
                {...a11y}
                value={fields.happened}
                rows={4}
                maxLength={LIMITS.happened}
                onChange={set("happened")}
                placeholder="The install stopped and said “EACCES: permission denied”."
                className={cx(control, "resize-y")}
                disabled={sending}
              />
            )}
          </Field>

          <Field id={id("expected")} label="What did you expect?" optional>
            {(a11y) => (
              <textarea
                {...a11y}
                value={fields.expected}
                rows={2}
                maxLength={LIMITS.expected}
                onChange={set("expected")}
                placeholder="Google Drive to install and show a green lamp."
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
  const describedBy = [problem && `${id}-error`, hint && `${id}-hint`, extraDescribedBy].filter(Boolean).join(" ")
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <div className="flex items-baseline justify-between gap-3">
        <span className="flex items-baseline gap-1.5">
          <label htmlFor={id} className="text-[0.875rem] font-medium text-ink">
            {label}
          </label>
          {optional && <span className="text-[0.85rem] text-ink-dim">optional</span>}
        </span>
        {aside}
      </div>
      {hint && (
        <p id={`${id}-hint`} className="-mt-1 text-[0.85rem] leading-snug text-ink-dim">
          {hint}
        </p>
      )}
      {children({ id, "aria-invalid": Boolean(problem), "aria-describedby": describedBy || undefined })}
      {problem && (
        <p id={`${id}-error`} className="flex items-center gap-1.5 text-[0.85rem] text-bad">
          <CircleAlert className="size-3.5 shrink-0" aria-hidden />
          {problem.message}
        </p>
      )}
    </div>
  )
}

function Counter({ value, limit, id }: { value: string; limit: number; id: string }) {
  const n = value.length
  return (
    <span
      id={id}
      className={cx("font-mono text-[0.78rem] tabular-nums", n >= limit - 10 ? "text-warn-ink" : "text-ink-dim")}
    >
      <span className="sr-only">Characters used: </span>
      {n}/{limit}
    </span>
  )
}

function WhatIsSent({ fields }: { fields: ReportFields }) {
  const { context, contextError, prefill } = useReport()
  const runs = (context?.attachments?.runs as { tool: string; runs: unknown[] }[] | undefined) ?? []
  const runCount = runs.reduce((n, r) => n + (Array.isArray(r.runs) ? r.runs.length : 0), 0)
  const pre =
    "selectable max-h-56 overflow-auto whitespace-pre-wrap rounded-[0.3rem] border border-line bg-app p-2.5 font-mono text-[0.78rem] leading-relaxed text-ink"

  return (
    <section
      aria-label="What is sent"
      className="flex flex-col gap-3 rounded-[0.45rem] bg-app-2 px-4 py-3.5 text-[0.875rem]"
    >
      <p className="flex gap-2.5">
        <LockKeyhole className="mt-[0.2rem] size-4 shrink-0 text-ink-dim" aria-hidden />
        <span>
          Recent error logs from your tools
          {prefill.errors?.length ? ", and this window’s recent errors," : ""} are attached. They are masked, kept only
          on WireCat’s server for 90 days, and never shown on GitHub. They can still contain personal details you typed
          into a command, such as a search query.
        </span>
      </p>
      {context ? (
        <div className="flex flex-col gap-2 pl-[1.6rem]">
          <Disclosure summary="See what is attached">
            <p className="mb-2">
              {runCount} failed {runCount === 1 ? "run" : "runs"}
              {runs.length ? ` from ${runs.map((r) => r.tool).join(", ")}` : ""}
              {prefill.log?.length ? `, and the ${prefill.log.length}-line install log` : ""}
              {prefill.errors?.length
                ? `, and ${prefill.errors.length} recent ${prefill.errors.length === 1 ? "error" : "errors"} from this window`
                : ""}
              .
            </p>
            <pre className={pre}>{JSON.stringify(attachmentsOf(context, prefill), null, 2)}</pre>
          </Disclosure>
          <Disclosure summary="See the public issue">
            <pre className={pre}>{`${fields.summary.trim() || "(summary)"}\n\n${issueBody(fields, context)}`}</pre>
          </Disclosure>
        </div>
      ) : (
        !contextError && (
          <p className="flex items-center gap-2 pl-[1.6rem] text-ink-dim" role="status">
            <LoaderCircle className="size-3.5 animate-spin" aria-hidden /> Collecting versions and recent errors…
          </p>
        )
      )}
    </section>
  )
}

function Actions({ fields }: { fields: ReportFields }) {
  const { phase, error, context, contextError, close } = useReport()
  if (phase === "sent") return <Button onClick={close}>Done</Button>
  const preparing = !context && !contextError
  const alert = phase === "failed" ? error : contextError && `Could not read this computer’s details: ${contextError}`
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
          Open on GitHub instead
        </Button>
      )}
      <Button variant="ghost" onClick={close}>
        Cancel
      </Button>
      <Button
        variant="primary"
        type="submit"
        form="report-form"
        title="Send report (Ctrl+Enter)"
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
        {phase === "sending" ? "Sending…" : preparing ? "Preparing…" : phase === "failed" ? "Try again" : "Send report"}
      </Button>
    </div>
  )
}

function Sent() {
  const sent = useReport((s) => s.sent)
  if (!sent) return null
  return (
    <div className="flex flex-col gap-3 pb-4">
      <p className="flex items-center gap-2 text-ink">
        <CircleCheck className="size-5 text-ok" aria-hidden />
        {sent.issueUrl ? `Thank you. The report is issue #${sent.issueNumber}.` : "Thank you. The report is saved."}
      </p>
      {sent.issueUrl ? (
        <div>
          <Button
            variant="secondary"
            icon={<ExternalLink className="size-4" aria-hidden />}
            onClick={() => sent.issueUrl && platform.openUrl(sent.issueUrl)}
          >
            Open the issue on GitHub
          </Button>
        </div>
      ) : (
        <p>GitHub did not answer in time, so the issue will be opened shortly. Your report id is {sent.id}.</p>
      )}
    </div>
  )
}
