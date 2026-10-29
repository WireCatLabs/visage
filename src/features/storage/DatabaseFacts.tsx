import type { ReactNode } from "react"
import { findTool } from "@/domain/catalog"
import { backupState, healthIssues, healthNotes, schemaState } from "@/domain/database"
import { formatBytes } from "@/domain/format"
import { formatDate, useMessages } from "@/i18n"
import type { StoreInfo } from "@/platform/archive-schemas"
import { Button } from "@/ui/Button"
import { CopyField } from "@/ui/CopyField"
import { Disclosure, DisclosureSkeleton } from "@/ui/Disclosure"
import { Lamp } from "@/ui/Lamp"
import { Skeleton } from "@/ui/Skeleton"
import { ReportThis } from "../report/ReportThis"
import { storageMessages } from "./messages"
import { useStorage } from "./store"
import { useElapsed } from "./useElapsed"

const DAY_AND_TIME: Intl.DateTimeFormatOptions = {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
}

export function DatabaseFacts({ info }: { info: StoreInfo }) {
  const m = useMessages(storageMessages)
  const tool = findTool(info.answeredBy)?.name ?? info.answeredBy
  const facts = info.facts
  const schema = schemaState(info.schema, info.speaks, m.databaseWords)
  const backup = facts ? backupState(facts.backup, Date.now(), m.databaseWords) : null

  return (
    <section aria-labelledby="database-title" className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 id="database-title" className="text-[1rem] font-semibold">
          {m.storageFile}
        </h3>
        <CheckButton />
      </div>
      <dl className="grid grid-cols-[minmax(7rem,9rem)_minmax(0,1fr)] gap-x-[1.2rem] gap-y-2 text-[0.95rem]">
        {info.path && (
          <Fact label={m.fact.file}>
            <span className="selectable block truncate font-mono text-[0.9rem]">{info.path}</span>
          </Fact>
        )}
        <Fact label={m.fact.size}>
          <span className="text-ink-soft">
            {m.sizeWal(
              <span className="font-mono text-ink tabular-nums">{formatBytes(info.fileBytes)}</span>,
              <span className="font-mono text-ink tabular-nums">{formatBytes(info.walBytes)}</span>,
            )}
          </span>
        </Fact>
        {facts && (
          <Fact label={m.fact.journal}>
            <span className="font-mono">{facts.journalMode}</span>
          </Fact>
        )}
        {info.schema !== null && (
          <Fact label={m.fact.schema}>
            <span className="inline-flex items-center gap-2">
              {schema && <Lamp tone={schema.tone} size="sm" />}
              <span className="font-mono tabular-nums">{info.schema}</span>
              {schema && <span className="text-ink-soft">{schema.text}</span>}
            </span>
          </Fact>
        )}
        {facts && (
          <Fact label={m.fact.unused}>
            <span className="text-ink-soft">
              {m.unusedSpace(
                <span className="font-mono text-ink tabular-nums">
                  {formatBytes(facts.freePages * facts.pageSize)}
                </span>,
                facts.freePages,
                facts.pageCount,
              )}
            </span>
          </Fact>
        )}
        {backup && (
          <Fact label={m.fact.backup}>
            <span className="inline-flex items-start gap-2">
              <span className="pt-[0.35rem]">
                <Lamp tone={backup.tone} size="sm" />
              </span>
              <span className={backup.tone === "warn" ? "text-warn-ink" : "text-ink-soft"}>{backup.text}</span>
            </span>
          </Fact>
        )}
        <Fact label={m.fact.health}>
          <Health />
        </Fact>
      </dl>
      {facts ? (
        facts.migrations.length > 0 && (
          <Disclosure summary={m.migrations(facts.migrations.length)}>
            <div className="max-h-[16rem] max-w-[34rem] overflow-auto">
              <table aria-label={m.migrationsLabel} className="w-full text-[0.9rem]">
                <thead className="sticky top-0 bg-app">
                  <tr className="text-left text-ink-dim">
                    <th scope="col" className="py-1 pr-4 font-medium">
                      {m.version}
                    </th>
                    <th scope="col" className="py-1 pr-4 font-medium">
                      {m.applied}
                    </th>
                    <th scope="col" className="py-1 font-medium">
                      {m.readableFrom}
                    </th>
                  </tr>
                </thead>
                <tbody className="font-mono tabular-nums">
                  {[...facts.migrations].reverse().map((x) => (
                    <tr key={x.version} className="border-line border-t">
                      <td className="py-1 pr-4">{x.version}</td>
                      <td className="py-1 pr-4 text-ink-soft">
                        {x.appliedAt ? formatDate(x.appliedAt, DAY_AND_TIME) : "—"}
                      </td>
                      <td className="py-1 text-ink-soft">{m.schema(x.minCompatible)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Disclosure>
        )
      ) : (
        <p className="text-[0.9rem] text-ink-soft">{m.factsLater(tool)}</p>
      )}
    </section>
  )
}

/** The section as it will look with a current tool, while the tool is still being asked. */
export function DatabaseFactsSkeleton() {
  const m = useMessages(storageMessages)
  return (
    <section aria-labelledby="database-title" className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 id="database-title" className="text-[1rem] font-semibold">
          {m.storageFile}
        </h3>
        <CheckButton />
      </div>
      <dl className="grid grid-cols-[minmax(7rem,9rem)_minmax(0,1fr)] gap-x-[1.2rem] gap-y-2 text-[0.95rem]">
        <Fact label={m.fact.file}>
          <span className="block font-mono text-[0.9rem]">
            <Skeleton chars={34} />
          </span>
        </Fact>
        <Fact label={m.fact.size}>
          <span className="font-mono">
            <Skeleton chars={44} />
          </span>
        </Fact>
        <Fact label={m.fact.journal}>
          <span className="font-mono">
            <Skeleton chars={3} />
          </span>
        </Fact>
        <Fact label={m.fact.schema}>
          <span className="inline-flex items-center gap-2">
            <Lamp tone="idle" size="sm" />
            <span className="font-mono">
              <Skeleton chars={16} />
            </span>
          </span>
        </Fact>
        <Fact label={m.fact.unused}>
          <span className="font-mono">
            <Skeleton chars={52} />
          </span>
        </Fact>
        <Fact label={m.fact.backup}>
          <span className="inline-flex items-start gap-2">
            <span className="pt-[0.35rem]">
              <Lamp tone="idle" size="sm" />
            </span>
            <Skeleton chars={58} />
          </span>
        </Fact>
        <Fact label={m.fact.health}>
          <Health />
        </Fact>
      </dl>
      <DisclosureSkeleton chars={20} />
    </section>
  )
}

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <>
      <dt className="pt-[0.1rem] text-[0.9rem] text-ink-dim">{label}</dt>
      <dd className="min-w-0">{children}</dd>
    </>
  )
}

function CheckButton() {
  const m = useMessages(storageMessages)
  const checking = useStorage((s) => s.checking)
  const runCheck = useStorage((s) => s.runCheck)
  return (
    <Button size="sm" onClick={runCheck} disabled={checking !== null}>
      {checking !== null ? m.checking : m.checkHealth}
    </Button>
  )
}

function Health() {
  const m = useMessages(storageMessages)
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
          {m.readingPages(<span className="font-mono tabular-nums">{m.duration(elapsed)}</span>)}
        </span>
      </span>
    )
  if (checkError)
    return (
      <span className="inline-flex flex-wrap items-center gap-2" role="alert">
        <Lamp tone="bad" size="sm" />
        <span className="text-bad">{m.checkFailed(checkError)}</span>
        <ReportThis what="Checking the message storage" error={checkError} />
      </span>
    )
  if (!check)
    return (
      <span className="inline-flex items-center gap-2">
        <Lamp tone="idle" size="sm" />
        <span className="text-ink-soft">{m.notChecked}</span>
      </span>
    )

  const issues = healthIssues(check, formatBytes, m.databaseWords)
  const notes = healthNotes(check, m.databaseWords)
  const took = checkedIn === null ? "" : ` · ${m.checkedIn(m.duration(checkedIn))}`
  return (
    <div className="flex flex-col gap-2" role="status">
      <span className="inline-flex items-center gap-2">
        <Lamp tone={issues.length === 0 ? "ok" : "bad"} size="sm" />
        <span className={issues.length === 0 ? "text-ink" : "text-bad"}>
          {issues.length === 0 ? m.noProblems : m.problems(issues.length)}
        </span>
        <span className="text-[0.9rem] text-ink-dim">{took}</span>
      </span>
      {issues.length > 0 && (
        <ul className="flex flex-col gap-2">
          {issues.map((issue) => (
            <li key={`${issue.text}${issue.fix}`} className="flex max-w-[70ch] flex-col gap-1">
              <span className="text-ink-soft">{issue.text}</span>
              {issue.fix && <CopyField value={issue.fix} label={m.copyCommand} />}
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
