import { useState } from "react"
import type { ProgramState } from "@/platform/schemas"
import { Button } from "@/ui/Button"
import { Dialog } from "@/ui/Dialog"
import { Lamp } from "@/ui/Lamp"
import { ManagedNode } from "./ManagedNode"
import { useSystem } from "./store"

function Item({
  label,
  program,
  suffix,
}: {
  label: string
  program: ProgramState | null
  suffix?: string | undefined
}) {
  const tone = !program ? "idle" : program.ok ? "ok" : "bad"
  const text = !program ? label : program.version ? `${label} ${program.version}` : `${label} missing`
  return (
    <span className="flex items-center gap-2" title={program?.problem ?? program?.path ?? undefined}>
      <Lamp size="sm" tone={tone} />
      <span className="font-mono">{text}</span>
      {suffix && <span className="text-ink-soft">{suffix}</span>}
    </span>
  )
}

export function ReadinessStrip() {
  const r = useSystem((s) => s.readiness)
  const [open, setOpen] = useState(false)
  const managed = r?.managed ?? null
  const node = <Item label="Node.js" program={r?.node ?? null} suffix={managed?.active ? "(WireCat)" : undefined} />
  return (
    <section aria-label="Your computer" className="flex min-w-0 items-center gap-[2rem] text-[0.98rem]">
      <h2 className="shrink-0 font-medium">Your computer</h2>
      <ul className="flex min-w-0 items-center gap-[2rem] overflow-hidden whitespace-nowrap text-ink">
        <li className="flex items-center gap-2">
          <Lamp size="sm" tone={r ? "ok" : "idle"} />
          <span className="font-mono">{r ? r.os : "…"}</span>
        </li>
        <li>
          {managed ? (
            <button
              type="button"
              onClick={() => setOpen(true)}
              aria-label={`Node.js ${r?.node.version ?? ""}${managed.active ? ", set up by WireCat" : ""}: settings`}
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
        title="WireCat's Node.js"
        onClose={() => setOpen(false)}
        actions={
          <Button variant="ghost" onClick={() => setOpen(false)}>
            Close
          </Button>
        }
      >
        <ManagedNode />
      </Dialog>
    </section>
  )
}
