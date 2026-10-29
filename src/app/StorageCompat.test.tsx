import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { useOnboarding } from "@/features/onboarding/store"
import { platform } from "@/platform/bridge"
import { App } from "./App"

// The mock's store is at schema 33 and needs 32: WhatsApp 0.6 reads up to 29, Memo 0.93 is recorded at 31, Zoom
// predates `store info`. WhatsApp 0.7 moves the store to 34, which Telegram and MAX 0.74 do not read.
const row = async (name: RegExp) => {
  const list = await screen.findByRole("list", { name: "WireCat tools" })
  const li = within(list).getByRole("heading", { name }).closest("li")
  if (!li) throw new Error(`no row for ${name}`)
  return li
}

describe("Tools and the shared storage", () => {
  beforeEach(() => useOnboarding.setState({ status: "done", open: false }))

  it("says which installed tools can't read storage, and why", async () => {
    render(<App />)

    expect(
      await screen.findByText(/2 tools need an update to read storage: WhatsApp and Memo/, {}, { timeout: 4000 }),
    ).toBeInTheDocument()
    expect(screen.getByText(/Zoom can't say yet/)).toBeInTheDocument()
    const wa = await row(/WhatsApp/)
    expect(await within(wa).findByText("Can't read storage (schema 33). Update WhatsApp.")).toBeInTheDocument()
    expect(within(wa).getByRole("img", { name: /Can't read storage/ })).toBeInTheDocument()
  }, 10000)

  it("**warns before an updated tool's next run strands others, and queues their updates**", async () => {
    const latest = await platform.latestVersions()
    vi.spyOn(platform, "latestVersions").mockResolvedValue({ ...latest, max: "0.75.0" })
    const user = userEvent.setup()
    render(<App />)

    await user.click(
      await within(await row(/WhatsApp/)).findByRole("button", { name: "Update to 0.7.0" }, { timeout: 4000 }),
    )

    const dialog = await screen.findByRole(
      "dialog",
      { name: "WhatsApp 0.7.0 will move storage to schema 34" },
      { timeout: 8000 },
    )
    expect(within(dialog).getByText(/Telegram and MAX can't read schema 34/)).toBeInTheDocument()
    expect(within(dialog).getByText(/No newer Telegram is out yet/)).toBeInTheDocument()
    await user.click(within(dialog).getByRole("button", { name: "Update MAX too" }))

    expect(await within(await row(/MAX/)).findByRole("button", { name: "Cancel" })).toBeInTheDocument()
  }, 20000)
})
