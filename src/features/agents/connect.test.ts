import { afterEach, beforeEach, expect, it, vi } from "vitest"
import { platform } from "@/platform/bridge"
import { useConnect } from "./connect"

beforeEach(() => useConnect.setState(useConnect.getInitialState(), true))
afterEach(() => vi.restoreAllMocks())

it("never asks a profile that is not signed in for its tasks, and keeps it out of the errors", async () => {
  vi.spyOn(platform, "terminalReach").mockResolvedValue({})
  vi.spyOn(platform, "listProfiles").mockResolvedValue([
    { name: "personal", signedIn: false },
    { name: "work", signedIn: true },
  ])
  const asked = vi
    .spyOn(platform, "taskClaims")
    .mockResolvedValue({ items: [], open: 0, more: false, signedOut: false })

  await useConnect.getState().load([], ["max"])

  expect(asked.mock.calls).toEqual([["max", "work"]])
  expect(useConnect.getState().claims["max/personal"]).toEqual({
    state: "ready",
    data: { items: [], more: false, signedOut: true },
  })
})
