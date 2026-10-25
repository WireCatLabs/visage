import { RefreshCw } from "lucide-react"
import { findTool } from "@/domain/catalog"
import { agentName, termText } from "@/domain/runs"
import { Button } from "@/ui/Button"
import { cx } from "@/ui/cx"
import { Disclosure } from "@/ui/Disclosure"
import { ErrorNotice } from "@/ui/ErrorNotice"
import { Skeleton, StableText } from "@/ui/Skeleton"
import { useLogs } from "../logs/store"
import { useNav } from "../nav"
import { ReportThis } from "../report/ReportThis"
import { ClaimRow } from "./ClaimRow"
import { ConfirmCommand } from "./Confirm"
import { pairKey } from "./connect"
import { SkillPreview } from "./SkillPreview"
import { type AgentsView, plural } from "./view"

const box = "rounded-[0.45rem] border border-line bg-app"

export function PageHead({ view }: { view: AgentsView }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0">
        <h1 className="font-display text-[2.1rem] font-extrabold leading-none tracking-[-0.035em]">Agents</h1>
        <p className="mt-3 max-w-[70ch] text-[0.95rem] text-ink-soft">{INTRO}</p>
      </div>
      <Button
        variant="ghost"
        size="sm"
        className="-mr-2 text-ink-dim"
        disabled={view.checking || view.anyBusy}
        onClick={view.checkAll}
        icon={<RefreshCw className={cx("size-[0.95rem]", view.checking && "animate-spin")} aria-hidden />}
      >
        <StableText value={view.checking ? "Checking…" : "Check again"} variants={["Check again", "Checking…"]} />
      </Button>
    </div>
  )
}

const INTRO =
  "Give each AI agent the skill for each of your tools. A skill tells the agent which commands a tool has; with it, the agent runs them itself."

export function Notices({ view }: { view: AgentsView }) {
  const noneFound = view.found !== null && view.found.length === 0
  return (
    <>
      {view.agentsError && (
        <ErrorNotice action={<ReportThis what="Looking for AI agents" error={view.agentsError} />}>
          Could not look for AI agents: {view.agentsError}
        </ErrorNotice>
      )}
      {!view.agentsError && noneFound && (
        <p className="rounded-[0.2rem] border border-warn/40 bg-warn/10 px-4 py-3 text-[0.95rem]">
          No AI agent was found on this computer. Skills can still be written; an agent installed later reads them.
        </p>
      )}
      {view.toolsKnown && view.rows.length === 0 && (
        <p className="rounded-[0.2rem] border border-line-strong bg-app px-[1.3rem] py-4 text-[0.95rem] text-ink-soft">
          No WireCat tool is installed yet. Each tool brings its own skill; install one on the Tools page first.
        </p>
      )}
    </>
  )
}

/** Things that belong to no agent on this list, last on the page. */
export function Elsewhere({ view }: { view: AgentsView }) {
  const { pending, otherClaims, claimErrors, unknownRuns } = view.elsewhere
  if (pending) return <Skeleton className="h-[3rem] w-full max-w-[80ch]" label="Reading tasks and run logs" />
  if (otherClaims.length === 0 && claimErrors.length === 0 && unknownRuns === 0) return null
  return (
    <div className="flex max-w-[80ch] flex-col gap-2 text-[0.9rem] text-ink-soft">
      {unknownRuns > 0 && (
        <p>
          {plural(unknownRuns, "run")} in the logs came from older tool versions, which do not record the agent that
          started them.
        </p>
      )}
      {claimErrors.map(({ key, error }) => {
        const [tool, profile] = key.split("/")
        const name = findTool(tool ?? "")?.name ?? tool
        return (
          <ErrorNotice
            key={key}
            inline
            action={<ReportThis what={`Reading the tasks of ${name} (${profile})`} tool={tool ?? null} error={error} />}
          >
            Could not read the tasks of {name} ({profile}): {error}
          </ErrorNotice>
        )
      })}
      {otherClaims.length > 0 && (
        <Disclosure summary={`Tasks held by others (${otherClaims.length})`}>
          <ul className={cx(box, "divide-y divide-line")}>
            {otherClaims.map((c) => {
              const who =
                c.holder.type === "owner" ? "You" : c.holder.type === "agent" ? agentName(c.holder.kind) : c.holder.name
              return (
                <ClaimRow key={pairKey(c.tool.id, c.profile) + c.claim.id} c={{ ...c, session: null }} holder={who} />
              )
            })}
          </ul>
        </Disclosure>
      )}
    </div>
  )
}

export function Dialogs() {
  return (
    <>
      <ConfirmCommand />
      <SkillPreview />
    </>
  )
}

export function SeenLink({ kind, name }: { kind: string; name: string }) {
  const go = useNav((s) => s.go)
  return (
    <Button
      size="sm"
      variant="ghost"
      aria-label={`Show ${name} in Logs`}
      onClick={() => {
        const logs = useLogs.getState()
        logs.setQuery(termText("agent", kind))
        logs.setRange("all")
        go("logs")
      }}
    >
      Show in Logs
    </Button>
  )
}
