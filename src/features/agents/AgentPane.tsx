import { TARGET_FOLDER } from "@/domain/skills"
import { Button } from "@/ui/Button"
import { Skeleton } from "@/ui/Skeleton"
import { AgentDetails } from "./AgentDetails"
import { AgentIcon } from "./AgentIcon"
import { ConnectDialog } from "./ConnectDialog"
import { useConnectFlow } from "./connect-flow"
import { DisconnectDialog } from "./DisconnectDialog"
import { SeenLink } from "./PageParts"
import { AgentCta, SkillTable } from "./SkillTable"
import { type AgentEntry, type AgentsView, plural, sharers, todoSentence } from "./view"

/** The selected agent: its skills with one Install all, then what else stops it, its sessions, tasks and MCP. */
export function AgentPane({ entry, all }: { entry: AgentEntry | null; all: AgentsView }) {
  if (!entry || entry.type === "pending") return <PendingPane />
  if (entry.type === "seen")
    return (
      <div className="flex flex-col gap-3">
        <h2 className="text-[1.3rem] font-semibold text-ink-soft">{entry.name}</h2>
        <p className="max-w-[70ch] text-[0.95rem] text-ink-soft">
          The run logs name this agent ({plural(entry.sessions, "session")}), but WireCat does not detect it, so it
          cannot say which skills it reads.
        </p>
        <div>
          <SeenLink kind={entry.kind} name={entry.name} />
        </div>
      </div>
    )
  if (entry.type === "absent")
    return (
      <div className="flex flex-col gap-3">
        <h2 className="flex items-center gap-2 text-[1.3rem] font-semibold text-ink-soft">
          <AgentIcon id={entry.id} className="size-[1.3rem] shrink-0 text-ink-dim" />
          {entry.name}
        </h2>
        <p className="max-w-[70ch] text-[0.95rem] text-ink-soft">
          Not found on this computer. Once it is installed it reads skills from{" "}
          <span className="selectable font-mono text-[0.85rem]">
            {entry.agent.reads.map((t) => TARGET_FOLDER[t]).join(", ")}
          </span>
          {entry.agent.reads.some((t) => t !== "hermes")
            ? ", so the skills you install for the other agents reach it too."
            : "."}
        </p>
      </div>
    )
  const { view } = entry
  const checking = view.skills.some((s) => s.cell.kind === "checking")
  return (
    <div className="flex flex-col gap-5" key={view.agent.id}>
      <div className="flex min-h-[3.4rem] flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 className="flex items-center gap-2 text-[1.3rem] font-semibold leading-tight">
            <AgentIcon id={view.agent.id} className="size-[1.3rem] shrink-0 text-ink-soft" />
            {view.agent.name}
          </h2>
          <p className="mt-1 text-[0.95rem] text-ink-soft">
            {checking ? (
              <Skeleton chars={34} />
            ) : view.todo.length > 0 ? (
              todoSentence(view)
            ) : (
              "Every skill it can see is current"
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="secondary"
            disabled={all.anyBusy || !all.toolsKnown}
            onClick={() => useConnectFlow.getState().open(view.agent.id)}
            aria-label={`Connect WireCat to ${view.agent.name}`}
          >
            Connect
          </Button>
          <AgentCta view={view} all={all} />
        </div>
      </div>
      <SkillTable view={view} loading={!all.toolsKnown} />
      <div className="border-line border-t pt-4">
        <AgentDetails view={view} onCheck={() => all.checkOne(view.agent.id)} />
      </div>
      <ConnectDialog view={view} />
      <DisconnectDialog view={view} sharers={(t) => sharers(all.entries, t, view.agent.id)} />
    </div>
  )
}

/** The found agent's pane at its usual size while agents are still being looked for. */
function PendingPane() {
  return (
    <div className="flex flex-col gap-5">
      <div className="min-h-[3.4rem]">
        <Skeleton className="h-[1.6rem] w-40" />
        <p className="mt-1 text-[0.95rem]">
          <Skeleton chars={34} />
        </p>
      </div>
      <Skeleton className="h-[8.9rem] w-full" />
      <Skeleton className="h-[12rem] w-full" />
    </div>
  )
}
