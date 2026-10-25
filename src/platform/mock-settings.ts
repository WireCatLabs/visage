import type { Origin, SettingRow, Settings } from "./settings-schemas"
import type { Platform } from "./types"

// Fictional settings in the three shapes the tools print, after Rust has normalised and masked them.

type Scalar = string | number | boolean | null
type Layer = Record<string, Scalar>

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms))

const BUILT_IN: Layer = {
  limit: 50,
  timeout_ms: null,
  color: null,
  record: false,
  keep_runs_for_days: 30,
  sends_per_hour: 20,
  requests_per_minute: 30,
  transcribe_with: "auto",
  search_catch_up: true,
  picture_search: false,
  embedding_provider: "local",
  embedding_model: null,
  proxy: null,
  update_check: true,
  default_profile: null,
}
const NUMBERS = new Set(["limit", "timeout_ms", "keep_runs_for_days", "sends_per_hour", "requests_per_minute"])
const BOOLEANS = new Set(["record", "search_catch_up", "picture_search", "update_check"])
const STORE_BUILT_IN: Layer = { "task_categories.bills": "invoice,receipt,payment", task_first_pass_per_chat: 3 }

type MessengerState = { defaults: Layer; profiles: Record<string, Layer>; store: Layer }

const messengers: Record<string, MessengerState> = {
  tg: {
    defaults: { sends_per_hour: 10 },
    profiles: { personal: { limit: 20, record: true, proxy: "socks5://•••" }, work: { color: "always" } },
    store: {},
  },
  max: { defaults: {}, profiles: { personal: { limit: 30 } }, store: {} },
  wa: { defaults: {}, profiles: {}, store: {} },
}

/** Whether a messenger records every run for this profile, so the runs mock keeps its successes too. */
export function recordOn(id: string, profile: string | undefined): boolean {
  const state = messengers[id]
  if (!state) return false
  const own = profile ? state.profiles[profile] : undefined
  const value = own && "record" in own ? own.record : "record" in state.defaults ? state.defaults.record : false
  return value === true
}

const ENV_PREFIX: Record<string, string> = { tg: "TG", max: "MAX", wa: "WA" }
const ENVIRONMENT: Record<string, Layer> = { tg: { requests_per_minute: 12 } }

const zoom: Layer = { "zoom.client_id": "•••", source: "api", "files.folder": null, "files.timezone": "Europe/Madrid" }

const drive: { defaults: Layer; profiles: Record<string, Layer> } = {
  defaults: { max_text_chars: 200000, "permissions.files": "readonly" },
  profiles: { personal: { principal: "•••", picture_search: true }, work: { principal: "•••" } },
}
const DRIVE_READ_ONLY = new Set(["principal"])

const row = (key: string, value: unknown, origin: Origin, extra: Partial<SettingRow> = {}): SettingRow => ({
  key,
  value,
  origin,
  from: null,
  scope: null,
  locked: null,
  masked: value === "•••" || (typeof value === "string" && value.endsWith("•••")),
  resettable: false,
  ...extra,
})

function messengerRows(id: string, profile: string | null): SettingRow[] {
  const state = messengers[id] as MessengerState
  const own = profile ? (state.profiles[profile] ?? {}) : {}
  const env = ENVIRONMENT[id] ?? {}
  const layer: Origin = profile ? "profile" : "defaults"
  const rows = Object.keys(BUILT_IN).map((key) => {
    if (key in env) {
      const name = `${ENV_PREFIX[id]}_${key.toUpperCase()}`
      return row(key, env[key], "environment", {
        from: name,
        locked: `Set by the environment variable ${name}. Change or remove it there; config set cannot override it.`,
      })
    }
    if (key === "default_profile")
      return row(key, null, "default", { from: "default", locked: "This tool does not change it with config set." })
    const [value, origin, from]: [Scalar | undefined, Origin, string] =
      key in own
        ? [own[key], "profile", "config file"]
        : key in state.defaults
          ? [state.defaults[key], "defaults", "config defaults"]
          : [BUILT_IN[key], "default", "default"]
    return row(key, value, origin, { from, resettable: origin === layer })
  })
  rows.push(
    row("permissions", { send: "ask", "chats.leave": "deny" }, "profile", {
      from: "config file",
      locked: "Combined from several places. Change its parts in a terminal.",
    }),
  )
  for (const key of Object.keys(STORE_BUILT_IN)) {
    const set = key in state.store
    rows.push(
      row(key, set ? state.store[key] : STORE_BUILT_IN[key], set ? "store" : "default", {
        from: set ? "store" : "default",
        scope: key.startsWith("task_categories.") ? "shared" : "store",
        resettable: set,
      }),
    )
  }
  return rows
}

function driveRows(profile: string | null): SettingRow[] {
  const own = profile ? (drive.profiles[profile] ?? {}) : {}
  const keys = [...new Set([...Object.keys(own), ...Object.keys(drive.defaults)])].sort()
  return keys.map((key) => {
    const mine = key in own
    return row(key, mine ? own[key] : drive.defaults[key], mine ? "profile" : "defaults", {
      locked: DRIVE_READ_ONLY.has(key) ? "This tool does not change it with config set." : null,
    })
  })
}

const reject = (message: string) => Promise.reject(new Error(message))

function parseText(key: string, value: string): Scalar | Error {
  if (value.includes("•••")) return new Error(`${key}: that value is masked; type the real one`)
  if (NUMBERS.has(key)) {
    const n = Number(value)
    return Number.isInteger(n) && n >= 0 ? n : new Error(`${key} takes a whole number, not "${value}"`)
  }
  if (BOOLEANS.has(key)) {
    return value === "true" || value === "false" ? value === "true" : new Error(`${key} is true or false`)
  }
  if (key in BUILT_IN || key in STORE_BUILT_IN || key.startsWith("task_categories.")) return value
  return new Error(`unknown setting: ${key}`)
}

export const settingsMock: Pick<Platform, "settingsShow" | "settingsSet" | "settingsUnset"> = {
  async settingsShow(id, profile): Promise<Settings> {
    await delay(300)
    if (id === "zm") {
      return {
        rows: Object.entries(zoom).map(([key, value]) => row(key, value, value === null ? "default" : "file")),
        configFile: "~/.config/zm/config.json",
        notice: null,
      }
    }
    if (id === "drive") return { rows: driveRows(profile), configFile: null, notice: null }
    if (!(id in messengers)) throw new Error("This tool has no settings command.")
    return { rows: messengerRows(id, profile), configFile: `~/.config/${id}-cli/config.json`, notice: null }
  },

  async settingsSet(id, profile, defaults, setting, value) {
    await delay(250)
    if (value.startsWith("-")) return reject('A value cannot start with "-": the tool would read it as an option.')
    if (id === "zm") {
      if (!(setting in zoom)) return reject("unknown config key")
      if (setting === "source" && value !== "api" && value !== "files") return reject("source must be api or files")
      zoom[setting] = value
      return
    }
    if (id === "drive") {
      let parsed: Scalar
      try {
        parsed = JSON.parse(value)
      } catch {
        return reject("setting value must be JSON")
      }
      if (setting === "picture_search" && (defaults || typeof parsed !== "boolean"))
        return reject("picture_search is true or false, set per profile")
      if (!defaults && !profile) return reject("name a profile")
      const target = defaults ? drive.defaults : (drive.profiles[profile as string] ?? {})
      target[setting] = parsed
      if (!defaults) drive.profiles[profile as string] = target
      return
    }
    const state = messengers[id]
    if (!state) return reject("This tool has no settings command.")
    const parsed = parseText(setting, value)
    if (parsed instanceof Error) return reject(parsed.message)
    if (setting in STORE_BUILT_IN || setting.startsWith("task_categories.")) {
      if (defaults) return reject(`${setting} is store-wide — --defaults, --personal and --bot do not apply`)
      state.store[setting] = parsed
      return
    }
    if (defaults) state.defaults[setting] = parsed
    else if (profile) state.profiles[profile] = { ...state.profiles[profile], [setting]: parsed }
    else return reject("name a profile")
  },

  async settingsUnset(id, profile, defaults, setting) {
    await delay(250)
    const state = messengers[id]
    if (!state) return reject("This tool cannot remove a setting; give it a value instead.")
    if (setting in state.store) delete state.store[setting]
    else if (defaults) delete state.defaults[setting]
    else if (profile) delete state.profiles[profile]?.[setting]
  },
}
