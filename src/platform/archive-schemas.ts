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

const FileFactsSchema = v.object({
  journalMode: v.string(),
  pageSize: count,
  pageCount: count,
  freePages: count,
  migrations: v.array(v.object({ version: count, minCompatible: count, appliedAt: v.string() })),
  backup: v.nullable(v.object({ at: v.string(), file: v.nullable(v.string()), checked: v.nullable(v.string()) })),
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
    speaks: v.nullable(count),
    writable: v.nullable(v.boolean()),
    rows: v.record(v.string(), count),
    searchReady: v.nullable(v.boolean()),
    breakdown: v.nullable(BreakdownSchema),
    facts: v.nullable(FileFactsSchema),
  }),
)

const TableSchema = v.object({
  name: v.string(),
  kind: v.string(),
  rows: v.nullable(count),
  bytes: v.nullable(count),
})

export const TableListSchema = v.nullable(
  v.object({
    answeredBy: v.string(),
    available: v.boolean(),
    measured: v.boolean(),
    tables: v.array(TableSchema),
  }),
)

export const StoreCheckSchema = v.nullable(
  v.object({
    answeredBy: v.string(),
    bin: v.string(),
    ok: v.boolean(),
    problem: v.nullable(v.string()),
    schema: v.nullable(count),
    minCompatible: v.nullable(count),
    speaks: v.nullable(count),
    writable: v.nullable(v.boolean()),
    checks: v.record(v.string(), v.boolean()),
    integrity: v.array(v.string()),
    foreignKeyViolations: count,
    brokenIndexes: v.array(v.string()),
    diskFree: count,
    diskNeeded: count,
    chatsBehind: count,
    orphanPointers: count,
    fixes: v.array(v.string()),
  }),
)

export type Group = v.InferOutput<typeof GroupSchema>
export type Breakdown = v.InferOutput<typeof BreakdownSchema>
export type StoreInfo = NonNullable<v.InferOutput<typeof StoreInfoSchema>>
export type FileFacts = v.InferOutput<typeof FileFactsSchema>
export type Table = v.InferOutput<typeof TableSchema>
export type TableList = NonNullable<v.InferOutput<typeof TableListSchema>>
export type StoreCheck = NonNullable<v.InferOutput<typeof StoreCheckSchema>>
