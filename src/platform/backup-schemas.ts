import * as v from "valibot"

export const BackupFileSchema = v.object({
  name: v.string(),
  bytes: v.number(),
  /** Milliseconds since the Unix epoch. */
  modified: v.number(),
})

export const BackupsSchema = v.object({ folder: v.string(), files: v.array(BackupFileSchema) })

export const BackupEventSchema = v.variant("event", [
  v.object({ event: v.literal("copying"), done: v.number(), total: v.number() }),
  v.object({ event: v.literal("compressing"), done: v.number(), total: v.number() }),
  v.object({
    event: v.literal("done"),
    file: BackupFileSchema,
    folder: v.string(),
    storeBytes: v.number(),
    millis: v.number(),
  }),
  v.object({ event: v.literal("cancelled") }),
  v.object({ event: v.literal("failed"), message: v.string() }),
])

export const ResetPreviewSchema = v.nullable(
  v.object({
    answeredBy: v.string(),
    bin: v.string(),
    /** False while the installed tool is older than `store reset --dry-run`. */
    supported: v.boolean(),
    exists: v.boolean(),
    files: v.array(v.string()),
    bytes: v.number(),
    schema: v.nullable(v.number()),
    tables: v.array(v.object({ name: v.string(), rows: v.number() })),
    inUse: v.nullable(v.boolean()),
  }),
)

export const ResetDoneSchema = v.nullable(v.number())

export type BackupFile = v.InferOutput<typeof BackupFileSchema>
export type Backups = v.InferOutput<typeof BackupsSchema>
export type BackupEvent = v.InferOutput<typeof BackupEventSchema>
export type ResetPreview = NonNullable<v.InferOutput<typeof ResetPreviewSchema>>
