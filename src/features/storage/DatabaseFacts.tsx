import type { ReactNode } from "react"
import { findTool } from "@/domain/catalog"
import { backupState, formatDuration, healthIssues, healthNotes, schemaState } from "@/domain/database"
import { formatBytes } from "@/domain/format"
import type { StoreInfo } from "@/platform/archive-schemas"
import { Button } from "@/ui/Button"
import { CopyField } from "@/ui/CopyField"
import { Disclosure } from "@/ui/Disclosure"
import { Lamp } from "@/ui/Lamp"
import { ReportThis } from "../report/ReportThis"
import { useStorage } from "./store"
import { useElapsed } from "./useElapsed"

const dateTime = (iso: string) =>
  new Date(iso).toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })

export function DatabaseFacts({ info }: { info: StoreInfo }) {
  const tool = findTool(info.answeredBy)?.name ?? info.answeredBy
  const facts = info.facts
  const schema = schemaState(info.schema, info.speaks, tool)
  const backup = facts ? backupState(facts.backup, Date.now()) : null

  return (
    <section aria-labelledby="database-title" className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 id="database-title" className="text-[1rem] font-semibold">
          Storage file
        </h3>
        <CheckButton />
      </div>
      <dl className="grid grid-cols-[minmax(7rem,9rem)_minmax(0,1fr)] gap-x-[1.2rem] gap-y-2 text-[0.95rem]">
        {info.path && (
          <Fact label="File">
            <span className="selectable block truncate font-mono text-[0.85rem]">{info.path}</span>
          </Fact>
        )}
        <Fact label="Size">
          <span className="font-mono tabular-nums">{formatBytes(info.fileBytes)}</span>
          <span className="text-ink-soft"> and </span>
          <span className="font-mono tabular-nums">{formatBytes(info.walBytes)}</span>
          <span className="text-ink-soft"> not yet written into it (the write-ahead log)</span>
        </Fact>
        {facts && (
          <Fact label="Journal mode">
            <span className="font-mono">{facts.journalMode}</span>
          </Fact>
        )}
        {info.schema !== null && (
          <Fact label="Schema">
            <span className="inline-flex items-center gap-2">
              {schema && <Lamp tone={schema.tone} size="sm" />}
              <span className="font-mono tabular-nums">{info.schema}</span>
              {schema && <span className="text-ink-soft">{schema.text}</span>}
            </span>
          </Fact>
        )}
        {facts && (
          <Fact label="Unused space">
            <span className="font-mono tabular-nums">{formatBytes(facts.freePages * facts.pageSize)}</span>
            <span className="text-ink-soft">
              {" "}
              in {facts.freePages.toLocaleString("en-US")} free pages of {facts.pageCount.toLocaleString("en-US")}; a
              clean-up (VACUUM) would give it back
            </span>
          </Fact>
        )}
        {backup && (
          <Fact label="Last backup">
            <span className="inline-flex items-start gap-2">
              <span className="pt-[0.35rem]">
                <Lamp tone={backup.tone} size="sm" />
              </span>
              <span className={backup.tone === "warn" ? "text-warn-ink" : "text-ink-soft"}>{backup.text}</span>
            </span>
          </Fact>
        )}
        <Fact label="Health">
          <Health />
        </Fact>
      </dl>
      {facts ? (
        facts.migrations.length > 0 && (
          <Disclosure summary={`Migration history (${facts.migrations.length})`}>
            <div className="max-h-[16rem] max-w-[34rem] overflow-auto">
              <table aria-label="Migration history" className="w-full text-[0.85rem]">
                <thead className="sticky top-0 bg-app">
                  <tr className="text-left text-ink-dim">
                    <th scope="col" className="py-1 pr-4 font-medium">
                      Version
                    </th>
                    <th scope="col" className="py-1 pr-4 font-medium">
                      Applied
                    </th>
                    <th scope="col" className="py-1 font-medium">
                      Readable by tools from
                    </th>
                  </tr>
                </thead>
                <tbody className="font-mono tabular-nums">
                  {[...facts.migrations].reverse().map((m) => (
                    <tr key={m.version} className="border-line border-t">
                      <td className="py-1 pr-4">{m.version}</td>
                      <td className="py-1 pr-4 text-ink-soft">{m.appliedAt ? dateTime(m.appliedAt) : "—"}</td>
                      <td className="py-1 text-ink-soft">schema {m.minCompatible}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Disclosure>
        )
      ) : (
        <p className="text-[0.9rem] text-ink-soft">
          Journal mode, unused space, migration history and the last backup arrive with the next update of {tool}.
        </p>
      )}
    </section>
  )
}

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <>
      <dt className="pt-[0.1rem] text-[0.85rem] text-ink-dim">{label}</dt>
      <dd className="min-w-0">{children}</dd>
    </>
  )
}

function CheckButton() {
  const checking = useStorage((s) => s.checking)
  const runCheck = useStorage((s) => s.runCheck)
  return (
    <Button size="sm" onClick={runCheck} disabled={checking !== null}>
      {checking !== null ? "Checking…" : "Check health"}
    </Button>
  )
}

function Health() {
  const checking = useStorage((s) => s.checking)
  const check = useStorage((s) => s.check)
  const checkedIn = useStorage((s) => s.checkedIn)
  const checkError = useStorage((s) => s.checkError)
  const elapsed = useElapsed(checking)

  if (checking !== null)
    return (
      <span className="inline-flex items-center gap-2" role="status">
        <Lamp tone="busy" size="sm" />
        <span className="text-ink-soft">
          Reading every page of the file… <span className="font-mono tabular-nums">{formatDuration(elapsed)}</span>
        </span>
      </span>
    )
  if (checkError)
    return (
      <span className="inline-flex flex-wrap items-center gap-2" role="alert">
        <Lamp tone="bad" size="sm" />
        <span className="text-bad">The check did not finish: {checkError}</span>
        <ReportThis what="Checking the message storage" error={checkError} />
      </span>
    )
  if (!check)
    return (
      <span className="inline-flex items-center gap-2">
        <Lamp tone="idle" size="sm" />
        <span className="text-ink-soft">
          Not checked yet. The check reads the whole file, a minute or two when storage is large.
        </span>
      </span>
    )

  const issues = healthIssues(check, formatBytes)
  const notes = healthNotes(check)
  const took = checkedIn === null ? "" : ` · checked in ${formatDuration(checkedIn)}`
  return (
    <div className="flex flex-col gap-2" role="status">
      <span className="inline-flex items-center gap-2">
        <Lamp tone={issues.length === 0 ? "ok" : "bad"} size="sm" />
        <span className={issues.length === 0 ? "text-ink" : "text-bad"}>
          {issues.length === 0
            ? "No problems found"
            : `${issues.length} ${issues.length === 1 ? "problem" : "problems"} found`}
        </span>
        <span className="text-[0.85rem] text-ink-dim">{took}</span>
      </span>
      {issues.length > 0 && (
        <ul className="flex flex-col gap-2">
          {issues.map((issue) => (
            <li key={`${issue.text}${issue.fix}`} className="flex max-w-[70ch] flex-col gap-1">
              <span className="text-ink-soft">{issue.text}</span>
              {issue.fix && <CopyField value={issue.fix} label="Copy the command" />}
            </li>
          ))}
        </ul>
      )}
      {notes.map((note) => (
        <span key={note} className="text-[0.9rem] text-ink-soft">
          {note}
        </span>
      ))}
    </div>
  )
}
