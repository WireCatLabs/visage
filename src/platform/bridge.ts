import { Channel, invoke } from "@tauri-apps/api/core"
import { getCurrentWindow } from "@tauri-apps/api/window"
import { openUrl } from "@tauri-apps/plugin-opener"
import * as v from "valibot"
import { createMock } from "./mock"
import {
  DiagnosisSchema,
  InstallEventSchema,
  LatestVersionsSchema,
  ProfilesSchema,
  ReadinessSchema,
  ToolStatesSchema,
} from "./schemas"
import type { Platform } from "./types"

const call = async <S extends v.GenericSchema>(schema: S, cmd: string, args?: Record<string, unknown>) =>
  v.parse(schema, await invoke(cmd, args))

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
    install: (id, onEvent) => {
      const channel = new Channel<unknown>()
      channel.onmessage = (raw) => onEvent(v.parse(InstallEventSchema, raw))
      return invoke("install_tool", { id, onEvent: channel })
    },
    cancelInstall: (id) => invoke("cancel_install", { id }),
    openSetup: (id, profile) => invoke("open_setup", { id, profile }),
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
