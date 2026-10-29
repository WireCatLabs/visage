import { create } from "zustand"
import { findTool, ownerId, runTool, tools } from "@/domain/catalog"
import { cliCommand, NO_COMMAND_HIDDEN, type RangeId, type Run } from "@/domain/runs"
import { platform } from "@/platform/bridge"
import type { RunDetail, RunItem } from "@/platform/runs-schemas"
import { useTools } from "../tools/store"

/** Runs fetched per tool and page: about a month of a busy tool's failures. */
export const PAGE = 500

/**
 * `answer`: how long a round waits for the slowest tool before it shows what arrived.
 * `live`: the pause between live rounds; each round starts one process per tool, so it is not shorter.
 */
export const timing = { answer: 8000, live: 5000 }

/**
 * `update`: the installed version predates its `runs` commands; the next release of the tool brings them.
 * `late`: it did not answer within `timing.answer`; the runs shown are from its last answer, if any.
 */
export type SourceState = "loading" | "ready" | "error" | "missing" | "none" | "update" | "late"
export type Source = {
  id: string
  state: SourceState
  runs: Run[]
  hasMore: boolean
  pages: number
  error: string | null
}
export type Detail = { state: "loading" | "ready" | "error"; item: RunDetail["item"] | null; error: string | null }

/**
 * Whether a tool keeps successful runs too: its `record` setting in the defaults every profile gets. `everyByDefault`:
 * the tool keeps every run unless `record` is false (cli-core with `keep_successful_runs_for_days`); an older one keeps
 * failed runs only unless `record` is true, and there `record: false` stops keeping failures too.
 */
export type Keeping =
  | { state: "loading" }
  /** `error` null: the tool reports no `record` setting at all. */
  | { state: "error"; error: string | null }
  | {
      state: "ready"
      record: boolean
      /** Why the defaults cannot change it here (an environment variable, a profile named "default"). */
      locked: string | null
      everyByDefault: boolean
      /** How long failed runs are kept; on older tools every kept run. */
      days: number | null
      successDays: number | null
      saving: boolean
      error: string | null
    }

type LogsState = {
  /** The last snapshot: every tool's answer to one round, shown at once. */
  sources: Record<string, Source>
  keeping: Record<string, Keeping>
  /** When the snapshot was taken; null until the first round ends. */
  loadedAt: number | null
  /** A live round's snapshot adds runs under the reader instead of replacing the table. */
  liveRound: boolean
  /** Tools the running round still waits for, and how many it asked. */
  reading: string[]
  asked: number
  live: boolean
  query: string
  range: RangeId
  groupBy: string | null
  expanded: string | null
  details: Record<string, Detail>
  load(opts?: { live?: boolean }): Promise<void>
  setLive(on: boolean): void
  loadMore(id: string): Promise<void>
  setRecord(id: string, on: boolean): Promise<void>
  setQuery(query: string): void
  setRange(range: RangeId): void
  setGroupBy(field: string | null): void
  toggle(key: string, run: Run): void
}

const message = (e: unknown) => {
  const text = e instanceof Error ? e.message : String(e)
  // A tool's JSON error that reached here unread still has a plain message inside.
  if (!text.startsWith("{")) return text
  try {
    const inner = (JSON.parse(text) as { error?: { message?: unknown } }).error?.message
    return typeof inner === "string" ? inner : text
  } catch {
    return text
  }
}
// Every older zm, drive and memo refuses `runs list` with a validation_error whose message starts this way.
const tooOld = (error: string) => /^unknown command '(runs|list)'/.test(error)
export const runKey = (run: Pick<Run, "tool" | "run_id">) => `${run.tool}:${run.run_id}`
const toRun = (tool: string) => {
  const bin = findTool(tool)?.bin ?? tool
  return (item: RunItem): Run => ({
    ...item,
    tool: runTool(tool, item.command),
    // Newer CLIs record the command with their own name; older ones only the words after it.
    cli_command:
      typeof item.cli_command === "string" && item.cli_command ? item.cli_command : cliCommand(bin, item.command),
  })
}

function initialState(id: string): SourceState {
  const tool = tools.find((t) => t.id === id)
  if (!tool?.runs) return "none"
  const installs = useTools.getState().installs[id]
  return installs && installs.length === 0 ? "missing" : "loading"
}

// Turning it back off removes the setting, so a tool without `config unset` is not offered the switch.
export const canKeepEveryRun = (id: string) => {
  const settings = findTool(id)?.settings
  return Boolean(settings?.defaults && settings.unset)
}

/** Every source and keeping row the catalog knows of, before anything is read. */
export function fromCatalog(): Pick<LogsState, "sources" | "keeping"> {
  const sources = Object.fromEntries(
    // A part's runs come from its owner's source and are filed under the part by `runTool`.
    tools
      .filter((t) => !t.partOf)
      .map((t) => [
        t.id,
        { id: t.id, state: initialState(t.id), runs: [], hasMore: false, pages: 0, error: null } satisfies Source,
      ]),
  )
  const keeping = Object.fromEntries(
    Object.values(sources)
      .filter((s) => s.state === "loading" && canKeepEveryRun(s.id))
      .map((s) => [s.id, { state: "loading" } satisfies Keeping]),
  )
  return { sources, keeping }
}

// load() starts in an effect, after the first paint; until it has run the page shows what it is about to fill.
// Built once, so the selector keeps returning the same object and the store does not re-render in a loop.
let firstFrame: Pick<LogsState, "sources" | "keeping"> | undefined
export const useShownLogs = <T>(pick: (s: Pick<LogsState, "sources" | "keeping">) => T): T =>
  useLogs((s) => {
    if (Object.keys(s.sources).length) return pick(s)
    firstFrame ??= fromCatalog()
    return pick(firstFrame)
  })

const withOlder = (fresh: Run[], old: Run[]) => {
  const known = new Set(fresh.map(runKey))
  return [...fresh, ...old.filter((r) => !known.has(runKey(r)))]
}

export const useLogs = create<LogsState>((set, get) => {
  let running: Promise<void> | null = null
  let round = 0
  const patch = (id: string, f: (s: Source) => Partial<Source>) =>
    set((st) => {
      const s = st.sources[id]
      return s ? { sources: { ...st.sources, [id]: { ...s, ...f(s) } } } : {}
    })
  const keep = (id: string, k: Keeping) => set((st) => ({ keeping: { ...st.keeping, [id]: k } }))

  const fetchPage = async (id: string, page: number): Promise<Partial<Source>> => {
    try {
      const res = await platform.listRuns(id, null, PAGE, page)
      return { state: "ready", runs: res.items.map(toRun(id)), hasMore: res.page.has_more, pages: page, error: null }
    } catch (e) {
      const error = message(e)
      return tooOld(error) ? { state: "update", error: null } : { state: "error", error }
    }
  }

  // A tool slower than `timing.answer` is still running when the next round starts (Rust allows it 30 s); that round
  // waits for the same answer instead of starting a second process for it.
  const pending = new Map<string, Promise<Partial<Source>>>()
  const firstPage = (tool: string) => {
    let answer = pending.get(tool)
    if (!answer) {
      answer = fetchPage(tool, 1).finally(() => pending.delete(tool))
      pending.set(tool, answer)
    }
    return answer
  }

  // Every tool's answer is collected first and shown in one step, so rows on screen do not move as each tool answers.
  const readRound = async (live: boolean) => {
    const id = ++round
    const fresh = fromCatalog()
    const ids = Object.values(fresh.sources)
      .filter((s) => s.state === "loading")
      .map((s) => s.id)
    // A live round stays quiet: no progress, no placeholders, the keeping rows are not read again.
    if (!live)
      set({
        reading: ids,
        asked: ids.length,
        keeping: fresh.keeping,
        ...(get().loadedAt === null ? { sources: fresh.sources } : {}),
      })
    const answers: Record<string, Partial<Source>> = {}
    const asking = ids.map(async (tool) => {
      answers[tool] = await firstPage(tool)
      if (round === id && !live) set((st) => ({ reading: st.reading.filter((r) => r !== tool) }))
    })
    const keepingRead = live ? [] : Object.keys(fresh.keeping).map((k) => readKeeping(k))
    let timer: ReturnType<typeof setTimeout> | undefined
    await Promise.race([
      Promise.all(asking),
      new Promise<void>((r) => {
        timer = setTimeout(r, timing.answer)
      }),
    ])
    clearTimeout(timer)
    // A live round keeps what "Load older" added; a read the owner asked for starts again from page one.
    const base = live ? get().sources : fresh.sources
    const sources = Object.fromEntries(
      Object.values(fresh.sources).map((f): [string, Source] => {
        if (f.state !== "loading") return [f.id, f]
        const s = base[f.id] ?? f
        const a = answers[f.id]
        if (!a) return [f.id, { ...s, state: "late", error: null }]
        if (a.state !== "ready" || !(live && s.pages > 1)) return [f.id, { ...s, ...a }]
        return [f.id, { ...s, ...a, runs: withOlder(a.runs ?? [], s.runs), pages: s.pages, hasMore: s.hasMore }]
      }),
    )
    set({ sources, loadedAt: Date.now(), liveRound: live, reading: [], ...(live ? {} : { details: {} }) })
    await Promise.all(keepingRead)
  }

  const readKeeping = async (id: string, error: string | null = null) => {
    try {
      const { rows } = await platform.settingsShow(id, null)
      const record = rows.find((r) => r.key === "record")
      const days = rows.find((r) => r.key === "keep_runs_for_days")?.value
      const success = rows.find((r) => r.key === "keep_successful_runs_for_days")
      if (!record) {
        keep(id, { state: "error", error: null })
        return
      }
      keep(id, {
        state: "ready",
        record: record.value === true,
        locked: record.locked,
        everyByDefault: success !== undefined,
        days: typeof days === "number" ? days : null,
        successDays: typeof success?.value === "number" ? success.value : null,
        saving: false,
        error,
      })
    } catch (e) {
      keep(id, { state: "error", error: message(e) })
    }
  }

  return {
    sources: {},
    keeping: {},
    loadedAt: null,
    liveRound: false,
    reading: [],
    asked: 0,
    live: false,
    query: NO_COMMAND_HIDDEN,
    range: "30d",
    groupBy: null,
    expanded: null,
    details: {},

    // A round already running answers every caller, so a live tick never overlaps "Read again".
    load({ live = false } = {}) {
      running ??= readRound(live).finally(() => {
        running = null
      })
      return running
    },

    setLive: (live) => set({ live }),

    async loadMore(id) {
      const s = get().sources[id]
      if (!s?.hasMore || s.state === "loading") return
      patch(id, () => ({ state: "loading" }))
      const a = await fetchPage(id, s.pages + 1)
      patch(id, (cur) => (a.state === "ready" ? { ...a, runs: [...cur.runs, ...(a.runs ?? [])] } : a))
    },

    async setRecord(id, on) {
      const k = get().keeping[id]
      if (k?.state !== "ready" || k.locked) return
      keep(id, { ...k, saving: true, error: null })
      let error: string | null = null
      try {
        // Whichever value is the tool's default is reached by removing the setting, so the defaults stay clean.
        if (on === k.everyByDefault) await platform.settingsUnset(id, null, true, "record")
        else await platform.settingsSet(id, null, true, "record", String(on))
      } catch (e) {
        error = message(e)
      }
      // Show what the tool now reports, not what was asked for.
      await readKeeping(id, error)
    },

    setQuery: (query) => set({ query }),
    setRange: (range) => set({ range }),
    setGroupBy: (groupBy) => set({ groupBy }),

    toggle(key, run) {
      if (get().expanded === key) {
        set({ expanded: null })
        return
      }
      set({ expanded: key })
      const known = get().details[key]
      if (known && known.state !== "error") return
      set((st) => ({ details: { ...st.details, [key]: { state: "loading", item: null, error: null } } }))
      platform.showRun(ownerId(run.tool), run.run_id).then(
        (d) => set((st) => ({ details: { ...st.details, [key]: { state: "ready", item: d.item, error: null } } })),
        (e) => set((st) => ({ details: { ...st.details, [key]: { state: "error", item: null, error: message(e) } } })),
      )
    },
  }
})
