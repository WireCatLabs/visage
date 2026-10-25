import { useEffect } from "react"
import { tools as catalogTools } from "@/domain/catalog"
import {
  cellAction,
  needsUpdate,
  SKILL_TARGETS,
  type SkillCell,
  type SkillTarget,
  skillCell,
  TARGET_FOLDER,
} from "@/domain/skills"
import type { Agent } from "@/platform/agents-schemas"
import { Button } from "@/ui/Button"
import { cx } from "@/ui/cx"
import { Lamp, type LampTone } from "@/ui/Lamp"
import { Skeleton } from "@/ui/Skeleton"
import { useTools } from "../tools/store"
import { ToolIcon } from "../tools/ToolIcon"
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

/** Everything the matrix shows, so the page can offer "Update all" over the same cells. */
export function useSkillMatrix() {
  const installs = useTools((s) => s.installs)
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
 */
export function AgentsMatrix({ compact = false }: { compact?: boolean }) {
  const { detected, agents, found, targets, rows, notInstalled } = useSkillMatrix()
  const load = useAgents((s) => s.load)
  const install = useAgents((s) => s.install)
  const installedIds = rows.map((r) => r.tool.id).join(",")

  useEffect(() => {
    const tools = useTools.getState()
    if (!detected && !tools.refreshing) tools.refresh()
  }, [detected])

  useEffect(() => {
    if (detected) load(installedIds ? installedIds.split(",") : [])
  }, [detected, installedIds, load])

  const readers = (target: SkillTarget) => found?.filter((a) => a.reads.includes(target)) ?? []
  const columnName = (target: SkillTarget) => names(readers(target)) || TARGET_FOLDER[target]
  const pad = compact ? "px-[1rem] py-[0.7rem]" : "px-[1.3rem] py-[0.9rem]"

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
            {!detected
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
                      <div className="flex items-center gap-[0.8rem]">
                        <ToolIcon id={r.tool.id} className="size-[1.5rem] shrink-0 text-ink" />
                        <div className="min-w-0">
                          <span className="block text-[1.02rem] font-semibold leading-tight">{r.tool.name}</span>
                          <span className="selectable font-mono text-[0.8rem] text-ink-dim tabular-nums">
                            {r.tool.bin} {r.cliVersion ?? ""}
                          </span>
                        </div>
                      </div>
                      {r.source === "none" && (
                        <p className="mt-1.5 max-w-[34ch] text-[0.8rem] leading-snug text-ink-soft">
                          This version cannot report its skill. Update {r.tool.name} on the Tools page to see it.
                        </p>
                      )}
                    </th>
                    {r.cells.map((c) => (
                      <td key={c.target} className={pad}>
                        <Cell
                          cell={c.cell}
                          busy={c.busy}
                          failure={c.failure}
                          label={`${r.tool.name} skill for ${columnName(c.target)}`}
                          onInstall={() => install(r.tool.id, c.target)}
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
    </div>
  )
}

function Cell(props: { cell: SkillCell; busy: boolean; failure: string | null; label: string; onInstall: () => void }) {
  const { cell, busy, failure, label, onInstall } = props
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
          <Button size="sm" className="ml-auto" disabled={busy} onClick={onInstall} aria-label={`${action} ${label}`}>
            {action}
          </Button>
        )}
      </div>
      {cell.kind === "failed" && !busy && <p className="mt-1 text-[0.8rem] text-bad">{cell.message}</p>}
      {failure && !busy && (
        <p role="alert" className="selectable mt-1 text-[0.8rem] text-bad">
          {failure}
        </p>
      )}
    </div>
  )
}
