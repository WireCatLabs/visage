import { create } from "zustand"
import { type SkillTarget, TARGET_FOLDER } from "@/domain/skills"
import { useMessages } from "@/i18n"
import { platform } from "@/platform/bridge"
import { Button } from "@/ui/Button"
import { CopyField } from "@/ui/CopyField"
import { Dialog } from "@/ui/Dialog"
import { agentsMessages } from "./messages"
import { useAgents } from "./store"
import type { AgentView } from "./view"

export const useDisconnect = create<{ agent: string | null; open(agent: string): void; close(): void }>((set) => ({
  agent: null,
  open: (agent) => set({ agent }),
  close: () => set({ agent: null }),
}))

const folderOf = (path: string) => path.replace(/[\\/]SKILL\.md$/i, "")

/**
 * The known skills folder a copy sits directly in, by the target that writes it there. A Hermes copy usually lives in
 * `~/.agents/skills`, so it is that folder's readers who lose it too. `null` for anything else, which gets no command.
 */
function placeOf(folder: string): SkillTarget | null {
  const cut = folder.lastIndexOf("/")
  const name = folder.slice(cut + 1)
  if (!/^[A-Za-z0-9._-]+$/.test(name) || name === "." || name === "..") return null
  const root = folder.slice(0, cut)
  return (Object.keys(TARGET_FOLDER) as SkillTarget[]).find((t) => TARGET_FOLDER[t] === root) ?? null
}

/** The skill folders this agent reads, from each tool's own `skill status`. */
export function installedCopies(view: AgentView, skills: ReturnType<typeof useAgents.getState>["skills"]) {
  return view.skills.flatMap((s) =>
    (skills[s.tool.id]?.report?.targets ?? [])
      .filter((t) => view.agent.reads.includes(t.target) && t.installed !== null && t.path)
      .map((t) => {
        const folder = folderOf(t.path ?? "")
        return { tool: s.tool.name, target: t.target, folder, place: placeOf(folder) }
      }),
  )
}

/**
 * The tools have no command that removes their skill yet, and WireCat deletes only what its own catalog names, so
 * Disconnect says what to delete and who else reads it.
 */
export function DisconnectDialog({ view, sharers }: { view: AgentView; sharers: (target: SkillTarget) => string[] }) {
  const { agent } = view
  const open = useDisconnect((s) => s.agent === agent.id)
  const close = useDisconnect((s) => s.close)
  const m = useMessages(agentsMessages)
  const skills = useAgents((s) => s.skills)
  const copies = installedCopies(view, skills)
  const others = [...new Set(copies.flatMap((c) => (c.place ? sharers(c.place) : [])))]
  const shared = [...new Set(copies.flatMap((c) => (c.place ? [TARGET_FOLDER[c.place]] : [])))]
  // Only a plain folder directly inside a known skills folder goes into a command to paste.
  const safe = copies.filter((c) => c.place !== null)
  const command =
    platform.os === "windows" || safe.length === 0
      ? null
      : `rm -r ${safe.map((c) => `"${c.folder.replace(/^~(?=\/)/, "$HOME")}"`).join(" ")}`

  return (
    <Dialog
      open={open}
      title={m.disconnectFrom(agent.name)}
      onClose={close}
      actions={
        <Button variant="secondary" data-autofocus onClick={close}>
          {m.close}
        </Button>
      }
    >
      <div className="flex flex-col gap-3 text-[0.95rem]">
        <p className="max-w-[70ch]">{m.disconnectBody(agent.name, copies.length)}</p>
        <ul className="flex flex-col gap-1 font-mono text-[0.9rem]">
          {copies.map((c) => (
            <li key={`${c.tool}:${c.target}`} className="selectable">
              {c.folder}
            </li>
          ))}
        </ul>
        {command && <CopyField value={command} label={m.copyCommand} />}
        {others.length > 0 && <p className="max-w-[70ch] text-ink-soft">{m.othersLose(others, shared)}</p>}
        <p className="max-w-[70ch] text-ink-soft">{m.toolsStay(agent.name)}</p>
      </div>
    </Dialog>
  )
}
