import { create } from "zustand"
import { findTool, type SettingsSource } from "@/domain/catalog"
import { platform } from "@/platform/bridge"
import type { Profile } from "@/platform/schemas"
import type { SettingRow, Settings } from "@/platform/settings-schemas"
import { change, format, type Op, type Problem, parse, plan, toDocument } from "./diff"

/** `profile: null` is the defaults every profile gets (or the one file of a tool without per-profile settings). */
export type Target = { profile: string | null }
export type Tab = "settings" | "json"
export type Step = { op: Op; state: "waiting" | "running" | "done" | "failed" | "skipped"; message?: string }
type RowState = { state: "saving" } | { state: "failed"; message: string }

type ConfigState = {
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
  chooseTool(id: string): Promise<void>
  chooseTarget(target: Target): Promise<void>
  setTab(tab: Tab): void
  setQuery(query: string): void
  edit(text: string): void
  formatDraft(): void
  revert(): void
  saveDraft(): Promise<void>
  apply(row: SettingRow, value: unknown): Promise<void>
}

const message = (e: unknown) => (e instanceof Error ? e.message : String(e))

export const sourceOf = (id: string | null): SettingsSource | null => (id ? (findTool(id)?.settings ?? null) : null)
export const isDefaultsView = (src: SettingsSource | null, target: Target | null) =>
  Boolean(src?.perProfile && target && target.profile === null)

export const documentText = (s: Settings | null) => format(s ? toDocument(s.rows) : {})

/** Unsaved JSON: the draft would still change something, or does not parse. */
export function isDirty(st: Pick<ConfigState, "draft" | "settings" | "tool" | "target">): boolean {
  if (st.draft === null || !st.settings) return false
  if (st.draft === documentText(st.settings)) return false
  const parsed = parse(st.draft)
  if (!parsed.ok) return true
  const src = sourceOf(st.tool)
  if (!src) return false
  const p = plan(st.settings.rows, parsed.value, src, isDefaultsView(src, st.target))
  return p.ops.length > 0 || p.problems.length > 0
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
    const { tool, target } = get()
    if (!tool || !target) return
    const mine = ++generation
    set({ loading: true, error: null })
    try {
      const settings = await platform.settingsShow(tool, target.profile)
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

  return {
    tool: null,
    profiles: undefined,
    profilesError: null,
    target: null,
    loading: false,
    tab: "settings",
    query: "",
    saving: false,
    ...fresh,

    async chooseTool(id) {
      const src = sourceOf(id)
      generation++
      set({ tool: id, target: null, profiles: undefined, profilesError: null, loading: false, ...fresh })
      if (!src) return
      if (!src.perProfile) {
        set({ profiles: null })
        await get().chooseTarget({ profile: null })
        return
      }
      try {
        const profiles = await platform.listProfiles(id)
        if (get().tool === id) set({ profiles: profiles ?? [] })
      } catch (e) {
        if (get().tool === id) set({ profiles: [], profilesError: message(e) })
      }
    },

    async chooseTarget(target) {
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
      const { draft, settings, tool, target } = get()
      const src = sourceOf(tool)
      if (draft === null || !settings || !src) return
      const parsed = parse(draft)
      if (!parsed.ok) {
        set({ jsonError: { message: parsed.message, line: parsed.line } })
        return
      }
      const { ops, problems } = plan(settings.rows, parsed.value, src, isDefaultsView(src, target))
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
      const result = change(src, isDefaultsView(src, target), row, row.key, value)
      if (!result) return
      const setRow = (state: RowState | null) =>
        set((st) => {
          const { [row.key]: _, ...rest } = st.rows
          return { rows: state ? { ...rest, [row.key]: state } : rest }
        })
      if (!("kind" in result)) {
        setRow({ state: "failed", message: result.message })
        return
      }
      setRow({ state: "saving" })
      try {
        await run(result)
        await load()
        setRow(null)
      } catch (e) {
        setRow({ state: "failed", message: message(e) })
      }
    },
  }
})
