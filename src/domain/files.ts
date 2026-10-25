// What the entries in each tool's folders are. Names come from the tools' sources (cli-core, cli-memo, max-cli,
// drive-cli); the app lists names and sizes only and never opens a file.

export type EntryInfo = {
  what: string
  /** Sign-in material: shown by size only. */
  secret?: boolean
}

type Rule = { test: (name: string, area: string, kind: string) => boolean; info: EntryInfo }

const is = (n: string) => (name: string) => name === n

const RULES: readonly Rule[] = [
  { test: is("sessions"), info: { what: "Sign-in sessions. Credentials: size only, never opened.", secret: true } },
  {
    test: (name, area) => name === "profiles" && (area === "max" || area === "drive"),
    info: { what: "Sign-in state for each profile. Credentials: size only, never opened.", secret: true },
  },
  {
    test: (name) => name.startsWith("client_secret_"),
    info: { what: "Google sign-in app credentials. Size only, never opened.", secret: true },
  },
  { test: is("config.json"), info: { what: "Settings, the ones the Config page shows" } },
  {
    test: (name) => name.startsWith("config.json."),
    info: { what: "An older copy of the settings, kept before a change" },
  },
  { test: is("runs"), info: { what: "Run logs, the ones the Logs page shows" } },
  { test: is("backfill"), info: { what: "History sync jobs and how far each got" } },
  { test: is("sends"), info: { what: "A journal of every send attempt, never the text" } },
  { test: is("accounts"), info: { what: "Which account each profile is, for reading offline" } },
  { test: is("pace"), info: { what: "How fast each profile may ask the messenger" } },
  { test: is("flood"), info: { what: "Holds the messenger placed on sending, per profile" } },
  { test: is("serve"), info: { what: "Background server logs and locks" } },
  { test: is("bots"), info: { what: "Registered bots and their send journals" } },
  { test: is("update-check.json"), info: { what: "When the tool last looked for a new version" } },
  { test: is("wirecat.db"), info: { what: "The shared archive: messages, mail, documents, meetings" } },
  { test: (name) => /\.db-(wal|shm)$/.test(name), info: { what: "Part of the database beside it (write log)" } },
  { test: is("backups"), info: { what: "Backup copies of the database" } },
  { test: is("models"), info: { what: "Search models, downloaded once" } },
  { test: is("drive.db"), info: { what: "Drive's own older store, from before the shared archive" } },
  {
    test: (name, area, kind) => area === "max" && kind === "cache" && name.endsWith(".db"),
    info: { what: "An older per-profile message cache, from before the shared archive" },
  },
  { test: is("folders"), info: { what: "Which note folders memo reads and how far it got" } },
  { test: is("mail-trash"), info: { what: "Mail moved to the trash, kept so it can be undone" } },
  { test: is("domain-ages.json"), info: { what: "How old each mail sender's domain is, remembered" } },
  { test: is("auto"), info: { what: "When memo last synced on its own" } },
  { test: (name) => name.startsWith("import.lock"), info: { what: "A lock left by an import" } },
]

/** `null` for a name no tool documents; the page then shows its name and size only. */
export function describeEntry(area: string, kind: string, name: string): EntryInfo | null {
  return RULES.find((r) => r.test(name, area, kind))?.info ?? null
}
