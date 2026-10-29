import { useState } from "react"
import type { CatalogTool } from "@/domain/catalog"
import { useMessages } from "@/i18n"
import { Button } from "@/ui/Button"
import { Dialog } from "@/ui/Dialog"
import { toolsMessages } from "./messages"
import { permissionsMessages } from "./messages-permissions"
import { LEVELS } from "./permissions"
import { groupLabel } from "./tool-text"

export function LevelsHelp({ tool }: { tool: CatalogTool }) {
  const [open, setOpen] = useState(false)
  const t = useMessages(toolsMessages)
  const p = useMessages(permissionsMessages)
  const m = p.levels
  const groups = (tool.permissions?.groups ?? []).filter((g) => g.key in m.groups)
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded text-[0.875rem] font-medium text-brand hover:text-brand-hover hover:underline hover:underline-offset-4"
      >
        {m.open}
      </button>
      <Dialog
        open={open}
        wide
        scroll
        title={m.title}
        onClose={() => setOpen(false)}
        actions={
          <Button onClick={() => setOpen(false)} data-autofocus>
            {m.close}
          </Button>
        }
      >
        <p>{m.intro(tool.bin)}</p>
        <dl className="mt-3 flex flex-col gap-2.5">
          {LEVELS.map((l) => (
            <div key={l}>
              <dt className="font-medium text-ink">
                {p.permissions.levels[l]} <code className="ml-1 font-mono text-[0.85rem] text-ink-dim">{l}</code>
              </dt>
              <dd>{m.help[l]}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-3">{m.defaultNote}</p>
        {groups.length > 0 && (
          <>
            <h3 className="mt-5 mb-1 text-[1rem] font-semibold text-ink">{m.groupsTitle}</h3>
            <p className="mb-2">{m.notEvery}</p>
            <dl className="mb-2 flex flex-col gap-3">
              {groups.map((g) => {
                const help = m.groups[g.key]
                return (
                  help && (
                    <div key={g.key}>
                      <dt className="font-medium text-ink">
                        {groupLabel(t, g.key, g.label)}{" "}
                        <code className="ml-1 font-mono text-[0.85rem] text-ink-dim">{g.key}</code>
                      </dt>
                      <dd>
                        <span className="text-ink">{m.reading}</span> {help.reads}
                      </dd>
                      <dd>
                        <span className="text-ink">{m.changing}</span> {help.changes}
                      </dd>
                    </div>
                  )
                )
              })}
            </dl>
          </>
        )}
      </Dialog>
    </>
  )
}
