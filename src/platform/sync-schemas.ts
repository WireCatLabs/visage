import * as v from "valibot"

export const SyncSummarySchema = v.object({
  new: v.number(),
  places: v.number(),
  failed: v.number(),
  left: v.number(),
  complete: v.boolean(),
})

export const SyncEventSchema = v.variant("event", [
  v.object({ event: v.literal("stage"), stage: v.string() }),
  v.object({ event: v.literal("done"), summary: SyncSummarySchema }),
  v.object({ event: v.literal("stopped") }),
  v.object({
    event: v.literal("failed"),
    message: v.string(),
    code: v.nullable(v.string()),
    reason: v.nullable(v.string()),
  }),
])

export const LastSyncSchema = v.object({
  at: v.nullable(v.string()),
  left: v.nullable(v.number()),
  known: v.boolean(),
})

export type SyncSummary = v.InferOutput<typeof SyncSummarySchema>
export type SyncEvent = v.InferOutput<typeof SyncEventSchema>
export type LastSync = v.InferOutput<typeof LastSyncSchema>
