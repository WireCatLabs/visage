import * as v from "valibot"

// Owned by the Logs feature: the shapes of `runs list --json` and `runs show --json` after redaction.
// Loose on purpose: older runs lack some fields and newer ones add more (cli-core `recordedRun`).
const RunEntries = {
  run_id: v.string(),
  command: v.optional(v.string(), ""),
  profile: v.optional(v.string()),
  started_at: v.string(),
  completed_at: v.optional(v.string()),
  status: v.string(),
  duration_ms: v.optional(v.number()),
  requests: v.optional(v.number()),
  cli_version: v.optional(v.string()),
  error_code: v.optional(v.string()),
  operations: v.optional(v.array(v.string())),
  codes: v.optional(v.array(v.string())),
}

export const RunItemSchema = v.looseObject(RunEntries)

export const RunsPageSchema = v.looseObject({
  items: v.array(RunItemSchema),
  page: v.optional(v.looseObject({ has_more: v.optional(v.boolean(), false) }), { has_more: false }),
})

export const RunEventSchema = v.record(v.string(), v.unknown())

export const RunDetailSchema = v.looseObject({
  item: v.looseObject({
    ...RunEntries,
    event_count: v.optional(v.number()),
    events: v.optional(v.array(RunEventSchema), []),
  }),
})

export type RunItem = v.InferOutput<typeof RunItemSchema>
export type RunsPage = v.InferOutput<typeof RunsPageSchema>
export type RunDetail = v.InferOutput<typeof RunDetailSchema>
export type RunEvent = v.InferOutput<typeof RunEventSchema>
