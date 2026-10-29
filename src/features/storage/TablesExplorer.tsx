import { ArrowDown, ArrowUp, Search } from "lucide-react"
import { useState } from "react"
import { findTool } from "@/domain/catalog"
import { sortTables, splitTables, type TableSort, totalBytes } from "@/domain/database"
import { formatBytes } from "@/domain/format"
import { formatNumber, useMessages } from "@/i18n"
import type { Table } from "@/platform/archive-schemas"
import { Button } from "@/ui/Button"
import { cx } from "@/ui/cx"
import { Disclosure, DisclosureSkeleton } from "@/ui/Disclosure"
import { ErrorNotice } from "@/ui/ErrorNotice"
import { Skeleton } from "@/ui/Skeleton"
import { ReportThis } from "../report/ReportThis"
import { storageMessages } from "./messages"
import { useStorage } from "./store"
import { useElapsed } from "./useElapsed"

const COLUMNS: { key: TableSort["key"]; numeric: boolean }[] = [
  { key: "name", numeric: false },
  { key: "kind", numeric: false },
  { key: "rows", numeric: true },
  { key: "bytes", numeric: true },
]

export function TablesExplorer({ answeredBy }: { answeredBy: string }) {
  const m = useMessages(storageMessages)
  const tables = useStorage((s) => s.tables)
  const tablesError = useStorage((s) => s.tablesError)
  const [query, setQuery] = useState("")
  const [sort, setSort] = useState<TableSort>({ key: "name", descending: false })
  const tool = findTool(answeredBy)?.name ?? answeredBy

  if (tables === undefined) return <TablesSkeleton />
  if (tables && !tables.available)
    return (
      <Frame count={null}>
        <p className="text-[0.9rem] text-ink-soft">{m.listLater(tool)}</p>
      </Frame>
    )

  const { main, search } = splitTables(tables?.tables ?? [])
  const kindLabel = (kind: string) => m.tableKind[kind] ?? kind
  const shownMain = sortTables(main, query, sort, kindLabel)
  const shownSearch = sortTables(search, query, sort, kindLabel)
  const onSort = (key: TableSort["key"]) =>
    setSort((s) =>
      s.key === key ? { key, descending: !s.descending } : { key, descending: key !== "name" && key !== "kind" },
    )

  return (
    <Frame count={tables ? main.length + search.length : null} className="reveal">
      {tablesError && (
        <ErrorNotice inline action={<ReportThis what="Listing the storage tables" error={tablesError} />}>
          {m.listError(tablesError)}
        </ErrorNotice>
      )}
      {tables === null ? null : (
        <>
          <div className="flex flex-wrap items-center gap-3">
            <label className="relative flex min-w-[14rem] flex-1 items-center sm:max-w-[22rem]">
              <Search className="pointer-events-none absolute left-[0.6rem] size-[0.95rem] text-ink-dim" aria-hidden />
              <input
                type="search"
                aria-label={m.findTable}
                placeholder={m.findTable}
                spellCheck={false}
                autoComplete="off"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="selectable h-8 w-full rounded-[0.35rem] border border-line-strong bg-app pr-2 pl-[2rem] font-mono text-[0.875rem] text-ink placeholder:font-sans placeholder:text-ink-dim"
              />
            </label>
            <MeasureSizes measured={tables.measured} />
          </div>
          <TableOf tables={shownMain} sort={sort} onSort={onSort} label={m.tables} measured={tables.measured} />
          {query.trim() !== "" && shownMain.length === 0 && shownSearch.length === 0 && (
            <p className="text-[0.9rem] text-ink-soft">{m.noMatch(query.trim())}</p>
          )}
          {shownSearch.length > 0 && (
            <Disclosure
              summary={
                <>
                  {m.searchTables(shownSearch.length)}
                  {tables.measured && (
                    <span className="font-mono text-ink-dim tabular-nums">
                      {" "}
                      · {formatBytes(totalBytes(shownSearch))}
                    </span>
                  )}
                </>
              }
            >
              <p className="mb-2 max-w-[70ch] text-[0.9rem] text-ink-soft">{m.searchNote}</p>
              <TableOf
                tables={shownSearch}
                sort={sort}
                onSort={onSort}
                label={m.searchTablesLabel}
                measured={tables.measured}
              />
            </Disclosure>
          )}
        </>
      )}
    </Frame>
  )
}

/** A full table list, sized as it arrives: the list box is at its maximum height whenever there are many tables. */
export function TablesSkeleton() {
  const m = useMessages(storageMessages)
  return (
    <Frame count={null}>
      <div className="flex flex-wrap items-center gap-3">
        <Skeleton className="h-8 min-w-[14rem] flex-1 sm:max-w-[22rem]" label={m.countingRows} />
        <div className="flex flex-wrap items-center gap-3">
          <Button size="sm" disabled>
            {m.measure}
          </Button>
          <span className="text-[0.9rem] text-ink-dim">{m.measureHint}</span>
        </div>
      </div>
      <Skeleton className="h-[26rem] w-full rounded-[0.45rem]" />
      <DisclosureSkeleton chars={24} />
    </Frame>
  )
}

function Frame({
  count,
  className,
  children,
}: {
  count: number | null
  className?: string
  children: React.ReactNode
}) {
  const m = useMessages(storageMessages)
  return (
    <section aria-labelledby="tables-title" className={cx("flex flex-col gap-3", className)}>
      <h3 id="tables-title" className="text-[1rem] font-semibold">
        {m.tables}
        {count !== null && <span className="ml-2 font-mono text-[0.9rem] font-normal text-ink-dim">{count}</span>}
      </h3>
      {children}
    </section>
  )
}

function MeasureSizes({ measured }: { measured: boolean }) {
  const measuring = useStorage((s) => s.measuring)
  const measuredIn = useStorage((s) => s.measuredIn)
  const measureSizes = useStorage((s) => s.measureSizes)
  const elapsed = useElapsed(measuring)
  const m = useMessages(storageMessages)
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Button size="sm" onClick={measureSizes} disabled={measuring !== null}>
        {measuring !== null ? m.measuring : measured ? m.measureAgain : m.measure}
      </Button>
      <span className="text-[0.9rem] text-ink-dim" role="status">
        {measuring !== null
          ? m.readingPages(<span className="font-mono tabular-nums">{m.duration(elapsed)}</span>)
          : measured && measuredIn !== null
            ? m.measuredIn(<span className="font-mono tabular-nums">{m.duration(measuredIn)}</span>)
            : m.measureHint}
      </span>
    </div>
  )
}

function TableOf(props: {
  tables: Table[]
  sort: TableSort
  onSort: (key: TableSort["key"]) => void
  label: string
  measured: boolean
}) {
  const { tables, sort, onSort, label, measured } = props
  const m = useMessages(storageMessages)
  if (tables.length === 0) return null
  return (
    <div className="max-h-[26rem] overflow-auto rounded-[0.45rem] border border-line">
      <table aria-label={label} className="w-full text-[0.9rem]">
        <thead className="sticky top-0 bg-app-2">
          <tr className="border-line border-b text-left text-[0.9rem] text-ink-dim">
            {COLUMNS.map((c) => (
              <th
                key={c.key}
                scope="col"
                aria-sort={sort.key === c.key ? (sort.descending ? "descending" : "ascending") : undefined}
                className={`px-3 py-[0.45rem] font-medium ${c.numeric ? "text-right" : ""}`}
              >
                <button
                  type="button"
                  onClick={() => onSort(c.key)}
                  className="inline-flex items-center gap-1 rounded-[0.3rem] hover:text-ink"
                >
                  {m.column[c.key]}
                  {sort.key === c.key &&
                    (sort.descending ? (
                      <ArrowDown className="size-[0.85rem]" aria-hidden />
                    ) : (
                      <ArrowUp className="size-[0.85rem]" aria-hidden />
                    ))}
                </button>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {tables.map((t) => (
            <tr key={t.name} className="border-line border-t first:border-t-0">
              <th scope="row" className="selectable px-3 py-[0.35rem] text-left font-mono text-[0.9rem] font-normal">
                {t.name}
              </th>
              <td className="px-3 py-[0.35rem] text-ink-soft">{m.tableKind[t.kind] ?? t.kind}</td>
              <td className="px-3 py-[0.35rem] text-right font-mono tabular-nums">
                {t.rows === null ? <span className="text-ink-dim">—</span> : formatNumber(t.rows)}
              </td>
              <td className="px-3 py-[0.35rem] text-right font-mono tabular-nums">
                {measured && t.bytes !== null ? formatBytes(t.bytes) : <span className="text-ink-dim">—</span>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
