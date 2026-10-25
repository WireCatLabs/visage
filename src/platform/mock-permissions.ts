import { delay } from "./mock-delay"
import type { CommandAccess, Level, OwnLevel, Permissions } from "./permissions-schemas"
import type { Platform } from "./types"

// Fictional levels and commands. `?permissions=old` is a tool too old to report per command;
// `?permissions=readonly` is a machine whose first-run answer was "read only".

const mode = new URLSearchParams(typeof window === "undefined" ? "" : window.location.search).get("permissions")

type Layers = { defaults: Record<string, Level>; profiles: Record<string, Record<string, Level>> }

const state: Record<string, Layers> = {
  tg: {
    defaults: { "chats.leave": "ask" },
    profiles: {
      personal: { messages: "readonly", "messages.send": "allow" },
      work: { contacts: "deny", account: "ask" },
    },
  },
  max: { defaults: {}, profiles: { personal: {} } },
  wa: { defaults: {}, profiles: {} },
}

const R = false
const W = true
const COMMANDS: [string, boolean][] = [
  ["messages list", R],
  ["messages show", R],
  ["messages context", R],
  ["messages send", W],
  ["messages edit", W],
  ["messages forward", W],
  ["messages pin", W],
  ["messages delete", W],
  ["reactions list", R],
  ["reactions add", W],
  ["reactions remove", W],
  ["polls show", R],
  ["polls create", W],
  ["polls vote", W],
  ["topics list", R],
  ["topics create", W],
  ["topics delete", W],
  ["chats list", R],
  ["chats info", R],
  ["chats members list", R],
  ["chats archive", W],
  ["chats mute", W],
  ["chats leave", W],
  ["chats members add", W],
  ["contacts list", R],
  ["contacts show", R],
  ["contacts add", W],
  ["contacts block", W],
  ["account show", R],
  ["account sessions list", R],
  ["account update", W],
  ["attachments list", R],
  ["attachments download", W],
  ["tasks list", R],
  ["tasks add", W],
  ["tasks close", W],
  ["config show", R],
  ["runs list", R],
]

const ORDER: Record<Level, number> = { deny: 0, readonly: 1, ask: 2, allow: 3 }

function merged(id: string, profile: string | null): OwnLevel[] {
  const layers = state[id] as Layers
  const own = profile ? (layers.profiles[profile] ?? {}) : {}
  const out: OwnLevel[] = Object.entries(own).map(([key, level]) => ({
    key,
    level,
    origin: "profile",
    from: `config file: personal.profiles.${profile}`,
  }))
  for (const [key, level] of Object.entries(layers.defaults)) {
    if (out.some((l) => key === l.key || key.startsWith(`${l.key}.`))) continue
    out.push({ key, level, origin: "defaults", from: "config file: personal.defaults" })
  }
  return out
}

function access(levels: OwnLevel[], ceiling: Level | null): CommandAccess[] {
  return COMMANDS.map(([text, writes]) => {
    const path = text.split(" ")
    const key = path.join(".")
    if (path[0] === "config" || path[0] === "runs")
      return { path, writes, available: true, reason: null, permission: null }
    let level: Level = "allow"
    for (let n = path.length; n > 0; n--) {
      const found = levels.find((l) => l.key === path.slice(0, n).join("."))
      if (found) {
        level = found.level
        break
      }
    }
    if (ceiling && ORDER[ceiling] < ORDER[level]) level = ceiling
    if (level === "deny")
      return { path, writes, available: false, reason: `the profile denies ${key}`, permission: key }
    if (level === "readonly" && writes)
      return { path, writes, available: false, reason: `${key} is readonly in this profile`, permission: key }
    return { path, writes, available: true, reason: null, permission: null }
  })
}

const reject = (message: string) => Promise.reject(new Error(message))
const LEVELS = new Set(["deny", "readonly", "ask", "allow"])

export function permissionsMock(
  settings: Pick<Platform, "settingsSet" | "settingsUnset">,
): Pick<Platform, "permissionsShow" | "settingsSet" | "settingsUnset"> {
  return {
    async permissionsShow(id, profile): Promise<Permissions> {
      await delay(300)
      if (!(id in state)) throw new Error("WireCat cannot show this tool's permissions yet.")
      const levels = merged(id, profile)
      const ceiling: Level | null = mode === "readonly" ? "readonly" : null
      const commands = profile === null || mode === "old" ? null : access(levels, ceiling)
      return { levels, ceiling, commands, commandsError: null }
    },

    async settingsSet(id, profile, defaults, setting, value) {
      if (!setting.startsWith("permissions.")) return settings.settingsSet(id, profile, defaults, setting, value)
      await delay(250)
      const layers = state[id]
      if (!layers) return reject("This tool has no settings command.")
      if (!LEVELS.has(value)) return reject(`has to be one of deny, readonly, ask, allow, not ${value}`)
      const key = setting.slice("permissions.".length)
      if (defaults) layers.defaults[key] = value as Level
      else if (profile) layers.profiles[profile] = { ...layers.profiles[profile], [key]: value as Level }
      else return reject("name a profile")
    },

    async settingsUnset(id, profile, defaults, setting) {
      if (!setting.startsWith("permissions.")) return settings.settingsUnset(id, profile, defaults, setting)
      await delay(250)
      const layers = state[id]
      if (!layers) return reject("This tool cannot remove a setting; give it a value instead.")
      const key = setting.slice("permissions.".length)
      if (defaults) delete layers.defaults[key]
      else if (profile) delete layers.profiles[profile]?.[key]
    },
  }
}
