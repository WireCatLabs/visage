import { ChevronRight } from "lucide-react"
import { type ReactNode, useId, useState } from "react"
import type { RunError } from "@/domain/runs"
import { useMessages } from "@/i18n"
import { Collapse } from "@/ui/Collapse"
import { cx } from "@/ui/cx"
import { logsMessages } from "./messages"

/** What the tool recorded about how the run failed, before anything else in the run. */
export function RunFailure({ error, action }: { error: RunError; action?: ReactNode }) {
  const m = useMessages(logsMessages)
  const { http, provider, causes } = error
  const request = http && [http.method, http.endpoint].filter(Boolean).join(" ")
  return (
    <section
      aria-label={m.whatWentWrong}
      className="flex flex-col gap-[0.7rem] rounded-[0.2rem] border border-bad/40 bg-bad/10 px-[1rem] py-[0.8rem]"
    >
      <div className="flex flex-col gap-[0.3rem]">
        <div className="flex items-center justify-between gap-3">
          <h4 className="text-[0.9rem] font-medium text-ink-dim">{m.whatWentWrong}</h4>
          {action}
        </div>
        <p className="flex flex-wrap items-baseline gap-x-[0.6rem] gap-y-1">
          <span className="selectable font-mono text-[0.95rem] font-medium text-bad">{error.class}</span>
          {error.code && <span className="selectable font-mono text-[0.9rem] text-ink-soft">{error.code}</span>}
        </p>
        {error.message && <p className="selectable max-w-[75ch] text-[0.95rem] text-ink">{error.message}</p>}
      </div>
      <dl className="grid grid-cols-[minmax(7rem,auto)_1fr] gap-x-[1rem] gap-y-[0.35rem] text-[0.9rem]">
        {request && (
          <Fact term={m.request}>
            {request}
            {http?.status !== undefined && <span className="pl-[0.6rem] font-medium text-bad">{http.status}</span>}
          </Fact>
        )}
        {!request && http?.status !== undefined && <Fact term={m.httpStatus}>{http.status}</Fact>}
        {error.operation && <Fact term={m.operation}>{error.operation}</Fact>}
        {provider && (
          <Fact term={m.serviceRefused}>
            {[provider.key, provider.code === undefined ? null : m.code(provider.code)].filter(Boolean).join(" · ")}
          </Fact>
        )}
        {causes.length > 0 && (
          <Fact term={causes.length === 1 ? m.causedBy : m.causes}>
            <ol className="flex flex-col gap-[0.2rem]">
              {causes.map((c, i) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: a cause chain has no id and never reorders
                <li key={i}>
                  {c.class}
                  {c.message && <span className="font-sans text-ink-soft">: {c.message}</span>}
                </li>
              ))}
            </ol>
          </Fact>
        )}
      </dl>
      {error.stack.length > 0 && <Stack frames={error.stack} />}
    </section>
  )
}

function Fact({ term, children }: { term: string; children: ReactNode }) {
  return (
    <>
      <dt className="text-ink-dim">{term}</dt>
      <dd className="selectable min-w-0 font-mono text-[0.9rem] break-words text-ink tabular-nums">{children}</dd>
    </>
  )
}

function Stack({ frames }: { frames: string[] }) {
  const m = useMessages(logsMessages)
  const [open, setOpen] = useState(false)
  const id = useId()
  return (
    <div>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen(!open)}
        className="inline-flex items-center gap-1 rounded-[0.3rem] text-[0.9rem] font-medium text-ink-dim hover:text-ink"
      >
        <ChevronRight
          aria-hidden
          className={cx("size-[0.9rem] transition-transform duration-150", open && "rotate-90")}
        />
        {m.whereInTool(frames.length)}
      </button>
      <Collapse open={open} id={id} className="pt-[0.35rem]">
        <ol className="selectable overflow-x-auto rounded-[0.45rem] border border-line bg-app px-[0.8rem] py-[0.5rem] font-mono text-[0.85rem] text-ink-soft">
          {frames.map((f, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: frames repeat in recursion and never reorder
            <li key={i} className="whitespace-pre">
              {f}
            </li>
          ))}
        </ol>
      </Collapse>
    </div>
  )
}
