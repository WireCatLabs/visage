import * as v from "valibot"
import { describe, expect, it } from "vitest"
import { SearchAnswerSchema } from "./search-schemas"

// The same literals `answers_serialize_as_the_interface_reads_them` in search.rs asserts Rust prints.
describe("SearchAnswerSchema", () => {
  it("reads every answer search_store gives", () => {
    const answers = [
      { kind: "hits", hits: [{ ref: "msg:1" }], hasMore: true, paged: true, notes: ["n"] },
      { kind: "queryError", reason: "query.invalid-syntax", message: "m", span: null },
      { kind: "queryError", reason: "r", message: "m", span: { start: 0, end: 7 } },
      { kind: "old", message: "m" },
      { kind: "failed", message: "m" },
      { kind: "failed", message: "m", candidates: [{ id: "-1001", label: "@kyrillic", field: "chat" }] },
    ]
    for (const answer of answers)
      expect(v.parse(SearchAnswerSchema, answer)).toEqual(
        answer.kind === "failed" ? { candidates: [], ...answer } : answer,
      )
  })
})
