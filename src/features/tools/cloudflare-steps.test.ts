import { describe, expect, it } from "vitest"
import type { CloudflareStatus } from "@/platform/cloudflare-schemas"
import { cloudflareSteps } from "./cloudflare-steps"

const NOTHING: CloudflareStatus = {
  os: "linux",
  supported: true,
  installed: false,
  version: null,
  signedIn: false,
  hostname: null,
  running: false,
}

const done = (s: CloudflareStatus) => cloudflareSteps(s).map((x) => x.done)

describe("Cloudflare tunnel steps", () => {
  it("goes download, account, address, and a later step waits for the one before", () => {
    expect(done(NOTHING)).toEqual([false, false, false])
    expect(cloudflareSteps(NOTHING)[1]?.missing).toBe("Waits for the step before it.")
    expect(done({ ...NOTHING, installed: true })).toEqual([true, false, false])
    expect(done({ ...NOTHING, installed: true, signedIn: true })).toEqual([true, true, false])
    expect(done({ ...NOTHING, installed: true, hostname: "wirecat.example.com" })).toEqual([true, true, true])
  })

  it("reopens the address while the owner logs in again to choose another name", () => {
    expect(done({ ...NOTHING, installed: true, signedIn: true, hostname: "wirecat.example.com" })).toEqual([
      true,
      true,
      false,
    ])
  })

  it("says so where cloudflared has no build for the processor", () => {
    expect(cloudflareSteps({ ...NOTHING, supported: false })[0]?.missing).toMatch(/no cloudflared for this computer/)
  })
})
