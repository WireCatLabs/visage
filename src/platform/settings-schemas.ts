import * as v from "valibot"

export const OriginSchema = v.picklist([
  "default",
  "defaults",
  "profile",
  "environment",
  "store",
  "computed",
  "file",
  "other",
])

/** One setting after Rust has normalised each tool's `config show` shape and masked it. */
export const SettingRowSchema = v.object({
  key: v.string(),
  value: v.unknown(),
  origin: OriginSchema,
  from: v.nullable(v.string()),
  scope: v.nullable(v.string()),
  locked: v.nullable(v.string()),
  masked: v.boolean(),
  resettable: v.boolean(),
})

export const SettingsSchema = v.object({
  rows: v.array(SettingRowSchema),
  configFile: v.nullable(v.string()),
  notice: v.nullable(v.string()),
})

export type Origin = v.InferOutput<typeof OriginSchema>
export type SettingRow = v.InferOutput<typeof SettingRowSchema>
export type Settings = v.InferOutput<typeof SettingsSchema>
