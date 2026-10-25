import { useTools } from "@/features/tools/store"
import { platform } from "@/platform/bridge"

// Browser-only: starts the install named in `?install=<tool>` so a review can capture the progress state.
export async function runMockScenario() {
  if (platform.kind !== "mock") return
  const id = new URLSearchParams(window.location.search).get("install")
  if (!id) return
  await useTools.getState().refresh()
  useTools.getState().install(id)
}
