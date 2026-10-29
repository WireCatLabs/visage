import { useState } from "react"
import { breakdownRows, DIMENSIONS, type Dimension, TOTALS, totals } from "@/domain/archive"
import { findTool, tools } from "@/domain/catalog"
import { formatBytes } from "@/domain/format"
import { formatDate, formatNumber, useMessages } from "@/i18n"
import type { StoreInfo } from "@/platform/archive-schemas"
import { cx } from "@/ui/cx"
import { ErrorNotice } from "@/ui/ErrorNotice"
import { Skeleton } from "@/ui/Skeleton"
import { ReportThis } from "../report/ReportThis"
import { DatabaseFacts, DatabaseFactsSkeleton } from "./DatabaseFacts"
import { storageMessages } from "./messages"
import { useStorage } from "./store"
import { TablesExplorer, TablesSkeleton } from "./TablesExplorer"

export function ArchiveSummary() {
  const m = useMessages(storageMessages)
  const info = useStorage((s) => s.info)
  const infoError = useStorage((s) => s.infoError)
  const infoAt = useStorage((s) => s.infoAt)

  return (
    <section aria-labelledby="archive-title" className="rounded-[0.2rem] border border-line-strong bg-app">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-line border-b px-[1.3rem] py-[0.9rem]">
        <h2 id="archive-title" className="text-[1.08rem] font-semibold">
          {m.inStorage}
        </h2>
        {info === undefined && (
          <p className="text-[0.9rem] text-ink-dim">
            <Skeleton chars={44} />
          </p>
        )}
        {info && (
          <p className="reveal text-[0.9rem] text-ink-dim">
            {m.countedBy(
              <code className="font-mono">{findTool(info.answeredBy)?.bin ?? info.answeredBy} store info</code>,
              infoAt === null ? null : (
                <span className="font-mono tabular-nums">
                  {formatDate(infoAt, { hour: "2-digit", minute: "2-digit" })}
                </span>
              ),
            )}{" "}
            ·{" "}
            <span className="font-mono tabular-nums">
              {formatBytes(info.fileBytes + info.walBytes)}
              {info.schema !== null && ` · ${m.schema(info.schema)}`}
            </span>
          </p>
        )}
      </div>
      <div className="px-[1.3rem] py-[1.1rem]">
        {info === undefined ? (
          <ContentsSkeleton />
        ) : infoError ? (
          <ErrorNotice inline action={<ReportThis what="Reading the message storage" error={infoError} />}>
            {m.readError(infoError)}
          </ErrorNotice>
        ) : info === null ? (
          <p className="text-[0.95rem] text-ink-soft">{m.noTool}</p>
        ) : !info.exists ? (
          <p className="text-[0.95rem] text-ink-soft">{m.notCreated}</p>
        ) : info.problem ? (
          <ErrorNotice inline action={<ReportThis what="Opening the message storage" error={info.problem} />}>
            {m.didNotOpen(info.problem)}
          </ErrorNotice>
        ) : (
          <Contents info={info} />
        )}
      </div>
      {info === undefined && (
        <>
          <div className="border-line border-t px-[1.3rem] py-[1.1rem]">
            <DatabaseFactsSkeleton />
          </div>
          <div className="border-line border-t px-[1.3rem] py-[1.1rem]">
            <TablesSkeleton />
          </div>
        </>
      )}
      {info?.exists && !info.problem && (
        <>
          <div className="border-line border-t px-[1.3rem] py-[1.1rem]">
            <DatabaseFacts info={info} />
          </div>
          <div className="border-line border-t px-[1.3rem] py-[1.1rem]">
            <TablesExplorer answeredBy={info.answeredBy} />
          </div>
        </>
      )}
    </section>
  )
}

function Contents({ info }: { info: StoreInfo }) {
  const m = useMessages(storageMessages)
  const [dim, setDim] = useState<Dimension>("provider")
  const items = totals(info.rows)
  const rows = info.breakdown ? breakdownRows(info.breakdown, dim, formatBytes, m.archiveWords, formatNumber) : []

  return (
    <div className="reveal flex flex-col gap-[1.2rem]">
      <dl className="grid grid-cols-[repeat(auto-fill,minmax(8.5rem,1fr))] gap-x-[1.2rem] gap-y-3">
        {items.map((t) => (
          <div key={t.key}>
            <dt className="text-[0.9rem] text-ink-dim">{m.total[t.key]}</dt>
            <dd className="selectable font-mono text-[1.02rem] tabular-nums">{formatNumber(t.value)}</dd>
          </div>
        ))}
      </dl>

      {info.breakdown ? (
        <div className="flex flex-col gap-3">
          <fieldset className="m-0 flex min-w-0 flex-wrap items-center gap-1 border-0 p-0">
            <legend className="float-left mr-2 text-[0.9rem] text-ink-dim">{m.breakDownBy}</legend>
            {DIMENSIONS.map((d) => (
              <button
                key={d}
                type="button"
                aria-pressed={dim === d}
                onClick={() => setDim(d)}
                className={cx(
                  "rounded-[0.35rem] px-2.5 py-1 text-[0.875rem] transition-colors duration-150",
                  dim === d ? "bg-app-3 font-medium text-ink" : "text-ink-soft hover:bg-app-2 hover:text-ink",
                )}
              >
                {m.dimension[d]}
              </button>
            ))}
          </fieldset>
          {rows.length === 0 ? (
            <p className="text-[0.9rem] text-ink-soft">{m.nothingToBreak}</p>
          ) : (
            <table aria-label={m.byDimension[dim]} className="w-full">
              <thead className="sr-only">
                <tr>
                  <th scope="col">{m.group}</th>
                  <th scope="col">{m.share}</th>
                  <th scope="col">{m.unitHeader[dim]}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="align-middle">
                    <th scope="row" className="w-[40%] py-1.5 pr-4 text-left font-normal">
                      <span className="block truncate text-[0.95rem] text-ink">{r.label}</span>
                      {r.detail && (
                        <span className="block truncate font-mono text-[0.85rem] text-ink-dim tabular-nums">
                          {r.detail}
                        </span>
                      )}
                    </th>
                    <td className="py-1.5 pr-4">
                      <span aria-hidden className="block h-2 rounded-[0.15rem] bg-app-3">
                        <span
                          className="block h-full rounded-[0.15rem] bg-brand/70"
                          style={{ width: `${Math.max(r.share * 100, r.value > 0 ? 1 : 0)}%` }}
                        />
                      </span>
                    </td>
                    <td className="w-[7.5rem] whitespace-nowrap py-1.5 text-right font-mono text-[0.95rem] tabular-nums">
                      {formatNumber(r.value)}{" "}
                      <span className="text-[0.85rem] text-ink-dim">{m.unit(dim, r.value)}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      ) : (
        <p className="text-[0.9rem] text-ink-soft">
          {m.breakdownsLater(findTool(info.answeredBy)?.name ?? info.answeredBy)}
        </p>
      )}
    </div>
  )
}

function ContentsSkeleton() {
  const m = useMessages(storageMessages)
  return (
    <div className="flex flex-col gap-[1.2rem]">
      <dl className="grid grid-cols-[repeat(auto-fill,minmax(8.5rem,1fr))] gap-x-[1.2rem] gap-y-3">
        {TOTALS.map((t, i) => (
          <div key={t}>
            <dt className="text-[0.9rem] text-ink-dim">{m.total[t]}</dt>
            <dd className="font-mono text-[1.02rem]">
              <Skeleton chars={6} {...(i === 0 ? { label: m.readingStorage } : {})} />
            </dd>
          </div>
        ))}
      </dl>
      <div className="flex flex-col gap-3">
        <fieldset disabled className="m-0 flex min-w-0 flex-wrap items-center gap-1 border-0 p-0">
          <legend className="float-left mr-2 text-[0.9rem] text-ink-dim">{m.breakDownBy}</legend>
          {DIMENSIONS.map((d) => (
            <button
              key={d}
              type="button"
              aria-pressed={d === "provider"}
              className={cx(
                "rounded-[0.35rem] px-2.5 py-1 text-[0.875rem]",
                d === "provider" ? "bg-app-3 font-medium text-ink" : "text-ink-soft",
              )}
            >
              {m.dimension[d]}
            </button>
          ))}
        </fieldset>
        <table aria-hidden className="w-full">
          <tbody>
            {tools.map((t) => (
              <tr key={t.id} className="align-middle">
                <th className="w-[40%] py-1.5 pr-4 text-left font-normal">
                  <span className="block text-[0.95rem]">
                    <Skeleton chars={9} />
                  </span>
                  <span className="block font-mono text-[0.85rem]">
                    <Skeleton chars={34} />
                  </span>
                </th>
                <td className="py-1.5 pr-4">
                  <Skeleton className="h-2 w-full rounded-[0.15rem]" />
                </td>
                <td className="w-[7.5rem] py-1.5 text-right font-mono text-[0.95rem]">
                  <Skeleton chars={11} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
