import { create } from "zustand"
import { findTool, usesProfiles } from "@/domain/catalog"
import { platform } from "@/platform/bridge"
import type { Profile } from "@/platform/schemas"
import type { SearchAnswer } from "@/platform/search-schemas"
import { useTools } from "../tools/store"

export const LIMIT = 50

/** What the shown answer was asked for, so a query error is shown only while the query still reads the same. */
export type Asked = { tool: string; profile: string | null; query: string; page: number }

type SearchState = {
  tool: string | null
  /** Never chosen for the owner, even when the tool has one profile (rule 3). */
  profile: string | null
  /** undefined while reading them; null for a tool without profiles. */
  profiles: Profile[] | null | undefined
  profilesError: string | null
  query: string
  answer: SearchAnswer | null
  asked: Asked | null
  /** A search is running; the last answer stays on screen meanwhile. */
  loading: boolean
  /** The call itself failed (the tool is missing, a bad argument), as opposed to an answer the tool gave. */
  error: string | null
  expanded: string | null
  /** Tools that answered "too old" to search, by the version that said so; an update brings the tool back. */
  old: Record<string, string | null>
  chooseTool(id: string): void
  chooseProfile(name: string): void
  setQuery(query: string): void
  search(page?: number): Promise<void>
  toggle(key: string): void
}

const message = (e: unknown) => (e instanceof Error ? e.message : String(e))

export const ready = (s: Pick<SearchState, "tool" | "profile" | "profiles" | "query">) =>
  s.tool !== null && s.query.trim() !== "" && (s.profiles === null || s.profile !== null)

export const useSearch = create<SearchState>((set, get) => {
  // Only the newest request's answer is shown; a slower earlier one is dropped.
  let seq = 0
  let profilesSeq = 0

  return {
    tool: null,
    profile: null,
    profiles: undefined,
    profilesError: null,
    query: "",
    answer: null,
    asked: null,
    loading: false,
    error: null,
    expanded: null,
    old: {},
    chooseTool(id) {
      if (id === get().tool) return
      const t = findTool(id)
      const call = ++profilesSeq
      seq++
      set({
        tool: id,
        profile: null,
        profiles: t && usesProfiles(t) ? undefined : null,
        profilesError: null,
        answer: null,
        asked: null,
        loading: false,
        error: null,
        expanded: null,
      })
      if (!t || !usesProfiles(t)) return
      platform.listProfiles(id).then(
        (profiles) => call === profilesSeq && set({ profiles: profiles ?? [] }),
        (e) => call === profilesSeq && set({ profiles: [], profilesError: message(e) }),
      )
    },
    chooseProfile(name) {
      if (name === get().profile) return
      seq++
      set({ profile: name, answer: null, asked: null, loading: false, error: null, expanded: null })
    },
    setQuery: (query) => set({ query }),
    async search(page = 1) {
      const s = get()
      if (!ready(s) || s.tool === null) return
      const asked: Asked = { tool: s.tool, profile: s.profiles === null ? null : s.profile, query: s.query, page }
      const call = ++seq
      set({ loading: true, error: null })
      try {
        const answer = await platform.searchStore(asked.tool, asked.profile, asked.query, LIMIT, page)
        if (call !== seq) return
        set({ answer, asked, loading: false, expanded: null })
        if (answer.kind === "old") {
          const version = useTools.getState().installs[asked.tool]?.[0]?.version ?? null
          set((st) => ({ old: { ...st.old, [asked.tool]: version } }))
        }
      } catch (e) {
        if (call !== seq) return
        set({ error: message(e), asked, answer: null, loading: false })
      }
    },
    toggle: (key) => set((s) => ({ expanded: s.expanded === key ? null : key })),
  }
})
