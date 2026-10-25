import { Check, ChevronRight, Group, Minus } from "lucide-react"
import { type MouseEvent, useState } from "react"
import {
  agentName,
  BARE_COMMAND_HINT,
  type Count,
  commandLabel,
  FACET_LABELS,
  FACETS,
  isBareCommand,
  statusTone,
  type Term,
  termState,
} from "@/domain/runs"
import { cx } from "@/ui/cx"
import { Lamp } from "@/ui/Lamp"
import { ToolIcon } from "../tools/ToolIcon"
import { toolName } from "./names"

const SHOWN = 6

type Props = {
  counts: Record<string, Count[]>
  terms: Term[]
  total: number
  groupBy: string | null
  onToggle: (field: string, value: string, negate: boolean) => void
  onGroup: (field: string | null) => void
}

export function Facets({ counts, terms, total, groupBy, onToggle, onGroup }: Props) {
  return (
    <nav aria-label="Facets" className="flex flex-col gap-[1.1rem]">
      <p className="text-[0.85rem] text-ink-dim">
        Counts over {total} {total === 1 ? "run" : "runs"} in range. Click to keep a value, Alt-click to hide it.
      </p>
      {FACETS.map((field) => (
        <Facet
          key={field}
          field={field}
          counts={counts[field] ?? []}
          terms={terms}
          grouped={groupBy === field}
          onToggle={onToggle}
          onGroup={onGroup}
        />
      ))}
    </nav>
  )
}

/** Picked values always stay in view, but in their count order rather than pinned to the top. */
export function visibleValues(counts: Count[], picked: (c: Count) => boolean, limit: number): Count[] {
  let room = Math.max(0, limit - counts.filter(picked).length)
  return counts.filter((c) => {
    if (picked(c)) return true
    if (room === 0) return false
    room--
    return true
  })
}

function Facet(
  props: { field: string; counts: Count[]; grouped: boolean } & Pick<Props, "terms" | "onToggle" | "onGroup">,
) {
  const { field, counts, terms, grouped, onToggle, onGroup } = props
  const [open, setOpen] = useState(true)
  const [all, setAll] = useState(false)
  const shown = all ? counts : visibleValues(counts, (c) => termState(terms, field, c.value) !== null, SHOWN)
  const label = FACET_LABELS[field] ?? field

  return (
    <section aria-label={label}>
      <div className="group/facet flex items-center gap-1">
        <button
          type="button"
          onClick={() => setOpen(!open)}
          aria-expanded={open}
          className="flex min-w-0 flex-1 items-center gap-1 rounded-[0.3rem] text-left text-[0.95rem] font-medium text-ink-dim hover:text-ink"
        >
          <ChevronRight
            aria-hidden
            className={cx("size-[0.95rem] transition-transform duration-150", open && "rotate-90")}
          />
          {label}
          <span className="ml-auto font-normal tabular-nums">{counts.length || ""}</span>
        </button>
        <button
          type="button"
          onClick={() => onGroup(grouped ? null : field)}
          aria-pressed={grouped}
          aria-label={grouped ? `Stop grouping by ${label}` : `Group by ${label}`}
          title={grouped ? "Stop grouping" : "Group by this field"}
          className={cx(
            "grid size-[1.5rem] shrink-0 place-items-center rounded-[0.3rem] hover:bg-app-3 hover:text-ink focus-visible:opacity-100",
            grouped ? "text-brand" : "text-ink-dim opacity-0 group-hover/facet:opacity-100",
          )}
        >
          <Group className="size-[0.9rem]" aria-hidden />
        </button>
      </div>
      {open && (
        <ul className="mt-[0.35rem] flex flex-col">
          {counts.length === 0 && <li className="py-1 pl-[1.2rem] text-[0.85rem] text-ink-dim">No values</li>}
          {shown.map((c) => (
            <Value key={c.value} field={field} count={c} state={termState(terms, field, c.value)} onToggle={onToggle} />
          ))}
          {counts.length > shown.length && (
            <li>
              <button
                type="button"
                onClick={() => setAll(true)}
                className="mt-0.5 pl-[1.2rem] text-[0.85rem] font-medium text-brand hover:text-brand-hover"
              >
                Show all {counts.length}
              </button>
            </li>
          )}
          {all && counts.length > SHOWN && (
            <li>
              <button
                type="button"
                onClick={() => setAll(false)}
                className="mt-0.5 pl-[1.2rem] text-[0.85rem] font-medium text-brand hover:text-brand-hover"
              >
                Show fewer
              </button>
            </li>
          )}
        </ul>
      )}
    </section>
  )
}

function Value(props: {
  field: string
  count: Count
  state: "include" | "exclude" | null
  onToggle: Props["onToggle"]
}) {
  const { field, count, state, onToggle } = props
  const none = count.value === ""
  const click = (e: MouseEvent) => onToggle(field, count.value, e.altKey || e.shiftKey)
  return (
    <li className="group/value relative flex items-center">
      <button
        type="button"
        disabled={none}
        onClick={click}
        aria-pressed={state === "include"}
        title={
          none
            ? "Runs without this field"
            : `${state === "include" ? "Stop keeping" : "Keep only"} ${valueTitle(field, count.value)}`
        }
        className={cx(
          "flex min-h-[1.9rem] w-full min-w-0 items-center gap-[0.45rem] rounded-[0.3rem] pr-[0.4rem] pl-[0.15rem] text-left text-[0.95rem]",
          "hover:bg-app-3 disabled:pointer-events-none",
          state === "exclude" && "text-ink-dim line-through decoration-ink-dim",
        )}
      >
        <span
          aria-hidden
          className={cx(
            "grid size-[0.95rem] shrink-0 place-items-center rounded-[0.2rem] border",
            state === "include" && "border-brand bg-brand text-brand-ink",
            state === "exclude" && "border-bad bg-bad/15 text-bad",
            !state && "border-line-strong bg-app",
          )}
        >
          {state === "include" && <Check className="size-[0.7rem]" strokeWidth={3} />}
          {state === "exclude" && <Minus className="size-[0.7rem]" strokeWidth={3} />}
        </span>
        <ValueLabel field={field} value={count.value} />
        <span className="ml-auto shrink-0 pl-2 text-[0.85rem] text-ink-dim tabular-nums group-hover/value:invisible">
          {count.count}
        </span>
      </button>
      {!none && (
        <button
          type="button"
          onClick={() => onToggle(field, count.value, true)}
          aria-label={state === "exclude" ? `Show ${count.value} again` : `Hide ${count.value}`}
          title={state === "exclude" ? "Show again" : "Hide these runs"}
          className="absolute right-[0.2rem] grid size-[1.4rem] place-items-center rounded-[0.3rem] text-ink-dim opacity-0 hover:bg-app hover:text-bad focus-visible:opacity-100 group-hover/value:opacity-100"
        >
          <Minus className="size-[0.8rem]" aria-hidden />
        </button>
      )}
    </li>
  )
}

export function ValueLabel({ field, value }: { field: string; value: string }) {
  if (value === "") return <span className="truncate text-ink-dim italic">none</span>
  if (field === "tool")
    return (
      <span className="flex min-w-0 items-center gap-[0.4rem]">
        <ToolIcon id={value} className="size-[0.95rem] shrink-0 text-ink-soft" />
        <span className="truncate">{toolName(value)}</span>
      </span>
    )
  if (field === "status")
    return (
      <span className="flex min-w-0 items-center gap-[0.45rem]">
        <Lamp tone={statusTone(value)} size="sm" />
        <span className="truncate">{value}</span>
      </span>
    )
  if (field === "agent") return <span className="truncate">{agentName(value)}</span>
  if (field === "cli_command" && isBareCommand(value))
    return (
      <span className="truncate font-mono text-[0.85rem]" title={BARE_COMMAND_HINT}>
        {value} <span className="font-sans text-ink-dim">(no command)</span>
      </span>
    )
  return <span className="truncate font-mono text-[0.85rem]">{value}</span>
}

export const valueTitle = (field: string, value: string) =>
  field === "cli_command" && isBareCommand(value) ? `${commandLabel(value)}. ${BARE_COMMAND_HINT}` : value
