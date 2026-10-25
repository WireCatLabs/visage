import { RefreshCw } from "lucide-react"
import { useEffect, useMemo, useState } from "react"
import { AGENT_KIND, buildCheck, groupSessions, KNOWN_AGENTS, overall, parseHolder, sessionsOf } from "@/domain/agents"
import { tools as catalogTools, findTool } from "@/domain/catalog"
import { agentName } from "@/domain/runs"
import type { SkillCell, SkillTarget } from "@/domain/skills"
import { platform } from "@/platform/bridge"
import { Button } from "@/ui/Button"
import { cx } from "@/ui/cx"
import { ErrorNotice } from "@/ui/ErrorNotice"
import { Skeleton, StableText } from "@/ui/Skeleton"
import { useLogs } from "../logs/store"
import { ReportThis } from "../report/ReportThis"
import { useTools } from "../tools/store"
import {
  AgentCard,
  type AgentClaim,
  AgentDetails,
  type AgentTool,
  ClaimRow,
  QuietAgentCard,
  SeenAgentCard,
} from "./AgentCard"
import { AgentsMatrix, useSkillMatrix } from "./AgentsMatrix"
import { askSkillInstallAll } from "./actions"
import { ConfirmCommand } from "./Confirm"
import { pairKey, useConnect } from "./connect"
import { SkillPreview } from "./SkillPreview"
import { useAgents } from "./store"

// Until the installed tools are known, every tool that has a skill stands in; the ones not installed drop off the end.
const SKILL_TOOLS = catalogTools.filter((t) => t.skill !== null).map((t) => t.id)

// A skill helps an agent when any place it reads has a usable copy; the best one is shown.
const PREFER: SkillCell["kind"][] = ["current", "stale", "unversioned", "unknown", "failed", "missing", "checking"]

export function AgentsPage() {
  const { agents, found, stale, rows } = useSkillMatrix()
  const load = useAgents((s) => s.load)
  const checking = useAgents((s) => s.refreshing || rows.some((r) => !(r.tool.id in s.skills)))
  const answered = useAgents((s) => s.answered)
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
    if (answered && Object.keys(useLogs.getState().sources).length === 0) useLogs.getState().load()
  }, [answered])

  useEffect(() => {
    if (answered && foundIds && installedIds) useConnect.getState().load(foundIds.split(","), installedIds.split(","))
  }, [answered, foundIds, installedIds])

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
  const claimsPending =
    !answered ||
    (foundIds !== "" &&
      (installedIds.split(",").some((id) => findTool(id)?.tasks && !(id in connect.profiles)) ||
        Object.values(connect.claims).some((c) => c.state === "loading")))
  const bottomPending = claimsPending || (answered && installedIds !== "" && !logsReady)
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
    for (const id of Object.keys(useConnect.getState().checked)) useConnect.getState().check(id)
  }
  const checkOne = (id: string) => {
    load(rows.map((r) => r.tool.id))
    useConnect.getState().check(id)
  }
  // Opening an agent the first time runs its check: permissions and MCP answers are read only by it.
  const manage = (id: string) => {
    const opening = expanded !== id
    setExpanded(opening ? id : null)
    if (opening && !useConnect.getState().checked[id]) useConnect.getState().check(id)
  }

  const known = new Set(Object.values(AGENT_KIND))
  const seen = (sessions ?? []).reduce<Map<string, number>>((m, s) => {
    if (s.who === "agent" && s.kind && !known.has(s.kind)) m.set(s.kind, (m.get(s.kind) ?? 0) + 1)
    return m
  }, new Map())
  const open = cards.find((c) => c.agent.id === expanded)

  return (
    <div className="flex flex-col gap-[1.5rem] px-[2.1rem] pt-[1.6rem] pb-[2.2rem]">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-[2.1rem] font-extrabold leading-none tracking-[-0.035em]">Agents</h1>
          <p className="mt-3 max-w-[70ch] text-[0.95rem] text-ink-soft">
            Whether each AI agent on this computer can use your tools, and what it has done with them. An agent learns a
            tool from its skill and runs its commands; that is all it needs. MCP is optional, for apps that cannot run
            commands.
          </p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          disabled={checking || anyBusy}
          onClick={checkAll}
          icon={<RefreshCw className={cx("size-4", checking && "animate-spin")} aria-hidden />}
        >
          <StableText value={checking ? "Checking…" : "Check again"} variants={["Check again", "Checking…"]} />
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

      {!agentsError && (
        <ul aria-label="Agents" className="grid grid-cols-[repeat(auto-fill,minmax(17rem,1fr))] gap-3">
          {agents === null
            ? KNOWN_AGENTS.map((a, i) => <QuietAgentCard key={a.id} name={a.name} note={null} first={i === 0} />)
            : agents.map((agent) => {
                const c = cards.find((card) => card.agent.id === agent.id)
                if (!c) return <QuietAgentCard key={agent.id} name={agent.name} note="Not found on this computer" />
                return (
                  <AgentCard
                    key={c.agent.id}
                    agent={c.agent}
                    tools={c.tools}
                    sessions={c.sessions}
                    claims={c.claims}
                    items={c.items}
                    tone={c.items ? overall(c.items) : null}
                    selected={expanded === c.agent.id}
                    onManage={() => manage(c.agent.id)}
                  />
                )
              })}
          {[...seen].map(([kind, n]) => (
            <SeenAgentCard key={kind} kind={kind} name={agentName(kind)} sessions={n} />
          ))}
        </ul>
      )}
      {open && (
        <AgentDetails
          agent={open.agent}
          tools={open.tools}
          sessions={open.sessions}
          claims={open.claims}
          items={open.items}
          tone={open.items ? overall(open.items) : null}
          onClose={() => {
            const name = open.agent.name
            setExpanded(null)
            // The close button leaves with the panel; focus goes back to the card that opened it.
            requestAnimationFrame(() =>
              document.querySelector<HTMLButtonElement>(`button[aria-label="Manage ${name}"]`)?.focus(),
            )
          }}
          onCheck={() => checkOne(open.agent.id)}
        />
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
        <AgentsMatrix expected={SKILL_TOOLS} />
      </section>

      {/* Below Skills: these arrive last, and here they push nothing that is already on screen. Until they answer, a
          block the size of one held task keeps their place; when nothing comes, the page only gets shorter. */}
      {bottomPending ? (
        <Skeleton className="h-[7rem] w-full max-w-[80ch]" label="Reading tasks and run logs" />
      ) : (
        (otherClaims.length > 0 || claimErrors.length > 0 || unknownRuns > 0) && (
          <div className="flex max-w-[80ch] flex-col gap-2 text-[0.9rem] text-ink-soft">
            {unknownRuns > 0 && (
              <p>
                {unknownRuns} {unknownRuns === 1 ? "run" : "runs"} in the logs came from older tool versions, which do
                not record the agent that started them.
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
        )
      )}

      <ConfirmCommand />
      <SkillPreview />
    </div>
  )
}
