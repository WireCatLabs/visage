import * as v from "valibot"

export const ReportContextSchema = v.object({
  app: v.object({ name: v.string(), version: v.string() }),
  system: v.object({ os: v.string(), arch: v.string(), node: v.nullable(v.string()), npm: v.nullable(v.string()) }),
  tools: v.array(v.object({ id: v.string(), version: v.nullable(v.string()), manager: v.string() })),
  attachments: v.nullable(v.record(v.string(), v.unknown())),
})

export const ReportSentSchema = v.object({
  id: v.string(),
  issueNumber: v.nullable(v.number()),
  issueUrl: v.nullable(v.string()),
})

export type ReportContext = v.InferOutput<typeof ReportContextSchema>
export type ReportSent = v.InferOutput<typeof ReportSentSchema>
export type ReportDraft = {
  summary: string
  details: string
  expected: string | null
  tool: string | null
  idempotencyKey: string
}
