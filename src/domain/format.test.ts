import { describe, expect, it } from "vitest"
import { formatBytes } from "./format"

describe("formatBytes", () => {
  it("picks a readable unit", () => {
    expect(formatBytes(512)).toBe("512 bytes")
    expect(formatBytes(1536)).toBe("1.5 KB")
    expect(formatBytes(1450 * 1024 * 1024)).toBe("1.4 GB")
    expect(formatBytes(210 * 1024 * 1024)).toBe("210 MB")
  })
})
