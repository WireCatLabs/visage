import { ArrowDown, ArrowUp, ChevronRight } from "lucide-react"
import { Fragment } from "react"
import {
  agentName,
  agentOf,
  BARE_COMMAND_HINT,
  commandLabel,
  formatDuration,
  formatWhen,
  isBareCommand,
  type Run,
  shortSession,
  statusTone,
} from "@/domain/runs"
import { cx } from "@/ui/cx"
import { Lamp } from "@/ui/Lamp"
import { Skeleton } from "@/ui/Skeleton"
import { ToolIcon } from "../tools/ToolIcon"
import { toolName } from "./names"
import { RunDetail } from "./RunDetail"
import { type Detail, runKey } from "./store"

type Props = {
  runs: Run[]
  /** Rows to hold at the real row height while the first runs are read. */
  placeholders?: number
  /** Runs a live round just added; they fade in. */
  fresh?: ReadonlySet<string>
  now: Date
  expanded: string | null
  details: Record<string, Detail>
  newest: boolean
  onSort: () => void
  onToggle: (key: string, run: Run) => void
  onFilter: (field: string, value: string, negate: boolean) => void
  onGroup: (field: string) => void
}

const commandOf = (run: Run) => (typeof run.cli_command === "string" ? run.cli_command : run.command)

function CommandCell({ value, unknown }: { value: string; unknown: string | null }) {
  const bare = isBareCommand(value)
  const typed = unknown && unknown !== "[redacted]" ? unknown : null
  return (
    <td
      className="truncate font-mono text-[0.95rem] font-medium group-hover:text-brand"
      title={bare ? `${typed ? `It did not know "${typed}". ` : ""}${BARE_COMMAND_HINT}` : value}
    >
      {value}
      {bare && (
        <span className="font-normal font-sans text-ink-dim">
          {" "}
          (no command{typed && <span className="font-mono"> {typed}</span>})
        </span>
      )}
    </td>
  )
}

function AgentCell({ run, onFilter }: { run: Run; onFilter: Props["onFilter"] }) {
  const agent = agentOf(run)
  if (!agent) return <td className="text-ink-dim">—</td>
  const [field, value] = agent.session ? ["session_id", agent.session] : ["agent", agent.kind]
  return (
    <td className="pr-[0.6rem]">
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          onFilter(field, value, false)
        }}
        title={agent.session ? `Only runs of session ${agent.session}` : `Only runs ${agentName(agent.kind)} started`}
        className="flex max-w-full min-w-0 items-baseline gap-[0.4rem] rounded-[0.3rem] text-left hover:text-brand"
      >
        <span className="truncate">{agentName(agent.kind)}</span>
        {agent.session && (
          <span className="shrink-0 font-mono text-[0.8rem] text-ink-dim tabular-nums">
            {shortSession(agent.session)}
          </span>
        )}
      </button>
    </td>
  )
}

const STATUS_WORD: Record<string, string> = {
  success: "Succeeded",
  failed: "Failed",
  partial: "Partial",
  running: "Running",
}

export function RunsTable({
  runs,
  placeholders = 0,
  fresh,
  now,
  expanded,
  details,
  newest,
  onSort,
  onToggle,
  onFilter,
  onGroup,
}: Props) {
  // The fixed columns alone take ~55rem; below that the command column would shrink to nothing, so the table
  // keeps a minimum width and scrolls sideways instead.
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[66rem] table-fixed border-collapse text-[0.95rem] [&_td]:pr-[0.9rem] [&_th]:pr-[0.9rem]">
        <colgroup>
          <col className="w-[2.2rem]" />
          <col className="w-[8.6rem]" />
          <col className="w-[7.6rem]" />
          <col className="w-[7.4rem]" />
          <col />
          <col className="w-[9rem]" />
          <col className="w-[6.8rem]" />
          <col className="w-[5.6rem]" />
          <col className="w-[9.6rem]" />
        </colgroup>
        <thead>
          <tr className="border-line-strong border-b text-left text-[0.85rem] text-ink-dim">
            <th className="sr-only">Details</th>
            <th aria-sort={newest ? "descending" : "ascending"} className="py-[0.55rem] font-medium">
              <button
                type="button"
                onClick={onSort}
                className="inline-flex items-center gap-1 rounded-[0.3rem] hover:text-ink"
                title={newest ? "Newest first" : "Oldest first"}
              >
                Time
                {newest ? (
                  <ArrowDown className="size-[0.85rem]" aria-hidden />
                ) : (
                  <ArrowUp className="size-[0.85rem]" aria-hidden />
                )}
              </button>
            </th>
            <th className="font-medium">Tool</th>
            <th className="font-medium">Profile</th>
            <th className="font-medium">Command</th>
            <th className="font-medium">Agent</th>
            <th className="font-medium">Status</th>
            <th className="pr-[1rem] text-right font-medium">Took</th>
            <th className="pr-[1.3rem] font-medium">Error code</th>
          </tr>
        </thead>
        <tbody>
          {runs.map((run) => {
            const key = runKey(run)
            const open = expanded === key
            return (
              <Fragment key={key}>
                <tr
                  onClick={() => onToggle(key, run)}
                  className={cx(
                    "group h-[2.6rem] cursor-pointer border-line border-b transition-colors duration-150 hover:bg-app-2",
                    open && "bg-app-2",
                    fresh?.has(key) && "reveal",
                  )}
                >
                  <td className="pl-[0.55rem]">
                    <button
                      type="button"
                      aria-expanded={open}
                      aria-label={`${open ? "Hide" : "Show"} run ${commandLabel(commandOf(run))} at ${formatWhen(run.started_at, now)}`}
                      onClick={(e) => {
                        e.stopPropagation()
                        onToggle(key, run)
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
                    className="font-mono text-[0.85rem] text-ink-soft tabular-nums"
                    title={new Date(run.started_at).toString()}
                  >
                    {formatWhen(run.started_at, now)}
                  </td>
                  <td>
                    <span className="flex min-w-0 items-center gap-[0.4rem]">
                      <ToolIcon id={run.tool} className="size-[1rem] shrink-0 text-ink-soft" />
                      <span className="truncate">{toolName(run.tool)}</span>
                    </span>
                  </td>
                  <td className="truncate font-mono text-[0.85rem] text-ink-soft">{run.profile ?? "—"}</td>
                  <CommandCell
                    value={commandOf(run)}
                    unknown={typeof run.unknown_command === "string" ? run.unknown_command : null}
                  />
                  <AgentCell run={run} onFilter={onFilter} />
                  <td>
                    <span className="flex items-center gap-[0.45rem]">
                      <Lamp tone={statusTone(run.status)} size="sm" />
                      <span className={cx(run.status === "partial" && "text-warn-ink")}>
                        {STATUS_WORD[run.status] ?? run.status}
                      </span>
                    </span>
                  </td>
                  <td className="pr-[1rem] text-right font-mono text-[0.85rem] text-ink-soft tabular-nums">
                    {formatDuration(run.duration_ms)}
                  </td>
                  <td className="truncate pr-[1.3rem] font-mono text-[0.85rem]">
                    {run.error_code ?? <span className="text-ink-dim">—</span>}
                  </td>
                </tr>
                {open && (
                  <tr className="border-line border-b">
                    <td colSpan={9} className="p-0">
                      <RunDetail run={run} detail={details[key]} onFilter={onFilter} onGroup={onGroup} />
                    </td>
                  </tr>
                )}
              </Fragment>
            )
          })}
          {Array.from({ length: placeholders }, (_, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: placeholders have no identity
            <tr key={i} className="h-[2.6rem] border-line border-b">
              <td colSpan={9} className="px-[1.3rem]">
                {i === 0 ? (
                  <Skeleton className="h-[1.3rem] w-full" label="Loading runs" />
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
