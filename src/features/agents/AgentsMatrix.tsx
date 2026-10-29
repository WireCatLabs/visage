import { type ReactNode, useEffect } from "react"
import type { CatalogTool } from "@/domain/catalog"
import { cellAction, type SkillCell, type SkillTarget, TARGET_FOLDER } from "@/domain/skills"
import { formatList, type Lang, useMessages } from "@/i18n"
import type { Agent } from "@/platform/agents-schemas"
import { Button } from "@/ui/Button"
import { cx } from "@/ui/cx"
import { ErrorNotice } from "@/ui/ErrorNotice"
import { Lamp } from "@/ui/Lamp"
import { Skeleton } from "@/ui/Skeleton"
import { ReportThis } from "../report/ReportThis"
import { useTools } from "../tools/store"
import { ToolIcon } from "../tools/ToolIcon"
import { askSkillInstall } from "./actions"
import { ConfirmCommand } from "./Confirm"
import { agentsMessages } from "./messages"
import { SKILL_TONE } from "./SkillTable"
import { catalogTools, useSkillMatrix } from "./skill-matrix"
import { useAgents } from "./store"

const names = (agents: readonly Agent[], lang?: Lang) =>
  formatList(
    agents.map((a) => a.name),
    lang,
  )

/**
 * Tools down, the two places a skill is written across, headed by the agents found that read each.
 * `compact` drops the folder paths and the list of agents, for embedding in onboarding.
 * `expected` names the tools to draw as rows while the installed ones are still being found.
 */
export function AgentsMatrix({ compact = false, expected = [] }: { compact?: boolean; expected?: readonly string[] }) {
  const matrix = useSkillMatrix()
  const m = useMessages(agentsMessages)
  const { detected, agents, found, notInstalled } = matrix
  // Hermes has its own target that no released tool writes yet; its pane on the Agents page says so. A column of
  // "needs a newer version" would only push the matrix past the onboarding step's width.
  const targets = matrix.targets.filter((t) => t !== "hermes")
  const rows = matrix.rows.map((r) => ({ ...r, cells: r.cells.filter((c) => c.target !== "hermes") }))
  const load = useAgents((s) => s.load)
  const installedIds = rows.map((r) => r.tool.id).join(",")
  const checked = useTools((s) => s.checked)

  useEffect(() => {
    const tools = useTools.getState()
    if (!checked && !tools.refreshing) tools.refresh()
  }, [checked])

  useEffect(() => {
    if (detected) load(installedIds ? installedIds.split(",") : [])
  }, [detected, installedIds, load])

  const readers = (target: SkillTarget) => found?.filter((a) => a.reads.includes(target)) ?? []
  const columnName = (target: SkillTarget, lang?: Lang) => names(readers(target), lang) || TARGET_FOLDER[target]
  const pad = compact ? "px-[1rem] py-[0.7rem]" : "px-[1.3rem] py-[0.9rem]"
  const pending = catalogTools.filter((t) => expected.includes(t.id))
  const silent = rows.filter((r) => r.source === "none")
  const firstChecking = rows
    .flatMap((r) => r.cells.map((c) => ({ tool: r.tool.id, target: c.target, kind: c.cell.kind })))
    .find((c) => c.kind === "checking")

  if (detected && rows.length === 0) {
    return (
      <p className="rounded-[0.2rem] border border-line-strong bg-app px-[1.3rem] py-5 text-[0.95rem] text-ink-soft">
        {m.noTool}
      </p>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      {compact && found !== null && found.length === 0 && (
        <p className="rounded-[0.2rem] border border-warn/40 bg-warn/10 px-4 py-3 text-[0.95rem]">{m.noAgent}</p>
      )}
      <div className="overflow-x-auto rounded-[0.2rem] border border-line-strong bg-app">
        <table aria-label={m.matrixLabel} className="w-full border-collapse text-left">
          <thead>
            <tr className="border-line border-b">
              <th scope="col" className={cx(pad, "text-[0.9rem] font-medium text-ink-dim")}>
                {m.tool}
              </th>
              {targets.map((t) => (
                <th key={t} scope="col" className={cx(pad, "w-[34%] align-bottom font-normal", compact && "w-[38%]")}>
                  {agents === null ? (
                    <Skeleton className="h-5 w-32" label={m.lookingForAgents} />
                  ) : (
                    <span className="block text-[0.95rem] font-semibold text-ink">{columnName(t)}</span>
                  )}
                  {!compact && (
                    <span className="selectable mt-0.5 block font-mono text-[0.85rem] text-ink-dim">
                      {TARGET_FOLDER[t]}
                    </span>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {!detected && pending.length > 0
              ? pending.map((t, i) => (
                  <tr key={t.id} className="border-line border-b align-top last:border-b-0">
                    <th scope="row" className={cx(pad, "font-normal")}>
                      <ToolName tool={t} version={<Skeleton chars={6} />} />
                    </th>
                    {targets.map((target) => (
                      <td key={target} className={pad}>
                        <div className="flex min-h-8 items-center">
                          <Skeleton
                            chars={12}
                            {...(i === 0 && target === targets[0] ? { label: m.checkingSkills } : {})}
                          />
                        </div>
                      </td>
                    ))}
                  </tr>
                ))
              : !detected
                ? [0, 1, 2].map((i) => (
                    <tr key={i} className="border-line border-b last:border-b-0">
                      <td colSpan={targets.length + 1} className={pad}>
                        {i === 0 ? (
                          <Skeleton className="h-8 w-full" label={m.findingTools} />
                        ) : (
                          <Skeleton className="h-8 w-full" />
                        )}
                      </td>
                    </tr>
                  ))
                : rows.map((r) => (
                    <tr key={r.tool.id} className="border-line border-b align-top last:border-b-0">
                      <th scope="row" className={cx(pad, "font-normal")}>
                        <ToolName tool={r.tool} version={r.cliVersion ?? ""} />
                      </th>
                      {r.cells.map((c) => (
                        <td key={c.target} className={pad}>
                          <Cell
                            first={r.tool.id === firstChecking?.tool && c.target === firstChecking.target}
                            cell={c.cell}
                            busy={c.busy}
                            failure={c.failure}
                            tool={r.tool.id}
                            toolName={r.tool.name}
                            column={columnName(c.target)}
                            report={`${r.tool.name} skill for ${columnName(c.target, "en")}`}
                            onInstall={(action) => askSkillInstall(r.tool.id, c.target, action, columnName(c.target))}
                          />
                        </td>
                      ))}
                    </tr>
                  ))}
          </tbody>
        </table>
      </div>
      {detected && notInstalled.length > 0 && !compact && (
        <p className="text-[0.9rem] text-ink-soft">{m.notInstalledNote(notInstalled.map((t) => t.name))}</p>
      )}
      {silent.length === 0 && firstChecking && (
        // Old tools are the usual case, so their note's line is kept until every skill has answered.
        <p className={cx("leading-snug", compact ? "text-[0.9rem]" : "text-[0.9rem]")}>
          <Skeleton chars={60} />
        </p>
      )}
      {silent.length > 0 && (
        // Last under the table, as it arrives last: inside a row it would push every row under it down.
        <p className={cx("leading-snug text-ink-soft", compact ? "text-[0.9rem]" : "text-[0.9rem]")}>
          {m.silent(silent.map((r) => r.tool.name))}{" "}
          {silent.some((r) => r.newer)
            ? compact
              ? m.fixOnTools
              : m.fixOnToolsTo(silent.flatMap((r) => (r.newer ? [m.toVersion(r.tool.name, r.newer)] : [])))
            : m.comingRelease}
        </p>
      )}
      {compact && <ConfirmCommand />}
    </div>
  )
}

function ToolName({ tool, version }: { tool: CatalogTool; version: ReactNode }) {
  return (
    <div className="flex items-center gap-[0.8rem]">
      <ToolIcon id={tool.id} className="size-[1.5rem] shrink-0 text-ink" />
      <div className="min-w-0">
        <span className="block text-[1.02rem] font-semibold leading-tight">{tool.name}</span>
        <span className="selectable font-mono text-[0.85rem] text-ink-dim tabular-nums">
          {tool.bin} {version}
        </span>
      </div>
    </div>
  )
}

function Cell(props: {
  first: boolean
  cell: SkillCell
  busy: boolean
  failure: string | null
  tool: string
  toolName: string
  column: string
  /** Names the failure in the bug report, which stays in English whatever the interface's language. */
  report: string
  onInstall: (action: "Install" | "Update") => void
}) {
  const { first, cell, busy, failure, tool, toolName, column, report, onInstall } = props
  const m = useMessages(agentsMessages)
  if (cell.kind === "checking" && !busy)
    return (
      <div aria-live="polite">
        <div className="flex min-h-8 items-center">
          <Skeleton chars={12} {...(first ? { label: m.checkingSkills } : {})} />
        </div>
      </div>
    )
  const look = busy
    ? { tone: "busy" as const, word: m.writing }
    : { tone: SKILL_TONE[cell.kind], word: cell.kind === "unknown" ? m.unknown : m.state[cell.kind] }
  const action = cellAction(cell)
  const version = cell.kind === "current" || cell.kind === "stale" ? cell.installed : null
  return (
    <div aria-live="polite">
      <div className="flex min-h-8 items-center gap-2">
        <Lamp size="sm" tone={look.tone} label={m.skillState(toolName, column, look.word)} />
        <span className={cx("text-[0.95rem]", cell.kind === "stale" && !busy && "text-warn-ink")}>{look.word}</span>
        {version && <span className="selectable font-mono text-[0.9rem] text-ink-soft tabular-nums">{version}</span>}
        {action && (
          <Button
            size="sm"
            className="ml-auto"
            disabled={busy}
            onClick={() => onInstall(action)}
            aria-label={action === "Install" ? m.installSkill(toolName, column) : m.updateSkill(toolName, column)}
          >
            {m.action[action]}
          </Button>
        )}
      </div>
      {cell.kind === "failed" && !busy && (
        <ErrorNotice
          inline
          className="mt-1"
          action={<ReportThis what={`Checking the ${report}`} tool={tool} error={cell.message} />}
        >
          {cell.message}
        </ErrorNotice>
      )}
      {failure && !busy && (
        <ErrorNotice
          inline
          className="mt-1"
          action={<ReportThis what={`Writing the ${report}`} tool={tool} error={failure} />}
        >
          {failure}
        </ErrorNotice>
      )}
    </div>
  )
}
