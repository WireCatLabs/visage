import { type ReactNode, useEffect } from "react"
import { type CatalogTool, tools } from "@/domain/catalog"
import {
  cellAction,
  needsUpdate,
  SKILL_TARGETS,
  type SkillCell,
  type SkillTarget,
  skillCell,
  TARGET_FOLDER,
} from "@/domain/skills"
import { isNewer } from "@/domain/status"
import type { Agent } from "@/platform/agents-schemas"
import { Button } from "@/ui/Button"
import { cx } from "@/ui/cx"
import { ErrorNotice } from "@/ui/ErrorNotice"
import { Lamp, type LampTone } from "@/ui/Lamp"
import { Skeleton } from "@/ui/Skeleton"
import { ReportThis } from "../report/ReportThis"
import { useTools } from "../tools/store"
import { ToolIcon } from "../tools/ToolIcon"
import { askSkillInstall } from "./actions"
import { ConfirmCommand } from "./Confirm"
import { cellKey, useAgents } from "./store"

const LOOK: Record<SkillCell["kind"], { tone: LampTone; word: string }> = {
  checking: { tone: "idle", word: "Checking…" },
  current: { tone: "ok", word: "Current" },
  stale: { tone: "warn", word: "Old" },
  unversioned: { tone: "warn", word: "No version" },
  missing: { tone: "idle", word: "Not installed" },
  unknown: { tone: "idle", word: "Unknown" },
  failed: { tone: "bad", word: "Could not check" },
}

const names = (agents: readonly Agent[]) => agents.map((a) => a.name).join(", ")

// A part of another tool's package (Email in memo) has no skill of its own; its owner's skill covers it.
const catalogTools = tools.filter((t) => t.skill !== null)

/** Everything the matrix shows, so the page can offer "Update all" over the same cells. */
export function useSkillMatrix() {
  const installs = useTools((s) => s.installs)
  const latest = useTools((s) => s.latest)
  const latestOf = (id: string, current: string | null) => {
    const l = latest?.[id]
    return l && current && isNewer(l, current) ? l : null
  }
  const { agents, skills, written, busy, failures } = useAgents()
  const detected = Object.keys(installs).length > 0
  const installed = catalogTools.filter((t) => (installs[t.id]?.length ?? 0) > 0)
  const found = agents?.filter((a) => a.foundBy !== null) ?? null
  const targets =
    found && found.length > 0 ? SKILL_TARGETS.filter((t) => found.some((a) => a.reads.includes(t))) : SKILL_TARGETS
  const rows = installed.map((tool) => {
    const cliVersion = installs[tool.id]?.[0]?.version ?? null
    const skill = skills[tool.id]
    return {
      tool,
      cliVersion,
      source: skill?.report?.source ?? null,
      newer: latestOf(tool.id, cliVersion),
      cells: targets.map((target) => {
        const key = cellKey(tool.id, target)
        return {
          target,
          busy: busy[key] === true,
          failure: failures[key] ?? null,
          cell: skillCell({
            target,
            cliVersion,
            report: skill?.report,
            error: skill?.error,
            written: written[key],
          }),
        }
      }),
    }
  })
  const stale: [string, SkillTarget][] = rows.flatMap((r) =>
    r.cells.filter((c) => needsUpdate(c.cell) && !c.busy).map((c): [string, SkillTarget] => [r.tool.id, c.target]),
  )
  return {
    detected,
    agents,
    found,
    targets,
    rows,
    stale,
    notInstalled: catalogTools.filter((t) => !installed.includes(t)),
  }
}

/**
 * Tools down, the two places a skill is written across, headed by the agents found that read each.
 * `compact` drops the folder paths and the list of agents, for embedding in onboarding.
 * `expected` names the tools to draw as rows while the installed ones are still being found.
 */
export function AgentsMatrix({ compact = false, expected = [] }: { compact?: boolean; expected?: readonly string[] }) {
  const { detected, agents, found, targets, rows, notInstalled } = useSkillMatrix()
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
  const columnName = (target: SkillTarget) => names(readers(target)) || TARGET_FOLDER[target]
  const pad = compact ? "px-[1rem] py-[0.7rem]" : "px-[1.3rem] py-[0.9rem]"
  const pending = catalogTools.filter((t) => expected.includes(t.id))
  const silent = rows.filter((r) => r.source === "none")

  if (detected && rows.length === 0) {
    return (
      <p className="rounded-[0.2rem] border border-line-strong bg-app px-[1.3rem] py-5 text-[0.95rem] text-ink-soft">
        No WireCat tool is installed yet. Each tool brings its own skill; install one on the Tools page first.
      </p>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      {found !== null && found.length === 0 && (
        <p className="rounded-[0.2rem] border border-warn/40 bg-warn/10 px-4 py-3 text-[0.95rem]">
          No AI agent was found on this computer. Skills can still be written; an agent installed later reads them.
        </p>
      )}
      <div className="overflow-x-auto rounded-[0.2rem] border border-line-strong bg-app">
        <table aria-label="Skills for agents" className="w-full border-collapse text-left">
          <thead>
            <tr className="border-line border-b">
              <th scope="col" className={cx(pad, "text-[0.85rem] font-medium text-ink-dim")}>
                Tool
              </th>
              {targets.map((t) => (
                <th key={t} scope="col" className={cx(pad, "w-[34%] align-bottom font-normal", compact && "w-[38%]")}>
                  {agents === null ? (
                    <Skeleton className="h-5 w-32" label="Looking for agents" />
                  ) : (
                    <span className="block text-[0.95rem] font-semibold text-ink">{columnName(t)}</span>
                  )}
                  {!compact && (
                    <span className="selectable mt-0.5 block font-mono text-[0.8rem] text-ink-dim">
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
                            {...(i === 0 && target === targets[0] ? { label: "Checking skills" } : {})}
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
                          <Skeleton className="h-8 w-full" label="Finding installed tools" />
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
                        {r.source === "none" && !compact && (
                          <p className="mt-1.5 max-w-[34ch] text-[0.8rem] leading-snug text-ink-soft">
                            This version cannot report its skill.{" "}
                            {r.newer
                              ? `Update ${r.tool.name} to ${r.newer} on the Tools page to see it.`
                              : "A coming release will."}
                          </p>
                        )}
                      </th>
                      {r.cells.map((c) => (
                        <td key={c.target} className={pad}>
                          <Cell
                            cell={c.cell}
                            busy={c.busy}
                            failure={c.failure}
                            tool={r.tool.id}
                            label={`${r.tool.name} skill for ${columnName(c.target)}`}
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
        <p className="text-[0.9rem] text-ink-soft">
          Not installed: {notInstalled.map((t) => t.name).join(", ")}. A skill comes with its tool.
        </p>
      )}
      {compact && silent.length > 0 && (
        // Below the table, where it moves nothing: inside a row it would push every row under it down.
        <p className="text-[0.85rem] leading-snug text-ink-soft">
          The installed {silent.map((r) => r.tool.name).join(" and ")} cannot report{" "}
          {silent.length === 1 ? "its skill" : "their skills"}, so {silent.length === 1 ? "it shows" : "they show"} as
          Unknown. {silent.some((r) => r.newer) ? "Updating on the Tools page fixes that." : "A coming release will."}
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
        <span className="selectable font-mono text-[0.8rem] text-ink-dim tabular-nums">
          {tool.bin} {version}
        </span>
      </div>
    </div>
  )
}

function Cell(props: {
  cell: SkillCell
  busy: boolean
  failure: string | null
  tool: string
  label: string
  onInstall: (action: string) => void
}) {
  const { cell, busy, failure, tool, label, onInstall } = props
  const look = busy ? { tone: "busy" as const, word: "Writing…" } : LOOK[cell.kind]
  const action = cellAction(cell)
  const version = cell.kind === "current" || cell.kind === "stale" ? cell.installed : null
  return (
    <div aria-live="polite">
      <div className="flex min-h-8 items-center gap-2">
        <Lamp size="sm" tone={look.tone} label={`${label}: ${look.word}`} />
        <span className={cx("text-[0.95rem]", cell.kind === "stale" && !busy && "text-warn-ink")}>{look.word}</span>
        {version && <span className="selectable font-mono text-[0.9rem] text-ink-soft tabular-nums">{version}</span>}
        {action && (
          <Button
            size="sm"
            className="ml-auto"
            disabled={busy}
            onClick={() => onInstall(action)}
            aria-label={`${action} ${label}`}
          >
            {action}
          </Button>
        )}
      </div>
      {cell.kind === "failed" && !busy && (
        <ErrorNotice
          inline
          className="mt-1"
          action={<ReportThis what={`Checking the ${label}`} tool={tool} error={cell.message} />}
        >
          {cell.message}
        </ErrorNotice>
      )}
      {failure && !busy && (
        <ErrorNotice
          inline
          className="mt-1"
          action={<ReportThis what={`Writing the ${label}`} tool={tool} error={failure} />}
        >
          {failure}
        </ErrorNotice>
      )}
    </div>
  )
}
