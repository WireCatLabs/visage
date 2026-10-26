import * as v from "valibot"

/** What each step of the Tailscale guide needs to know; Rust reads it from `tailscale status --json` and friends. */
export const TailscaleStatusSchema = v.object({
  os: v.picklist(["linux", "macos", "windows"]),
  installed: v.boolean(),
  /** What the app can download and hand to the system's installer. */
  package: v.nullable(v.picklist(["pkg", "exe", "deb", "rpm"])),
  /** Linux: may this user change Tailscale's settings without root. Null where it does not apply or is not known. */
  operator: v.nullable(v.boolean()),
  user: v.nullable(v.string()),
  /** tailscaled answered. */
  daemon: v.boolean(),
  backend: v.picklist(["running", "needsLogin", "needsApproval", "stopped", "starting", "unknown"]),
  https: v.boolean(),
  funnel: v.boolean(),
  host: v.nullable(v.string()),
  freePorts: v.array(v.number()),
})

export const TailscaleDownloadSchema = v.object({ path: v.string(), file: v.string(), opened: v.boolean() })

/** A funnel the app turned on, and whether it still points at the server. */
export const FunnelStateSchema = v.object({
  tool: v.string(),
  profile: v.nullable(v.string()),
  url: v.string(),
  port: v.number(),
  live: v.boolean(),
})

/** A Tailscale page the app opened in the browser; the address is a one-time login link: never log it. */
export const PageEventSchema = v.object({ event: v.literal("opened"), url: v.pipe(v.string(), v.url()) })

export type TailscaleStatus = v.InferOutput<typeof TailscaleStatusSchema>
export type TailscaleDownload = v.InferOutput<typeof TailscaleDownloadSchema>
export type FunnelState = v.InferOutput<typeof FunnelStateSchema>
