import * as v from "valibot"

/** The tool's `mcp server status`. The code, the address and the apps' names come unmasked: never log or report them. */
export const McpServerStatusSchema = v.object({
  running: v.boolean(),
  listening: v.boolean(),
  startedHere: v.boolean(),
  startedAt: v.nullable(v.string()),
  port: v.nullable(v.number()),
  connectorUrl: v.nullable(v.string()),
  loginCode: v.nullable(v.object({ code: v.string(), expiresAt: v.string() })),
  outdated: v.boolean(),
  clients: v.array(v.object({ claimedName: v.nullable(v.string()), lastLoginAt: v.string() })),
})

export type McpServerStatus = v.InferOutput<typeof McpServerStatusSchema>
