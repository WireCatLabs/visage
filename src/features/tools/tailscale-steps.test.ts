import { describe, expect, it } from "vitest"
import type { TailscaleStatus } from "@/platform/tailscale-schemas"
import { addressOf, stepsOf } from "./tailscale-steps"

const READY: TailscaleStatus = {
  os: "linux",
  installed: true,
  package: "deb",
  linux: null,
  operator: true,
  user: "alex",
  daemon: true,
  backend: "running",
  https: true,
  funnel: true,
  host: "h.ts.net",
  freePorts: [8443, 10000],
}

const done = (s: TailscaleStatus) => stepsOf(s).map((step) => step.done)

describe("Tailscale steps", () => {
  it("are all done on a ready computer, with the first free Funnel port in the address", () => {
    expect(done(READY)).toEqual([true, true, true, true])
    expect(addressOf(READY)).toBe("https://h.ts.net:8443")
    expect(addressOf({ ...READY, freePorts: [443] })).toBe("https://h.ts.net")
  })

  it("stop at the first missing step, and every later one waits for it", () => {
    const missing = stepsOf({ ...READY, installed: false })
    expect(missing.map((s) => s.done)).toEqual([false, false, false, false])
    expect(missing[1]?.missing).toBe("Waits for the step before it.")
    expect(done({ ...READY, operator: false })[0]).toBe(false)
    expect(done({ ...READY, operator: null })[0]).toBe(true)
    expect(done({ ...READY, backend: "needsApproval" })).toEqual([true, false, false, false])
    expect(done({ ...READY, funnel: false })).toEqual([true, true, false, false])
    expect(stepsOf({ ...READY, freePorts: [] })[3]?.missing).toMatch(/all .* in use/i)
  })
})
