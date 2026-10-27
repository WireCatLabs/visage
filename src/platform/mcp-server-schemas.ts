import * as v from "valibot"

/** The tool's `mcp server status`. The code, the address and the apps' names come unmasked: never log or report them. */
export const McpServerStatusSchema = v.object({
  /** False for a tool from before `mcp server`. */
  available: v.boolean(),
  running: v.boolean(),
  listening: v.boolean(),
  startedHere: v.boolean(),
  startedAt: v.nullable(v.string()),
  port: v.nullable(v.number()),
  connectorUrl: v.nullable(v.string()),
  loginCode: v.nullable(v.object({ code: v.string(), expiresAt: v.string() })),
  outdated: v.boolean(),
  clients: v.array(
    v.object({
      claimedName: v.nullable(v.string()),
      lastLoginAt: v.string(),
      /** From cli-core 0.454; null from an older tool, or an app that has not reached the server yet. */
      lastRequestAt: v.nullable(v.string()),
      lastTool: v.nullable(v.string()),
      lastToolAt: v.nullable(v.string()),
      /** Null when the tool is too old to count calls. */
      toolCallsToday: v.nullable(v.number()),
    }),
  ),
})

export type McpServerStatus = v.InferOutput<typeof McpServerStatusSchema>

export type McpClient = McpServerStatus["clients"][number]

/** The issuer's metadata, read by Rust from the running server, for a browser app that cannot find it itself. */
export const OAuthSettingsSchema = v.object({
  issuer: v.string(),
  authorizationEndpoint: v.string(),
  tokenEndpoint: v.string(),
  registrationEndpoint: v.nullable(v.string()),
})

export type OAuthSettings = v.InferOutput<typeof OAuthSettingsSchema>
