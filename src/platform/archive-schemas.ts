import * as v from "valibot"

const count = v.pipe(v.number(), v.integer(), v.minValue(0))

const GroupSchema = v.object({
  provider: v.string(),
  key: v.nullable(v.string()),
  accounts: count,
  chats: count,
  messages: count,
  emails: count,
  documents: count,
  meetings: count,
})

export const BreakdownSchema = v.object({
  providers: v.array(GroupSchema),
  chatKinds: v.array(GroupSchema),
  accounts: v.array(GroupSchema),
  years: v.array(GroupSchema),
  attachmentKinds: v.array(v.object({ owner: v.string(), kind: v.string(), count, bytes: count })),
})

/** `null` when no messenger tool is installed to ask. */
export const StoreInfoSchema = v.nullable(
  v.object({
    answeredBy: v.string(),
    path: v.nullable(v.string()),
    exists: v.boolean(),
    problem: v.nullable(v.string()),
    fileBytes: count,
    walBytes: count,
    schema: v.nullable(count),
    writable: v.nullable(v.boolean()),
    rows: v.record(v.string(), count),
    searchReady: v.nullable(v.boolean()),
    breakdown: v.nullable(BreakdownSchema),
  }),
)

export type Group = v.InferOutput<typeof GroupSchema>
export type Breakdown = v.InferOutput<typeof BreakdownSchema>
export type StoreInfo = NonNullable<v.InferOutput<typeof StoreInfoSchema>>
