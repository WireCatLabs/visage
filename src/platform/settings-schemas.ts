import * as v from "valibot"

// Owned by the Config feature: the shape of `config show --json` after redaction.
export const SettingsSchema = v.unknown()

export type Settings = v.InferOutput<typeof SettingsSchema>
