import * as v from "valibot"

export const TargetSchema = v.picklist(["claude", "agents"])

export const AgentsSchema = v.array(
  v.object({
    id: v.string(),
    name: v.string(),
    foundBy: v.nullable(v.picklist(["program", "folder"])),
    reads: v.array(TargetSchema),
  }),
)

/** `state: null` when only the installed version is known; the interface compares it with the tool's. */
export const SkillReportSchema = v.object({
  source: v.picklist(["status", "doctor", "none"]),
  targets: v.array(
    v.object({
      target: TargetSchema,
      path: v.nullable(v.string()),
      installed: v.nullable(v.string()),
      state: v.nullable(v.picklist(["current", "stale", "missing", "unversioned"])),
    }),
  ),
})

/** The version `skill install` wrote, when the tool said. */
export const SkillWrittenSchema = v.nullable(v.string())

export type Target = v.InferOutput<typeof TargetSchema>
export type Agent = v.InferOutput<typeof AgentsSchema>[number]
export type SkillReport = v.InferOutput<typeof SkillReportSchema>
