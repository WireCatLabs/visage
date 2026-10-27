import { Channel, invoke } from "@tauri-apps/api/core"
import { getCurrentWindow } from "@tauri-apps/api/window"
import { openUrl } from "@tauri-apps/plugin-opener"
import * as v from "valibot"
import {
  AgentsSchema,
  ChatsSchema,
  ClaimsSchema,
  McpHealthSchema,
  RegistrationsSchema,
  SkillReportSchema,
  SkillTextSchema,
  SkillWrittenSchema,
  TerminalReachSchema,
} from "./agents-schemas"
import { StoreCheckSchema, StoreCompatSchema, StoreInfoSchema, TableListSchema } from "./archive-schemas"
import { BackupEventSchema, BackupsSchema, ResetDoneSchema, ResetPreviewSchema } from "./backup-schemas"
import { CloudflareStatusSchema, TunnelRouteSchema } from "./cloudflare-schemas"
import { McpServerStatusSchema, OAuthSettingsSchema, PublicCheckSchema } from "./mcp-server-schemas"
import { createMock } from "./mock"
import { PermissionsSchema } from "./permissions-schemas"
import { ReportContextSchema, ReportSentSchema } from "./report-schemas"
import { RunDetailSchema, RunsPageSchema } from "./runs-schemas"
import {
  DiagnosisSchema,
  InstallEventSchema,
  LatestVersionsSchema,
  NodeEventSchema,
  NodeOfferSchema,
  NodePathSchema,
  ProfilesSchema,
  ReadinessSchema,
  StorageSchema,
  ToolStatesSchema,
} from "./schemas"
import { SettingsSchema } from "./settings-schemas"
import { SignInEventSchema } from "./signin-schemas"
import { LastSyncSchema, SyncEventSchema } from "./sync-schemas"
import { FunnelStateSchema, PageEventSchema, TailscaleDownloadSchema, TailscaleStatusSchema } from "./tailscale-schemas"
import type { Platform } from "./types"

/** A page event that does not parse is dropped: the browser has the page open anyway. */
function pages(onPage: (url: string) => void) {
  const channel = new Channel<unknown>()
  channel.onmessage = (raw) => {
    const parsed = v.safeParse(PageEventSchema, raw)
    if (parsed.success) onPage(parsed.output.url)
  }
  return channel
}

const call = async <S extends v.GenericSchema>(schema: S, cmd: string, args?: Record<string, unknown>) =>
  v.parse(schema, await invoke(cmd, args))

function events(onEvent: (e: v.InferOutput<typeof InstallEventSchema>) => void) {
  const channel = new Channel<unknown>()
  channel.onmessage = (raw) => {
    const parsed = v.safeParse(InstallEventSchema, raw)
    // A dropped event would leave the step spinning forever; say so instead.
    onEvent(
      parsed.success
        ? parsed.output
        : {
            event: "failed",
            reason: "failed",
            message: "The app could not read the installer's last answer.",
            hint: "Press Check again to see what is installed now.",
          },
    )
  }
  return channel
}

function detectOs(): Platform["os"] {
  const ua = navigator.userAgent.toLowerCase()
  if (ua.includes("mac")) return "macos"
  if (ua.includes("win")) return "windows"
  return "linux"
}

function createTauri(): Platform {
  return {
    kind: "tauri",
    os: detectOs(),
    readiness: () => call(ReadinessSchema, "readiness"),
    nodeOffer: () => call(NodeOfferSchema, "node_offer"),
    setupNode: (onEvent) => {
      const channel = new Channel<unknown>()
      channel.onmessage = (raw) => onEvent(v.parse(NodeEventSchema, raw))
      return invoke("setup_node", { onEvent: channel })
    },
    cancelNodeSetup: () => invoke("cancel_node_setup"),
    removeNode: () => invoke("remove_node"),
    nodePath: () => call(NodePathSchema, "node_path"),
    setNodePath: (add) => call(NodePathSchema, "set_node_path", { add }),
    detectTools: (fresh = false) => call(ToolStatesSchema, "detect_tools", { fresh }),
    latestVersions: (fresh = false) => call(LatestVersionsSchema, "latest_versions", { fresh }),
    listProfiles: (id) => call(ProfilesSchema, "list_profiles", { id }),
    diagnose: (id, profile) => call(DiagnosisSchema, "diagnose", { id, profile }),
    install: (id, onEvent) => invoke("install_tool", { id, onEvent: events(onEvent) }),
    uninstall: (id, onEvent) => invoke("uninstall_tool", { id, onEvent: events(onEvent) }),
    storage: () => call(StorageSchema, "storage_report"),
    clearStorage: (id) => invoke("clear_storage", { id }),
    openFolder: (id, kind, entry) => invoke("open_folder", { id, kind, entry: entry ?? null }),
    storeInfo: () => call(StoreInfoSchema, "store_info"),
    storeCompat: () => call(StoreCompatSchema, "store_compat"),
    storeTables: (sizes) => call(TableListSchema, "store_tables", { sizes }),
    storeCheck: () => call(StoreCheckSchema, "store_check"),
    storeBackup: (onEvent, password) => {
      const channel = new Channel<unknown>()
      channel.onmessage = (raw) => {
        const parsed = v.safeParse(BackupEventSchema, raw)
        onEvent(
          parsed.success
            ? parsed.output
            : { event: "failed", message: "The app could not read the backup's progress." },
        )
      }
      return invoke("store_backup", { password: password ?? null, onEvent: channel })
    },
    cancelStoreBackup: () => invoke("cancel_store_backup"),
    listBackups: () => call(BackupsSchema, "list_backups"),
    openBackups: (name) => invoke("open_backups", { name }),
    storeResetPreview: () => call(ResetPreviewSchema, "store_reset_preview"),
    storeReset: () => call(ResetDoneSchema, "store_reset"),
    detectAgents: () => call(AgentsSchema, "detect_agents"),
    skillStatus: (id) => call(SkillReportSchema, "skill_status", { id }),
    skillInstall: (id, target) => call(SkillWrittenSchema, "skill_install", { id, target }),
    skillShow: (id) => call(SkillTextSchema, "skill_show", { id }),
    terminalReach: (agent) => call(TerminalReachSchema, "terminal_reach", agent ? { agent } : {}),
    agentChats: (agent) => call(ChatsSchema, "agent_chats", { agent }),
    mcpRegistrations: (agent) => call(RegistrationsSchema, "mcp_registrations", { agent }),
    mcpCheck: (id, profile) => call(McpHealthSchema, "mcp_check", { id, profile }),
    mcpAdd: (id, profile, agent, allowWrites) => invoke("mcp_add", { id, profile, agent, allowWrites }),
    mcpRemove: (id, profile, agent) => invoke("mcp_remove", { id, profile, agent }),
    mcpServerStatus: (id) => call(McpServerStatusSchema, "mcp_server_status", { id }),
    mcpServerStart: (id, port, url) => call(McpServerStatusSchema, "mcp_server_start", { id, port, url }),
    mcpServerStop: (id) => invoke("mcp_server_stop", { id }),
    mcpServerRevoke: (id) => invoke("mcp_server_revoke", { id }),
    mcpServerConfig: (id) => call(v.string(), "mcp_server_config", { id }),
    mcpServerOAuth: (id) => call(OAuthSettingsSchema, "mcp_server_oauth", { id }),
    mcpServerPublic: (id) => call(PublicCheckSchema, "mcp_server_public", { id }),
    tailscaleStatus: () => call(TailscaleStatusSchema, "tailscale_status"),
    tailscaleDownload: (kind) => call(TailscaleDownloadSchema, "tailscale_download", { kind }),
    tailscaleTerminal: (what) => invoke("tailscale_terminal", { what }),
    tailscaleLogin: (onPage) => invoke("tailscale_login", { onEvent: pages(onPage) }),
    tailscaleStop: () => invoke("tailscale_stop"),
    tailscaleFunnelOpen: (id, port, onPage) =>
      call(v.string(), "tailscale_funnel_open", { id, port, onEvent: pages(onPage) }),
    tailscaleFunnelClose: (id) => invoke("tailscale_funnel_close", { id }),
    tailscaleFunnels: () => call(v.array(FunnelStateSchema), "tailscale_funnels"),
    cloudflareStatus: () => call(CloudflareStatusSchema, "cloudflare_status"),
    cloudflareInstall: () => call(v.string(), "cloudflare_install"),
    cloudflareLogin: (onPage) => invoke("cloudflare_login", { onEvent: pages(onPage) }),
    cloudflareStop: () => invoke("cloudflare_stop"),
    cloudflareCreate: (hostname) => call(v.string(), "cloudflare_create", { hostname }),
    cloudflareTunnelOpen: (id, port) => call(v.string(), "cloudflare_tunnel_open", { id, port }),
    cloudflareTunnelClose: (id) => invoke("cloudflare_tunnel_close", { id }),
    cloudflareRoutes: () => call(v.array(TunnelRouteSchema), "cloudflare_routes"),
    taskClaims: (id, profile) => call(ClaimsSchema, "task_claims", { id, profile }),
    taskRelease: (id, profile, task) => invoke("task_release", { id, profile, task }),
    cancelInstall: (id) => invoke("cancel_install", { id }),
    openSetup: (id, profile) => invoke("open_setup", { id, profile }),
    signIn: (id, method, profile, onEvent) => {
      const channel = new Channel<unknown>()
      // An event that does not parse is never thrown: the error would carry the code into the window's error list.
      channel.onmessage = (raw) => {
        const parsed = v.safeParse(SignInEventSchema, raw)
        onEvent(
          parsed.success
            ? parsed.output
            : { event: "failed", message: "The app could not read the sign-in's last step.", code: null },
        )
      }
      return invoke("sign_in", { id, method, profile, onEvent: channel })
    },
    signInAnswer: (id, value) => invoke("sign_in_answer", { id, value }),
    signInStop: (id) => invoke("sign_in_stop", { id }),
    syncRun: (id, profile, onEvent) => {
      const channel = new Channel<unknown>()
      channel.onmessage = (raw) => {
        const parsed = v.safeParse(SyncEventSchema, raw)
        onEvent(
          parsed.success
            ? parsed.output
            : { event: "failed", message: "The app could not read the sync's answer.", code: null, reason: null },
        )
      }
      return invoke("sync_run", { id, profile, onEvent: channel })
    },
    syncStop: (id, profile) => invoke("sync_stop", { id, profile }),
    syncLast: (id, profile) => call(LastSyncSchema, "sync_last", { id, profile }),
    listRuns: (id, query, limit, page) => call(RunsPageSchema, "list_runs", { id, query, limit, page }),
    showRun: (id, run) => call(RunDetailSchema, "show_run", { id, run }),
    reportContext: () => call(ReportContextSchema, "report_context"),
    sendReport: (draft, context) => call(ReportSentSchema, "send_report", { draft, context }),
    settingsShow: (id, profile) => call(SettingsSchema, "settings_show", { id, profile }),
    settingsSet: (id, profile, defaults, setting, value) =>
      invoke("settings_set", { id, profile, defaults, setting, value }),
    settingsUnset: (id, profile, defaults, setting) => invoke("settings_unset", { id, profile, defaults, setting }),
    permissionsShow: (id, profile) => call(PermissionsSchema, "permissions_show", { id, profile }),
    openUrl: (url) => openUrl(url),
    window: async (action) => {
      const w = getCurrentWindow()
      if (action === "minimize") await w.minimize()
      else if (action === "toggleMaximize") await w.toggleMaximize()
      else await w.close()
    },
  }
}

const inTauri = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window

export type { Platform, WindowAction } from "./types"

export const platform: Platform = inTauri ? createTauri() : createMock(detectOs())
