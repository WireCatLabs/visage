import type { CatalogTool } from "@/domain/catalog"
import { formatWhen, shortSession } from "@/domain/runs"
import type { Claim } from "@/platform/agents-schemas"
import { Button } from "@/ui/Button"
import { ErrorNotice } from "@/ui/ErrorNotice"
import { ReportThis } from "../report/ReportThis"
import { askRelease, releaseKey } from "./actions"
import { useConnect } from "./connect"

export type AgentClaim = { tool: CatalogTool; profile: string; claim: Claim; session: string | null }

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
          <span className="selectable font-mono text-[0.9rem] text-ink-soft" title={c.session}>
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
