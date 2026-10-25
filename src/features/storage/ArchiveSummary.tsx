import { useState } from "react"
import { breakdownRows, DIMENSIONS, type Dimension, totals, UNIT } from "@/domain/archive"
import { findTool } from "@/domain/catalog"
import { formatBytes } from "@/domain/format"
import type { StoreInfo } from "@/platform/archive-schemas"
import { cx } from "@/ui/cx"
import { Skeleton } from "@/ui/Skeleton"
import { DatabaseFacts } from "./DatabaseFacts"
import { useStorage } from "./store"
import { TablesExplorer } from "./TablesExplorer"

const n = (x: number) => x.toLocaleString("en-US")
const clock = (at: number) => new Date(at).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })

export function ArchiveSummary() {
  const info = useStorage((s) => s.info)
  const infoError = useStorage((s) => s.infoError)
  const infoAt = useStorage((s) => s.infoAt)

  return (
    <section aria-labelledby="archive-title" className="rounded-[0.2rem] border border-line-strong bg-app">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-line border-b px-[1.3rem] py-[0.9rem]">
        <h2 id="archive-title" className="text-[1.08rem] font-semibold">
          In storage
        </h2>
        {info && (
          <p className="text-[0.85rem] text-ink-dim">
            Counted by <span className="font-mono">{findTool(info.answeredBy)?.bin ?? info.answeredBy} store info</span>
            {infoAt !== null && (
              <>
                {" "}
                at <span className="font-mono tabular-nums">{clock(infoAt)}</span>
              </>
            )}{" "}
            ·{" "}
            <span className="font-mono tabular-nums">
              {formatBytes(info.fileBytes + info.walBytes)}
              {info.schema !== null && ` · schema ${info.schema}`}
            </span>
          </p>
        )}
      </div>
      <div className="px-[1.3rem] py-[1.1rem]">
        {info === undefined ? (
          <Skeleton className="h-16 w-full" label="Reading storage" />
        ) : infoError ? (
          <p role="alert" className="text-[0.95rem] text-bad">
            Could not read storage: {infoError}
          </p>
        ) : info === null ? (
          <p className="text-[0.95rem] text-ink-soft">
            Install a WireCat tool to see what is in storage: the installed tool that reads the newest schema counts it
            for the app.
          </p>
        ) : !info.exists ? (
          <p className="text-[0.95rem] text-ink-soft">Storage is not created yet. It appears after the first sync.</p>
        ) : info.problem ? (
          <p role="alert" className="text-[0.95rem] text-bad">
            Storage is there but did not open: {info.problem}
          </p>
        ) : (
          <Contents info={info} />
        )}
      </div>
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
  const [dim, setDim] = useState<Dimension>("provider")
  const items = totals(info.rows)
  const rows = info.breakdown ? breakdownRows(info.breakdown, dim, formatBytes) : []

  return (
    <div className="flex flex-col gap-[1.2rem]">
      <dl className="grid grid-cols-[repeat(auto-fill,minmax(8.5rem,1fr))] gap-x-[1.2rem] gap-y-3">
        {items.map((t) => (
          <div key={t.key}>
            <dt className="text-[0.85rem] text-ink-dim">{t.label}</dt>
            <dd className="selectable font-mono text-[1.02rem] tabular-nums">{n(t.value)}</dd>
          </div>
        ))}
      </dl>

      {info.breakdown ? (
        <div className="flex flex-col gap-3">
          <fieldset className="m-0 flex min-w-0 flex-wrap items-center gap-1 border-0 p-0">
            <legend className="float-left mr-2 text-[0.85rem] text-ink-dim">Break down by</legend>
            {DIMENSIONS.map((d) => (
              <button
                key={d.id}
                type="button"
                aria-pressed={dim === d.id}
                onClick={() => setDim(d.id)}
                className={cx(
                  "rounded-[0.35rem] px-2.5 py-1 text-[0.875rem] transition-colors duration-150",
                  dim === d.id ? "bg-app-3 font-medium text-ink" : "text-ink-soft hover:bg-app-2 hover:text-ink",
                )}
              >
                {d.label}
              </button>
            ))}
          </fieldset>
          {rows.length === 0 ? (
            <p className="text-[0.9rem] text-ink-soft">Nothing to break down yet.</p>
          ) : (
            <table aria-label={`By ${DIMENSIONS.find((d) => d.id === dim)?.label.toLowerCase()}`} className="w-full">
              <thead className="sr-only">
                <tr>
                  <th scope="col">Group</th>
                  <th scope="col">Share</th>
                  <th scope="col">{UNIT[dim]}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="align-middle">
                    <th scope="row" className="w-[40%] py-1.5 pr-4 text-left font-normal">
                      <span className="block truncate text-[0.95rem] text-ink">{r.label}</span>
                      {r.detail && (
                        <span className="block truncate font-mono text-[0.8rem] text-ink-dim tabular-nums">
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
                    <td className="w-[7.5rem] py-1.5 text-right font-mono text-[0.95rem] tabular-nums">
                      {n(r.value)} <span className="text-[0.8rem] text-ink-dim">{UNIT[dim]}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      ) : (
        <p className="text-[0.9rem] text-ink-soft">
          Breakdowns by source, chat type, account and year arrive with the next update of{" "}
          {findTool(info.answeredBy)?.name ?? info.answeredBy}.
        </p>
      )}
    </div>
  )
}
