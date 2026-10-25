import { RefreshCw, X } from "lucide-react"
import type { CheckItem, Session, Tone } from "@/domain/agents"
import { sessionQuery } from "@/domain/agents"
import type { CatalogTool } from "@/domain/catalog"
import { formatWhen, shortSession, termText } from "@/domain/runs"
import { type SkillCell, TARGET_FOLDER } from "@/domain/skills"
import type { Agent, Claim } from "@/platform/agents-schemas"
import { Button } from "@/ui/Button"
import { CopyField } from "@/ui/CopyField"
import { cx } from "@/ui/cx"
import { ErrorNotice } from "@/ui/ErrorNotice"
import { Lamp, type LampTone } from "@/ui/Lamp"
import { Skeleton, StableText } from "@/ui/Skeleton"
import { useLogs } from "../logs/store"
import { useNav } from "../nav"
import { ReportThis } from "../report/ReportThis"
import { ToolIcon } from "../tools/ToolIcon"
import { AdvancedMcp } from "./AdvancedMcp"
import { askRelease, askSkillInstall, releaseKey } from "./actions"
import { useConnect } from "./connect"
import { useSkillPreview } from "./SkillPreview"

export type AgentTool = { tool: CatalogTool; skill: { cell: SkillCell; target: string } | null }
export type AgentClaim = { tool: CatalogTool; profile: string; claim: Claim; session: string | null }

type Props = {
  agent: Agent
  tools: readonly AgentTool[]
  /** null while the run logs are read. */
  sessions: readonly Session[] | null
  claims: readonly AgentClaim[]
  items: readonly CheckItem[] | null
  tone: Tone | null
}

const SKILL_WORD: Record<SkillCell["kind"], [LampTone, string]> = {
  checking: ["idle", "Checking…"],
  current: ["ok", "Current"],
  stale: ["warn", "Old"],
  unversioned: ["warn", "No version"],
  missing: ["idle", "Not installed"],
  unknown: ["idle", "Unknown"],
  failed: ["bad", "Could not check"],
}

const TONE_WORD: Record<Tone, string> = {
  ok: "Works with your tools",
  warn: "Something to set up",
  bad: "Something stops it",
  idle: "Nothing to check yet",
}

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`

export const DETAILS_ID = "agent-details"

const card = "flex min-h-[6.6rem] min-w-0 flex-col gap-1 rounded-[0.45rem] border bg-app px-4 py-3 transition-colors"

function CardHead(props: { name: string; tone: LampTone; label: string; action?: React.ReactNode }) {
  const { name, tone, label, action } = props
  return (
    <div className="flex min-h-8 min-w-0 items-center gap-2.5">
      <Lamp size="sm" tone={tone} label={`${name}: ${label}`} />
      <h3 className="min-w-0 flex-1 truncate text-[1.05rem] font-semibold leading-tight">{name}</h3>
      {action}
    </div>
  )
}

/** A known agent before detection answers, or one not found: the same card box, so the grid never changes size. */
export function QuietAgentCard({ name, note, first = false }: { name: string; note: string | null; first?: boolean }) {
  return (
    <li className={cx(card, "border-line")}>
      <CardHead name={name} tone="idle" label={note ?? "Looking for it"} />
      <p className="truncate pl-[1.45rem] text-[0.9rem] text-ink-soft">
        {note ?? <Skeleton chars={20} {...(first ? { label: "Looking for agents" } : {})} />}
      </p>
    </li>
  )
}

/** An agent the run logs name but this app does not detect: it can still be followed in Logs. */
export function SeenAgentCard({ kind, name, sessions }: { kind: string; name: string; sessions: number }) {
  const go = useNav((s) => s.go)
  const open = () => {
    const logs = useLogs.getState()
    logs.setQuery(termText("agent", kind))
    logs.setRange("all")
    go("logs")
  }
  return (
    <li className={cx(card, "border-line")}>
      <CardHead
        name={name}
        tone="idle"
        label="Seen in runs"
        action={
          <Button size="sm" variant="ghost" onClick={open} aria-label={`Show ${name} in Logs`}>
            Show in Logs
          </Button>
        }
      />
      <p className="truncate pl-[1.45rem] text-[0.9rem] text-ink-soft">Seen in runs, not detected here</p>
      <p className="truncate pl-[1.45rem] text-[0.85rem] text-ink-dim">{plural(sessions, "session")}</p>
    </li>
  )
}

export function AgentCard(props: Props & { selected: boolean; onManage(): void }) {
  const { agent, sessions, claims, tone, selected, onManage } = props
  const checking = useConnect((s) => s.checking[agent.id] === true)
  const summary = [
    sessions === null ? null : plural(sessions.length, "session"),
    claims.length > 0 ? `${plural(claims.length, "task")} held` : null,
  ].filter(Boolean)
  const word = checking ? "Checking…" : tone ? TONE_WORD[tone] : null

  return (
    <li className={cx(card, selected ? "border-brand" : "border-line")}>
      <CardHead
        name={agent.name}
        tone={checking ? "busy" : (tone ?? "idle")}
        label={word ?? "Checking"}
        action={
          <Button
            size="sm"
            onClick={onManage}
            aria-expanded={selected}
            aria-controls={DETAILS_ID}
            aria-label={`Manage ${agent.name}`}
            className="min-w-[5.6rem]"
          >
            Manage
          </Button>
        }
      />
      <p className="truncate pl-[1.45rem] text-[0.9rem] text-ink-soft">{word ?? <Skeleton chars={20} />}</p>
      <p className="min-h-[1.3rem] truncate pl-[1.45rem] text-[0.85rem] text-ink-dim">{summary.join(" · ")}</p>
    </li>
  )
}

const foundWords = (a: Agent) =>
  a.foundBy === "program" ? "The program is on PATH" : "Found by its settings folder; the program is not on PATH"

export function AgentDetails(props: Props & { onClose(): void; onCheck(): void }) {
  const { agent, tools, sessions, claims, items, onClose, onCheck } = props
  const checking = useConnect((s) => s.checking[agent.id] === true)
  return (
    <section
      id={DETAILS_ID}
      aria-label={`${agent.name} details`}
      className="reveal flex flex-col gap-5 rounded-[0.45rem] border border-line-strong bg-app-2/60 px-[1.3rem] pt-4 pb-5"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-[1.2rem] font-semibold">{agent.name}</h2>
          <p className="mt-1 text-[0.9rem] text-ink-soft">
            {foundWords(agent)} · reads skills from{" "}
            <span className="font-mono text-[0.8rem]">{agent.reads.map((t) => TARGET_FOLDER[t]).join(", ")}</span>
            {agent.reads.length > 1 && "; an old copy in either folder still reaches it"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            disabled={checking}
            onClick={onCheck}
            icon={<RefreshCw className={cx("size-4", checking && "animate-spin")} aria-hidden />}
          >
            <StableText
              value={checking ? "Checking…" : "Check this agent again"}
              variants={["Check this agent again", "Checking…"]}
            />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={onClose}
            aria-label={`Close ${agent.name} details`}
            icon={<X className="size-4" aria-hidden />}
          />
        </div>
      </div>
      <Section title="What to fix">
        <CheckList agent={agent} items={items} />
      </Section>
      <Section title="Tools">
        <ToolsTable agent={agent} tools={tools} />
      </Section>
      <Section title="Recent sessions">
        <Sessions agent={agent} sessions={sessions} />
      </Section>
      <Section title="Tasks it holds">
        <Claims agent={agent} claims={claims} />
      </Section>
      <AdvancedMcp agent={agent} />
    </section>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h4 className="mb-2 text-[0.85rem] font-medium text-ink-dim">{title}</h4>
      {children}
    </section>
  )
}

const box = "rounded-[0.45rem] border border-line bg-app"

function CheckList({ agent, items }: { agent: Agent; items: readonly CheckItem[] | null }) {
  const go = useNav((s) => s.go)
  if (!items) return <Skeleton className="h-10 w-full" label="Checking" />
  const shown = items.filter((i) => i.tone !== "ok")
  const fine = items.filter((i) => i.tone === "ok").length
  return (
    <ul className={cx(box, "divide-y divide-line")} aria-label={`What to fix for ${agent.name}`}>
      {shown.map((item) => (
        <li key={item.id} className="flex flex-col gap-2 px-4 py-3">
          <div className="flex items-start gap-2.5">
            <span className="mt-[0.4rem]">
              <Lamp size="sm" tone={item.tone} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[0.95rem] text-ink">{item.title}</p>
              {item.detail && <p className="mt-0.5 max-w-[70ch] text-[0.85rem] text-ink-soft">{item.detail}</p>}
            </div>
            {item.fix?.kind === "skill" && (
              <Button
                size="sm"
                onClick={() => {
                  const fix = item.fix
                  if (fix?.kind === "skill") askSkillInstall(fix.tool, fix.target, fix.label, agent.name)
                }}
              >
                {item.fix.label} skill
              </Button>
            )}
            {item.fix?.kind === "tools" && (
              <Button size="sm" variant="ghost" onClick={() => go("tools")}>
                Open Tools
              </Button>
            )}
          </div>
          {item.fix?.kind === "command" && (
            <div className="pl-6">
              <CopyField value={item.fix.command} label="Copy the command" />
            </div>
          )}
        </li>
      ))}
      <li className="px-4 py-2.5 text-[0.85rem] text-ink-soft">
        {fine > 0 ? `${plural(fine, "check")} passed.` : "No check passed yet."}
      </li>
    </ul>
  )
}

function ToolsTable({ agent, tools }: { agent: Agent; tools: readonly AgentTool[] }) {
  const openSkill = useSkillPreview((s) => s.open)
  if (tools.length === 0) return <p className="text-[0.9rem] text-ink-soft">No WireCat tool is installed yet.</p>
  return (
    <div className={box}>
      <table className="w-full border-collapse text-left" aria-label={`Tools for ${agent.name}`}>
        <thead>
          <tr className="border-line border-b text-[0.85rem] text-ink-dim">
            <th scope="col" className="px-4 py-2 font-medium">
              Tool
            </th>
            <th scope="col" className="px-4 py-2 font-medium">
              Skill
            </th>
          </tr>
        </thead>
        <tbody>
          {tools.map(({ tool, skill }) => {
            const [tone, word] = skill ? SKILL_WORD[skill.cell.kind] : (["idle", "—"] as const)
            const version = skill && "installed" in skill.cell ? skill.cell.installed : null
            return (
              <tr key={tool.id} className="border-line border-b align-top last:border-b-0">
                <th scope="row" className="px-4 py-2.5 font-normal">
                  <div className="flex items-center gap-2.5">
                    <ToolIcon id={tool.id} className="size-[1.3rem] shrink-0 text-ink" />
                    <span className="font-semibold">{tool.name}</span>
                  </div>
                </th>
                <td className="px-4 py-2.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <Lamp size="sm" tone={tone} label={`${tool.name} skill for ${agent.name}: ${word}`} />
                    <span className="text-[0.9rem]">{word}</span>
                    {version && <span className="font-mono text-[0.85rem] text-ink-soft tabular-nums">{version}</span>}
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => openSkill(tool.id)}
                      aria-label={`Read the ${tool.name} skill`}
                    >
                      Read
                    </Button>
                  </div>
                  {skill && (
                    <span className="font-mono text-[0.75rem] text-ink-dim">
                      {TARGET_FOLDER[skill.target as keyof typeof TARGET_FOLDER]}
                    </span>
                  )}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function Sessions({ agent, sessions }: { agent: Agent; sessions: readonly Session[] | null }) {
  const go = useNav((s) => s.go)
  if (sessions === null) return <Skeleton className="h-8 w-full" label="Reading run logs" />
  if (sessions.length === 0)
    return <p className="text-[0.9rem] text-ink-soft">The tools' run logs have no session from {agent.name}.</p>
  const open = (s: Session) => {
    const logs = useLogs.getState()
    logs.setQuery(sessionQuery(s))
    logs.setRange("all")
    go("logs")
  }
  return (
    <ul className={cx(box, "divide-y divide-line")}>
      {sessions.slice(0, 5).map((s) => (
        <li key={s.key} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-2.5 text-[0.9rem]">
          <span className="w-[8.5rem] font-mono text-[0.85rem] text-ink tabular-nums">
            {formatWhen(s.last, new Date())}
          </span>
          <span className="selectable font-mono text-[0.85rem] text-ink-soft" title={s.session ?? undefined}>
            {s.session ? shortSession(s.session) : "no session id"}
          </span>
          <span>
            {plural(s.runs, "command")}
            {s.failed > 0 && <span className="text-bad"> · {s.failed} failed</span>}
          </span>
          <span className="min-w-0 flex-1 truncate text-ink-soft">{s.tools.join(", ")}</span>
          <Button size="sm" variant="ghost" onClick={() => open(s)}>
            Show in Logs
          </Button>
        </li>
      ))}
      {sessions.length > 5 && (
        <li className="px-4 py-2 text-[0.85rem] text-ink-soft">and {sessions.length - 5} older on the Logs page</li>
      )}
    </ul>
  )
}

function Claims({ agent, claims }: { agent: Agent; claims: readonly AgentClaim[] }) {
  if (claims.length === 0) return <p className="text-[0.9rem] text-ink-soft">{agent.name} holds no task.</p>
  return (
    <ul className={cx(box, "divide-y divide-line")}>
      {claims.map((c) => (
        <ClaimRow key={`${c.tool.id}/${c.profile}/${c.claim.id}`} c={c} holder={agent.name} />
      ))}
    </ul>
  )
}

export function ClaimRow({ c, holder }: { c: AgentClaim; holder: string }) {
  const task = c.claim.key ?? c.claim.id
  const key = releaseKey(c.tool.id, c.profile, task)
  const busy = useConnect((s) => s.busy[key] === true)
  const failure = useConnect((s) => s.failures[key])
  return (
    <li className="px-4 py-2.5">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[0.9rem]">
        <span className="selectable font-mono text-ink">{task}</span>
        <span className="text-ink-soft">
          {c.tool.name} · {c.profile}
        </span>
        {c.session && (
          <span className="selectable font-mono text-[0.85rem] text-ink-soft" title={c.session}>
            {shortSession(c.session)}
          </span>
        )}
        {c.claim.until && <span className="text-ink-soft">until {formatWhen(c.claim.until, new Date())}</span>}
        <Button
          size="sm"
          variant="danger"
          className="ml-auto"
          disabled={busy}
          onClick={() => askRelease(c.tool.id, c.profile, c.claim, holder)}
          aria-label={`Release ${task}`}
        >
          {busy ? "Releasing…" : "Release"}
        </Button>
      </div>
      {failure && !busy && (
        <ErrorNotice
          inline
          className="mt-1"
          action={<ReportThis what={`Releasing the task ${task}`} tool={c.tool.id} error={failure} />}
        >
          {failure}
        </ErrorNotice>
      )}
    </li>
  )
}
