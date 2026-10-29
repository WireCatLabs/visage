import { connections, serverName } from "@/domain/agents"
import { tools as catalogTools } from "@/domain/catalog"
import { useMessages } from "@/i18n"
import type { Agent } from "@/platform/agents-schemas"
import { Button } from "@/ui/Button"
import { Disclosure } from "@/ui/Disclosure"
import { ErrorNotice } from "@/ui/ErrorNotice"
import { Skeleton } from "@/ui/Skeleton"
import { ReportThis } from "../report/ReportThis"
import { askMcpRemove, mcpKey } from "./actions"
import { useConnect } from "./connect"
import { agentsMessages } from "./messages"

// Email shares memo's program, so one entry per program keeps a server from being listed twice.
const PROGRAMS = catalogTools.filter((t) => !t.partOf)

/** Read-only: agents here use the tools through their skill, so MCP is never offered, only cleaned up. */
export function AdvancedMcp({ agent }: { agent: Agent }) {
  const m = useMessages(agentsMessages)
  return (
    <Disclosure summary={m.advancedMcp}>
      <div className="flex flex-col gap-2 pl-[1.25rem]">
        <p className="max-w-[70ch] text-[0.9rem] text-ink-soft">{m.mcpIntro}</p>
        <Servers agent={agent} />
      </div>
    </Disclosure>
  )
}

function Servers({ agent }: { agent: Agent }) {
  const servers = useConnect((s) => s.servers[agent.id])
  const m = useMessages(agentsMessages)
  if (!servers || servers.state === "loading") return <Skeleton className="h-8 w-full" label={m.readingMcp} />
  if (servers.state === "error")
    return (
      <ErrorNotice inline action={<ReportThis what={`Reading ${agent.name} MCP servers`} error={servers.error} />}>
        {servers.error}
      </ErrorNotice>
    )
  const { names, canRemove, source, unread } = servers.data
  if (unread)
    return (
      <p className="max-w-[70ch] text-[0.9rem] text-ink-soft">
        {m.mcpUnread(agent.name, <code className="selectable font-mono text-[0.85rem]">{unread}</code>)}
      </p>
    )
  const rows = PROGRAMS.flatMap((tool) =>
    connections(names, tool.bin, []).map((row) => ({ tool, profile: row.profile })),
  )
  return (
    <>
      {rows.length === 0 ? (
        <p className="text-[0.9rem] text-ink-soft">{m.noMcp(agent.name)}</p>
      ) : (
        <ul className="flex flex-col gap-1.5" aria-label={m.mcpList(agent.name)}>
          {rows.map(({ tool, profile }) => (
            <ServerRow
              key={serverName(tool.bin, profile)}
              agent={agent}
              toolId={tool.id}
              toolName={tool.name}
              name={serverName(tool.bin, profile)}
              profile={profile}
              canRemove={canRemove}
            />
          ))}
        </ul>
      )}
      <p className="text-[0.85rem] text-ink-dim">
        {m.readFrom(<span className="selectable font-mono">{source}</span>)}
      </p>
    </>
  )
}

function ServerRow(props: {
  agent: Agent
  toolId: string
  toolName: string
  name: string
  profile: string | null
  canRemove: boolean
}) {
  const { agent, toolId, toolName, name, profile, canRemove } = props
  const key = mcpKey(agent.id, toolId, profile)
  const busy = useConnect((s) => s.busy[key] === true)
  const failure = useConnect((s) => s.failures[key])
  const m = useMessages(agentsMessages)
  return (
    <li>
      <div className="flex min-h-8 flex-wrap items-center gap-2 text-[0.9rem]">
        <span className="selectable font-mono text-ink">{name}</span>
        <span className="text-ink-soft">{toolName}</span>
        {canRemove && (
          <Button
            size="sm"
            variant="ghost"
            className="ml-auto"
            disabled={busy}
            onClick={() => askMcpRemove(toolId, profile, agent)}
            aria-label={m.removeServer(name, agent.name)}
          >
            {busy ? m.removing : m.remove}
          </Button>
        )}
      </div>
      {failure && !busy && (
        <ErrorNotice
          inline
          action={<ReportThis what={`Removing ${name} from ${agent.name}`} tool={toolId} error={failure} />}
        >
          {failure}
        </ErrorNotice>
      )}
    </li>
  )
}
