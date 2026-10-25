import * as v from "valibot"
import raw from "../../catalog/tools.json"

const ToolSchema = v.object({
  id: v.pipe(v.string(), v.regex(/^[a-z]+$/)),
  name: v.string(),
  bin: v.string(),
  package: v.pipe(v.string(), v.startsWith("@wirecat/")),
  summary: v.string(),
  docs: v.pipe(v.string(), v.url()),
  repo: v.pipe(v.string(), v.url()),
  profiles: v.nullable(v.object({ args: v.array(v.string()), shape: v.string() })),
  doctor: v.array(v.string()),
  setup: v.nullable(v.array(v.string())),
  storage: v.object({ app: v.string(), env: v.string() }),
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

export const doctorNeedsProfile = (t: CatalogTool) => t.doctor.includes("{profile}")

export const PROFILE_NAME = /^[A-Za-z0-9._-]{1,64}$/
export const isValidProfile = (name: string) => PROFILE_NAME.test(name) && !name.startsWith("-")
