import { RefreshCw } from "lucide-react"
import { findTool } from "@/domain/catalog"
import { agentName, termText } from "@/domain/runs"
import { useMessages } from "@/i18n"
import { Button } from "@/ui/Button"
import { cx } from "@/ui/cx"
import { Disclosure } from "@/ui/Disclosure"
import { ErrorNotice } from "@/ui/ErrorNotice"
import { Skeleton, StableText } from "@/ui/Skeleton"
import { useLogs } from "../logs/store"
import { useNav } from "../nav"
import { ReportThis } from "../report/ReportThis"
import { openManage } from "./AgentDetails"
import { ClaimRow } from "./ClaimRow"
import { ConfirmCommand } from "./Confirm"
import { pairKey } from "./connect"
import { agentsMessages } from "./messages"
import { SkillPreview } from "./SkillPreview"
import type { AgentsView } from "./view"

const box = "rounded-[0.45rem] border border-line bg-app"

export function PageHead({ view }: { view: AgentsView }) {
  const m = useMessages(agentsMessages)
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0">
        <h1 className="font-display text-[2.1rem] font-extrabold leading-none tracking-[-0.035em]">{m.title}</h1>
        <p className="mt-3 max-w-[70ch] text-[0.95rem] text-ink-soft">{m.intro}</p>
      </div>
      <Button
        variant="ghost"
        size="sm"
        className="-mr-2 text-ink-dim"
        disabled={view.checking || view.anyBusy}
        onClick={view.checkAll}
        icon={<RefreshCw className={cx("size-[0.95rem]", view.checking && "animate-spin")} aria-hidden />}
      >
        <StableText value={view.checking ? m.checking : m.checkAgain} variants={[m.checkAgain, m.checking]} />
      </Button>
    </div>
  )
}

export function Notices({ view }: { view: AgentsView }) {
  const m = useMessages(agentsMessages)
  const noneFound = view.found !== null && view.found.length === 0
  return (
    <>
      {view.agentsError && (
        <ErrorNotice action={<ReportThis what="Looking for AI agents" error={view.agentsError} />}>
          {m.lookFailed(view.agentsError)}
        </ErrorNotice>
      )}
      {!view.agentsError && noneFound && (
        <p className="rounded-[0.2rem] border border-warn/40 bg-warn/10 px-4 py-3 text-[0.95rem]">{m.noAgent}</p>
      )}
      {view.toolsKnown && view.rows.length === 0 && (
        <p className="rounded-[0.2rem] border border-line-strong bg-app px-[1.3rem] py-4 text-[0.95rem] text-ink-soft">
          {m.noTool}
        </p>
      )}
    </>
  )
}

/** Things that belong to no agent on this list, last on the page. */
export function Elsewhere({ view }: { view: AgentsView }) {
  const m = useMessages(agentsMessages)
  const { pending, otherClaims, claimErrors, signedOutTasks, unknownRuns } = view.elsewhere
  if (pending) return <Skeleton className="h-[3rem] w-full max-w-[80ch]" label={m.readingElsewhere} />
  if (otherClaims.length === 0 && claimErrors.length === 0 && signedOutTasks.length === 0 && unknownRuns === 0)
    return null
  return (
    <div className="flex max-w-[80ch] flex-col gap-2 text-[0.9rem] text-ink-soft">
      {unknownRuns > 0 && <p>{m.unknownRuns(unknownRuns)}</p>}
      {signedOutTasks.map(({ tool, profiles }) => (
        <p key={`signed-out:${tool}`}>
          {m.signedOutTasks(
            findTool(tool)?.name ?? tool,
            profiles,
            <button
              type="button"
              onClick={() => openManage(tool)}
              className="font-medium text-brand hover:text-brand-hover hover:underline hover:underline-offset-4"
            >
              {m.signIn}
            </button>,
          )}
        </p>
      ))}
      {claimErrors.map(({ key, error }) => {
        const [tool, profile] = key.split("/")
        const name = findTool(tool ?? "")?.name ?? tool
        return (
          <ErrorNotice
            key={key}
            inline
            action={<ReportThis what={`Reading the tasks of ${name} (${profile})`} tool={tool ?? null} error={error} />}
          >
            {m.claimReadFailed(name ?? "", profile ?? "", error)}
          </ErrorNotice>
        )
      })}
      {otherClaims.length > 0 && (
        <Disclosure summary={m.heldByOthers(otherClaims.length)}>
          <ul className={cx(box, "divide-y divide-line")}>
            {otherClaims.map((c) => {
              const who =
                c.holder.type === "owner" ? m.you : c.holder.type === "agent" ? agentName(c.holder.kind) : c.holder.name
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
  const m = useMessages(agentsMessages)
  return (
    <Button
      size="sm"
      variant="ghost"
      aria-label={m.showNameInLogs(name)}
      onClick={() => {
        const logs = useLogs.getState()
        logs.setQuery(termText("agent", kind))
        logs.setRange("all")
        go("logs")
      }}
    >
      {m.showInLogs}
    </Button>
  )
}
