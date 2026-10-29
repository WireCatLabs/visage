import {
  ArrowDown,
  ArrowUp,
  BotMessageSquare,
  ChevronRight,
  Globe,
  Monitor,
  SquareTerminal,
  UserRound,
} from "lucide-react"
import { Fragment } from "react"
import {
  agentName,
  agentOf,
  type Conversation,
  clientOf,
  formatDuration,
  formatWhen,
  isBareCommand,
  type Run,
  shortSession,
  statusTone,
} from "@/domain/runs"
import { formatDate, useLang, useMessages } from "@/i18n"
import { cx } from "@/ui/cx"
import { Lamp } from "@/ui/Lamp"
import { Skeleton } from "@/ui/Skeleton"
import { selectsTextIn } from "@/ui/selection"
import { TextButton } from "@/ui/TextButton"
import { ToolIcon } from "../tools/ToolIcon"
import { logsMessages } from "./messages"
import { commandLabel, type LogsWords, toolName, viaName } from "./names"
import { RunDetail } from "./RunDetail"
import { type Detail, runKey } from "./store"

type Props = {
  runs: Run[]
  /** Runs grouped by conversation, each under a header row; `runs` is then not read. */
  sections?: Conversation[] | undefined
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
  const m = useMessages(logsMessages)
  const bare = isBareCommand(value)
  const typed = unknown && unknown !== "[redacted]" ? unknown : null
  return (
    <td
      className="truncate font-mono text-[0.95rem] font-medium group-hover:text-brand"
      title={bare ? [typed && m.didNotKnow(typed), m.bareHint].filter(Boolean).join(" ") : value}
    >
      {value}
      {bare && (
        <span className="font-normal font-sans text-ink-dim">
          {" "}
          {typed ? m.noCommandTyped(<span className="font-mono">{typed}</span>) : m.noCommand}
        </span>
      )}
    </td>
  )
}

function AgentCell({ run, onFilter }: { run: Run; onFilter: Props["onFilter"] }) {
  const m = useMessages(logsMessages)
  const agent = agentOf(run)
  if (!agent) return <td className="text-ink-dim">—</td>
  // A browser app has no session of its own to show; the name it gave says who it is.
  const shown =
    agent.kind === "mcp-client" ? (clientOf(run)?.name ?? agentName(agent.kind, m.mcpApp)) : agentName(agent.kind)
  const [field, value] = agent.session ? ["session_id", agent.session] : ["agent", agent.kind]
  return (
    <td className="pr-[0.6rem]">
      <TextButton
        onClick={(e) => {
          e.stopPropagation()
          onFilter(field, value, false)
        }}
        title={agent.session ? m.onlySession(agent.session) : m.onlyStartedBy(shown)}
        className="flex max-w-full min-w-0 items-baseline gap-[0.4rem] rounded-[0.3rem] text-left hover:text-brand"
      >
        <span className="truncate">{shown}</span>
        {agent.session && (
          <span className="shrink-0 font-mono text-[0.85rem] text-ink-dim tabular-nums">
            {shortSession(agent.session)}
          </span>
        )}
      </TextButton>
    </td>
  )
}

const FULL: Intl.DateTimeFormatOptions = { dateStyle: "full", timeStyle: "long" }

const CHAT_KINDS = new Set(["hermes-agent", "openclaw"])

/** Who held the conversation: the agent, else the app that called, else how the runs were started. */
export function conversationTitle(m: LogsWords, c: Conversation): string {
  if (c.agent === "mcp-client" || (!c.agent && c.client)) return c.client?.name ?? m.mcpApp
  if (c.agent) return agentName(c.agent, m.mcpApp)
  return c.via ? viaName(m, c.via) : m.notInConversation
}

function WhoIcon({ c }: { c: Conversation }) {
  const Icon =
    c.agent === "mcp-client" || (!c.agent && c.client)
      ? Globe
      : c.agent && CHAT_KINDS.has(c.agent)
        ? BotMessageSquare
        : c.agent
          ? SquareTerminal
          : c.via === "desktop"
            ? Monitor
            : UserRound
  return <Icon className="size-[1rem] shrink-0 text-ink-soft" strokeWidth={1.7} aria-hidden />
}

function ConversationRow({ conversation: c, now }: { conversation: Conversation; now: Date }) {
  const m = useMessages(logsMessages)
  const lang = useLang()
  // Claude Code calls itself "claude-code" over MCP; repeating it next to its name says nothing.
  const client = c.client && c.agent !== "mcp-client" && c.client.name !== c.agent ? c.client.name : null
  const details = [
    client,
    c.via && (c.agent || c.client) ? viaName(m, c.via) : null,
    c.session ? m.session(shortSession(c.session)) : null,
  ].filter(Boolean)
  return (
    <tr className="h-[2.6rem] border-line-strong border-b bg-app-2/70">
      <td colSpan={9} className="pl-[0.8rem]">
        <span className="flex min-w-0 items-center gap-[0.55rem] text-[0.9rem]">
          {c.key ? <WhoIcon c={c} /> : <span className="size-[1rem] shrink-0" />}
          <span className="truncate font-medium">{conversationTitle(m, c)}</span>
          {details.length > 0 && <span className="truncate text-ink-dim">{details.join(" · ")}</span>}
          <span className="ml-auto flex shrink-0 items-baseline gap-[1.1rem] text-[0.9rem] text-ink-soft">
            {c.key && (
              <span className="font-mono tabular-nums" title={formatDate(c.first, FULL, lang)}>
                {m.from(formatWhen(c.first, now, lang))}
              </span>
            )}
            <span className="tabular-nums">{m.runsN(c.runs.length)}</span>
            <span className={cx("tabular-nums", c.failed > 0 ? "text-bad" : "text-ink-dim")}>
              {m.failedN(c.failed)}
            </span>
          </span>
        </span>
      </td>
    </tr>
  )
}

export function RunsTable({
  runs,
  sections,
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
  const m = useMessages(logsMessages)
  const lang = useLang()
  const row = (run: Run) => {
    const key = runKey(run)
    const open = expanded === key
    return (
      <Fragment key={key}>
        <tr
          onClick={(e) => {
            if (!selectsTextIn(e.currentTarget)) onToggle(key, run)
          }}
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
              aria-label={(open ? m.hideRun : m.showRun)(
                commandLabel(m, commandOf(run)),
                formatWhen(run.started_at, now, lang),
              )}
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
            className="font-mono text-[0.9rem] text-ink-soft tabular-nums"
            title={formatDate(run.started_at, FULL, lang)}
          >
            {formatWhen(run.started_at, now, lang)}
          </td>
          <td>
            <span className="flex min-w-0 items-center gap-[0.4rem]">
              <ToolIcon id={run.tool} className="size-[1rem] shrink-0 text-ink-soft" />
              <span className="truncate">{toolName(run.tool)}</span>
            </span>
          </td>
          <td className="truncate font-mono text-[0.9rem] text-ink-soft">{run.profile ?? "—"}</td>
          <CommandCell
            value={commandOf(run)}
            unknown={typeof run.unknown_command === "string" ? run.unknown_command : null}
          />
          <AgentCell run={run} onFilter={onFilter} />
          <td>
            <span className="flex items-center gap-[0.45rem]">
              <Lamp tone={statusTone(run.status)} size="sm" />
              <span className={cx(run.status === "partial" && "text-warn-ink")}>
                {m.statuses[run.status] ?? run.status}
              </span>
            </span>
          </td>
          <td className="pr-[1rem] text-right font-mono text-[0.9rem] text-ink-soft tabular-nums">
            {formatDuration(run.duration_ms)}
          </td>
          <td className="truncate pr-[1.3rem] font-mono text-[0.9rem]">
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
  }

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
          <tr className="border-line-strong border-b text-left text-[0.9rem] text-ink-dim">
            <th className="sr-only">{m.details}</th>
            <th aria-sort={newest ? "descending" : "ascending"} className="py-[0.55rem] font-medium">
              <button
                type="button"
                onClick={onSort}
                className="inline-flex items-center gap-1 rounded-[0.3rem] hover:text-ink"
                title={newest ? m.newestFirst : m.oldestFirst}
              >
                {m.time}
                {newest ? (
                  <ArrowDown className="size-[0.85rem]" aria-hidden />
                ) : (
                  <ArrowUp className="size-[0.85rem]" aria-hidden />
                )}
              </button>
            </th>
            <th className="font-medium">{m.tool}</th>
            <th className="font-medium">{m.profile}</th>
            <th className="font-medium">{m.command}</th>
            <th className="font-medium">{m.agent}</th>
            <th className="font-medium">{m.status}</th>
            <th className="pr-[1rem] text-right font-medium">{m.took}</th>
            <th className="pr-[1.3rem] font-medium">{m.errorCode}</th>
          </tr>
        </thead>
        {sections ? (
          sections.map((c) => (
            <tbody
              key={c.key || "none"}
              aria-label={m.conversationLabel(conversationTitle(m, c), c.session ? shortSession(c.session) : null)}
            >
              <ConversationRow conversation={c} now={now} />
              {c.runs.map(row)}
            </tbody>
          ))
        ) : (
          <tbody>
            {runs.map(row)}
            {Array.from({ length: placeholders }, (_, i) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: placeholders have no identity
              <tr key={i} className="h-[2.6rem] border-line border-b">
                <td colSpan={9} className="px-[1.3rem]">
                  {i === 0 ? (
                    <Skeleton className="h-[1.3rem] w-full" label={m.loadingRuns} />
                  ) : (
                    <Skeleton className="h-[1.3rem] w-full" />
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        )}
      </table>
    </div>
  )
}
