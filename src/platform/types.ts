import type { RunDetail, RunsPage } from "./runs-schemas"
import type { Diagnosis, InstallEvent, Profile, Readiness, StorageArea, StorageFolder, ToolState } from "./schemas"
import type { Settings } from "./settings-schemas"

export type WindowAction = "minimize" | "toggleMaximize" | "close"

/** Everything the interface may ask of the machine. Each call names a known operation, never a command line. */
export type Platform = {
  kind: "tauri" | "mock"
  os: "linux" | "macos" | "windows"
  readiness(): Promise<Readiness>
  detectTools(): Promise<ToolState[]>
  latestVersions(): Promise<Record<string, string | null>>
  listProfiles(id: string): Promise<Profile[] | null>
  diagnose(id: string, profile: string | null): Promise<Diagnosis>
  install(id: string, onEvent: (e: InstallEvent) => void): Promise<void>
  uninstall(id: string, onEvent: (e: InstallEvent) => void): Promise<void>
  cancelInstall(id: string): Promise<void>
  storage(): Promise<StorageArea[]>
  clearStorage(id: string): Promise<void>
  openFolder(id: string, kind: StorageFolder["kind"]): Promise<void>
  openSetup(id: string, profile: string | null): Promise<void>
  listRuns(id: string, query: string | null): Promise<RunsPage>
  showRun(id: string, run: string): Promise<RunDetail>
  /** `defaults` changes what every profile gets instead of one profile. */
  settingsShow(id: string, profile: string): Promise<Settings>
  settingsSet(id: string, profile: string, defaults: boolean, setting: string, value: string): Promise<void>
  settingsUnset(id: string, profile: string, defaults: boolean, setting: string): Promise<void>
  openUrl(url: string): Promise<void>
  window(action: WindowAction): Promise<void>
}
