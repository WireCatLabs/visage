import { ArrowDown, ArrowUp, Search } from "lucide-react"
import { useState } from "react"
import { findTool } from "@/domain/catalog"
import { formatDuration, KIND_LABEL, sortTables, splitTables, type TableSort, totalBytes } from "@/domain/database"
import { formatBytes } from "@/domain/format"
import type { Table } from "@/platform/archive-schemas"
import { Button } from "@/ui/Button"
import { Disclosure } from "@/ui/Disclosure"
import { Skeleton } from "@/ui/Skeleton"
import { useStorage } from "./store"
import { useElapsed } from "./useElapsed"

const COLUMNS: { key: TableSort["key"]; label: string; numeric: boolean }[] = [
  { key: "name", label: "Table", numeric: false },
  { key: "kind", label: "Kind", numeric: false },
  { key: "rows", label: "Rows", numeric: true },
  { key: "bytes", label: "Size", numeric: true },
]

export function TablesExplorer({ answeredBy }: { answeredBy: string }) {
  const tables = useStorage((s) => s.tables)
  const tablesError = useStorage((s) => s.tablesError)
  const [query, setQuery] = useState("")
  const [sort, setSort] = useState<TableSort>({ key: "name", descending: false })
  const tool = findTool(answeredBy)?.name ?? answeredBy

  if (tables && !tables.available)
    return (
      <Frame count={null}>
        <p className="text-[0.9rem] text-ink-soft">The table list arrives with the next update of {tool}.</p>
      </Frame>
    )

  const { main, search } = splitTables(tables?.tables ?? [])
  const shownMain = sortTables(main, query, sort)
  const shownSearch = sortTables(search, query, sort)
  const onSort = (key: TableSort["key"]) =>
    setSort((s) =>
      s.key === key ? { key, descending: !s.descending } : { key, descending: key !== "name" && key !== "kind" },
    )

  return (
    <Frame count={tables ? main.length + search.length : null}>
      {tablesError && (
        <p role="alert" className="text-[0.9rem] text-bad">
          Could not list the tables: {tablesError}
        </p>
      )}
      {tables === undefined ? (
        <Skeleton className="h-24 w-full" label="Counting rows" />
      ) : tables === null ? null : (
        <>
          <div className="flex flex-wrap items-center gap-3">
            <label className="relative flex min-w-[14rem] flex-1 items-center sm:max-w-[22rem]">
              <Search className="pointer-events-none absolute left-[0.6rem] size-[0.95rem] text-ink-dim" aria-hidden />
              <input
                type="search"
                aria-label="Find a table"
                placeholder="Find a table"
                spellCheck={false}
                autoComplete="off"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="selectable h-8 w-full rounded-[0.35rem] border border-line-strong bg-app pr-2 pl-[2rem] font-mono text-[0.875rem] text-ink placeholder:font-sans placeholder:text-ink-dim"
              />
            </label>
            <MeasureSizes measured={tables.measured} />
          </div>
          <TableOf tables={shownMain} sort={sort} onSort={onSort} label="Tables" measured={tables.measured} />
          {query.trim() !== "" && shownMain.length === 0 && shownSearch.length === 0 && (
            <p className="text-[0.9rem] text-ink-soft">No table name contains “{query.trim()}”.</p>
          )}
          {shownSearch.length > 0 && (
            <Disclosure
              summary={
                <>
                  Search index tables ({shownSearch.length})
                  {tables.measured && (
                    <span className="font-mono text-ink-dim tabular-nums">
                      {" "}
                      · {formatBytes(totalBytes(shownSearch))}
                    </span>
                  )}
                </>
              }
            >
              <p className="mb-2 max-w-[70ch] text-[0.85rem] text-ink-soft">
                Built from the data above so search is fast; rebuilding them loses nothing. Their rows are not counted,
                which would read every index in full.
              </p>
              <TableOf
                tables={shownSearch}
                sort={sort}
                onSort={onSort}
                label="Search index tables"
                measured={tables.measured}
              />
            </Disclosure>
          )}
        </>
      )}
    </Frame>
  )
}

function Frame({ count, children }: { count: number | null; children: React.ReactNode }) {
  return (
    <section aria-labelledby="tables-title" className="flex flex-col gap-3">
      <h3 id="tables-title" className="text-[1rem] font-semibold">
        Tables
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
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Button size="sm" onClick={measureSizes} disabled={measuring !== null}>
        {measuring !== null ? "Measuring…" : measured ? "Measure again" : "Measure sizes"}
      </Button>
      <span className="text-[0.85rem] text-ink-dim" role="status">
        {measuring !== null ? (
          <>
            Reading every page of the file… <span className="font-mono tabular-nums">{formatDuration(elapsed)}</span>
          </>
        ) : measured && measuredIn !== null ? (
          <>
            Measured in <span className="font-mono tabular-nums">{formatDuration(measuredIn)}</span>
          </>
        ) : (
          "Reads the whole file: seconds, or a few minutes on a large archive"
        )}
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
  if (tables.length === 0) return null
  return (
    <div className="max-h-[26rem] overflow-auto rounded-[0.45rem] border border-line">
      <table aria-label={label} className="w-full text-[0.9rem]">
        <thead className="sticky top-0 bg-app-2">
          <tr className="border-line border-b text-left text-[0.85rem] text-ink-dim">
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
                  {c.label}
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
              <th scope="row" className="selectable px-3 py-[0.35rem] text-left font-mono text-[0.85rem] font-normal">
                {t.name}
              </th>
              <td className="px-3 py-[0.35rem] text-ink-soft">{KIND_LABEL[t.kind] ?? t.kind}</td>
              <td className="px-3 py-[0.35rem] text-right font-mono tabular-nums">
                {t.rows === null ? <span className="text-ink-dim">—</span> : t.rows.toLocaleString("en-US")}
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
