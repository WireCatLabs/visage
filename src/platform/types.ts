import type { Agent, SkillReport, Target } from "./agents-schemas"
import type { StoreCheck, StoreInfo, TableList } from "./archive-schemas"
import type { ReportContext, ReportDraft, ReportSent } from "./report-schemas"
import type { RunDetail, RunsPage } from "./runs-schemas"
import type {
  Diagnosis,
  InstallEvent,
  NodeEvent,
  NodeOffer,
  NodePath,
  Profile,
  Readiness,
  StorageArea,
  StorageFolder,
  ToolState,
} from "./schemas"
import type { Settings } from "./settings-schemas"

export type WindowAction = "minimize" | "toggleMaximize" | "close"

/** Everything the interface may ask of the machine. Each call names a known operation, never a command line. */
export type Platform = {
  kind: "tauri" | "mock"
  os: "linux" | "macos" | "windows"
  readiness(): Promise<Readiness>
  /** The Node.js build "Set up Node.js for me" would download from nodejs.org. */
  nodeOffer(): Promise<NodeOffer>
  setupNode(onEvent: (e: NodeEvent) => void): Promise<void>
  cancelNodeSetup(): Promise<void>
  /** Rejects while tools still run on it. */
  removeNode(): Promise<void>
  /** The exact line "Add to PATH" writes and the file it goes into, for the app's own Node.js. */
  nodePath(): Promise<NodePath>
  setNodePath(add: boolean): Promise<NodePath>
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
  /** What the shared archive holds, from the first installed messenger tool; null when none is installed. */
  storeInfo(): Promise<StoreInfo | null>
  /** Every table with its kind and rows; `sizes` reads the whole file, from seconds to minutes. */
  storeTables(sizes: boolean): Promise<TableList | null>
  /** The archive's integrity and health checks; a minute or more on a large archive. */
  storeCheck(): Promise<StoreCheck | null>
  /** Every known agent; `foundBy` is null for the ones not on this computer. */
  detectAgents(): Promise<Agent[]>
  skillStatus(id: string): Promise<SkillReport>
  /** Resolves with the version written. */
  skillInstall(id: string, target: Target): Promise<string | null>
  openSetup(id: string, profile: string | null): Promise<void>
  /** What a bug report carries about this computer, masked, including recent failed runs (private). */
  reportContext(): Promise<ReportContext>
  sendReport(draft: ReportDraft, context: ReportContext): Promise<ReportSent>
  /** `query` is the CLI's own filter (exact `field:value` terms); `page` starts at 1. */
  listRuns(id: string, query: string | null, limit: number, page: number): Promise<RunsPage>
  showRun(id: string, run: string): Promise<RunDetail>
  /** `profile: null` is the defaults every profile gets, or the one file a tool without per-profile settings keeps. */
  settingsShow(id: string, profile: string | null): Promise<Settings>
  /** `defaults` changes what every profile gets instead of one profile. Rejects with the tool's own message. */
  settingsSet(id: string, profile: string | null, defaults: boolean, setting: string, value: string): Promise<void>
  settingsUnset(id: string, profile: string | null, defaults: boolean, setting: string): Promise<void>
  openUrl(url: string): Promise<void>
  window(action: WindowAction): Promise<void>
}
