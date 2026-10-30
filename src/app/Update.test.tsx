import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { useOnboarding } from "@/features/onboarding/store"
import { CHECK_EVERY_MS, useUpdate } from "@/features/update/store"
import { useLanguage } from "@/i18n"
import { platform } from "@/platform/bridge"
import { App } from "./App"

const offer = { version: "0.2.0", notes: "Faster Storage page.", kind: "self" as const }

describe("App update", () => {
  beforeEach(() => {
    useOnboarding.setState({ status: "done", open: false })
    useUpdate.setState({ update: null, open: false, phase: "available", progress: null, saved: null, error: null })
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
    await user.click(within(dialog).getByRole("button", { name: "Open the download page" }))
    expect(open).toHaveBeenCalledWith("https://wirecat.dev/en/download")
  })

  it("hands a .deb to the system's installer and says what to do next", async () => {
    vi.spyOn(platform, "checkUpdate").mockResolvedValue({ ...offer, kind: "deb" })
    const install = vi.spyOn(platform, "installUpdate")
    const download = vi.spyOn(platform, "downloadPackageUpdate").mockResolvedValue({
      result: "saved",
      file: "wirecat_0.2.0_amd64.deb",
      path: "~/Downloads/wirecat_0.2.0_amd64.deb",
      opened: true,
      command: "sudo apt install ~/Downloads/wirecat_0.2.0_amd64.deb",
    })
    const user = userEvent.setup()
    render(<App />)

    await user.click(await screen.findByRole("button", { name: "Update to 0.2.0" }))
    const dialog = await screen.findByRole("dialog", { name: "WireCat 0.2.0 is available" })
    expect(within(dialog).getByText(/installed from a \.deb package \(Ubuntu, Debian, Linux Mint\)/)).toBeVisible()
    expect(within(dialog).getByText(/Your accounts and data will not be deleted/)).toBeVisible()
    await user.click(within(dialog).getByRole("button", { name: "Download and install" }))

    expect(await within(dialog).findByText(/The system installer opened wirecat_0\.2\.0_amd64\.deb/)).toBeVisible()
    expect(within(dialog).getByText("sudo apt install ~/Downloads/wirecat_0.2.0_amd64.deb")).toBeVisible()
    expect(within(dialog).getByRole("button", { name: "Close" })).toHaveFocus()
    expect(download).toHaveBeenCalledWith("0.2.0", expect.any(Function))
    expect(install).not.toHaveBeenCalled()
  })

  it("says plainly when the package fails the signature check", async () => {
    vi.spyOn(platform, "checkUpdate").mockResolvedValue({ ...offer, kind: "rpm" })
    vi.spyOn(platform, "downloadPackageUpdate").mockResolvedValue({ result: "badSignature" })
    const user = userEvent.setup()
    render(<App />)

    await user.click(await screen.findByRole("button", { name: "Update to 0.2.0" }))
    const dialog = await screen.findByRole("dialog", { name: "WireCat 0.2.0 is available" })
    expect(within(dialog).getByText(/\.rpm package \(Fedora\)/)).toBeVisible()
    await user.click(within(dialog).getByRole("button", { name: "Download and install" }))
    expect(await within(dialog).findByRole("alert")).toHaveTextContent(
      "The download did not match WireCat's signature, so it was not opened.",
    )
    expect(within(dialog).getByRole("button", { name: "Try again" })).toBeEnabled()
  })

  it("keeps GitHub to the quiet links under the buttons", async () => {
    vi.spyOn(platform, "checkUpdate").mockResolvedValue({ ...offer, kind: "deb" })
    const open = vi.spyOn(platform, "openUrl").mockResolvedValue()
    const user = userEvent.setup()
    render(<App />)

    await user.click(await screen.findByRole("button", { name: "Update to 0.2.0" }))
    const dialog = await screen.findByRole("dialog", { name: "WireCat 0.2.0 is available" })
    const github = within(dialog).getAllByText(/GitHub/)
    expect(github).toHaveLength(1)
    expect(github[0]).toHaveTextContent("All releases on GitHub")
    await user.click(within(dialog).getByRole("button", { name: "What's new in 0.2.0" }))
    expect(open).toHaveBeenCalledWith("https://github.com/WireCatLabs/wirecat-desktop/releases/tag/v0.2.0")
  })

  describe("while the app stays open", () => {
    beforeEach(() => vi.useFakeTimers({ toFake: ["setInterval", "clearInterval"] }))
    afterEach(() => vi.useRealTimers())

    it("checks again every 6 hours, and stops when the app closes", async () => {
      const check = vi.spyOn(platform, "checkUpdate").mockResolvedValueOnce(null).mockResolvedValue(offer)
      const { unmount } = render(<App />)
      await screen.findByText("Node.js 24.19.0")
      expect(check).toHaveBeenCalledOnce()
      expect(screen.queryByRole("button", { name: "Update to 0.2.0" })).not.toBeInTheDocument()

      await vi.advanceTimersByTimeAsync(CHECK_EVERY_MS)
      expect(await screen.findByRole("button", { name: "Update to 0.2.0" })).toBeInTheDocument()
      expect(check).toHaveBeenCalledTimes(2)

      unmount()
      await vi.advanceTimersByTimeAsync(CHECK_EVERY_MS)
      expect(check).toHaveBeenCalledTimes(2)
    })

    it("does not check or change the offer while an install runs", async () => {
      const check = vi
        .spyOn(platform, "checkUpdate")
        .mockResolvedValueOnce(offer)
        .mockResolvedValue({
          ...offer,
          version: "0.3.0",
        })
      vi.spyOn(platform, "installUpdate").mockReturnValue(new Promise(() => {}))
      const user = userEvent.setup()
      render(<App />)

      await user.click(await screen.findByRole("button", { name: "Update to 0.2.0" }))
      const dialog = await screen.findByRole("dialog", { name: "WireCat 0.2.0 is available" })
      await user.click(within(dialog).getByRole("button", { name: "Install and restart" }))
      await within(dialog).findByRole("progressbar", { name: "Downloading the update" })

      await vi.advanceTimersByTimeAsync(CHECK_EVERY_MS)
      expect(check).toHaveBeenCalledOnce()
      expect(screen.getByRole("dialog", { name: "WireCat 0.2.0 is available" })).toBeInTheDocument()
    })
  })

  it("offers the update in the chosen language", async () => {
    vi.spyOn(platform, "checkUpdate").mockResolvedValue(offer)
    useLanguage.setState({ choice: "ru" })
    const user = userEvent.setup()
    render(<App />)
    await user.click(await screen.findByRole("button", { name: "Обновить до 0.2.0" }))
    const dialog = await screen.findByRole("dialog", { name: "Вышел WireCat 0.2.0" })
    expect(within(dialog).getByRole("button", { name: "Установить и перезапустить" })).toBeEnabled()
  })
})
