import { type KeyboardEvent, useRef } from "react"
import { create } from "zustand"
import { cx } from "@/ui/cx"
import { Lamp } from "@/ui/Lamp"
import { Skeleton } from "@/ui/Skeleton"
import { agentTabId } from "./actions"
import { rowTone } from "./SkillTable"
import { type AgentEntry, plural } from "./view"

/** The agent the owner picked, kept for the app session so coming back to Agents shows the same one. */
export const useAgentChoice = create<{ chosen: string | null; choose(id: string): void }>((set) => ({
  chosen: null,
  choose: (chosen) => set({ chosen }),
}))

/** The owner's pick, else the first found agent with something to set up, else the first found one. */
export function selectedEntry(entries: readonly AgentEntry[], chosen: string | null): AgentEntry | null {
  return (
    entries.find((e) => e.id === chosen) ??
    entries.find((e) => e.type === "found" && e.view.todo.length > 0) ??
    entries.find((e) => e.type === "found") ??
    entries[0] ??
    null
  )
}

export const PANEL_ID = "agent-panel"

const KEYS: Record<string, (i: number, n: number) => number> = {
  ArrowDown: (i, n) => (i + 1) % n,
  ArrowUp: (i, n) => (i - 1 + n) % n,
  Home: () => 0,
  End: (_, n) => n - 1,
}

/** Every agent as a vertical tab list; arrows, Home and End move the selection, as in any tab list. */
export function AgentList({ entries, selected }: { entries: readonly AgentEntry[]; selected: string | null }) {
  const choose = useAgentChoice((s) => s.choose)
  const tabs = useRef<(HTMLButtonElement | null)[]>([])
  const onKey = (event: KeyboardEvent, i: number) => {
    const move = KEYS[event.key]
    if (!move) return
    event.preventDefault()
    const next = move(i, entries.length)
    const e = entries[next]
    if (e) choose(e.id)
    tabs.current[next]?.focus()
  }
  return (
    <div role="tablist" aria-label="Agents" aria-orientation="vertical" className="flex flex-col @min-[52rem]:py-2">
      {entries.map((e, i) => {
        const on = e.id === selected
        return (
          <button
            key={e.id}
            ref={(el) => {
              tabs.current[i] = el
            }}
            type="button"
            role="tab"
            id={agentTabId(e.id)}
            aria-selected={on}
            aria-controls={PANEL_ID}
            tabIndex={on ? 0 : -1}
            onClick={() => choose(e.id)}
            onKeyDown={(ev) => onKey(ev, i)}
            className={cx(
              "relative flex min-h-[3.9rem] items-center gap-3 rounded-[0.45rem] border px-4 py-2 text-left transition-colors duration-150",
              "@min-[52rem]:-mr-px @min-[52rem]:rounded-r-none @min-[52rem]:border-r-0",
              on ? "z-10 border-line-strong bg-app" : "border-transparent hover:bg-app-3/60",
            )}
          >
            <TabBody entry={e} on={on} first={i === 0} />
          </button>
        )
      })}
    </div>
  )
}

function TabBody({ entry, on, first }: { entry: AgentEntry; on: boolean; first: boolean }) {
  if (entry.type !== "found") {
    const note =
      entry.type === "pending"
        ? null
        : entry.type === "absent"
          ? "Not found"
          : `Seen in runs · ${plural(entry.sessions, "session")}`
    return (
      <>
        <Lamp size="sm" tone="idle" />
        <span className="min-w-0">
          <span className={cx("block font-semibold leading-tight", entry.type !== "pending" && !on && "text-ink-dim")}>
            {entry.name}
          </span>
          <span className="block truncate text-[0.85rem] text-ink-dim">
            {note ?? <Skeleton chars={10} {...(first ? { label: "Looking for agents" } : {})} />}
          </span>
        </span>
      </>
    )
  }
  const { view } = entry
  const checking = view.skills.some((s) => s.cell.kind === "checking")
  const note = view.todo.length > 0 ? `${view.todo.length} to set up` : "Skills current"
  return (
    <>
      <Lamp size="sm" tone={rowTone(view)} />
      <span className="min-w-0 flex-1">
        <span className={cx("block font-semibold leading-tight", on && "text-brand")}>{view.agent.name}</span>
        <span className="block truncate text-[0.85rem] text-ink-soft">{checking ? <Skeleton chars={12} /> : note}</span>
      </span>
      {view.todo.length > 0 && (
        <span className="rounded-[0.3rem] bg-warn/15 px-[0.45rem] py-[0.1rem] text-[0.8rem] font-medium text-warn-ink tabular-nums">
          {view.todo.length}
        </span>
      )}
    </>
  )
}
