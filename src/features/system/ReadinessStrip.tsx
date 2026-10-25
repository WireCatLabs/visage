import type { ProgramState } from "@/platform/schemas"
import { Lamp } from "@/ui/Lamp"
import { useSystem } from "./store"

function Item({ label, program }: { label: string; program: ProgramState | null }) {
  const tone = !program ? "idle" : program.ok ? "ok" : "bad"
  const text = !program ? label : program.version ? `${label} ${program.version}` : `${label} missing`
  return (
    <li className="flex items-center gap-2" title={program?.problem ?? program?.path ?? undefined}>
      <Lamp size="sm" tone={tone} />
      <span className="font-mono">{text}</span>
    </li>
  )
}

export function ReadinessStrip() {
  const r = useSystem((s) => s.readiness)
  return (
    <section aria-label="Your computer" className="flex min-w-0 items-center gap-[2rem] text-[0.98rem]">
      <h2 className="shrink-0 font-medium">Your computer</h2>
      <ul className="flex min-w-0 items-center gap-[2rem] overflow-hidden whitespace-nowrap text-ink">
        <li className="flex items-center gap-2">
          <Lamp size="sm" tone={r ? "ok" : "idle"} />
          <span className="font-mono">{r ? r.os : "…"}</span>
        </li>
        <Item label="Node.js" program={r?.node ?? null} />
        <Item label="npm" program={r?.npm ?? null} />
      </ul>
    </section>
  )
}
