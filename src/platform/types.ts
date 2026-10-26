import type { StoreCompat } from "@/domain/compat"
import type { Agent, Chats, Claims, McpHealth, Registrations, SkillReport, SkillText, Target } from "./agents-schemas"
import type { StoreCheck, StoreInfo, TableList } from "./archive-schemas"
import type { BackupEvent, Backups, ResetPreview } from "./backup-schemas"
import type { Permissions } from "./permissions-schemas"
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
import type { SignInEvent } from "./signin-schemas"

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
  /** `fresh` runs every copy's `--version` again; otherwise an unchanged program keeps its last answer. */
  detectTools(fresh?: boolean): Promise<ToolState[]>
  /** `fresh` asks npm even when an answer from the last hour is kept. */
  latestVersions(fresh?: boolean): Promise<Record<string, string | null>>
  listProfiles(id: string): Promise<Profile[] | null>
  diagnose(id: string, profile: string | null): Promise<Diagnosis>
  install(id: string, onEvent: (e: InstallEvent) => void): Promise<void>
  uninstall(id: string, onEvent: (e: InstallEvent) => void): Promise<void>
  cancelInstall(id: string): Promise<void>
  storage(): Promise<StorageArea[]>
  clearStorage(id: string): Promise<void>
  /** `entry` opens one item directly inside the folder; Rust builds and checks the path. */
  openFolder(id: string, kind: StorageFolder["kind"], entry?: string): Promise<void>
  /** What the shared archive holds, from the installed tool that reads the newest schema; null when none is installed. */
  storeInfo(): Promise<StoreInfo | null>
  /** Every installed tool's own `store info`: whether it reads the shared store, and what its next run does to it. */
  storeCompat(): Promise<StoreCompat>
  /** Every table with its kind and rows; `sizes` reads the whole file, from seconds to minutes. */
  storeTables(sizes: boolean): Promise<TableList | null>
  /** The archive's integrity and health checks; a minute or more on a large archive. */
  storeCheck(): Promise<StoreCheck | null>
  /**
   * The newest-schema tool's own `store backup`, zipped into the backups folder; progress and the result arrive as
   * events. With a password, the tool's `store backup --encrypt` seals it instead, reading the password on stdin.
   */
  storeBackup(onEvent: (e: BackupEvent) => void, password?: string): Promise<void>
  cancelStoreBackup(): Promise<void>
  /** Finished backups in the backups folder, newest first. */
  listBackups(): Promise<Backups>
  /** The backups folder, or one backup shown in it by name. */
  openBackups(name: string | null): Promise<void>
  /** What clearing storage deletes, from `store reset --dry-run`; null when no messenger tool is installed. */
  storeResetPreview(): Promise<ResetPreview | null>
  /** Empties storage with the tool's own `store reset`; resolves with the new empty store's schema. */
  storeReset(): Promise<number | null>
  /** Every known agent; `foundBy` is null for the ones not on this computer. */
  detectAgents(): Promise<Agent[]>
  skillStatus(id: string): Promise<SkillReport>
  /** Resolves with the version written. */
  skillInstall(id: string, target: Target): Promise<string | null>
  skillShow(id: string): Promise<SkillText>
  /** By tool id, for installed tools: whether a terminal finds it on its own PATH. */
  terminalReach(agent?: string): Promise<Record<string, boolean>>
  /** Which chat apps drive the agent (Hermes's gateway, OpenClaw's channels), read only. */
  agentChats(agent: string): Promise<Chats>
  /** WireCat servers an agent has registered; rejects when the agent's list cannot be read. */
  mcpRegistrations(agent: string): Promise<Registrations>
  /** The tool's own `mcp check` for one profile; starts the server once, writes nothing. */
  mcpCheck(id: string, profile: string): Promise<McpHealth>
  /** The tool's own `mcp add`; `allowWrites` passes `--allow-writes`, which the owner confirmed. */
  mcpAdd(id: string, profile: string, agent: string, allowWrites: boolean): Promise<void>
  /** The agent's own `mcp remove` of `<bin>-<profile>`, or of `<bin>` when `profile` is null. */
  mcpRemove(id: string, profile: string | null, agent: string): Promise<void>
  taskClaims(id: string, profile: string): Promise<Claims>
  /** Releases a claim as the owner, who may release any. */
  taskRelease(id: string, profile: string, task: string): Promise<void>
  openSetup(id: string, profile: string | null): Promise<void>
  /**
   * Signs the named profile in inside the window with the tool's own sign-in (`signIn.qr` in the catalog); steps arrive
   * as events and the last one is `done`, `failed` or `stopped`. Never with a profile the owner did not choose.
   */
  signIn(id: string, profile: string, onEvent: (e: SignInEvent) => void): Promise<void>
  /** Asks the tool to stop, then ends it after a few seconds; `signIn` then answers `stopped`, or `done` with what came. */
  signInStop(id: string): Promise<void>
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
  /** Levels the owner set, plus per-command access when the tool reports it. Saved with `settingsSet`. */
  permissionsShow(id: string, profile: string | null): Promise<Permissions>
  openUrl(url: string): Promise<void>
  window(action: WindowAction): Promise<void>
}
