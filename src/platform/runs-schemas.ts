import * as v from "valibot"

// Owned by the Logs feature: the shapes of `runs list --json` and `runs show --json` after redaction.
export const RunsPageSchema = v.unknown()
export const RunDetailSchema = v.unknown()

export type RunsPage = v.InferOutput<typeof RunsPageSchema>
export type RunDetail = v.InferOutput<typeof RunDetailSchema>
