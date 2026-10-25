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
    }),
  ),
  skill: v.nullable(
    v.object({
      status: v.array(v.string()),
      install: v.array(v.string()),
      doctorSkills: v.optional(v.array(v.string())),
    }),
  ),
  storeInfo: v.nullable(v.array(v.string())),
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
  const word = command.split(" ")[0]
  return tools.find((t) => t.partOf === owner && t.commandPrefix === word)?.id ?? owner
}

/** "Memo and Email" for a shared package, the tool's own name otherwise. */
export const packageNames = (id: string) =>
  samePackage(id)
    .map((t) => t.name)
    .join(" and ")

export const installCommand = (t: CatalogTool) => `npm install -g ${t.package}`

export const usesProfiles = (t: CatalogTool) => t.profiles !== null

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

export const doctorNeedsProfile = (t: CatalogTool) => t.doctor.includes("{profile}")

export const PROFILE_NAME = /^[A-Za-z0-9._-]{1,64}$/
export const isValidProfile = (name: string) => PROFILE_NAME.test(name) && !name.startsWith("-")
