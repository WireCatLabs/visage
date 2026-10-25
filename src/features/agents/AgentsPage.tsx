import { RefreshCw } from "lucide-react"
import { useEffect, useMemo, useState } from "react"
import { buildCheck, groupSessions, overall, parseHolder, sessionsOf } from "@/domain/agents"
import { findTool } from "@/domain/catalog"
import { agentName } from "@/domain/runs"
import { type SkillCell, type SkillTarget, TARGET_FOLDER } from "@/domain/skills"
import type { Agent } from "@/platform/agents-schemas"
import { platform } from "@/platform/bridge"
import { Button } from "@/ui/Button"
import { cx } from "@/ui/cx"
import { Disclosure } from "@/ui/Disclosure"
import { ErrorNotice } from "@/ui/ErrorNotice"
import { Lamp } from "@/ui/Lamp"
import { useLogs } from "../logs/store"
import { ReportThis } from "../report/ReportThis"
import { useTools } from "../tools/store"
import { type AgentClaim, AgentRow, type AgentTool, ClaimRow } from "./AgentRow"
import { AgentsMatrix, useSkillMatrix } from "./AgentsMatrix"
import { askSkillInstallAll } from "./actions"
import { ConfirmCommand } from "./Confirm"
import { pairKey, useConnect } from "./connect"
import { SkillPreview } from "./SkillPreview"
import { useAgents } from "./store"

const foundWords = (a: Agent) =>
  a.foundBy === "program"
    ? "Found: the program is on PATH"
    : a.foundBy === "folder"
      ? "Found by its settings folder; the program itself is not on PATH"
      : "Not found on this computer"

// A skill helps an agent when any place it reads has a usable copy; the best one is shown.
const PREFER: SkillCell["kind"][] = ["current", "stale", "unversioned", "unknown", "failed", "missing", "checking"]

export function AgentsPage() {
  const { agents, found, stale, rows } = useSkillMatrix()
  const load = useAgents((s) => s.load)
  const checking = useAgents((s) => rows.some((r) => !(r.tool.id in s.skills)))
  const anyBusy = useAgents((s) => Object.keys(s.busy).length > 0)
  const agentsError = useAgents((s) => s.agentsError)
  const installs = useTools((s) => s.installs)
  const sources = useLogs((s) => s.sources)
  const connect = useConnect()
  const [expanded, setExpanded] = useState<string | null>(null)

  const foundIds = (found ?? []).map((a) => a.id).join(",")
  const installedIds = Object.keys(installs)
    .filter((id) => (installs[id]?.length ?? 0) > 0)
    .join(",")

  useEffect(() => {
    if (Object.keys(useLogs.getState().sources).length === 0) useLogs.getState().load()
  }, [])

  useEffect(() => {
    if (foundIds && installedIds) useConnect.getState().load(foundIds.split(","), installedIds.split(","))
  }, [foundIds, installedIds])

  const sourceList = Object.values(sources)
  const logsReady = sourceList.length > 0 && sourceList.every((s) => s.state !== "loading")
  const sessions = useMemo(
    () => (logsReady ? groupSessions(Object.values(sources).flatMap((s) => s.runs)) : null),
    [logsReady, sources],
  )
  const unknownRuns = sessions?.find((s) => s.who === "unknown")?.runs ?? 0

  const claims = Object.entries(connect.claims).flatMap(([key, loaded]) => {
    if (loaded.state !== "ready") return []
    const [toolId, profile = ""] = key.split("/")
    const tool = findTool(toolId ?? "")
    if (!tool) return []
    return loaded.data.items.map((claim) => ({ tool, profile, claim, holder: parseHolder(claim.holder) }))
  })
  const claimErrors = Object.entries(connect.claims).flatMap(([key, loaded]) =>
    loaded.state === "error" ? [{ key, error: loaded.error }] : [],
  )
  const otherClaims = claims.filter((c) => c.holder.type !== "agent" || c.holder.agent === null)

  const cards = (found ?? []).map((agent) => {
    const tools: AgentTool[] = rows.map((r) => {
      const mine = r.cells.filter((c) => agent.reads.includes(c.target))
      const best = PREFER.map((k) => mine.find((c) => c.cell.kind === k)).find(Boolean)
      return { tool: r.tool, skill: best ? { cell: best.cell, target: best.target } : null }
    })
    const skillsLoaded = rows.every((r) => r.cells.every((c) => c.cell.kind !== "checking"))
    const servers = connect.servers[agent.id]
    const items =
      skillsLoaded && servers && servers.state !== "loading"
        ? buildCheck({
            agent,
            tools: rows.map((r) => ({
              id: r.tool.id,
              name: r.tool.name,
              bin: r.tool.bin,
              path: installs[r.tool.id]?.[0]?.path ?? null,
              hasMcp: r.tool.mcp !== null,
            })),
            reach: connect.reach,
            skills: Object.fromEntries(
              rows.map((r) => [
                r.tool.id,
                Object.fromEntries(r.cells.map((c) => [c.target, c.cell])) as Partial<Record<SkillTarget, SkillCell>>,
              ]),
            ),
            servers: servers.state === "ready" ? servers.data : null,
            health: connect.health,
            profiles: connect.profiles,
            access: connect.access,
            windows: platform.os === "windows",
          })
        : null
    const mine: AgentClaim[] = claims
      .filter((c) => c.holder.type === "agent" && c.holder.agent === agent.id)
      .map((c) => ({ ...c, session: c.holder.type === "agent" ? c.holder.session : null }))
    return {
      agent,
      tools,
      items,
      claims: mine,
      sessions: sessions ? sessionsOf(sessions, agent.id) : null,
    }
  })

  const installedList = installedIds ? installedIds.split(",") : []
  const checkAll = () => {
    load(rows.map((r) => r.tool.id))
    useLogs.getState().load()
    if (foundIds) useConnect.getState().load(foundIds.split(","), installedList)
  }
  const checkOne = (id: string) => {
    setExpanded(id)
    load(rows.map((r) => r.tool.id))
    useConnect.getState().check(id)
  }

  return (
    <div className="flex flex-col gap-[1.5rem] px-[2.1rem] pt-[1.6rem] pb-[2.2rem]">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-[2.1rem] font-extrabold leading-none tracking-[-0.035em]">Agents</h1>
          <p className="mt-3 max-w-[70ch] text-[0.95rem] text-ink-soft">
            Whether each AI agent on this computer can use your tools, and what it has done with them. An agent learns a
            tool from its skill, and can also start the tool's MCP server.
          </p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          disabled={checking || anyBusy}
          onClick={checkAll}
          icon={<RefreshCw className={cx("size-4", checking && "animate-spin")} aria-hidden />}
        >
          {checking ? "Checking…" : "Check again"}
        </Button>
      </div>

      {agentsError && (
        <ErrorNotice action={<ReportThis what="Looking for AI agents" error={agentsError} />}>
          Could not look for AI agents: {agentsError}
        </ErrorNotice>
      )}
      {!agentsError && found !== null && found.length === 0 && (
        <p className="rounded-[0.2rem] border border-warn/40 bg-warn/10 px-4 py-3 text-[0.95rem]">
          No AI agent was found on this computer. Skills can still be written; an agent installed later reads them.
        </p>
      )}

      {found && found.length > 0 && (
        <ul aria-label="Agents" className="rounded-[0.2rem] border border-line-strong bg-app">
          {cards.map((c) => (
            <AgentRow
              key={c.agent.id}
              agent={c.agent}
              tools={c.tools}
              sessions={c.sessions}
              claims={c.claims}
              items={c.items}
              tone={c.items ? overall(c.items) : null}
              expanded={expanded === c.agent.id}
              onToggle={() => setExpanded((e) => (e === c.agent.id ? null : c.agent.id))}
              onCheck={() => checkOne(c.agent.id)}
            />
          ))}
        </ul>
      )}

      {(otherClaims.length > 0 || claimErrors.length > 0 || unknownRuns > 0) && (
        <div className="flex max-w-[80ch] flex-col gap-2 text-[0.9rem] text-ink-soft">
          {unknownRuns > 0 && (
            <p>
              {unknownRuns} {unknownRuns === 1 ? "run" : "runs"} in the logs came from older tool versions, which do not
              record the agent that started them.
            </p>
          )}
          {claimErrors.map(({ key, error }) => {
            const [tool, profile] = key.split("/")
            return (
              <ErrorNotice
                key={key}
                inline
                action={
                  <ReportThis
                    what={`Reading the tasks of ${findTool(tool ?? "")?.name ?? tool} (${profile})`}
                    tool={tool ?? null}
                    error={error}
                  />
                }
              >
                Could not read the tasks of {findTool(tool ?? "")?.name ?? tool} ({profile}): {error}
              </ErrorNotice>
            )
          })}
          {otherClaims.length > 0 && (
            <section>
              <h2 className="mb-2 text-[0.85rem] font-medium text-ink-dim">Tasks held by others</h2>
              <ul className="divide-y divide-line rounded-[0.45rem] border border-line bg-app">
                {otherClaims.map((c) => {
                  const who =
                    c.holder.type === "owner"
                      ? "You"
                      : c.holder.type === "agent"
                        ? agentName(c.holder.kind)
                        : c.holder.name
                  return (
                    <ClaimRow
                      key={pairKey(c.tool.id, c.profile) + c.claim.id}
                      c={{ ...c, session: null }}
                      holder={who}
                    />
                  )
                })}
              </ul>
            </section>
          )}
        </div>
      )}

      <section className="flex flex-col gap-3">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="text-[1.2rem] font-semibold">Skills</h2>
            <p className="mt-1 max-w-[70ch] text-[0.95rem] text-ink-soft">
              A skill is a short guide that tells an agent which commands a tool has and when to use them. Each tool
              writes its skill to two folders; the agents on this computer read one or both.
            </p>
          </div>
          {stale.length > 0 && (
            <Button variant="primary" disabled={anyBusy} onClick={() => askSkillInstallAll(stale)}>
              Update all old skills ({stale.length})
            </Button>
          )}
        </div>
        <AgentsMatrix />
        <ReadsBoth agents={agents} />
      </section>

      {agents && (
        <Disclosure summary="Agents this app knows">
          <ul className="flex max-w-[70ch] flex-col gap-1.5">
            {agents.map((a) => (
              <li key={a.id} className="flex items-start gap-2.5 text-[0.9rem]">
                <span className="mt-[0.35rem]">
                  <Lamp size="sm" tone={a.foundBy ? "ok" : "idle"} />
                </span>
                <span>
                  <span className="font-medium text-ink">{a.name}</span>
                  <span className="text-ink-soft">
                    {" "}
                    · {foundWords(a)} · reads{" "}
                    <span className="font-mono text-[0.8rem]">{a.reads.map((t) => TARGET_FOLDER[t]).join(", ")}</span>
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </Disclosure>
      )}

      <ConfirmCommand />
      <SkillPreview />
    </div>
  )
}

function ReadsBoth({ agents }: { agents: Agent[] | null }) {
  const readsBoth = agents?.filter((a) => a.foundBy && a.reads.length > 1) ?? []
  if (readsBoth.length === 0) return null
  return (
    <p className="max-w-[70ch] text-[0.9rem] text-ink-soft">
      {readsBoth.map((a) => a.name).join(" and ")} {readsBoth.length > 1 ? "read" : "reads"} both folders, so an old
      copy in either one still reaches {readsBoth.length > 1 ? "them" : "it"}.
    </p>
  )
}
