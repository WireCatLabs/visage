import * as v from "valibot"

/** `self`: replaces itself (macOS, Windows, AppImage). `deb`, `rpm`: the system's installer replaces it.
 * `other`: a Linux build that does not know how it was installed, so only the download page can help. */
export const UpdateKindSchema = v.picklist(["self", "deb", "rpm", "other"])
export type UpdateKind = v.InferOutput<typeof UpdateKindSchema>

export const UpdateProgressSchema = v.object({ downloaded: v.number(), total: v.nullable(v.number()) })
export type UpdateProgress = v.InferOutput<typeof UpdateProgressSchema>

export const PackageOutcomeSchema = v.variant("result", [
  v.object({
    result: v.literal("saved"),
    file: v.string(),
    path: v.string(),
    opened: v.boolean(),
    command: v.string(),
  }),
  v.object({ result: v.literal("badSignature") }),
])
export type PackageOutcome = v.InferOutput<typeof PackageOutcomeSchema>
