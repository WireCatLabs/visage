import { describe, expect, it } from "vitest"
import { MOCK_CODES } from "@/platform/mock-qr"
import { qrModules, qrPath } from "./qr"

const finderAt = (dark: boolean[][], top: number, left: number) =>
  [0, 1, 2, 3, 4, 5, 6].every((r) =>
    [0, 1, 2, 3, 4, 5, 6].every((c) => {
      const ring = Math.max(Math.abs(r - 3), Math.abs(c - 3))
      return dark[top + r]?.[left + c] === (ring !== 2)
    }),
  )

describe("qrModules", () => {
  it("turns the tool's light-glyph drawing back into a square grid with three finder patterns", () => {
    const dark = qrModules(MOCK_CODES[0] ?? "")
    expect(dark).toHaveLength(33)
    expect(dark?.every((row) => row.length === 33)).toBe(true)
    if (!dark) return
    expect(dark.slice(0, 4).flat().some(Boolean)).toBe(false)
    expect(finderAt(dark, 4, 4)).toBe(true)
    expect(finderAt(dark, 4, 33 - 11)).toBe(true)
    expect(finderAt(dark, 33 - 11, 4)).toBe(true)
    expect(finderAt(dark, 33 - 11, 33 - 11)).toBe(false)
  })

  it("refuses text that is not a drawing", () => {
    expect(qrModules("")).toBeNull()
    expect(qrModules("scan in WhatsApp")).toBeNull()
    expect(qrModules("██\n█")).toBeNull()
  })

  it("draws each run of dark modules as one rectangle", () => {
    expect(
      qrPath([
        [true, true, false],
        [false, false, true],
      ]),
    ).toBe("M0 0h2v1h-2zM2 1h1v1h-1z")
  })
})
