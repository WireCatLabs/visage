import { delay } from "./mock-delay"
import type { Platform } from "./types"

// `?update=available` offers 0.2.0; `downloading` holds the download at 40%; `fail` stops it halfway with an error;
// `manual` offers it to a copy that cannot replace itself (a Linux .deb or .rpm). No parameter: no update.
const mode = new URLSearchParams(typeof window === "undefined" ? "" : window.location.search).get("update")

const TOTAL = 18_400_000

export const updateMock: Pick<Platform, "checkUpdate" | "installUpdate" | "restart"> = {
  async checkUpdate() {
    await delay(400)
    if (!mode) return null
    return {
      version: "0.2.0",
      notes: "Sign in to Zoom from the window.\nFaster Storage page.",
      manual: mode === "manual",
    }
  },
  async installUpdate(onProgress) {
    onProgress({ downloaded: 0, total: TOTAL })
    for (let part = 1; part <= 10; part++) {
      await delay(250)
      if (mode === "downloading" && part === 4) {
        onProgress({ downloaded: (TOTAL * part) / 10, total: TOTAL })
        await new Promise(() => {})
      }
      if (mode === "fail" && part === 5) throw new Error("The download stopped: connection reset")
      onProgress({ downloaded: (TOTAL * part) / 10, total: TOTAL })
    }
    await delay(600)
  },
  async restart() {
    window.location.reload()
  },
}
