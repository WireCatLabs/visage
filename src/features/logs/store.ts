import { create } from "zustand"
import { findTool, tools } from "@/domain/catalog"
import { cliCommand, type RangeId, type Run } from "@/domain/runs"
import { platform } from "@/platform/bridge"
import type { RunDetail, RunItem } from "@/platform/runs-schemas"
import { useTools } from "../tools/store"

/** Runs fetched per tool and page: about a month of a busy tool's failures. */
export const PAGE = 500

export type SourceState = "loading" | "ready" | "error" | "missing" | "none"
export type Source = {
  id: string
  state: SourceState
  runs: Run[]
  hasMore: boolean
  pages: number
  error: string | null
}
export type Detail = { state: "loading" | "ready" | "error"; item: RunDetail["item"] | null; error: string | null }

/** Whether a tool keeps successful runs too: its `record` setting in the defaults every profile gets. */
export type Keeping =
  | { state: "loading" }
  | { state: "error"; error: string }
  | {
      state: "ready"
      record: boolean
      /** Why the defaults cannot change it here (an environment variable, a profile named "default"). */
      locked: string | null
      days: number | null
      saving: boolean
      error: string | null
    }

type LogsState = {
  sources: Record<string, Source>
  keeping: Record<string, Keeping>
  loadedAt: number
  query: string
  range: RangeId
  groupBy: string | null
  expanded: string | null
  details: Record<string, Detail>
  load(): Promise<void>
  loadMore(id: string): Promise<void>
  setRecord(id: string, on: boolean): Promise<void>
  setQuery(query: string): void
  setRange(range: RangeId): void
  setGroupBy(field: string | null): void
  toggle(key: string, run: Run): void
}

const message = (e: unknown) => (e instanceof Error ? e.message : String(e))
export const runKey = (run: Pick<Run, "tool" | "run_id">) => `${run.tool}:${run.run_id}`
const toRun = (tool: string) => {
  const bin = findTool(tool)?.bin ?? tool
  return (item: RunItem): Run => ({ ...item, tool, cli_command: cliCommand(bin, item.command) })
}

function initialState(id: string): SourceState {
  const tool = tools.find((t) => t.id === id)
  if (!tool?.runs) return "none"
  const installs = useTools.getState().installs[id]
  return installs && installs.length === 0 ? "missing" : "loading"
}

export const canKeepEveryRun = (id: string) => Boolean(findTool(id)?.settings?.defaults)

export const useLogs = create<LogsState>((set, get) => {
  const patch = (id: string, f: (s: Source) => Partial<Source>) =>
    set((st) => {
      const s = st.sources[id]
      return s ? { sources: { ...st.sources, [id]: { ...s, ...f(s) } } } : {}
    })
  const keep = (id: string, k: Keeping) => set((st) => ({ keeping: { ...st.keeping, [id]: k } }))

  const fetchPage = async (id: string, page: number) => {
    try {
      const res = await platform.listRuns(id, null, PAGE, page)
      patch(id, (s) => ({
        state: "ready",
        runs: page === 1 ? res.items.map(toRun(id)) : [...s.runs, ...res.items.map(toRun(id))],
        hasMore: res.page.has_more,
        pages: page,
        error: null,
      }))
    } catch (e) {
      patch(id, () => ({ state: "error", error: message(e) }))
    }
  }

  const readKeeping = async (id: string, error: string | null = null) => {
    try {
      const { rows } = await platform.settingsShow(id, null)
      const record = rows.find((r) => r.key === "record")
      const days = rows.find((r) => r.key === "keep_runs_for_days")?.value
      if (!record) {
        keep(id, { state: "error", error: "The tool does not report a record setting." })
        return
      }
      keep(id, {
        state: "ready",
        record: record.value === true,
        locked: record.locked,
        days: typeof days === "number" ? days : null,
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
    loadedAt: Date.now(),
    query: "",
    range: "30d",
    groupBy: null,
    expanded: null,
    details: {},

    async load() {
      const sources = Object.fromEntries(
        tools.map((t) => [
          t.id,
          { id: t.id, state: initialState(t.id), runs: [], hasMore: false, pages: 0, error: null } satisfies Source,
        ]),
      )
      const reading = Object.values(sources).filter((s) => s.state === "loading")
      const keeping = Object.fromEntries(
        reading.filter((s) => canKeepEveryRun(s.id)).map((s) => [s.id, { state: "loading" } satisfies Keeping]),
      )
      set({ sources, keeping, loadedAt: Date.now(), details: {} })
      await Promise.all([
        ...reading.map((s) => fetchPage(s.id, 1)),
        ...Object.keys(keeping).map((id) => readKeeping(id)),
      ])
    },

    async loadMore(id) {
      const s = get().sources[id]
      if (!s?.hasMore || s.state === "loading") return
      patch(id, () => ({ state: "loading" }))
      await fetchPage(id, s.pages + 1)
    },

    async setRecord(id, on) {
      const k = get().keeping[id]
      if (k?.state !== "ready" || k.locked) return
      keep(id, { ...k, saving: true, error: null })
      let error: string | null = null
      try {
        await platform.settingsSet(id, null, true, "record", on ? "true" : "false")
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
      platform.showRun(run.tool, run.run_id).then(
        (d) => set((st) => ({ details: { ...st.details, [key]: { state: "ready", item: d.item, error: null } } })),
        (e) => set((st) => ({ details: { ...st.details, [key]: { state: "error", item: null, error: message(e) } } })),
      )
    },
  }
})
