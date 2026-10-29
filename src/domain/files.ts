// What the entries in each tool's folders are. Names come from the tools' sources (cli-core, cli-memo, max-cli,
// drive-cli); the app lists names and sizes only and never opens a file.

export type EntryKey =
  | "sessions"
  | "profiles"
  | "googleClient"
  | "config"
  | "configCopy"
  | "runs"
  | "backfill"
  | "sends"
  | "accounts"
  | "pace"
  | "flood"
  | "serve"
  | "bots"
  | "updateCheck"
  | "store"
  | "storeLog"
  | "backups"
  | "models"
  | "driveStore"
  | "maxCache"
  | "folders"
  | "mailTrash"
  | "domainAges"
  | "auto"
  | "importLock"

/** What an entry is, as a key the Storage page's catalog explains. */
export type EntryInfo = {
  key: EntryKey
  /** Sign-in material: shown by size only. */
  secret?: boolean
}

type Rule = { test: (name: string, area: string, kind: string) => boolean; info: EntryInfo }

const is = (n: string) => (name: string) => name === n

const RULES: readonly Rule[] = [
  { test: is("sessions"), info: { key: "sessions", secret: true } },
  {
    test: (name, area) => name === "profiles" && (area === "max" || area === "drive"),
    info: { key: "profiles", secret: true },
  },
  {
    test: (name) => name.startsWith("client_secret_"),
    info: { key: "googleClient", secret: true },
  },
  { test: is("config.json"), info: { key: "config" } },
  {
    test: (name) => name.startsWith("config.json."),
    info: { key: "configCopy" },
  },
  { test: is("runs"), info: { key: "runs" } },
  { test: is("backfill"), info: { key: "backfill" } },
  { test: is("sends"), info: { key: "sends" } },
  { test: is("accounts"), info: { key: "accounts" } },
  { test: is("pace"), info: { key: "pace" } },
  { test: is("flood"), info: { key: "flood" } },
  { test: is("serve"), info: { key: "serve" } },
  { test: is("bots"), info: { key: "bots" } },
  { test: is("update-check.json"), info: { key: "updateCheck" } },
  { test: is("wirecat.db"), info: { key: "store" } },
  { test: (name) => /\.db-(wal|shm)$/.test(name), info: { key: "storeLog" } },
  { test: is("backups"), info: { key: "backups" } },
  { test: is("models"), info: { key: "models" } },
  { test: is("drive.db"), info: { key: "driveStore" } },
  {
    test: (name, area, kind) => area === "max" && kind === "cache" && name.endsWith(".db"),
    info: { key: "maxCache" },
  },
  { test: is("folders"), info: { key: "folders" } },
  { test: is("mail-trash"), info: { key: "mailTrash" } },
  { test: is("domain-ages.json"), info: { key: "domainAges" } },
  { test: is("auto"), info: { key: "auto" } },
  { test: (name) => name.startsWith("import.lock"), info: { key: "importLock" } },
]

/** `null` for a name no tool documents; the page then shows its name and size only. */
export function describeEntry(area: string, kind: string, name: string): EntryInfo | null {
  return RULES.find((r) => r.test(name, area, kind))?.info ?? null
}
