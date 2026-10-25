import { RefreshCw } from "lucide-react"
import type { CheckItem, Connection, Session, Tone } from "@/domain/agents"
import { connections, sessionQuery } from "@/domain/agents"
import type { CatalogTool } from "@/domain/catalog"
import { formatWhen, shortSession } from "@/domain/runs"
import { type SkillCell, TARGET_FOLDER } from "@/domain/skills"
import type { Agent, Claim } from "@/platform/agents-schemas"
import { Button } from "@/ui/Button"
import { CopyField } from "@/ui/CopyField"
import { cx } from "@/ui/cx"
import { Lamp, type LampTone } from "@/ui/Lamp"
import { Skeleton } from "@/ui/Skeleton"
import { useLogs } from "../logs/store"
import { useNav } from "../nav"
import { ToolIcon } from "../tools/ToolIcon"
import { askMcpAdd, askMcpRemove, askRelease, askSkillInstall, mcpKey, releaseKey } from "./actions"
import { type Loaded, useConnect } from "./connect"
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
  expanded: boolean
  onToggle(): void
  onCheck(): void
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
  warn: "Works, with something to fix",
  bad: "Something stops it",
  idle: "Nothing to check yet",
}

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`

export function AgentRow(props: Props) {
  const { agent, sessions, claims, tone, expanded, onToggle, onCheck } = props
  const checking = useConnect((s) => s.checking[agent.id] === true)
  const servers = useConnect((s) => s.servers[agent.id])
  const panelId = `agent-panel-${agent.id}`
  const connected = servers?.state === "ready" ? servers.data.names.length : null
  const summary = [
    sessions === null ? null : plural(sessions.length, "session"),
    claims.length > 0 ? `${plural(claims.length, "task")} claimed` : null,
    connected === null ? null : `${plural(connected, "MCP server")}`,
  ].filter(Boolean)

  return (
    <li className="border-line border-b last:border-b-0">
      <div className="grid min-h-[4.5rem] grid-cols-[1.2rem_minmax(0,1fr)_auto] items-center gap-x-[0.9rem] px-[1.3rem] xl:grid-cols-[1.6rem_minmax(0,1fr)_auto] xl:gap-x-[1.2rem]">
        <Lamp
          tone={checking ? "busy" : (tone ?? "idle")}
          label={`${agent.name}: ${checking ? "Checking" : tone ? TONE_WORD[tone] : "Checking"}`}
        />
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={expanded}
          aria-controls={panelId}
          className="group min-w-0 py-3 text-left"
        >
          <h3 className="text-[1.08rem] font-semibold leading-tight group-hover:text-brand">{agent.name}</h3>
          <p className="mt-1 truncate text-[0.95rem] text-ink-soft">
            {tone ? TONE_WORD[tone] : "Checking…"}
            {summary.length > 0 && <span className="text-ink-dim"> · {summary.join(" · ")}</span>}
          </p>
        </button>
        <Button
          size="sm"
          disabled={checking}
          onClick={onCheck}
          aria-label={`Check ${agent.name}`}
          icon={<RefreshCw className={cx("size-4", checking && "animate-spin")} aria-hidden />}
        >
          {checking ? "Checking…" : "Check"}
        </Button>
      </div>
      <div
        id={panelId}
        className={cx(
          "grid transition-[grid-template-rows] duration-300 ease-out-quart",
          expanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
        )}
      >
        <div className="overflow-hidden">{expanded && <Panel {...props} />}</div>
      </div>
    </li>
  )
}

function Panel({ agent, tools, sessions, claims, items }: Props) {
  const servers = useConnect((s) => s.servers[agent.id])
  return (
    <div className="flex flex-col gap-5 border-line border-t bg-app-2/60 px-[1.3rem] pt-4 pb-5">
      <Section title="What to fix">
        <CheckList agent={agent} items={items} />
      </Section>
      <Section title="Tools">
        <ToolsTable agent={agent} tools={tools} servers={servers} />
      </Section>
      <Section title="Recent sessions">
        <Sessions agent={agent} sessions={sessions} />
      </Section>
      <Section title="Tasks it holds">
        <Claims agent={agent} claims={claims} />
      </Section>
    </div>
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
  const checked = useConnect((s) => s.checked[agent.id] === true)
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
            {item.fix?.kind === "update" && (
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
        {!checked && " Check also starts each connected MCP server to see that it answers."}
      </li>
    </ul>
  )
}

function ToolsTable({
  agent,
  tools,
  servers,
}: {
  agent: Agent
  tools: readonly AgentTool[]
  servers: Loaded<{ names: string[]; canAdd: boolean; canRemove: boolean; source: string }> | undefined
}) {
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
            <th scope="col" className="px-4 py-2 font-medium">
              MCP
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
                <td className="px-4 py-2.5">
                  <McpCell agent={agent} tool={tool} servers={servers} />
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
      {servers?.state === "ready" && (
        <p className="border-line border-t px-4 py-2 text-[0.8rem] text-ink-dim">
          MCP servers read from <span className="selectable font-mono">{servers.data.source}</span>
        </p>
      )}
    </div>
  )
}

function McpCell({
  agent,
  tool,
  servers,
}: {
  agent: Agent
  tool: CatalogTool
  servers: Loaded<{ names: string[]; canAdd: boolean; canRemove: boolean }> | undefined
}) {
  const profiles = useConnect((s) => s.profiles[tool.id])
  if (!servers || servers.state === "loading" || (tool.profiles && !profiles))
    return <Skeleton className="h-5 w-32" label="Reading MCP servers" />
  if (servers.state === "error") return <p className="text-[0.85rem] text-bad">{servers.error}</p>
  const { names, canAdd, canRemove } = servers.data
  const rows = connections(names, tool.bin, profiles ?? [])
  const shown = tool.mcp ? rows : rows.filter((r) => r.connected)
  return (
    <ul className="flex flex-col gap-1.5">
      {shown.map((row) => (
        <McpRow key={row.profile ?? ""} agent={agent} tool={tool} row={row} canAdd={canAdd} canRemove={canRemove} />
      ))}
      {tool.mcp && rows.length === 0 && (
        <li className="text-[0.85rem] text-ink-soft">No profile yet. Sign in on the Tools page first.</li>
      )}
      {!tool.mcp && (
        <li className="text-[0.85rem] text-ink-dim">
          {shown.length === 0 ? "Not connected. " : ""}Connecting {tool.name} from here arrives with a tool update.
        </li>
      )}
    </ul>
  )
}

function McpRow(props: { agent: Agent; tool: CatalogTool; row: Connection; canAdd: boolean; canRemove: boolean }) {
  const { agent, tool, row, canAdd, canRemove } = props
  const key = mcpKey(agent.id, tool.id, row.profile)
  const busy = useConnect((s) => s.busy[key] === true)
  const failure = useConnect((s) => s.failures[key])
  const label = row.profile ?? `${tool.bin} (no profile)`
  return (
    <li>
      <div className="flex min-h-8 flex-wrap items-center gap-2">
        <Lamp
          size="sm"
          tone={busy ? "busy" : row.connected ? "ok" : "idle"}
          label={`${tool.name} ${label} for ${agent.name}: ${row.connected ? "Connected" : "Not connected"}`}
        />
        <span className="font-mono text-[0.85rem]">{label}</span>
        <span className="text-[0.85rem] text-ink-soft">{row.connected ? "Connected" : "Not connected"}</span>
        {row.connected && canRemove && (
          <Button
            size="sm"
            variant="ghost"
            className="ml-auto"
            disabled={busy}
            onClick={() => askMcpRemove(tool.id, row.profile, agent)}
            aria-label={`Disconnect ${tool.name} ${label} from ${agent.name}`}
          >
            Disconnect
          </Button>
        )}
        {!row.connected && canAdd && row.profile && (
          <Button
            size="sm"
            className="ml-auto"
            disabled={busy}
            onClick={() => row.profile && askMcpAdd(tool.id, row.profile, agent)}
            aria-label={`Connect ${tool.name} ${label} to ${agent.name}`}
          >
            {busy ? "Starting it…" : "Connect"}
          </Button>
        )}
      </div>
      {!row.connected && !canAdd && row.profile && (
        <p className="text-[0.8rem] text-ink-soft">
          Add it in {agent.name}'s settings with the entry{" "}
          <code className="selectable font-mono">
            {tool.bin} {row.profile} mcp config
          </code>{" "}
          prints.
        </p>
      )}
      {failure && !busy && (
        <p role="alert" className="selectable text-[0.8rem] text-bad">
          {failure}
        </p>
      )}
    </li>
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
        <p role="alert" className="selectable mt-1 text-[0.8rem] text-bad">
          {failure}
        </p>
      )}
    </li>
  )
}
