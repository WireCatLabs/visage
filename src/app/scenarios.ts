import { findTool, syncNeedsProfile } from "@/domain/catalog"
import { useNav } from "@/features/nav"
import { STEPS, useOnboarding } from "@/features/onboarding/store"
import { useSearch } from "@/features/search/store"
import { useSignIn } from "@/features/signin/store"
import { useTools } from "@/features/tools/store"
import { useSync } from "@/features/tools/sync-store"
import { platform } from "@/platform/bridge"

// Browser-only: starts the install named in `?install=<tool>` so a review can capture the progress state.
// `?onboarding=off` hides the first-run setup for this load, so captures of other screens stay as they were;
// `?onboarding=<step>` opens it at that step. `?section=<id>` opens that page without a click, so a layout-shift
// measurement is not hidden by the browser's 500 ms grace period after input. `?crash=<section>` opens that section
// and breaks its render. `?signin=<tool>` opens that tool's in-window sign-in for a profile named personal.
// `?mcp=<tool>` and `?mcp-fail=<tool>` open that tool's details, where its MCP server section starts open.
// `?connect=<state>` opens tg's details at that step of the guide (`src/features/tools/connect-scenario.ts`).
// `?sync=<tool>` opens that tool's details and starts its sync for personal (`src/platform/mock-sync.ts`).
// `?tailscale=<state>` opens tg's, with the "Connect an AI app" guide's Tailscale steps at that state (`src/platform/mock-tailscale.ts`); `?cloudflare=<state>` the same with the Cloudflare tunnel (`mock-cloudflare.ts`).
export async function runMockScenario() {
  if (platform.kind !== "mock") return
  const params = new URLSearchParams(window.location.search)
  const crash = params.get("crash")
  if (crash) useNav.getState().go(crash)
  const onboarding = params.get("onboarding")
  if (onboarding === "off") useOnboarding.getState().hide()
  const section = params.get("section")
  if (section) useNav.getState().go(section)
  const step = STEPS.find((s) => s.id === onboarding)
  if (step) useOnboarding.getState().reopen(step.id)
  const signIn = params.get("signin")
  if (signIn) useSignIn.getState().start(signIn, "personal")
  const mcp =
    params.get("mcp") ??
    params.get("mcp-fail") ??
    params.get("mcp-old") ??
    params.get("funnel-old") ??
    params.get("code-used") ??
    (params.has("tailscale") || params.has("connect") || params.has("cloudflare") ? "tg" : null)
  if (mcp) {
    useNav.getState().go("tools")
    await useTools.getState().refresh()
    useTools.getState().toggle(mcp)
  }
  const sync = ["sync", "sync-hold", "sync-fail", "sync-timeout"]
    .map((k) => params.get(k))
    .find((v) => v && v !== "never")
  const syncing = sync ? findTool(sync) : undefined
  if (syncing) {
    useNav.getState().go("tools")
    await useTools.getState().refresh()
    useTools.getState().toggle(syncing.id)
    useSync.getState().start(syncing.id, syncNeedsProfile(syncing) ? "personal" : null)
  }
  await searchScenario(params)
  const id = params.get("install")
  if (!id) return
  await useTools.getState().refresh()
  useTools.getState().install(id)
}

// `?search=<tool>` opens Search on that tool's hits, `?search=empty` on a query nothing matches, `?search-fail=query`
// on a query error with a span, `?search-fail=tool` on the tool's refusal, `?search-old=<tool>` on a tool too old to
// search (`src/platform/mock-search.ts`). Profile personal, else the first, is chosen here as the owner would; the page
// never chooses one.
async function searchScenario(params: URLSearchParams) {
  const asked = params.get("search") ?? params.get("search-old") ?? (params.has("search-fail") ? "tg" : null)
  if (!asked) return
  const tool = findTool(asked) ? asked : "tg"
  useNav.getState().go("search")
  const search = useSearch.getState()
  search.chooseTool(tool)
  while (useSearch.getState().profiles === undefined) await new Promise((r) => setTimeout(r, 50))
  const profiles = useSearch.getState().profiles ?? []
  const profile = profiles.find((p) => p.name === "personal") ?? profiles[0]
  if (profile) search.chooseProfile(profile.name)
  const fail = params.get("search-fail")
  search.setQuery(fail === "query" ? "invoice bogus:x date>=30d" : tool === "zm" ? "budget review" : "invoice")
  await search.search(1)
}

export function CrashScenario({ section }: { section: string }): null {
  if (platform.kind === "mock" && new URLSearchParams(window.location.search).get("crash") === section) {
    throw new TypeError("Cannot read properties of undefined (reading 'length')")
  }
  return null
}
