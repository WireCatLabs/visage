import { useState } from "react"
import { useMessages } from "@/i18n"
import type { ProgramState } from "@/platform/schemas"
import { Button } from "@/ui/Button"
import { Dialog } from "@/ui/Dialog"
import { Lamp } from "@/ui/Lamp"
import { Skeleton } from "@/ui/Skeleton"
import { ManagedNode } from "./ManagedNode"
import { systemMessages } from "./messages"
import { useSystem } from "./store"

// "24.19.0": the usual length, so the strip does not move when real versions replace the placeholders.
const VERSION_CHARS = 7

function Item({
  label,
  program,
  suffix,
}: {
  label: string
  program: ProgramState | null
  suffix?: string | undefined
}) {
  const m = useMessages(systemMessages)
  const tone = !program ? "idle" : program.ok ? "ok" : "bad"
  const text = !program ? label : program.version ? `${label} ${program.version}` : m.missing(label)
  return (
    <span className="flex items-center gap-2" title={program?.problem ?? program?.path ?? undefined}>
      <Lamp size="sm" tone={tone} />
      <span className="font-mono">
        {text}
        {!program && (
          <>
            {" "}
            <Skeleton chars={VERSION_CHARS} />
          </>
        )}
      </span>
      {suffix && <span className="text-ink-soft">{suffix}</span>}
    </span>
  )
}

export function ReadinessStrip() {
  const r = useSystem((s) => s.readiness)
  const [open, setOpen] = useState(false)
  const m = useMessages(systemMessages)
  const managed = r?.managed ?? null
  const node = <Item label="Node.js" program={r?.node ?? null} suffix={managed?.active ? "(WireCat)" : undefined} />
  return (
    <section aria-label={m.yourComputer} className="flex min-w-0 items-center gap-[2rem] text-[0.98rem]">
      <h2 className="shrink-0 font-medium">{m.yourComputer}</h2>
      <ul className="flex min-w-0 items-center gap-[2rem] overflow-hidden whitespace-nowrap text-ink">
        <li className="flex items-center gap-2">
          <Lamp size="sm" tone={r ? "ok" : "idle"} />
          <span className="font-mono">{r ? r.os : <Skeleton chars={5} label={m.checking} />}</span>
        </li>
        <li>
          {managed ? (
            <button
              type="button"
              onClick={() => setOpen(true)}
              aria-label={m.nodeSettings(r?.node.version ?? "", managed.active)}
              className="-mx-1.5 rounded-[0.35rem] px-1.5 py-0.5 transition-colors duration-150 hover:bg-app-3"
            >
              {node}
            </button>
          ) : (
            node
          )}
        </li>
        <li>
          <Item label="npm" program={r?.npm ?? null} />
        </li>
      </ul>
      <Dialog
        open={open}
        wide
        title={m.nodeDialog}
        onClose={() => setOpen(false)}
        actions={
          <Button variant="ghost" data-autofocus onClick={() => setOpen(false)}>
            {m.close}
          </Button>
        }
      >
        <ManagedNode />
      </Dialog>
    </section>
  )
}
