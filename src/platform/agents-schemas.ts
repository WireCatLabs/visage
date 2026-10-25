import * as v from "valibot"

export const TargetSchema = v.picklist(["claude", "agents", "hermes"])

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

/** The SKILL.md the installed version of a tool ships, as `skill show --json` prints it. */
export const SkillTextSchema = v.object({ name: v.string(), content: v.string() })

/** By tool id: whether a terminal's own PATH finds the tool, without the folders the app adds. */
export const TerminalReachSchema = v.record(v.string(), v.boolean())

/** WireCat server names an agent has registered, and where that was read. */
export const RegistrationsSchema = v.object({
  source: v.string(),
  names: v.array(v.string()),
  canAdd: v.boolean(),
  canRemove: v.boolean(),
  /** Where the owner can look when the app does not read this agent's servers. */
  unread: v.optional(v.nullable(v.string()), null),
})

/** The chat apps that can drive an agent, by name only; `running` is null when the source does not say. */
export const ChatsSchema = v.object({
  source: v.string(),
  running: v.nullable(v.boolean()),
  channels: v.array(v.string()),
})

/** A profile's MCP server, started once by the tool's own `mcp check`. */
export const McpHealthSchema = v.object({
  healthy: v.boolean(),
  signedIn: v.boolean(),
  tools: v.number(),
  potentialWrites: v.number(),
})

/** Claimed open tasks of one profile: ids, keys and holders only, never a title. */
export const ClaimsSchema = v.object({
  items: v.array(
    v.object({ id: v.string(), key: v.nullable(v.string()), holder: v.string(), until: v.nullable(v.string()) }),
  ),
  open: v.number(),
  more: v.boolean(),
})

export type SkillText = v.InferOutput<typeof SkillTextSchema>
export type Registrations = v.InferOutput<typeof RegistrationsSchema>
export type Chats = v.InferOutput<typeof ChatsSchema>
export type McpHealth = v.InferOutput<typeof McpHealthSchema>
export type Claims = v.InferOutput<typeof ClaimsSchema>
export type Claim = Claims["items"][number]
