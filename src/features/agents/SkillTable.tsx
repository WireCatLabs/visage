import type { SkillCell } from "@/domain/skills"
import { TARGET_FOLDER } from "@/domain/skills"
import { useMessages } from "@/i18n"
import { Button } from "@/ui/Button"
import { cx } from "@/ui/cx"
import { ErrorNotice } from "@/ui/ErrorNotice"
import { Lamp, type LampTone } from "@/ui/Lamp"
import { Skeleton, StableText } from "@/ui/Skeleton"
import { ReportThis } from "../report/ReportThis"
import { ToolIcon } from "../tools/ToolIcon"
import { openManage } from "./AgentDetails"
import { askAgentSkills, askSkillInstall } from "./actions"
import { type AgentsMessages, agentsMessages } from "./messages"
import { useSkillPreview } from "./SkillPreview"
import { type AgentSkill, type AgentsView, type AgentView, sharers, todoInstalls, todoSentence } from "./view"

export const SKILL_TONE: Record<SkillCell["kind"], LampTone> = {
  checking: "idle",
  current: "ok",
  stale: "warn",
  unversioned: "warn",
  missing: "idle",
  unknown: "idle",
  unsupported: "idle",
  failed: "bad",
}

const skillLook = (s: AgentSkill, m: AgentsMessages) =>
  s.busy ? { tone: "busy" as const, word: m.writing } : { tone: SKILL_TONE[s.cell.kind], word: m.state[s.cell.kind] }

export function rowTone(view: AgentView): LampTone {
  if (view.skills.some((s) => s.busy)) return "busy"
  if (view.skills.some((s) => s.cell.kind === "checking")) return "idle"
  if (view.tone === "bad") return "bad"
  if (view.todo.length > 0 || view.tone === "warn" || view.signedOut.length > 0) return "warn"
  return "ok"
}

/** The agent's one primary action: install every missing or old skill. */
export function AgentCta({ view, all }: { view: AgentView; all: AgentsView }) {
  const m = useMessages(agentsMessages)
  // The button's own shape with its longer label invisible, so a longer language does not wrap the row when it arrives.
  if (view.skills.some((s) => s.cell.kind === "checking"))
    return (
      <span
        aria-hidden
        className="skeleton inline-flex h-8 items-center gap-2 rounded-[0.35rem] border border-transparent px-3 text-[0.875rem] font-medium whitespace-nowrap"
      >
        <StableText className="invisible" value={m.installAll} variants={[m.installAll, m.updateAll]} />
        <span className="invisible tabular-nums">0</span>
      </span>
    )
  if (view.todo.length === 0) return null
  return (
    <Button
      variant="primary"
      size="sm"
      disabled={all.anyBusy}
      onClick={() => askAgentSkills(view, (t) => sharers(all.entries, t, view.agent.id))}
      aria-label={`${todoInstalls(view) ? m.installAll : m.updateAll}: ${todoSentence(view, m)}`}
    >
      {todoInstalls(view) ? m.installAll : m.updateAll}
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
  const m = useMessages(agentsMessages)
  const { agent } = view
  if (loading)
    return (
      <ul aria-label={m.skillsFor(agent.name)} className="divide-y divide-line rounded-[0.45rem] border border-line">
        {[0, 1, 2].map((i) => (
          <li key={i} className="px-4 py-2">
            <div className={row}>
              <Skeleton chars={10} {...(i === 0 ? { label: m.findingTools } : {})} />
              <Skeleton chars={22} />
            </div>
          </li>
        ))}
      </ul>
    )
  return (
    <ul aria-label={m.skillsFor(agent.name)} className="divide-y divide-line rounded-[0.45rem] border border-line">
      {view.skills.map((s) => {
        const look = skillLook(s, m)
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
                    {s.newer
                      ? m.updateToSeeVersion(
                          s.tool.name,
                          <span className="font-mono text-[0.9rem] tabular-nums">{s.newer}</span>,
                        )
                      : m.updateToSee(s.tool.name)}
                  </span>
                ) : s.cell.kind === "unsupported" ? (
                  <span className="text-ink-soft">{m.needsNewerFor(s.tool.name, agent.name)}</span>
                ) : (
                  <>
                    <Lamp size="sm" tone={look.tone} label={m.skillState(s.tool.name, agent.name, look.word)} />
                    <span className={cx(s.cell.kind === "stale" && !s.busy && "text-warn-ink")}>{look.word}</span>
                    {version && <span className="font-mono text-[0.9rem] text-ink-soft tabular-nums">{version}</span>}
                    <span className="selectable font-mono text-[0.85rem] text-ink-dim">{TARGET_FOLDER[s.target]}</span>
                  </>
                )}
              </span>
              <span className="flex items-center gap-1">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => openSkill(s.tool.id)}
                  aria-label={m.readSkill(s.tool.name)}
                >
                  {m.read}
                </Button>
                {/* Sized by every label it can show, in this language, so Read stays put when the check adds one. */}
                <span className="grid">
                  {[m.action.Install, m.action.Update, m.openTools].map((word) => (
                    <Button key={word} size="sm" aria-hidden tabIndex={-1} className="invisible [grid-area:1/1]">
                      {word}
                    </Button>
                  ))}
                  {s.cell.kind === "unknown" && (
                    <Button size="sm" variant="ghost" className="[grid-area:1/1]" onClick={() => openManage(s.tool.id)}>
                      {m.openTools}
                    </Button>
                  )}
                  {s.action && (
                    <Button
                      size="sm"
                      className="[grid-area:1/1]"
                      disabled={s.busy}
                      onClick={() => s.action && askSkillInstall(s.tool.id, s.target, s.action, agent.name, agent.id)}
                      aria-label={
                        s.action === "Install"
                          ? m.installSkill(s.tool.name, agent.name)
                          : m.updateSkill(s.tool.name, agent.name)
                      }
                    >
                      {m.action[s.action]}
                    </Button>
                  )}
                </span>
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
