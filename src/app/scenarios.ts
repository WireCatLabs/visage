import { useNav } from "@/features/nav"
import { STEPS, useOnboarding } from "@/features/onboarding/store"
import { useSignIn } from "@/features/signin/store"
import { useTools } from "@/features/tools/store"
import { platform } from "@/platform/bridge"

// Browser-only: starts the install named in `?install=<tool>` so a review can capture the progress state.
// `?onboarding=off` hides the first-run setup for this load, so captures of other screens stay as they were;
// `?onboarding=<step>` opens it at that step. `?section=<id>` opens that page without a click, so a layout-shift
// measurement is not hidden by the browser's 500 ms grace period after input. `?crash=<section>` opens that section
// and breaks its render. `?signin=<tool>` opens that tool's in-window sign-in for a profile named personal.
// `?mcp=<tool>` and `?mcp-fail=<tool>` open that tool's details, where its MCP server section starts open.
// `?connect=<state>` opens tg's details at that step of the guide (`src/features/tools/connect-scenario.ts`).
// `?tailscale=<state>` opens tg's, with the "Connect an AI app" guide's Tailscale steps at that state (`src/platform/mock-tailscale.ts`).
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
    (params.has("tailscale") || params.has("connect") ? "tg" : null)
  if (mcp) {
    useNav.getState().go("tools")
    await useTools.getState().refresh()
    useTools.getState().toggle(mcp)
  }
  const id = params.get("install")
  if (!id) return
  await useTools.getState().refresh()
  useTools.getState().install(id)
}

export function CrashScenario({ section }: { section: string }): null {
  if (platform.kind === "mock" && new URLSearchParams(window.location.search).get("crash") === section) {
    throw new TypeError("Cannot read properties of undefined (reading 'length')")
  }
  return null
}
