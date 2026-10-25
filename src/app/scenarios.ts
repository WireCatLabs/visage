import { STEPS, useOnboarding } from "@/features/onboarding/store"
import { useTools } from "@/features/tools/store"
import { platform } from "@/platform/bridge"

// Browser-only: starts the install named in `?install=<tool>` so a review can capture the progress state.
// `?onboarding=off` hides the first-run setup for this load, so captures of other screens stay as they were;
// `?onboarding=<step>` opens it at that step.
export async function runMockScenario() {
  if (platform.kind !== "mock") return
  const params = new URLSearchParams(window.location.search)
  const onboarding = params.get("onboarding")
  if (onboarding === "off") useOnboarding.getState().hide()
  const step = STEPS.find((s) => s.id === onboarding)
  if (step) useOnboarding.getState().reopen(step.id)
  const id = params.get("install")
  if (!id) return
  await useTools.getState().refresh()
  useTools.getState().install(id)
}
