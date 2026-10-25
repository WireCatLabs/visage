import { CircleCheck, ExternalLink, Globe, LoaderCircle, Lock, Send } from "lucide-react"
import { useEffect, useId, useState } from "react"
import { tools } from "@/domain/catalog"
import { issueBody, newIssueUrl } from "@/domain/report"
import { platform } from "@/platform/bridge"
import { Button } from "@/ui/Button"
import { Dialog } from "@/ui/Dialog"
import { Disclosure } from "@/ui/Disclosure"
import { useReport } from "./store"

const SECURITY_POLICY = "https://github.com/WireCatLabs/.github/blob/main/SECURITY.md"
const field =
  "w-full rounded-[0.35rem] border border-line-strong bg-app px-2.5 py-1.5 text-[0.95rem] text-ink placeholder:text-ink-dim aria-[invalid=true]:border-bad"
const label = "text-[0.875rem] font-medium text-ink"

export function ReportDialog() {
  const { open, prefill, phase, close } = useReport()
  const [summary, setSummary] = useState("")
  const [details, setDetails] = useState("")
  const [expected, setExpected] = useState("")
  const [tool, setTool] = useState<string | null>(null)
  const ids = { summary: useId(), details: useId(), expected: useId(), tool: useId() }

  useEffect(() => {
    if (!open) return
    setSummary(prefill.summary ?? "")
    setDetails(prefill.details ?? "")
    setExpected("")
    setTool(prefill.tool ?? null)
  }, [open, prefill])

  const fields = { summary, details, expected, tool }
  const ready = summary.trim().length > 0 && summary.trim().length <= 120 && details.trim().length > 0
  const sending = phase === "sending"

  return (
    <Dialog
      open={open}
      wide
      title={phase === "sent" ? "Report sent" : "Report a problem"}
      onClose={close}
      actions={<Actions fields={fields} ready={ready} />}
    >
      {phase === "sent" ? (
        <Sent />
      ) : (
        <form
          id="report-form"
          className="flex max-h-[min(36rem,calc(100vh-12rem))] flex-col gap-4 overflow-y-auto pr-1"
          onSubmit={(e) => {
            e.preventDefault()
            if (ready && !sending) useReport.getState().send(fields)
          }}
        >
          <p>
            The report becomes a public GitHub issue, so the team can track it and you can follow it. Email addresses,
            phone numbers and tokens in your text are masked before it leaves this computer. Security problems go to the{" "}
            <button
              type="button"
              className="font-medium text-brand hover:text-brand-hover"
              onClick={() => platform.openUrl(SECURITY_POLICY)}
            >
              security policy
            </button>{" "}
            instead.
          </p>

          <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_13rem]">
            <div className="flex flex-col gap-1">
              <label htmlFor={ids.summary} className={label}>
                Summary
              </label>
              <input
                id={ids.summary}
                data-autofocus
                value={summary}
                maxLength={120}
                onChange={(e) => setSummary(e.target.value)}
                placeholder="Installing Google Drive fails at the last step"
                className={field}
                disabled={sending}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor={ids.tool} className={label}>
                About
              </label>
              <select
                id={ids.tool}
                value={tool ?? ""}
                onChange={(e) => setTool(e.target.value || null)}
                className={`${field} h-[2.3rem]`}
                disabled={sending}
              >
                <option value="">WireCat Desktop</option>
                {tools.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} ({t.bin})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor={ids.details} className={label}>
              What happened
            </label>
            <textarea
              id={ids.details}
              value={details}
              rows={5}
              maxLength={10000}
              onChange={(e) => setDetails(e.target.value)}
              placeholder="What you did, and what the app or the tool said."
              className={`${field} resize-y`}
              disabled={sending}
            />
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor={ids.expected} className={label}>
              What you expected <span className="font-normal text-ink-dim">(optional)</span>
            </label>
            <textarea
              id={ids.expected}
              value={expected}
              rows={2}
              maxLength={5000}
              onChange={(e) => setExpected(e.target.value)}
              className={`${field} resize-y`}
              disabled={sending}
            />
          </div>

          <Preview fields={fields} />
        </form>
      )}
    </Dialog>
  )
}

function Preview({ fields }: { fields: { summary: string; details: string; expected: string; tool: string | null } }) {
  const { context, contextError, attachLogs, setAttachLogs, phase, prefill } = useReport()
  const runs = (context?.attachments?.runs as { tool: string; runs: unknown[] }[] | undefined) ?? []
  const runCount = runs.reduce((n, r) => n + (Array.isArray(r.runs) ? r.runs.length : 0), 0)

  return (
    <div className="grid gap-3 lg:grid-cols-2">
      <section className="flex flex-col gap-2 rounded-[0.4rem] border border-line bg-app-2/60 p-3">
        <h3 className="flex items-center gap-1.5 text-[0.875rem] font-semibold text-ink">
          <Globe className="size-4" aria-hidden /> Public on GitHub
        </h3>
        <p className="text-[0.85rem]">
          Your summary and description, and the versions of the app, the system and your tools.
        </p>
        {context ? (
          <Disclosure summary="Show the issue text">
            <pre className="selectable max-h-48 overflow-auto whitespace-pre-wrap rounded-[0.3rem] bg-app p-2 font-mono text-[0.78rem] text-ink">
              {`${fields.summary || "(summary)"}\n\n${issueBody(fields, context)}`}
            </pre>
          </Disclosure>
        ) : (
          <p className="flex items-center gap-1.5 text-[0.85rem] text-ink-dim">
            {contextError ? (
              `Could not read the versions: ${contextError}`
            ) : (
              <>
                <LoaderCircle className="size-3.5 animate-spin" aria-hidden /> Reading versions…
              </>
            )}
          </p>
        )}
      </section>

      <section className="flex flex-col gap-2 rounded-[0.4rem] border border-line bg-app-2/60 p-3">
        <h3 className="flex items-center gap-1.5 text-[0.875rem] font-semibold text-ink">
          <Lock className="size-4" aria-hidden /> Kept private
        </h3>
        <label className="flex items-start gap-2 text-[0.85rem] text-ink">
          <input
            type="checkbox"
            className="mt-0.5 accent-[var(--brand)]"
            checked={attachLogs}
            disabled={phase === "sending"}
            onChange={(e) => setAttachLogs(e.target.checked)}
          />
          <span>
            Attach recent error logs. They are masked, stored on the WireCat server for 90 days, and never shown in the
            issue.
          </span>
        </label>
        {attachLogs && !context && !contextError && (
          <p className="flex items-center gap-1.5 text-[0.85rem] text-ink-dim">
            <LoaderCircle className="size-3.5 animate-spin" aria-hidden /> Collecting failed runs from your tools…
          </p>
        )}
        {attachLogs && context && (
          <>
            <p className="text-[0.85rem]">
              {runCount} failed {runCount === 1 ? "run" : "runs"} from {runs.map((r) => r.tool).join(", ") || "no tool"}
              {prefill.log?.length ? `, and the ${prefill.log.length}-line install log` : ""}.
            </p>
            <Disclosure summary="Show what is attached">
              <pre className="selectable max-h-48 overflow-auto rounded-[0.3rem] bg-app p-2 font-mono text-[0.78rem] text-ink">
                {JSON.stringify(
                  { ...context.attachments, ...(prefill.log?.length ? { installLog: prefill.log } : {}) },
                  null,
                  2,
                )}
              </pre>
            </Disclosure>
          </>
        )}
      </section>
    </div>
  )
}

function Actions({ fields, ready }: { fields: Parameters<typeof newIssueUrl>[0]; ready: boolean }) {
  const { phase, error, context, close } = useReport()
  if (phase === "sent") return <Button onClick={close}>Done</Button>
  return (
    <div className="flex w-full flex-wrap items-center justify-end gap-2">
      {phase === "failed" && error && (
        <p role="alert" className="mr-auto max-w-[24rem] text-[0.875rem] text-bad">
          {error}
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
        disabled={!ready || !context || phase === "sending"}
        icon={
          phase === "sending" ? (
            <LoaderCircle className="size-4 animate-spin" aria-hidden />
          ) : (
            <Send className="size-4" aria-hidden />
          )
        }
      >
        {phase === "sending" ? "Sending…" : phase === "failed" ? "Try again" : "Send report"}
      </Button>
    </div>
  )
}

function Sent() {
  const sent = useReport((s) => s.sent)
  if (!sent) return null
  return (
    <div className="flex flex-col gap-3">
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
