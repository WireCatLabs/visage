import { useEffect } from "react"
import { AgentList, PANEL_ID, selectedEntry, useAgentChoice } from "./AgentList"
import { AgentPane } from "./AgentPane"
import { agentTabId } from "./actions"
import { Dialogs, Elsewhere, Notices, PageHead } from "./PageParts"
import { useAgentsView } from "./view"

export function AgentsPage() {
  const view = useAgentsView()
  const chosen = useAgentChoice((s) => s.chosen)
  const selected = selectedEntry(view.entries, chosen)
  const selectedFound = selected?.type === "found" ? selected.id : null
  const { opened } = view
  // The pane can open on an agent nobody clicked, and its details still need that agent's own check.
  useEffect(() => {
    if (selectedFound) opened(selectedFound)
  }, [selectedFound, opened])

  return (
    // The page fills the window from its first frame, so details arriving inside the pane do not grow it.
    <div className="@container flex min-h-full flex-col gap-[1.5rem] px-[2.1rem] pt-[1.6rem] pb-[2.2rem]">
      <PageHead view={view} />
      <Notices view={view} />
      {!view.agentsError && (
        <div className="grid flex-1 content-start gap-3 @min-[52rem]:content-stretch @min-[52rem]:grid-cols-[15rem_minmax(0,1fr)] @min-[52rem]:gap-0 @min-[80rem]:grid-cols-[17rem_minmax(0,1fr)]">
          <AgentList entries={view.entries} selected={selected?.id ?? null} />
          <section
            id={PANEL_ID}
            role="tabpanel"
            aria-labelledby={selected ? agentTabId(selected.id) : undefined}
            className="min-h-[24rem] rounded-[0.2rem] border border-line-strong bg-app px-[1.5rem] pt-4 pb-5"
          >
            <AgentPane entry={selected} all={view} />
          </section>
        </div>
      )}
      <Elsewhere view={view} />
      <Dialogs />
    </div>
  )
}
