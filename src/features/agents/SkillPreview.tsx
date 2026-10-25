import { useEffect, useState } from "react"
import { create } from "zustand"
import { findTool } from "@/domain/catalog"
import { SKILL_TARGETS, TARGET_FOLDER } from "@/domain/skills"
import { platform } from "@/platform/bridge"
import { Button } from "@/ui/Button"
import { Dialog } from "@/ui/Dialog"
import { Skeleton } from "@/ui/Skeleton"
import { useTools } from "../tools/store"
import { useAgents } from "./store"

export const useSkillPreview = create<{ tool: string | null; open(tool: string): void; close(): void }>((set) => ({
  tool: null,
  open: (tool) => set({ tool }),
  close: () => set({ tool: null }),
}))

type Text = { state: "loading" } | { state: "ready"; content: string } | { state: "error"; error: string }

/** The skill as the installed tool ships it, beside the versions of the copies agents read. */
export function SkillPreview() {
  const id = useSkillPreview((s) => s.tool)
  const close = useSkillPreview((s) => s.close)
  const tool = id ? findTool(id) : undefined
  const version = useTools((s) => (id ? (s.installs[id]?.[0]?.version ?? null) : null))
  const report = useAgents((s) => (id ? s.skills[id]?.report : null))
  const [text, setText] = useState<Text>({ state: "loading" })

  useEffect(() => {
    if (!id) return
    setText({ state: "loading" })
    platform.skillShow(id).then(
      (t) => setText({ state: "ready", content: t.content }),
      (e) => setText({ state: "error", error: e instanceof Error ? e.message : String(e) }),
    )
  }, [id])

  const copies = SKILL_TARGETS.map((target) => ({
    target,
    installed: report?.targets.find((t) => t.target === target)?.installed ?? null,
  }))
  const differs = copies.some((c) => c.installed && version && c.installed !== version)

  return (
    <Dialog
      open={id !== null}
      wide
      scroll
      title={tool ? `${tool.name} skill` : ""}
      onClose={close}
      actions={
        <Button variant="ghost" data-autofocus onClick={close}>
          Close
        </Button>
      }
    >
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-[0.9rem]">
        <dt className="text-ink-dim">Comes with {tool?.bin}</dt>
        <dd className="selectable font-mono text-ink tabular-nums">{version ?? "—"}</dd>
        {copies.map((c) => (
          <div key={c.target} className="contents">
            <dt className="text-ink-dim">
              In <span className="font-mono text-[0.8rem]">{TARGET_FOLDER[c.target]}</span>
            </dt>
            <dd className="selectable font-mono text-ink tabular-nums">{c.installed ?? "not installed"}</dd>
          </div>
        ))}
      </dl>
      {differs && (
        <p className="mt-3 text-[0.9rem] text-ink-soft">
          An installed copy is a different version. Showing exactly what changed arrives with a tool update: the tool
          cannot print the installed copy yet. Updating replaces it with the text below.
        </p>
      )}
      <div className="mt-4 mb-2 rounded-[0.45rem] border border-line bg-app-2">
        {text.state === "loading" && (
          <div className="flex flex-col gap-2 p-4">
            <Skeleton className="h-4 w-1/2" label="Reading the skill" />
            <Skeleton className="h-4 w-5/6" />
            <Skeleton className="h-4 w-2/3" />
          </div>
        )}
        {text.state === "error" && (
          <p role="alert" className="selectable p-4 text-[0.9rem] text-bad">
            {text.error}
          </p>
        )}
        {text.state === "ready" && (
          <pre className="selectable max-h-[50vh] overflow-auto p-4 font-mono text-[0.8rem] leading-relaxed whitespace-pre-wrap text-ink">
            {text.content}
          </pre>
        )}
      </div>
    </Dialog>
  )
}
