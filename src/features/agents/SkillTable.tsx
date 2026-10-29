import type { SkillCell } from "@/domain/skills"
import { TARGET_FOLDER } from "@/domain/skills"
import { Button } from "@/ui/Button"
import { cx } from "@/ui/cx"
import { ErrorNotice } from "@/ui/ErrorNotice"
import { Lamp, type LampTone } from "@/ui/Lamp"
import { Skeleton } from "@/ui/Skeleton"
import { ReportThis } from "../report/ReportThis"
import { ToolIcon } from "../tools/ToolIcon"
import { openManage } from "./AgentDetails"
import { askAgentSkills, askSkillInstall } from "./actions"
import { useSkillPreview } from "./SkillPreview"
import { type AgentSkill, type AgentsView, type AgentView, sharers, todoAction, todoSentence } from "./view"

const SKILL_LOOK: Record<SkillCell["kind"], { tone: LampTone; word: string }> = {
  checking: { tone: "idle", word: "Checking…" },
  current: { tone: "ok", word: "Current" },
  stale: { tone: "warn", word: "Old" },
  unversioned: { tone: "warn", word: "No version" },
  missing: { tone: "idle", word: "Not installed" },
  unknown: { tone: "idle", word: "Update the tool to see" },
  unsupported: { tone: "idle", word: "Needs a newer version" },
  failed: { tone: "bad", word: "Could not check" },
}

const skillLook = (s: AgentSkill) => (s.busy ? { tone: "busy" as const, word: "Writing…" } : SKILL_LOOK[s.cell.kind])

export function rowTone(view: AgentView): LampTone {
  if (view.skills.some((s) => s.busy)) return "busy"
  if (view.skills.some((s) => s.cell.kind === "checking")) return "idle"
  if (view.tone === "bad") return "bad"
  if (view.todo.length > 0 || view.tone === "warn" || view.signedOut.length > 0) return "warn"
  return "ok"
}

/** The agent's one primary action: install every missing or old skill. */
export function AgentCta({ view, all }: { view: AgentView; all: AgentsView }) {
  if (view.skills.some((s) => s.cell.kind === "checking")) return <Skeleton className="h-8 w-[6.5rem]" />
  if (view.todo.length === 0) return null
  return (
    <Button
      variant="primary"
      size="sm"
      disabled={all.anyBusy}
      onClick={() => askAgentSkills(view, (t) => sharers(all.entries, t, view.agent.id))}
      aria-label={`${todoAction(view)}: ${todoSentence(view)}`}
    >
      {todoAction(view)}
      <span className="tabular-nums opacity-80">{view.todo.length}</span>
    </Button>
  )
}

const row = "grid min-h-9 grid-cols-[minmax(8rem,12rem)_minmax(0,1fr)_auto] items-center gap-x-4"

/**
 * Every installed tool's skill for one agent: its state, version and folder, Read, and its own Install or Update.
 * A tool too old to report keeps its row, so the list does not shrink when the answers arrive.
 */
export function SkillTable({ view, loading }: { view: AgentView; loading: boolean }) {
  const openSkill = useSkillPreview((s) => s.open)
  const { agent } = view
  if (loading)
    return (
      <ul aria-label={`Skills for ${agent.name}`} className="divide-y divide-line rounded-[0.45rem] border border-line">
        {[0, 1, 2].map((i) => (
          <li key={i} className="px-4 py-2">
            <div className={row}>
              <Skeleton chars={10} {...(i === 0 ? { label: "Finding installed tools" } : {})} />
              <Skeleton chars={22} />
            </div>
          </li>
        ))}
      </ul>
    )
  return (
    <ul aria-label={`Skills for ${agent.name}`} className="divide-y divide-line rounded-[0.45rem] border border-line">
      {view.skills.map((s) => {
        const look = skillLook(s)
        const version = s.cell.kind === "current" || s.cell.kind === "stale" ? s.cell.installed : null
        return (
          <li key={s.tool.id} className="px-4 py-2">
            <div className={row}>
              <span className="flex min-w-0 items-center gap-2.5">
                <ToolIcon id={s.tool.id} className="size-[1.25rem] shrink-0 text-ink" />
                <span className="truncate font-semibold">{s.tool.name}</span>
              </span>
              <span className="flex min-w-0 flex-wrap items-center gap-x-2 text-[0.9rem]">
                {s.cell.kind === "checking" ? (
                  <Skeleton chars={14} />
                ) : s.cell.kind === "unknown" ? (
                  <span className="text-ink-soft">
                    Update {s.tool.name}
                    {s.newer && <span className="font-mono text-[0.9rem] tabular-nums"> to {s.newer}</span>} to see its
                    skill
                  </span>
                ) : s.cell.kind === "unsupported" ? (
                  <span className="text-ink-soft">
                    Needs a newer {s.tool.name} to write a skill for {agent.name}
                  </span>
                ) : (
                  <>
                    <Lamp size="sm" tone={look.tone} label={`${s.tool.name} skill for ${agent.name}: ${look.word}`} />
                    <span className={cx(s.cell.kind === "stale" && !s.busy && "text-warn-ink")}>{look.word}</span>
                    {version && <span className="font-mono text-[0.9rem] text-ink-soft tabular-nums">{version}</span>}
                    <span className="selectable font-mono text-[0.85rem] text-ink-dim">{TARGET_FOLDER[s.target]}</span>
                  </>
                )}
              </span>
              {/* Room for Read and an action from the start, so Read stays put when the check adds Install or Update. */}
              <span className="flex min-w-[9.6rem] items-center gap-1">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => openSkill(s.tool.id)}
                  aria-label={`Read the ${s.tool.name} skill`}
                >
                  Read
                </Button>
                {s.cell.kind === "unknown" && (
                  <Button size="sm" variant="ghost" onClick={() => openManage(s.tool.id)}>
                    Open Tools
                  </Button>
                )}
                {s.action && (
                  <Button
                    size="sm"
                    className="min-w-[5.4rem]"
                    disabled={s.busy}
                    onClick={() => s.action && askSkillInstall(s.tool.id, s.target, s.action, agent.name, agent.id)}
                    aria-label={`${s.action} the ${s.tool.name} skill for ${agent.name}`}
                  >
                    {s.action}
                  </Button>
                )}
              </span>
            </div>
            {s.failure && !s.busy && (
              <ErrorNotice
                inline
                className="mt-1"
                action={<ReportThis what={`Writing the ${s.tool.name} skill`} tool={s.tool.id} error={s.failure} />}
              >
                {s.failure}
              </ErrorNotice>
            )}
          </li>
        )
      })}
    </ul>
  )
}
