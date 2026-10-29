export type Schema = { version: number; minCompatible: number }

/** One installed package's own `store info`, as Rust read it. */
export type ToolView = {
  id: string
  outcome: "answered" | "unknown" | "failed"
  speaks: number | null
  writable: boolean | null
  reason: string | null
  upgrade: Schema | null
  file: Schema | null
  exists: boolean | null
  problem: string | null
}

export type Client = { command: string; version: string; speaks: number }

export type StoreCompat = { tools: ToolView[]; clients: Client[] }

/** The installed copy of a tool: its command word and version, to find it in the store's own list of clients. */
export type Installed = { bin: string; version: string | null }

export type Fit =
  | { kind: "reads" }
  /** `minCompatible` is null when the tool is too old to say what its run leaves behind. */
  | { kind: "upgrades"; to: number; minCompatible: number | null; locksOut: string[] }
  | { kind: "cannot_read"; schema: number | null; needs: number; speaks: number | null }
  | { kind: "unknown" }

export type Refusal = { schema: number | null; needs: number; speaks: number | null }

/** cli-core's two refusals: a write-open's "written by a newer version" and a read-only open's "requires schema". */
export function parseRefusal(text: string | null): Refusal | null {
  if (!text) return null
  const newer = /written by a newer version \(schema (\d+), needs at least (\d+)(?:; this one speaks (\d+))?/.exec(text)
  if (newer) return { schema: Number(newer[1]), needs: Number(newer[2]), speaks: newer[3] ? Number(newer[3]) : null }
  const requires = /requires schema (\d+), but this tool supports (\d+)/.exec(text)
  if (requires) return { schema: null, needs: Number(requires[1]), speaks: Number(requires[2]) }
  return null
}

/** The file as the tool that reads the newest schema saw it; a refusal's numbers when no tool could read it. */
export function storeFile(compat: StoreCompat): (Schema & { exists: boolean }) | null {
  const answered = compat.tools
    .filter((t) => t.outcome === "answered" && t.exists !== null)
    .sort((a, b) => (b.speaks ?? 0) - (a.speaks ?? 0))[0]
  if (answered?.exists === false) return { version: 0, minCompatible: 0, exists: false }
  // A file that is there but did not open says nothing about which tools read it.
  if (answered) return answered.file ? { ...answered.file, exists: true } : null
  for (const t of compat.tools) {
    const refusal = parseRefusal(t.problem)
    if (refusal?.schema != null) return { version: refusal.schema, minCompatible: refusal.needs, exists: true }
  }
  return null
}

function speaksOf(view: ToolView, installed: Installed | undefined, clients: Client[]): number | null {
  if (view.speaks !== null) return view.speaks
  const recorded = clients.find((c) => c.command === installed?.bin && c.version === installed?.version)
  return recorded?.speaks ?? parseRefusal(view.problem)?.speaks ?? null
}

const reads = (file: Schema, speaks: number) => file.version <= speaks || file.minCompatible <= speaks

/** Per installed tool: whether it reads the shared store now, and whom its next run would lock out. */
export function fits(compat: StoreCompat, installed: Record<string, Installed>): Record<string, Fit> {
  const file = storeFile(compat)
  const speaks = Object.fromEntries(compat.tools.map((t) => [t.id, speaksOf(t, installed[t.id], compat.clients)]))
  const readsNow = (id: string) => {
    const s = speaks[id]
    return s != null && file !== null && (!file.exists || reads(file, s))
  }
  const fitOf = (view: ToolView): Fit => {
    const refusal = view.outcome === "failed" ? parseRefusal(view.problem) : null
    if (refusal) return { kind: "cannot_read", ...refusal }
    const own = speaks[view.id]
    if (own == null || file === null) return { kind: "unknown" }
    if (!file.exists) return { kind: "reads" }
    if (!(view.writable ?? reads(file, own)))
      return { kind: "cannot_read", schema: file.version, needs: file.minCompatible, speaks: own }
    if (own <= file.version) return { kind: "reads" }
    const minCompatible = view.upgrade?.minCompatible ?? null
    const locksOut =
      minCompatible === null
        ? []
        : compat.tools
            .map((t) => t.id)
            .filter((id) => id !== view.id && readsNow(id) && (speaks[id] ?? 0) < minCompatible)
    return { kind: "upgrades", to: view.upgrade?.version ?? own, minCompatible, locksOut }
  }
  return Object.fromEntries(compat.tools.map((t) => [t.id, fitOf(t)]))
}

export type FitSummary = { cannotRead: string[]; unknown: string[] }

export function summarize(all: Record<string, Fit>): FitSummary {
  const ids = (kind: Fit["kind"]) =>
    Object.entries(all)
      .filter(([, f]) => f.kind === kind)
      .map(([id]) => id)
  return { cannotRead: ids("cannot_read"), unknown: ids("unknown") }
}

/** Only a run that strands another tool is worth a warning; reading the store is not. */
export function fitSeverity(fit: Fit | undefined): "bad" | "warn" | null {
  if (fit?.kind === "cannot_read") return "bad"
  if (fit?.kind === "upgrades" && fit.locksOut.length > 0) return "warn"
  return null
}
