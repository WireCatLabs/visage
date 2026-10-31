import { ChevronRight } from "lucide-react"
import { Fragment } from "react"
import { formatWhen } from "@/domain/runs"
import { hitRow } from "@/domain/search"
import { formatDate, useLang, useMessages } from "@/i18n"
import type { SearchHit } from "@/platform/search-schemas"
import { Collapse } from "@/ui/Collapse"
import { cx } from "@/ui/cx"
import { Skeleton } from "@/ui/Skeleton"
import { selectsTextIn } from "@/ui/selection"
import { JsonTree } from "../logs/JsonTree"
import { searchMessages } from "./messages"

type Props = {
  hits: SearchHit[]
  /** Rows held at the real row height while the first answer is on its way. */
  placeholders?: number
  now: Date
  expanded: string | null
  onToggle: (key: string) => void
}

const FULL: Intl.DateTimeFormatOptions = { dateStyle: "full", timeStyle: "long" }
const none = () => null
const nothing = () => {}

export function HitsTable({ hits, placeholders = 0, now, expanded, onToggle }: Props) {
  const m = useMessages(searchMessages)
  const lang = useLang()
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[36rem] table-fixed border-collapse text-[0.95rem] [&_td]:pr-[0.9rem] [&_th]:pr-[0.9rem]">
        <colgroup>
          <col className="w-[2.2rem]" />
          <col className="w-[10.5rem]" />
          <col className="w-[8rem] lg:w-[13rem]" />
          <col className="w-[6.5rem] lg:w-[10rem]" />
          <col />
        </colgroup>
        <thead>
          <tr className="border-line-strong border-b text-left text-[0.9rem] text-ink-dim">
            <th className="sr-only">{m.hitDetail}</th>
            <th className="py-[0.55rem] font-medium">{m.when}</th>
            <th className="font-medium">{m.where}</th>
            <th className="font-medium">{m.who}</th>
            <th className="pr-[1.3rem] font-medium">{m.text}</th>
          </tr>
        </thead>
        <tbody>
          {hits.map((hit, i) => {
            const row = hitRow(hit, i)
            const key = `${i}:${row.key}`
            const open = expanded === key
            const label = row.where ?? row.text ?? row.key
            return (
              <Fragment key={key}>
                <tr
                  onClick={(e) => {
                    if (!selectsTextIn(e.currentTarget)) onToggle(key)
                  }}
                  className={cx(
                    "group h-[2.6rem] cursor-pointer border-line border-b transition-colors duration-150 hover:bg-app-2",
                    open && "bg-app-2",
                  )}
                >
                  <td className="pl-[0.55rem]">
                    <button
                      type="button"
                      aria-expanded={open}
                      aria-label={(open ? m.hideHit : m.showHit)(label)}
                      onClick={(e) => {
                        e.stopPropagation()
                        onToggle(key)
                      }}
                      className="grid size-[1.5rem] place-items-center rounded-[0.3rem] text-ink-dim hover:bg-app-3 hover:text-ink"
                    >
                      <ChevronRight
                        aria-hidden
                        className={cx("size-[0.95rem] transition-transform duration-150", open && "rotate-90")}
                      />
                    </button>
                  </td>
                  <td
                    className="truncate whitespace-nowrap font-mono text-[0.9rem] text-ink-soft tabular-nums"
                    title={row.when ? formatDate(row.when, FULL, lang) : undefined}
                  >
                    {row.when ? formatWhen(row.when, now, lang) : "—"}
                  </td>
                  <td className="truncate font-medium" title={row.where ?? undefined}>
                    {row.where ?? <span className="font-normal text-ink-dim">—</span>}
                  </td>
                  <td className="truncate text-ink-soft" title={row.who ?? undefined}>
                    {row.fromMe ? m.you : (row.who ?? <span className="text-ink-dim">—</span>)}
                  </td>
                  <td className="truncate pr-[1.3rem]" title={row.text ?? undefined}>
                    {row.text ?? <span className="text-ink-dim">—</span>}
                  </td>
                </tr>
                <tr className={cx(open && "border-line border-b")}>
                  <td colSpan={5} className="p-0">
                    <Collapse open={open}>
                      <div className="bg-app-2/60 px-[1.3rem] py-[0.9rem]">
                        <JsonTree value={hit} fieldOf={none} onFilter={nothing} onGroup={nothing} label={m.hitDetail} />
                      </div>
                    </Collapse>
                  </td>
                </tr>
              </Fragment>
            )
          })}
          {Array.from({ length: placeholders }, (_, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: placeholders have no identity
            <tr key={i} className="h-[2.6rem] border-line border-b">
              <td colSpan={5} className="px-[1.3rem]">
                {i === 0 ? (
                  <Skeleton className="h-[1.3rem] w-full" label={m.loadingHits} />
                ) : (
                  <Skeleton className="h-[1.3rem] w-full" />
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
