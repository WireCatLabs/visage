import { RefreshCw } from "lucide-react"
import type { ReactNode } from "react"
import { type Session, sessionQuery } from "@/domain/agents"
import { formatWhen, shortSession } from "@/domain/runs"
import { TARGET_FOLDER } from "@/domain/skills"
import type { Agent } from "@/platform/agents-schemas"
import { Button } from "@/ui/Button"
import { CopyField } from "@/ui/CopyField"
import { cx } from "@/ui/cx"
import { Lamp } from "@/ui/Lamp"
import { Skeleton, StableText } from "@/ui/Skeleton"
import { useLogs } from "../logs/store"
import { useNav } from "../nav"
import { useTools } from "../tools/store"
import { AdvancedMcp } from "./AdvancedMcp"
import { ClaimRow } from "./ClaimRow"
import { useConnect } from "./connect"
import { installedCopies, useDisconnect } from "./DisconnectDialog"
import { useAgents } from "./store"
import { type AgentView, plural } from "./view"

const box = "rounded-[0.45rem] border border-line bg-app"

const foundWords = (a: Agent) =>
  a.foundBy === "program" ? "Program on PATH" : "Found by its settings folder; the program is not on PATH"

/** Opens the tool's Manage panel on Tools, where its profiles are signed in. */
export function openManage(tool: string) {
  useTools.setState({ expanded: tool })
  useNav.getState().go("tools")
}

/** Everything about one agent after its skills: other fixes, sessions, tasks, and MCP folded away. */
export function AgentDetails({ view, onCheck }: { view: AgentView; onCheck(): void }) {
  const { agent } = view
  const checking = useConnect((s) => s.checking[agent.id] === true)
  const skills = useAgents((s) => s.skills)
  const connected = installedCopies(view, skills).length > 0
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[0.9rem] text-ink-soft">
          {foundWords(agent)} · reads{" "}
          <span className="selectable font-mono text-[0.85rem]">
            {agent.reads.map((t) => TARGET_FOLDER[t]).join(", ")}
          </span>
        </p>
        <span className="flex items-center gap-1">
          <Button
            size="sm"
            variant="ghost"
            disabled={!connected}
            onClick={() => useDisconnect.getState().open(agent.id)}
            aria-label={`Disconnect WireCat from ${agent.name}`}
          >
            Disconnect
          </Button>
          <Button
            size="sm"
            variant="ghost"
            disabled={checking}
            onClick={onCheck}
            icon={<RefreshCw className={cx("size-[0.95rem]", checking && "animate-spin")} aria-hidden />}
          >
            <StableText
              value={checking ? "Checking…" : "Check this agent"}
              variants={["Check this agent", "Checking…"]}
            />
          </Button>
        </span>
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        <Section title="Also to fix">
          <OtherFixes view={view} />
        </Section>
        <Section title="Recent sessions">
          <Sessions agent={agent} sessions={view.sessions} />
        </Section>
      </div>
      {view.claims.length > 0 && (
        <Section title="Tasks it holds">
          <ul className={cx(box, "divide-y divide-line")}>
            {view.claims.map((c) => (
              <ClaimRow key={`${c.tool.id}/${c.profile}/${c.claim.id}`} c={c} holder={agent.name} />
            ))}
          </ul>
        </Section>
      )}
      <AdvancedMcp agent={agent} />
    </div>
  )
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h4 className="mb-2 text-[0.9rem] font-medium text-ink-dim">{title}</h4>
      {children}
    </section>
  )
}

/** What is left once skills are dealt with: sign-in, PATH, permissions. Skill items live in the skills list. */
function OtherFixes({ view }: { view: AgentView }) {
  const go = useNav((s) => s.go)
  if (!view.items) return <Skeleton className="h-10 w-full" label="Checking" />
  const shown = view.items.filter((i) => i.tone !== "ok" && !i.id.endsWith(":skill") && !i.id.startsWith("skill:"))
  if (shown.length === 0 && view.signedOut.length === 0)
    return <p className="text-[0.9rem] text-ink-soft">Nothing else stops {view.agent.name}.</p>
  return (
    <ul className={cx(box, "divide-y divide-line")} aria-label={`Other things to fix for ${view.agent.name}`}>
      {shown.map((item) => (
        <li key={item.id} className="flex flex-col gap-2 px-4 py-2.5">
          <div className="flex items-start gap-2.5">
            <span className="mt-[0.4rem]">
              <Lamp size="sm" tone={item.tone} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[0.95rem] text-ink">{item.title}</p>
              {item.detail && <p className="mt-0.5 max-w-[70ch] text-[0.9rem] text-ink-soft">{item.detail}</p>}
            </div>
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
      {view.signedOut.map(({ tool, profile }) => (
        <li key={`signin:${tool.id}/${profile}`} className="flex items-start gap-2.5 px-4 py-2.5">
          <span className="mt-[0.4rem]">
            <Lamp size="sm" tone="warn" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[0.95rem] text-ink">
              {tool.name} profile <span className="font-medium">{profile}</span> is not signed in
            </p>
            <p className="mt-0.5 max-w-[70ch] text-[0.9rem] text-ink-soft">
              {view.agent.name} cannot use {tool.name} through this profile until it is signed in again.
            </p>
          </div>
          <Button size="sm" onClick={() => openManage(tool.id)} aria-label={`Sign in to ${tool.name} (${profile})`}>
            Sign in
          </Button>
        </li>
      ))}
    </ul>
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
      {sessions.slice(0, 3).map((s) => (
        <li key={s.key} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-2 text-[0.9rem]">
          <span className="w-[8.5rem] font-mono text-[0.9rem] tabular-nums">{formatWhen(s.last, new Date())}</span>
          <span className="selectable font-mono text-[0.9rem] text-ink-soft" title={s.session ?? undefined}>
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
      {sessions.length > 3 && (
        <li className="px-4 py-2 text-[0.9rem] text-ink-soft">and {sessions.length - 3} older on the Logs page</li>
      )}
    </ul>
  )
}
