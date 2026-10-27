import * as v from "valibot"

/** What each step of the Cloudflare tunnel guide needs to know (`cloudflare.rs`). */
export const CloudflareStatusSchema = v.object({
  os: v.picklist(["linux", "macos", "windows"]),
  /** cloudflared publishes a build for this computer's processor. */
  supported: v.boolean(),
  installed: v.boolean(),
  version: v.nullable(v.string()),
  /** Logged in to Cloudflare, with no tunnel made yet: the next step is the address. */
  signedIn: v.boolean(),
  /** The tunnel's name on the owner's domain, once it exists. */
  hostname: v.nullable(v.string()),
  /** cloudflared runs and holds a connection to Cloudflare. */
  running: v.boolean(),
})

/** A tool the tunnel carries, and whether cloudflared is up now. */
export const TunnelRouteSchema = v.object({
  tool: v.string(),
  url: v.string(),
  port: v.number(),
  live: v.boolean(),
})

export type CloudflareStatus = v.InferOutput<typeof CloudflareStatusSchema>
export type TunnelRoute = v.InferOutput<typeof TunnelRouteSchema>
