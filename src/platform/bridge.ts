import { Channel, invoke } from "@tauri-apps/api/core"
import { getCurrentWindow } from "@tauri-apps/api/window"
import { openUrl } from "@tauri-apps/plugin-opener"
import * as v from "valibot"
import { createMock } from "./mock"
import { ReportContextSchema, ReportSentSchema } from "./report-schemas"
import { RunDetailSchema, RunsPageSchema } from "./runs-schemas"
import {
  DiagnosisSchema,
  InstallEventSchema,
  LatestVersionsSchema,
  ProfilesSchema,
  ReadinessSchema,
  StorageSchema,
  ToolStatesSchema,
} from "./schemas"
import { SettingsSchema } from "./settings-schemas"
import type { Platform } from "./types"

const call = async <S extends v.GenericSchema>(schema: S, cmd: string, args?: Record<string, unknown>) =>
  v.parse(schema, await invoke(cmd, args))

function events(onEvent: (e: v.InferOutput<typeof InstallEventSchema>) => void) {
  const channel = new Channel<unknown>()
  channel.onmessage = (raw) => onEvent(v.parse(InstallEventSchema, raw))
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
    detectTools: () => call(ToolStatesSchema, "detect_tools"),
    latestVersions: () => call(LatestVersionsSchema, "latest_versions"),
    listProfiles: (id) => call(ProfilesSchema, "list_profiles", { id }),
    diagnose: (id, profile) => call(DiagnosisSchema, "diagnose", { id, profile }),
    install: (id, onEvent) => invoke("install_tool", { id, onEvent: events(onEvent) }),
    uninstall: (id, onEvent) => invoke("uninstall_tool", { id, onEvent: events(onEvent) }),
    storage: () => call(StorageSchema, "storage_report"),
    clearStorage: (id) => invoke("clear_storage", { id }),
    openFolder: (id, kind) => invoke("open_folder", { id, kind }),
    cancelInstall: (id) => invoke("cancel_install", { id }),
    openSetup: (id, profile) => invoke("open_setup", { id, profile }),
    listRuns: (id, query, limit, page) => call(RunsPageSchema, "list_runs", { id, query, limit, page }),
    showRun: (id, run) => call(RunDetailSchema, "show_run", { id, run }),
    reportContext: (attachLogs) => call(ReportContextSchema, "report_context", { attachLogs }),
    sendReport: (draft, context) => call(ReportSentSchema, "send_report", { draft, context }),
    settingsShow: (id, profile) => call(SettingsSchema, "settings_show", { id, profile }),
    settingsSet: (id, profile, defaults, setting, value) =>
      invoke("settings_set", { id, profile, defaults, setting, value }),
    settingsUnset: (id, profile, defaults, setting) => invoke("settings_unset", { id, profile, defaults, setting }),
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
