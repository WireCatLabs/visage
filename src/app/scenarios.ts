import { useNav } from "@/features/nav"
import { STEPS, useOnboarding } from "@/features/onboarding/store"
import { useTools } from "@/features/tools/store"
import { platform } from "@/platform/bridge"

// Browser-only: starts the install named in `?install=<tool>` so a review can capture the progress state.
// `?onboarding=off` hides the first-run setup for this load, so captures of other screens stay as they were;
// `?onboarding=<step>` opens it at that step. `?section=<id>` opens that page without a click, so a layout-shift
// measurement is not hidden by the browser's 500 ms grace period after input.
export async function runMockScenario() {
  if (platform.kind !== "mock") return
  const params = new URLSearchParams(window.location.search)
  const onboarding = params.get("onboarding")
  if (onboarding === "off") useOnboarding.getState().hide()
  const section = params.get("section")
  if (section) useNav.getState().go(section)
  const step = STEPS.find((s) => s.id === onboarding)
  if (step) useOnboarding.getState().reopen(step.id)
  const id = params.get("install")
  if (!id) return
  await useTools.getState().refresh()
  useTools.getState().install(id)
}
