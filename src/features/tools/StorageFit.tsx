import { findTool, ownerId } from "@/domain/catalog"
import { type Fit, fitSeverity, summarize } from "@/domain/compat"
import { isNewer } from "@/domain/status"
import { formatList, useMessages } from "@/i18n"
import { Button } from "@/ui/Button"
import { Lamp } from "@/ui/Lamp"
import { type ToolsText, toolsMessages } from "./messages"
import { useTools } from "./store"
import { useFits } from "./useFits"

const nameOf = (id: string) => findTool(id)?.name ?? id
/** Follows the chosen language; a component that shows it reads its messages, so a switch re-renders it. */
export const namesOf = (ids: readonly string[]) => formatList(ids.map(nameOf))

/** Whether npm has answered at all: until it has, "no newer version" would be a guess. */
export const useLatestKnown = () => useTools((s) => s.latest !== null && Object.keys(s.latest).length > 0)

/** Ids among `ids` that npm has a newer version of, so updating can help. */
export function useUpdatable(ids: readonly string[]): string[] {
  const latest = useTools((s) => s.latest)
  const installs = useTools((s) => s.installs)
  return ids.filter((id) => {
    const newest = latest?.[id]
    const current = installs[id]?.[0]?.version
    return Boolean(newest && current && isNewer(newest, current))
  })
}

type Words = ToolsText["storage"]

/**
 * What the row says in place of its tagline when storage needs attention; null when it does not.
 * `canUpdate` is null while npm has not said whether a newer version exists.
 */
export function fitLine(fit: Fit | undefined, id: string, canUpdate: boolean | null, m: Words): string | null {
  if (fit?.kind === "cannot_read") {
    const next = canUpdate === null ? null : canUpdate ? m.updateName(nameOf(id)) : m.noNewer
    return [m.cannotRead(fit.schema), next].filter(Boolean).join(" ")
  }
  if (fit?.kind === "upgrades" && fit.locksOut.length > 0) return m.moves(fit.to, namesOf(fit.locksOut))
  return null
}

export function fitLabel(fit: Fit | undefined, m: Words): string | null {
  if (fit?.kind === "cannot_read") return m.labelCannotRead
  if (fit?.kind === "upgrades" && fit.locksOut.length > 0) return m.labelMoves
  if (fit?.kind === "unknown") return m.labelUnknown
  return null
}

function detailOf(fit: Fit, id: string, schema: number | null, canUpdate: boolean | null, m: Words): string {
  const name = nameOf(id)
  switch (fit.kind) {
    case "reads":
      return schema === null ? m.readsNoFile : m.reads(schema)
    case "unknown":
      return m.unknown(name, Boolean(canUpdate))
    case "upgrades":
      if (fit.locksOut.length > 0) return m.locksOut(name, fit.to, fit.minCompatible, namesOf(fit.locksOut))
      return fit.minCompatible === null ? m.movesAlone(fit.to) : m.movesAll(fit.to)
    case "cannot_read": {
      const next = canUpdate === null ? null : canUpdate ? m.updateToRead(name) : m.noNewerOf(name)
      return [m.behind(fit.schema, fit.needs, fit.speaks, name), next].filter(Boolean).join(" ")
    }
  }
}

/** The Storage block in a tool's Manage panel. */
export function FitDetails({ id }: { id: string }) {
  const owner = ownerId(id)
  const fits = useFits()
  const known = useLatestKnown()
  const updatable = useUpdatable([owner]).length > 0
  const canUpdate = known ? updatable : null
  const fit = fits?.all[owner]
  const m = useMessages(toolsMessages).storage
  if (!fits || !fit) return null
  const tone = fitSeverity(fit) ?? (fit.kind === "unknown" ? "idle" : "ok")
  return (
    <div>
      <h4 className="mb-2 text-[0.9rem] font-medium text-ink-dim">{m.heading}</h4>
      <p className="flex items-start gap-2 text-[0.9rem] text-ink-soft">
        <Lamp size="sm" tone={tone} />
        <span className="-mt-[0.2rem] max-w-[60ch]">{detailOf(fit, owner, fits.schema, canUpdate, m)}</span>
      </p>
    </div>
  )
}

/** One line for the whole machine: whether every installed tool reads storage, and the update that fixes it. */
export function StorageSummary() {
  const fits = useFits()
  const { cannotRead, unknown } = summarize(fits?.all ?? {})
  const updatable = useUpdatable(cannotRead)
  const known = useLatestKnown()
  const m = useMessages(toolsMessages).storage
  if (!fits || Object.keys(fits.all).length === 0) return null
  const quiet = unknown.length > 0 ? ` ${m.cantSayYet(unknown.length, namesOf(unknown))}` : ""
  if (cannotRead.length === 0)
    return (
      <p className="flex items-center gap-2 text-[0.9rem] text-ink-soft">
        <Lamp size="sm" tone="ok" />
        <span>
          {m.allRead}
          {quiet}
        </span>
      </p>
    )
  return (
    <div
      role="status"
      className="flex min-h-[calc(3.25rem+2px)] items-center justify-between gap-4 rounded-[0.2rem] border border-warn/40 bg-warn/10 px-4 py-2.5 text-[0.95rem]"
    >
      {/* The button arrives once the latest versions are known: beside the text and at a height kept from the start,
          it adds no height of its own. */}
      <p className="min-w-0">
        {m.needUpdate(cannotRead.length, namesOf(cannotRead))}
        {known && updatable.length === 0 && ` ${m.noNewerVersions}`}
        {quiet}
      </p>
      {updatable.length > 0 && (
        <Button
          size="sm"
          onClick={() => {
            for (const id of updatable) useTools.getState().install(id)
          }}
        >
          {updatable.length === 1 ? m.updateOne(nameOf(updatable[0] ?? "")) : m.updateThem}
        </Button>
      )}
    </div>
  )
}
