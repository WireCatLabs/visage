import { create } from "zustand"
import { findTool, type SettingsSource } from "@/domain/catalog"
import { platform } from "@/platform/bridge"
import type { Profile } from "@/platform/schemas"
import type { SettingRow, Settings } from "@/platform/settings-schemas"
import { change, format, type Op, type Problem, parse, plan, toDocument } from "./diff"
import { rowsFor, sharedDocument, sharedPlan, type View } from "./scope"

/** `profile: null` is the defaults every profile gets (or the one file of a tool without per-profile settings). */
export type Target = { profile: string | null }
export type Tab = "settings" | "json"
export type Step = { op: Op; state: "waiting" | "running" | "done" | "failed" | "skipped"; message?: string }
type RowState = { state: "saving" } | { state: "failed"; message: string }

type ConfigState = {
  view: View
  /** In the shared view, the tool whose commands read and change the shared settings. */
  tool: string | null
  /** undefined while loading; null when the tool keeps one file for every profile. */
  profiles: Profile[] | null | undefined
  profilesError: string | null
  target: Target | null
  settings: Settings | null
  loading: boolean
  error: string | null
  tab: Tab
  query: string
  /** The JSON tab's text; null until the owner types in it. */
  draft: string | null
  jsonError: { message: string; line: number } | null
  problems: Problem[]
  steps: Step[]
  saving: boolean
  rows: Record<string, RowState>
  /** Opens the last tool and view the owner used, or the first installed tool's defaults. */
  start(installed: readonly string[], shared: readonly string[]): Promise<void>
  chooseTool(id: string): Promise<void>
  /** `candidates` in order of preference; the first that reports shared settings answers for all of them. */
  chooseShared(candidates: readonly string[]): Promise<void>
  chooseTarget(target: Target): Promise<void>
  setTab(tab: Tab): void
  setQuery(query: string): void
  edit(text: string): void
  formatDraft(): void
  revert(): void
  saveDraft(): Promise<void>
  apply(row: SettingRow, value: unknown): Promise<void>
  /** Runs one prepared change for a single row, as the categories editor does. */
  applyOp(op: Op): Promise<void>
}

// Only what the owner picked last time; a profile is never chosen for them, the shared defaults are.
const LAST = "wirecat.config.last"
type Last = { view?: View; tool?: string; targets?: Record<string, string | null> }
export function readLast(): Last {
  try {
    return JSON.parse(localStorage.getItem(LAST) ?? "{}") as Last
  } catch {
    return {}
  }
}
export function remember(f: (last: Last) => Last) {
  try {
    localStorage.setItem(LAST, JSON.stringify(f(readLast())))
  } catch {
    // Without storage the page simply opens on the defaults next time.
  }
}

const message = (e: unknown) => (e instanceof Error ? e.message : String(e))

export const sourceOf = (id: string | null): SettingsSource | null => (id ? (findTool(id)?.settings ?? null) : null)
export const isDefaultsView = (src: SettingsSource | null, target: Target | null) =>
  Boolean(src?.perProfile && target && target.profile === null)

type ViewOf = Pick<ConfigState, "view" | "settings" | "tool" | "target">

export const documentText = (st: Pick<ConfigState, "view" | "settings">) => {
  const rows = st.settings?.rows ?? []
  return format(st.view === "shared" ? sharedDocument(rows) : toDocument(rows))
}

function planFor(st: ViewOf, edited: Record<string, unknown>) {
  const src = sourceOf(st.tool)
  if (!src || !st.settings) return null
  if (st.view === "shared") return sharedPlan(st.settings.rows, edited, src)
  return plan(st.settings.rows, edited, src, isDefaultsView(src, st.target))
}

/** Unsaved JSON: the draft would still change something, or does not parse. */
export function isDirty(st: ViewOf & Pick<ConfigState, "draft">): boolean {
  if (st.draft === null || !st.settings) return false
  if (st.draft === documentText(st)) return false
  const parsed = parse(st.draft)
  if (!parsed.ok) return true
  const p = planFor(st, parsed.value)
  return p !== null && (p.ops.length > 0 || p.problems.length > 0)
}

const fresh = {
  settings: null,
  error: null,
  draft: null,
  jsonError: null,
  problems: [],
  steps: [],
  rows: {},
} satisfies Partial<ConfigState>

export const useConfig = create<ConfigState>((set, get) => {
  let generation = 0

  const load = async () => {
    const { tool, target, view } = get()
    if (!tool || !target) return
    const mine = ++generation
    set({ loading: true, error: null })
    try {
      const shown = await platform.settingsShow(tool, target.profile)
      const rows = rowsFor(shown.rows, view)
      // The shared view reads through one tool; its own file and profile notice are not what is shown.
      const settings = view === "shared" ? { rows, configFile: null, notice: null } : { ...shown, rows }
      if (mine === generation) set({ settings, loading: false })
    } catch (e) {
      if (mine === generation) set({ settings: null, error: message(e), loading: false })
    }
  }

  const run = (op: Op) => {
    const { tool, target } = get()
    if (!tool || !target) return Promise.reject(new Error("Choose a tool and a profile first."))
    return op.kind === "set"
      ? platform.settingsSet(tool, target.profile, op.defaults, op.key, op.value)
      : platform.settingsUnset(tool, target.profile, op.defaults, op.key)
  }

  const runRow = async (key: string, op: Op) => {
    const setRow = (state: RowState | null) =>
      set((st) => {
        const { [key]: _, ...rest } = st.rows
        return { rows: state ? { ...rest, [key]: state } : rest }
      })
    setRow({ state: "saving" })
    try {
      await run(op)
      await load()
      setRow(null)
    } catch (e) {
      setRow({ state: "failed", message: message(e) })
    }
  }

  return {
    view: "tool",
    tool: null,
    profiles: undefined,
    profilesError: null,
    target: null,
    loading: false,
    tab: "settings",
    query: "",
    saving: false,
    ...fresh,

    async start(installed, shared) {
      if (get().tool) return
      const usable = installed.filter((id) => sourceOf(id))
      const last = readLast()
      if (last.view === "shared" && shared.length > 0) return get().chooseShared(shared)
      const id = last.tool && usable.includes(last.tool) ? last.tool : usable[0]
      if (id) await get().chooseTool(id)
    },

    async chooseShared(candidates) {
      remember((l) => ({ ...l, view: "shared" }))
      const mine = ++generation
      const target = { profile: null }
      set({ view: "shared", tool: null, target, profiles: null, profilesError: null, loading: true, ...fresh })
      let failure: string | null = null
      for (const id of candidates) {
        const src = sourceOf(id)
        if (!src || (src.perProfile && !src.defaults)) continue
        try {
          const shown = await platform.settingsShow(id, null)
          if (mine !== generation) return
          const rows = rowsFor(shown.rows, "shared")
          if (rows.length === 0) continue
          set({ tool: id, settings: { rows, configFile: null, notice: null }, loading: false })
          return
        } catch (e) {
          failure ??= message(e)
        }
      }
      if (mine === generation)
        set({
          loading: false,
          error:
            failure ??
            "None of the installed tools reports shared settings. Update Telegram, MAX or WhatsApp in Tools.",
        })
    },

    async chooseTool(id) {
      const src = sourceOf(id)
      remember((l) => ({ ...l, view: "tool", tool: id }))
      generation++
      set({ view: "tool", tool: id, target: null, profiles: undefined, profilesError: null, loading: false, ...fresh })
      if (!src) return
      if (!src.perProfile) {
        set({ profiles: null })
        await get().chooseTarget({ profile: null })
        return
      }
      try {
        const profiles = (await platform.listProfiles(id)) ?? []
        if (get().tool !== id) return
        set({ profiles })
        const last = readLast().targets?.[id]
        const stillThere = last === null ? src.defaults : profiles.some((p) => p.name === last)
        const target = last !== undefined && stillThere ? { profile: last } : src.defaults ? { profile: null } : null
        if (target && !get().target) await get().chooseTarget(target)
      } catch (e) {
        if (get().tool === id) set({ profiles: [], profilesError: message(e) })
      }
    },

    async chooseTarget(target) {
      const tool = get().tool
      if (tool && get().view === "tool") remember((l) => ({ ...l, targets: { ...l.targets, [tool]: target.profile } }))
      set({ target, ...fresh })
      await load()
    },

    setTab: (tab) => set({ tab }),
    setQuery: (query) => set({ query }),

    edit(text) {
      const parsed = parse(text)
      set({ draft: text, jsonError: parsed.ok ? null : { message: parsed.message, line: parsed.line }, problems: [] })
    },

    formatDraft() {
      const { draft } = get()
      if (draft === null) return
      const parsed = parse(draft)
      if (parsed.ok) set({ draft: format(parsed.value), jsonError: null })
    },

    revert: () => set({ draft: null, jsonError: null, problems: [], steps: [] }),

    async saveDraft() {
      const { draft } = get()
      if (draft === null) return
      const parsed = parse(draft)
      if (!parsed.ok) {
        set({ jsonError: { message: parsed.message, line: parsed.line } })
        return
      }
      const planned = planFor(get(), parsed.value)
      if (!planned) return
      const { ops, problems } = planned
      if (problems.length > 0) {
        set({ problems, steps: [] })
        return
      }
      const steps: Step[] = ops.map((op) => ({ op, state: "waiting" }))
      set({ saving: true, problems: [], steps })
      const update = (i: number, step: Partial<Step>) =>
        set((st) => ({ steps: st.steps.map((s, j) => (j === i ? { ...s, ...step } : s)) }))
      let failed: Problem | null = null
      for (const [i, step] of steps.entries()) {
        if (failed) {
          update(i, { state: "skipped" })
          continue
        }
        update(i, { state: "running" })
        try {
          await run(step.op)
          update(i, { state: "done" })
        } catch (e) {
          failed = { key: step.op.key, message: message(e) }
          update(i, { state: "failed", message: failed.message })
        }
      }
      await load()
      // What was saved now matches the file; whatever was not stays in the editor as unsaved.
      set((st) => ({
        saving: false,
        problems: failed ? [failed] : [],
        draft: failed || isDirty(st) ? st.draft : null,
      }))
    },

    async apply(row, value) {
      const { tool, target } = get()
      const src = sourceOf(tool)
      if (!src) return
      const defaultsView = get().view === "tool" && isDefaultsView(src, target)
      const result = change(src, defaultsView, row, row.key, value)
      if (!result) return
      if (!("kind" in result)) {
        set((st) => ({ rows: { ...st.rows, [row.key]: { state: "failed", message: result.message } } }))
        return
      }
      await runRow(row.key, result)
    },

    applyOp: (op) => runRow(op.key, op),
  }
})
