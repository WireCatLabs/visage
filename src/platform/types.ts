import type { StoreCompat } from "@/domain/compat"
import type { Agent, Chats, Claims, McpHealth, Registrations, SkillReport, SkillText, Target } from "./agents-schemas"
import type { StoreCheck, StoreInfo, TableList } from "./archive-schemas"
import type { BackupEvent, Backups, ResetPreview } from "./backup-schemas"
import type { CloudflareStatus, TunnelRoute } from "./cloudflare-schemas"
import type { McpServerStatus, OAuthSettings, PublicCheck } from "./mcp-server-schemas"
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
import type { SearchAnswer } from "./search-schemas"
import type { Settings } from "./settings-schemas"
import type { SignInEvent } from "./signin-schemas"
import type { LastSync, SyncEvent } from "./sync-schemas"
import type { FunnelState, TailscaleDownload, TailscaleStatus } from "./tailscale-schemas"
import type { PackageOutcome, UpdateKind, UpdateProgress } from "./update-schemas"

export type WindowAction = "minimize" | "toggleMaximize" | "close"

/** A newer WireCat release, and how this copy takes it. */
export type AppUpdate = { version: string; notes: string | null; kind: UpdateKind }
export type { PackageOutcome, UpdateKind, UpdateProgress }

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
  /** The tool's HTTP MCP server for browser apps: one per tool, serving every profile (each call names one). */
  mcpServerStatus(id: string): Promise<McpServerStatus>
  /** Rust checks the port and the tunnel's address, then runs the tool's `mcp server start` and answers its status. */
  mcpServerStart(id: string, port: number, url: string): Promise<McpServerStatus>
  /** The tool refuses a server it did not start. */
  mcpServerStop(id: string): Promise<void>
  /** `mcp --revoke`: every browser app must log in again. */
  mcpServerRevoke(id: string): Promise<void>
  /** The `mcpServers` entry a desktop app pastes, as JSON text. */
  mcpServerConfig(id: string): Promise<string>
  /** The running server's login endpoints, to type by hand where a browser app does not find them. */
  mcpServerOAuth(id: string): Promise<OAuthSettings>
  /** Whether the internet reaches the running server: public DNS, then its metadata from the public address. */
  mcpServerPublic(id: string): Promise<PublicCheck>
  /** Every step of the Tailscale guide at once: installed, allowed to change settings, logged in, Funnel allowed. */
  tailscaleStatus(): Promise<TailscaleStatus>
  /** Downloads Tailscale's official installer into Downloads, then opens it or shows it in the file manager. */
  tailscaleDownload(kind: NonNullable<TailscaleStatus["package"]>): Promise<TailscaleDownload>
  /** Opens a terminal running Tailscale's install commands for this Linux, which ask for the password themselves. */
  tailscaleTerminal(what: "install"): Promise<void>
  /** `tailscale login` on a logged-out computer; the login page opens in the browser and `onPage` gets its link. */
  tailscaleLogin(onPage: (url: string) => void): Promise<void>
  /** Stops a waiting login or Funnel approval. */
  tailscaleStop(): Promise<void>
  /** Funnel from the tool's paths of the shared public address to its local port; answers `https://<host>/<tool>`. */
  tailscaleFunnelOpen(id: string, port: number, onPage: (url: string) => void): Promise<string>
  /** Turns off only the paths the app set up for this tool, an older whole-port funnel of it too. */
  tailscaleFunnelClose(id: string): Promise<void>
  tailscaleFunnels(): Promise<FunnelState[]>
  /** Every step of the Cloudflare tunnel guide at once: cloudflared downloaded, account connected, address made. */
  cloudflareStatus(): Promise<CloudflareStatus>
  /** Downloads cloudflared's own release into the app's folder, checked against GitHub's checksum; answers its version. */
  cloudflareInstall(): Promise<string>
  /** `cloudflared tunnel login`: the owner logs in and picks the domain in the browser; `onPage` gets the page's link. */
  cloudflareLogin(onPage: (url: string) => void): Promise<void>
  /** Stops a waiting login or download. */
  cloudflareStop(): Promise<void>
  /** Makes the tunnel and its DNS record for this name on the owner's domain; answers the name as kept. */
  cloudflareCreate(hostname: string): Promise<string>
  /** Routes the tool's paths of the tunnel's name to its local port and runs cloudflared; answers `https://<name>/<tool>`. */
  cloudflareTunnelOpen(id: string, port: number): Promise<string>
  /** Takes the tool's paths off the tunnel; cloudflared stops when no tool is left. */
  cloudflareTunnelClose(id: string): Promise<void>
  cloudflareRoutes(): Promise<TunnelRoute[]>
  taskClaims(id: string, profile: string): Promise<Claims>
  /** Releases a claim as the owner, who may release any. */
  taskRelease(id: string, profile: string, task: string): Promise<void>
  openSetup(id: string, profile: string | null): Promise<void>
  /**
   * Signs the named profile in inside the window with one of the tool's own sign-ins (`signIn.methods` in the catalog);
   * steps arrive as events and the last one is `done`, `failed` or `stopped`. Never with a profile the owner did not
   * choose.
   */
  signIn(id: string, method: string, profile: string, onEvent: (e: SignInEvent) => void): Promise<void>
  /** The answer to the running sign-in's `needs` step, written to the tool's stdin; never logged or kept. */
  signInAnswer(id: string, value: string): Promise<void>
  /** Asks the tool to stop, then ends it after a few seconds; `signIn` then answers `stopped`, or `done` with what came. */
  signInStop(id: string): Promise<void>
  /**
   * Runs the tool's own sync (`sync.run` in the catalog) for the profile the owner chose, or none for a tool without
   * profiles. Stages and the result arrive as events; only counts, never chat or account names.
   */
  syncRun(id: string, profile: string | null, onEvent: (e: SyncEvent) => void): Promise<void>
  /** Asks that sync to stop; `syncRun` then answers `stopped`. What came is kept by the tool. */
  syncStop(id: string, profile: string | null): Promise<void>
  /** When the profile's last successful sync ended, from the tool's own `runs list` or `status`. */
  syncLast(id: string, profile: string | null): Promise<LastSync>
  /** What a bug report carries about this computer, masked, including recent failed runs (private). */
  reportContext(): Promise<ReportContext>
  sendReport(draft: ReportDraft, context: ReportContext): Promise<ReportSent>
  /** `query` is the CLI's own filter (exact `field:value` terms); `page` starts at 1. */
  listRuns(id: string, query: string | null, limit: number, page: number): Promise<RunsPage>
  showRun(id: string, run: string): Promise<RunDetail>
  /**
   * The tool's own search of what it stored on this computer, for the profile the owner chose (null for a tool
   * without profiles). Never asks the provider. A query the tool refuses is an answer, not a rejection.
   */
  searchStore(id: string, profile: string | null, query: string, limit: number, page: number): Promise<SearchAnswer>
  /** `profile: null` is the defaults every profile gets, or the one file a tool without per-profile settings keeps. */
  settingsShow(id: string, profile: string | null): Promise<Settings>
  /** `defaults` changes what every profile gets instead of one profile. Rejects with the tool's own message. */
  settingsSet(id: string, profile: string | null, defaults: boolean, setting: string, value: string): Promise<void>
  settingsUnset(id: string, profile: string | null, defaults: boolean, setting: string): Promise<void>
  /** Levels the owner set, plus per-command access when the tool reports it. Saved with `settingsSet`. */
  permissionsShow(id: string, profile: string | null): Promise<Permissions>
  /** Null when this is the newest release. */
  checkUpdate(): Promise<AppUpdate | null>
  /** Downloads and installs the update `checkUpdate` found; the app keeps running until `restart`. */
  installUpdate(onProgress: (p: UpdateProgress) => void): Promise<void>
  /** A .deb or .rpm copy: downloads that version's package, signature checked, into Downloads and opens it. */
  downloadPackageUpdate(version: string, onProgress: (p: UpdateProgress) => void): Promise<PackageOutcome>
  restart(): Promise<void>
  openUrl(url: string): Promise<void>
  window(action: WindowAction): Promise<void>
}
