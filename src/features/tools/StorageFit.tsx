import { findTool, ownerId } from "@/domain/catalog"
import { type Fit, fitSeverity, summarize } from "@/domain/compat"
import { isNewer } from "@/domain/status"
import { Button } from "@/ui/Button"
import { Lamp } from "@/ui/Lamp"
import { useTools } from "./store"
import { useFits } from "./useFits"

const nameOf = (id: string) => findTool(id)?.name ?? id
export const namesOf = (ids: readonly string[]) =>
  new Intl.ListFormat("en", { type: "conjunction" }).format(ids.map(nameOf))

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

/**
 * What the row says in place of its tagline when storage needs attention; null when it does not.
 * `canUpdate` is null while npm has not said whether a newer version exists.
 */
export function fitLine(fit: Fit | undefined, id: string, canUpdate: boolean | null): string | null {
  if (fit?.kind === "cannot_read") {
    const schema = fit.schema === null ? "" : ` (schema ${fit.schema})`
    const next = canUpdate === null ? "" : canUpdate ? ` Update ${nameOf(id)}.` : " No newer version is out yet."
    return `Can't read storage${schema}.${next}`
  }
  if (fit?.kind === "upgrades" && fit.locksOut.length > 0)
    return `Its next run moves storage to schema ${fit.to}; ${namesOf(fit.locksOut)} will stop reading it.`
  return null
}

export function fitLabel(fit: Fit | undefined): string | null {
  if (fit?.kind === "cannot_read") return "Can't read storage"
  if (fit?.kind === "upgrades" && fit.locksOut.length > 0) return "Will move storage past what other tools read"
  if (fit?.kind === "unknown") return "Can't say whether it reads storage"
  return null
}

function detailOf(fit: Fit, id: string, schema: number | null, canUpdate: boolean | null): string {
  const name = nameOf(id)
  switch (fit.kind) {
    case "reads":
      return schema === null ? "Reads storage. There is no storage file yet." : `Reads storage (schema ${schema}).`
    case "unknown":
      return `This version of ${name} can't say whether it reads storage. ${canUpdate ? `Updating ${name} adds the check.` : "A later version adds the check."}`
    case "upgrades":
      if (fit.locksOut.length > 0)
        return `The next time ${name} runs, it moves storage to schema ${fit.to}; reading it will take schema ${fit.minCompatible} or later. ${namesOf(fit.locksOut)} read only older schemas and will stop reading storage. Update them first.`
      return fit.minCompatible === null
        ? `Reads storage, and moves it to schema ${fit.to} when it next runs.`
        : `Reads storage, and moves it to schema ${fit.to} when it next runs. Every other installed tool can read that.`
    case "cannot_read": {
      const written =
        fit.schema === null
          ? `Storage needs a tool that reads schema ${fit.needs} or later`
          : `A newer WireCat tool moved storage to schema ${fit.schema}; reading it takes schema ${fit.needs} or later`
      const reads = fit.speaks === null ? "" : `, and this ${name} reads up to ${fit.speaks}`
      const next =
        canUpdate === null ? "" : canUpdate ? ` Update ${name} to read it again.` : ` No newer ${name} is out yet.`
      return `${written}${reads}.${next}`
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
  if (!fits || !fit) return null
  const tone = fitSeverity(fit) ?? (fit.kind === "unknown" ? "idle" : "ok")
  return (
    <div>
      <h4 className="mb-2 text-[0.9rem] font-medium text-ink-dim">Storage</h4>
      <p className="flex items-start gap-2 text-[0.9rem] text-ink-soft">
        <Lamp size="sm" tone={tone} />
        <span className="-mt-[0.2rem] max-w-[60ch]">{detailOf(fit, owner, fits.schema, canUpdate)}</span>
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
  if (!fits || Object.keys(fits.all).length === 0) return null
  const quiet = unknown.length > 0 ? ` ${namesOf(unknown)} can't say yet; a newer version adds the check.` : ""
  if (cannotRead.length === 0)
    return (
      <p className="flex items-center gap-2 text-[0.9rem] text-ink-soft">
        <Lamp size="sm" tone="ok" />
        <span>All installed tools can read storage.{quiet}</span>
      </p>
    )
  const count = cannotRead.length === 1 ? "1 tool needs" : `${cannotRead.length} tools need`
  return (
    <div
      role="status"
      className="flex min-h-[calc(3.25rem+2px)] items-center justify-between gap-4 rounded-[0.2rem] border border-warn/40 bg-warn/10 px-4 py-2.5 text-[0.95rem]"
    >
      {/* The button arrives once the latest versions are known: beside the text and at a height kept from the start,
          it adds no height of its own. */}
      <p className="min-w-0">
        {count} an update to read storage: {namesOf(cannotRead)}.
        {known && updatable.length === 0 && " No newer versions are out yet."}
        {quiet}
      </p>
      {updatable.length > 0 && (
        <Button
          size="sm"
          onClick={() => {
            for (const id of updatable) useTools.getState().install(id)
          }}
        >
          {updatable.length === 1 ? `Update ${nameOf(updatable[0] ?? "")}` : "Update them"}
        </Button>
      )}
    </div>
  )
}
