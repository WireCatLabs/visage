import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { useOnboarding } from "@/features/onboarding/store"
import { useUpdate } from "@/features/update/store"
import { platform } from "@/platform/bridge"
import { App } from "./App"

const offer = { version: "0.2.0", notes: "Faster Storage page.", manual: false }

describe("App update", () => {
  beforeEach(() => {
    useOnboarding.setState({ status: "done", open: false })
    useUpdate.setState({ update: null, open: false, phase: "available", progress: null, error: null })
  })
  afterEach(() => vi.restoreAllMocks())

  it("offers nothing when this is the newest release or the check fails", async () => {
    const check = vi.spyOn(platform, "checkUpdate").mockRejectedValue(new Error("offline"))
    render(<App />)
    await screen.findByText("Node.js 24.19.0")
    expect(check).toHaveBeenCalled()
    expect(screen.queryByRole("button", { name: /Update to/ })).not.toBeInTheDocument()
  })

  it("installs only after the user confirms, shows the download, then restarts", async () => {
    vi.spyOn(platform, "checkUpdate").mockResolvedValue(offer)
    let finish = () => {}
    const install = vi.spyOn(platform, "installUpdate").mockImplementation(async (onProgress) => {
      onProgress({ downloaded: 4_000_000, total: 10_000_000 })
      await new Promise<void>((resolve) => {
        finish = resolve
      })
    })
    const restart = vi.spyOn(platform, "restart").mockResolvedValue()
    const user = userEvent.setup()
    render(<App />)

    await user.click(await screen.findByRole("button", { name: "Update to 0.2.0" }))
    const dialog = await screen.findByRole("dialog", { name: "WireCat 0.2.0 is available" })
    expect(within(dialog).getByText("Faster Storage page.")).toBeInTheDocument()
    expect(install).not.toHaveBeenCalled()

    await user.click(within(dialog).getByRole("button", { name: "Install and restart" }))
    expect(await within(dialog).findByRole("progressbar", { name: "Downloading the update" })).toHaveAttribute(
      "aria-valuenow",
      "40",
    )
    expect(within(dialog).getByRole("button", { name: "Install and restart" })).toBeDisabled()
    expect(restart).not.toHaveBeenCalled()

    finish()
    expect(await within(dialog).findByText("Installed. WireCat is restarting…")).toBeInTheDocument()
    expect(restart).toHaveBeenCalledOnce()
  })

  it("says why an install failed and lets the user try again or download it", async () => {
    vi.spyOn(platform, "checkUpdate").mockResolvedValue(offer)
    vi.spyOn(platform, "installUpdate").mockRejectedValueOnce(new Error("The download stopped: connection reset"))
    const open = vi.spyOn(platform, "openUrl").mockResolvedValue()
    const user = userEvent.setup()
    render(<App />)

    await user.click(await screen.findByRole("button", { name: "Update to 0.2.0" }))
    const dialog = await screen.findByRole("dialog", { name: "WireCat 0.2.0 is available" })
    await user.click(within(dialog).getByRole("button", { name: "Install and restart" }))

    expect(await within(dialog).findByRole("alert")).toHaveTextContent("The download stopped: connection reset")
    expect(within(dialog).getByRole("button", { name: "Try again" })).toBeEnabled()
    await user.click(within(dialog).getByRole("button", { name: "Open GitHub" }))
    expect(open).toHaveBeenCalledWith("https://github.com/WireCatLabs/wirecat-desktop/releases/latest")
  })

  it("sends a Linux package copy to GitHub instead of installing", async () => {
    vi.spyOn(platform, "checkUpdate").mockResolvedValue({ ...offer, manual: true })
    const install = vi.spyOn(platform, "installUpdate")
    const open = vi.spyOn(platform, "openUrl").mockResolvedValue()
    const user = userEvent.setup()
    render(<App />)

    await user.click(await screen.findByRole("button", { name: "Update to 0.2.0" }))
    const dialog = await screen.findByRole("dialog", { name: "WireCat 0.2.0 is available" })
    expect(within(dialog).queryByRole("button", { name: "Install and restart" })).not.toBeInTheDocument()
    await user.click(within(dialog).getByRole("button", { name: "Download from GitHub" }))
    expect(open).toHaveBeenCalledWith("https://github.com/WireCatLabs/wirecat-desktop/releases/latest")
    expect(install).not.toHaveBeenCalled()
  })
})
