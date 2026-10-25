import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { platform } from "@/platform/bridge"
import type { ToolState } from "@/platform/schemas"
import { useSystem } from "../system/store"
import { readSaved, save } from "./saved"
import { useTools } from "./store"
import { ToolsPage } from "./ToolsPage"

const copy = (version: string) => [{ path: "~/bin/tg", version, manager: "pnpm" as const, problem: null }]
const answer = (version: string): ToolState[] => [{ id: "tg", installs: copy(version) }]

function held<T>() {
  let resolve: (value: T) => void = () => undefined
  const promise = new Promise<T>((r) => {
    resolve = r
  })
  return { promise, resolve }
}

beforeEach(() => {
  useTools.setState(useTools.getInitialState(), true)
  useSystem.setState({ readiness: null, error: null })
})
afterEach(() => vi.restoreAllMocks())

describe("the Tools page on a revisit", () => {
  it("keeps the last versions on screen while it checks, then shows the new ones", async () => {
    useTools.setState({ installs: { tg: copy("0.88.0") }, latest: { tg: "0.88.0" }, checked: true })
    const detect = held<ToolState[]>()
    vi.spyOn(platform, "detectTools").mockReturnValue(detect.promise)
    vi.spyOn(platform, "latestVersions").mockResolvedValue({ tg: "0.88.0" })
    render(<ToolsPage />)

    const row = () => within(screen.getByRole("list", { name: "WireCat tools" })).getAllByRole("listitem")[0]
    expect(screen.getByText("Looking for WireCat tools on this computer…")).toBeInTheDocument()
    expect(within(row() as HTMLElement).getByText(/0\.88\.0/)).toBeInTheDocument()

    detect.resolve(answer("0.89.0"))
    expect(await within(row() as HTMLElement).findByText(/0\.89\.0/)).toBeInTheDocument()
    await waitFor(() =>
      expect(screen.queryByText("Looking for WireCat tools on this computer…")).not.toBeInTheDocument(),
    )
  })

  it("reuses unchanged answers on a visit and asks every copy again on Check again", async () => {
    const user = userEvent.setup()
    const detect = vi.spyOn(platform, "detectTools").mockResolvedValue(answer("0.88.0"))
    const latest = vi.spyOn(platform, "latestVersions").mockResolvedValue({ tg: "0.88.0" })
    const readiness = vi.spyOn(platform, "readiness")
    render(<ToolsPage />)
    await user.click(await screen.findByRole("button", { name: "Check again" }))

    expect(detect.mock.calls).toEqual([[false], [true]])
    expect(latest.mock.calls).toEqual([[false], [true]])
    expect(readiness).toHaveBeenCalledTimes(2)
  })
})

describe("the saved Tools answer", () => {
  const memory = () => {
    const data = new Map<string, string>()
    return { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => void data.set(k, v) }
  }

  it("comes back as it was saved", () => {
    const storage = memory()
    save({ tools: answer("0.88.0"), latest: null }, storage)
    expect(readSaved(storage)).toEqual({ tools: answer("0.88.0"), latest: null })
  })

  it("is ignored when an older app saved another shape, or storage is unavailable", () => {
    const storage = memory()
    storage.setItem("wirecat.tools.last", JSON.stringify({ installs: { tg: "0.1" } }))
    expect(readSaved(storage)).toBeNull()
    storage.setItem("wirecat.tools.last", "{ broken")
    expect(readSaved(storage)).toBeNull()
    const throwing = {
      getItem: () => {
        throw new Error("denied")
      },
    }
    expect(readSaved(throwing)).toBeNull()
  })
})
