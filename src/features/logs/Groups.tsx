import { formatWhen, type Group } from "@/domain/runs"
import { useLang, useMessages } from "@/i18n"
import { ValueLabel, valueTitle } from "./Facets"
import { logsMessages } from "./messages"
import { fieldLabel } from "./names"

type Props = { field: string; groups: Group[]; now: Date; onPick: (value: string) => void }

export function Groups({ field, groups, now, onPick }: Props) {
  const m = useMessages(logsMessages)
  const lang = useLang()
  const max = groups[0]?.count ?? 1
  return (
    <table className="w-full table-fixed border-collapse text-[0.95rem]">
      <colgroup>
        <col />
        <col className="w-[30%]" />
        <col className="w-[5.5rem]" />
        <col className="w-[5.5rem]" />
        <col className="w-[9rem]" />
      </colgroup>
      <thead>
        <tr className="border-line-strong border-b text-left text-[0.9rem] text-ink-dim">
          <th className="py-[0.55rem] pl-[1.3rem] font-medium">{fieldLabel(m, field)}</th>
          <th className="font-medium">
            <span className="sr-only">{m.share}</span>
          </th>
          <th className="pr-[0.9rem] text-right font-medium">{m.runs}</th>
          <th className="pr-[0.9rem] text-right font-medium">{m.failed}</th>
          <th className="pr-[1.3rem] font-medium">{m.latest}</th>
        </tr>
      </thead>
      <tbody>
        {groups.map((g) => (
          <tr key={g.value} className="h-[2.6rem] border-line border-b last:border-b-0">
            <td className="pl-[0.8rem]">
              <button
                type="button"
                disabled={g.value === ""}
                onClick={() => onPick(g.value)}
                title={g.value === "" ? m.withoutField : m.showOnly(valueTitle(m, field, g.value))}
                className="flex w-full min-w-0 items-center rounded-[0.3rem] px-[0.5rem] py-[0.3rem] text-left hover:bg-app-3 disabled:pointer-events-none"
              >
                <ValueLabel field={field} value={g.value} />
              </button>
            </td>
            <td aria-hidden>
              <span className="block h-[0.45rem] rounded-full bg-app-3">
                <span
                  className="block h-full rounded-full bg-ink-soft/45"
                  style={{ width: `${Math.max(2, (g.count / max) * 100)}%` }}
                />
              </span>
            </td>
            <td className="pr-[0.9rem] text-right font-mono text-[0.95rem] tabular-nums">{g.count}</td>
            <td className="pr-[0.9rem] text-right font-mono text-[0.95rem] text-ink-soft tabular-nums">{g.failed}</td>
            <td className="truncate pr-[1.3rem] font-mono text-[0.9rem] text-ink-soft tabular-nums">
              {formatWhen(g.last, now, lang)}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
