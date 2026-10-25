import * as v from "valibot"

// What Rust sends is checked here once, so a drift between the two sides fails loudly at the boundary
// instead of rendering `undefined` somewhere in the interface.

const Program = v.object({
  path: v.nullable(v.string()),
  version: v.nullable(v.string()),
  ok: v.boolean(),
  problem: v.nullable(v.string()),
})

export const ReadinessSchema = v.object({
  os: v.string(),
  arch: v.string(),
  node: Program,
  npm: Program,
  pnpm: Program,
  npmPrefix: v.nullable(v.string()),
  npmPrefixWritable: v.nullable(v.boolean()),
  managed: v.nullable(v.object({ version: v.string(), dir: v.string(), active: v.boolean() })),
})

export const NodeOfferSchema = v.object({ version: v.string(), bytes: v.nullable(v.number()), dir: v.string() })

export const NodePathSchema = v.object({
  shell: v.string(),
  file: v.nullable(v.string()),
  line: v.string(),
  added: v.boolean(),
  automatic: v.boolean(),
})

const InstallRecord = v.object({
  path: v.string(),
  version: v.nullable(v.string()),
  manager: v.string(),
  problem: v.nullable(v.string()),
})

export const ToolStatesSchema = v.array(v.object({ id: v.string(), installs: v.array(InstallRecord) }))

export const LatestVersionsSchema = v.record(v.string(), v.nullable(v.string()))

export const ProfilesSchema = v.nullable(v.array(v.object({ name: v.string(), signedIn: v.nullable(v.boolean()) })))

export const DiagnosisSchema = v.object({
  command: v.string(),
  exitCode: v.nullable(v.number()),
  durationMs: v.number(),
  report: v.unknown(),
  stderr: v.string(),
})

const FailReason = v.picklist(["requirements", "permission", "network", "timeout", "cancelled", "verify", "failed"])

export const InstallEventSchema = v.variant("event", [
  v.object({ event: v.literal("step"), step: v.picklist(["check", "install", "remove", "verify"]) }),
  v.object({ event: v.literal("log"), line: v.string(), stderr: v.boolean() }),
  v.object({ event: v.literal("done"), version: v.string(), path: v.string(), shadowedBy: v.nullable(v.string()) }),
  v.object({ event: v.literal("removed") }),
  v.object({ event: v.literal("failed"), reason: FailReason, message: v.string(), hint: v.nullable(v.string()) }),
])

export const NodeEventSchema = v.variant("event", [
  v.object({ event: v.literal("step"), step: v.picklist(["check", "download", "verify", "unpack"]) }),
  v.object({ event: v.literal("progress"), received: v.number(), total: v.nullable(v.number()) }),
  v.object({ event: v.literal("done"), version: v.string(), path: v.string() }),
  v.object({ event: v.literal("failed"), reason: FailReason, message: v.string(), hint: v.nullable(v.string()) }),
])

export const StorageSchema = v.array(
  v.object({
    id: v.string(),
    folders: v.array(
      v.object({
        kind: v.picklist(["config", "state", "cache"]),
        path: v.string(),
        bytes: v.number(),
        /** One level, largest first; names and sizes only. */
        entries: v.array(v.object({ name: v.string(), dir: v.boolean(), bytes: v.number() })),
      }),
    ),
    usedBy: v.array(v.string()),
  }),
)

export type Readiness = v.InferOutput<typeof ReadinessSchema>
export type ProgramState = v.InferOutput<typeof Program>
export type ToolState = v.InferOutput<typeof ToolStatesSchema>[number]
export type Profile = NonNullable<v.InferOutput<typeof ProfilesSchema>>[number]
export type Diagnosis = v.InferOutput<typeof DiagnosisSchema>
export type InstallEvent = v.InferOutput<typeof InstallEventSchema>
export type NodeOffer = v.InferOutput<typeof NodeOfferSchema>
export type NodePath = v.InferOutput<typeof NodePathSchema>
export type NodeEvent = v.InferOutput<typeof NodeEventSchema>
export type StorageArea = v.InferOutput<typeof StorageSchema>[number]
export type StorageFolder = StorageArea["folders"][number]
