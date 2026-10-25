import * as v from "valibot"
import { OriginSchema } from "./settings-schemas"

export const LevelSchema = v.picklist(["deny", "readonly", "ask", "allow"])

/** A level the owner set in a config file; the tool's built-in defaults are not listed. */
export const OwnLevelSchema = v.object({
  key: v.string(),
  level: LevelSchema,
  origin: OriginSchema,
  from: v.nullable(v.string()),
})

export const CommandAccessSchema = v.object({
  path: v.array(v.string()),
  writes: v.boolean(),
  available: v.boolean(),
  reason: v.nullable(v.string()),
  /** The key the tool names when it blocks the command; absent for a command it lets run. */
  permission: v.nullable(v.string()),
})

export const PermissionsSchema = v.object({
  levels: v.array(OwnLevelSchema),
  /** The first-run answer no level goes above, written only by `setup`. */
  ceiling: v.nullable(LevelSchema),
  /** null when the tool does not report, per command, whether this profile may run it. */
  commands: v.nullable(v.array(CommandAccessSchema)),
  commandsError: v.nullable(v.string()),
})

export type Level = v.InferOutput<typeof LevelSchema>
export type OwnLevel = v.InferOutput<typeof OwnLevelSchema>
export type CommandAccess = v.InferOutput<typeof CommandAccessSchema>
export type Permissions = v.InferOutput<typeof PermissionsSchema>
