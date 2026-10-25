import { RefreshCw } from "lucide-react"
import { TARGET_FOLDER } from "@/domain/skills"
import type { Agent } from "@/platform/agents-schemas"
import { Button } from "@/ui/Button"
import { cx } from "@/ui/cx"
import { Disclosure } from "@/ui/Disclosure"
import { Lamp } from "@/ui/Lamp"
import { AgentsMatrix, useSkillMatrix } from "./AgentsMatrix"
import { useAgents } from "./store"

const foundWords = (a: Agent) =>
  a.foundBy === "program"
    ? "Found: the program is on PATH"
    : a.foundBy === "folder"
      ? "Found by its settings folder; the program itself is not on PATH"
      : "Not found on this computer"

export function AgentsPage() {
  const { agents, stale, rows } = useSkillMatrix()
  const installAll = useAgents((s) => s.installAll)
  const load = useAgents((s) => s.load)
  const checking = useAgents((s) => rows.some((r) => !(r.tool.id in s.skills)))
  const anyBusy = useAgents((s) => Object.keys(s.busy).length > 0)
  const readsBoth = agents?.filter((a) => a.foundBy && a.reads.length > 1) ?? []

  return (
    <div className="flex flex-col gap-[1.5rem] px-[2.1rem] pt-[1.6rem] pb-[2.2rem]">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-[2.1rem] font-extrabold leading-none tracking-[-0.035em]">Agents</h1>
          <p className="mt-3 max-w-[70ch] text-[0.95rem] text-ink-soft">
            A skill is a short guide that tells an AI agent which commands a tool has and when to use them. Each tool
            writes its skill to two folders; the agents on this computer read one or both.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            disabled={checking || anyBusy}
            onClick={() => load(rows.map((r) => r.tool.id))}
            icon={<RefreshCw className={cx("size-4", checking && "animate-spin")} aria-hidden />}
          >
            {checking ? "Checking…" : "Check again"}
          </Button>
          {stale.length > 0 && (
            <Button variant="primary" disabled={anyBusy} onClick={() => installAll(stale)}>
              Update all old skills ({stale.length})
            </Button>
          )}
        </div>
      </div>

      <AgentsMatrix />

      {readsBoth.length > 0 && (
        <p className="max-w-[70ch] text-[0.9rem] text-ink-soft">
          {readsBoth.map((a) => a.name).join(" and ")} {readsBoth.length > 1 ? "read" : "reads"} both folders, so an old
          copy in either one still reaches {readsBoth.length > 1 ? "them" : "it"}.
        </p>
      )}

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
    </div>
  )
}
