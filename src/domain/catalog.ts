import * as v from "valibot"
import raw from "../../catalog/tools.json"

const ToolSchema = v.object({
  id: v.pipe(v.string(), v.regex(/^[a-z]+$/)),
  name: v.string(),
  /** Another tool's id: this one ships in that tool's package and has no install of its own. */
  partOf: v.optional(v.pipe(v.string(), v.regex(/^[a-z]+$/))),
  /** The owner's command group that is this part, such as memo's `mail …`: its run logs are filed under the part. */
  commandPrefix: v.optional(v.string()),
  tagline: v.pipe(v.string(), v.maxLength(55)),
  bin: v.string(),
  package: v.pipe(v.string(), v.startsWith("@wirecat/")),
  summary: v.string(),
  docs: v.pipe(v.string(), v.url()),
  repo: v.pipe(v.string(), v.url()),
  profiles: v.nullable(v.object({ args: v.array(v.string()), shape: v.string() })),
  doctor: v.array(v.string()),
  runs: v.nullable(v.object({ list: v.array(v.string()), show: v.array(v.string()) })),
  setup: v.nullable(v.array(v.string())),
  signIn: v.nullable(
    v.object({
      gives: v.string(),
      asks: v.string(),
      guide: v.optional(v.pipe(v.string(), v.url())),
      /** Shown for the owner to run when the tool has no interactive `setup`; the app never runs it. */
      command: v.optional(v.string()),
      /** Sign-ins the app runs in its own window instead of a terminal, the first one by default. */
      methods: v.optional(v.array(v.object({ id: v.string(), label: v.string(), words: v.array(v.string()) }))),
    }),
  ),
  skill: v.nullable(
    v.object({
      status: v.array(v.string()),
      install: v.array(v.string()),
      doctorSkills: v.optional(v.array(v.string())),
      show: v.array(v.string()),
    }),
  ),
  /** The tool's own `mcp check` and `mcp add`; only the messenger CLIs register themselves with an agent. */
  mcp: v.nullable(v.object({ check: v.array(v.string()), add: v.array(v.string()) })),
  /** The HTTP MCP server for browser apps, run in the background by the tool; `{port}` and `{url}` are filled in Rust. */
  mcpServer: v.nullable(
    v.object({
      /** What the Start dialog offers; a different one per tool, so two tools' servers do not collide. */
      port: v.number(),
      start: v.array(v.string()),
      stop: v.array(v.string()),
      status: v.array(v.string()),
      revoke: v.array(v.string()),
      config: v.nullable(v.array(v.string())),
    }),
  ),
  /** Open tasks with their claim holders, and releasing a claim as the owner. */
  tasks: v.nullable(v.object({ list: v.array(v.string()), release: v.array(v.string()) })),
  storeInfo: v.nullable(v.array(v.string())),
  storeTables: v.nullable(v.array(v.string())),
  storeTableSizes: v.nullable(v.array(v.string())),
  storeCheck: v.nullable(v.array(v.string())),
  storeBackup: v.nullable(v.array(v.string())),
  storeBackupEncrypted: v.nullable(v.array(v.string())),
  storeResetPreview: v.nullable(v.array(v.string())),
  storeReset: v.nullable(v.array(v.string())),
  storage: v.object({ app: v.string(), env: v.string() }),
  settings: v.nullable(
    v.object({
      show: v.array(v.string()),
      set: v.array(v.string()),
      unset: v.nullable(v.array(v.string())),
      shape: v.picklist(["rows", "flat", "profiles"]),
      perProfile: v.boolean(),
      defaults: v.boolean(),
      jsonValues: v.boolean(),
      keys: v.nullable(v.record(v.string(), v.string())),
      readOnly: v.array(v.string()),
    }),
  ),
  /** Each group is a top-level command word that is also a permission key `config set` accepts. */
  permissions: v.optional(
    v.object({
      commands: v.array(v.string()),
      groups: v.array(v.object({ key: v.pipe(v.string(), v.regex(/^[a-z][a-z-]*$/)), label: v.string() })),
    }),
  ),
})

const CatalogSchema = v.object({
  requirements: v.object({ nodeLabel: v.string(), nodeDownload: v.pipe(v.string(), v.url()) }),
  tools: v.array(ToolSchema),
  sharedStorage: v.object({ app: v.string(), env: v.string(), label: v.string() }),
})

export type CatalogTool = v.InferOutput<typeof ToolSchema>

const catalog = v.parse(CatalogSchema, raw)

export const tools: readonly CatalogTool[] = catalog.tools
export const requirements = catalog.requirements
export const sharedStorage = catalog.sharedStorage

export function findTool(id: string): CatalogTool | undefined {
  return tools.find((t) => t.id === id)
}

/** The tool whose package is installed for `id`: installs, updates and uninstalls run once, under this id. */
export const ownerId = (id: string) => findTool(id)?.partOf ?? id

/** Every tool that one install brings, the owner first. */
export const samePackage = (id: string) => tools.filter((t) => ownerId(t.id) === ownerId(id))

/** The tool a run belongs to: the owner's, or a part's when the run's command is in the part's command group. */
export function runTool(owner: string, command: string): string {
  // memo puts `mcp` before the command words of a run an agent started through its MCP server.
  const words = command.split(" ")
  const word = words[0] === "mcp" && words.length > 1 ? words[1] : words[0]
  return tools.find((t) => t.partOf === owner && t.commandPrefix === word)?.id ?? owner
}

/** "Memo and Email" for a shared package, the tool's own name otherwise. */
export const packageNames = (id: string) =>
  samePackage(id)
    .map((t) => t.name)
    .join(" and ")

export const installCommand = (t: CatalogTool) => `npm install -g ${t.package}`

/** Removes one copy with the program that installed it; `install.rs` uninstall_steps maps the same managers. */
export function removeCommand(manager: string, pkg: string, path: string) {
  if (manager === "pnpm") return `pnpm remove --global ${pkg}`
  if (manager === "bun") return `bun remove --global ${pkg}`
  if (manager === "volta") return `volta uninstall ${pkg}`
  // An nvm copy belongs to the npm of its own Node version, which may not be the one a terminal has active.
  const nvm = path.match(/[\\/]\.nvm[\\/]versions[\\/]node[\\/](v[^\\/]+)[\\/]/)?.[1]
  return nvm ? `nvm exec ${nvm} npm uninstall --global ${pkg}` : `npm uninstall --global ${pkg}`
}

export const usesProfiles = (t: CatalogTool) => t.profiles !== null

/** Whether the app can sign this tool in inside its own window (`sign_in`), with no terminal. */
export const signsInHere = (t: CatalogTool) => (t.signIn?.methods?.length ?? 0) > 0

export const signInMethods = (t: CatalogTool) => t.signIn?.methods ?? []

export function setupCommand(t: CatalogTool, profile: string | null): string | null {
  if (!t.setup) return null
  const args = t.setup.map((a) => (a === "{profile}" ? (profile ?? "<profile>") : a))
  return [t.bin, ...args].join(" ")
}

export function doctorCommand(t: CatalogTool, profile: string | null): string {
  const args = t.doctor.map((a) => (a === "{profile}" ? (profile ?? "<profile>") : a))
  return [t.bin, ...args].join(" ")
}

export type SettingsSource = NonNullable<CatalogTool["settings"]>
export type PermissionGroup = NonNullable<CatalogTool["permissions"]>["groups"][number]

export const doctorNeedsProfile = (t: CatalogTool) => t.doctor.includes("{profile}")

export const PROFILE_NAME = /^[A-Za-z0-9._-]{1,64}$/
export const isValidProfile = (name: string) => PROFILE_NAME.test(name) && !name.startsWith("-")

/** The command line a catalog template runs, for showing before the owner confirms it. */
export function catalogCommand(t: CatalogTool, args: readonly string[], fill: Record<string, string>): string {
  return [t.bin, ...args.map((a) => (/^\{\w+\}$/.test(a) ? (fill[a.slice(1, -1)] ?? a) : a))].join(" ")
}
