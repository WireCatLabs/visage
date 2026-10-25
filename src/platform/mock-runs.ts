import type { Platform } from "./types"

export const runsMock: Pick<Platform, "listRuns" | "showRun"> = {
  async listRuns() {
    return null
  },
  async showRun() {
    return null
  },
}
