import * as v from "valibot"

// Owned by the Search feature: `search_store`'s answer (`src-tauri/src/search.rs`). A hit is whatever the tool
// printed for it; `src/domain/search.ts` picks what the table shows.
const SpanSchema = v.object({ start: v.number(), end: v.number() })

export const SearchHitSchema = v.record(v.string(), v.unknown())

export const SearchAnswerSchema = v.variant("kind", [
  v.object({
    kind: v.literal("hits"),
    hits: v.array(SearchHitSchema),
    hasMore: v.boolean(),
    paged: v.boolean(),
    notes: v.array(v.string()),
  }),
  v.object({
    kind: v.literal("queryError"),
    reason: v.string(),
    message: v.string(),
    span: v.nullable(SpanSchema),
  }),
  v.object({ kind: v.literal("old"), message: v.string() }),
  v.object({ kind: v.literal("failed"), message: v.string() }),
])

export type SearchHit = v.InferOutput<typeof SearchHitSchema>
export type SearchAnswer = v.InferOutput<typeof SearchAnswerSchema>
