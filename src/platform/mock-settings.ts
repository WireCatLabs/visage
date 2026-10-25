import type { Platform } from "./types"

export const settingsMock: Pick<Platform, "settingsShow" | "settingsSet" | "settingsUnset"> = {
  async settingsShow() {
    return null
  },
  async settingsSet() {},
  async settingsUnset() {},
}
