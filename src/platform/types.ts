import type { Diagnosis, InstallEvent, Profile, Readiness, StorageArea, StorageFolder, ToolState } from "./schemas"

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
  openUrl(url: string): Promise<void>
  window(action: WindowAction): Promise<void>
}
