import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { AboutDialog } from "@/features/about/AboutDialog"
import { useOnboarding } from "@/features/onboarding/store"
import { useLanguage } from "@/i18n"
import { platform } from "@/platform/bridge"
import { App } from "./App"

describe("About WireCat", () => {
  beforeEach(() => useOnboarding.setState({ status: "done", open: false }))
  afterEach(() => vi.restoreAllMocks())

  it("opens from the Help menu by keyboard and copies the version with the build and system", async () => {
    const user = userEvent.setup()
    render(<App />)
    await screen.findByText("Node.js 24.19.0")

    const help = screen.getByRole("button", { name: "Help" })
    help.focus()
    await user.keyboard("{ArrowDown}")
    expect(screen.getByRole("menuitem", { name: "Take the tour" })).toHaveFocus()
    await user.keyboard("{End}{Enter}")

    const dialog = await screen.findByRole("dialog", { name: "About WireCat" })
    expect(within(dialog).getByRole("button", { name: "Close" })).toHaveFocus()
    expect(within(dialog).getByText("abc1234, 2026-10-26")).toBeInTheDocument()
    await user.click(within(dialog).getByRole("button", { name: "Copy version details" }))
    expect(await navigator.clipboard.readText()).toBe("WireCat 0.0.0-test (abc1234, 2026-10-26) · Linux x86_64")
    expect(within(dialog).getByText(/Viacheslav Ptsarev/)).toBeInTheDocument()

    await user.click(within(dialog).getByRole("button", { name: "Close" }))
    expect(screen.queryByRole("dialog", { name: "About WireCat" })).not.toBeInTheDocument()
  })

  it("opens the project's links in the browser and hands over to the problem report", async () => {
    const open = vi.spyOn(platform, "openUrl").mockResolvedValue()
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole("button", { name: "Help" }))
    await user.click(screen.getByRole("menuitem", { name: "About WireCat" }))
    const dialog = await screen.findByRole("dialog", { name: "About WireCat" })

    const links = [
      ["Website", "https://wirecat.dev"],
      ["Documentation", "https://wirecat.dev/en/docs"],
      ["Source code", "https://github.com/WireCatLabs/wirecat-desktop"],
      ["Privacy policy", "https://wirecat.dev/en/privacy"],
      ["Apache License 2.0", "https://github.com/WireCatLabs/wirecat-desktop/blob/main/LICENSE"],
    ] as const
    for (const [name, url] of links) {
      await user.click(within(dialog).getByRole("button", { name }))
      expect(open).toHaveBeenLastCalledWith(url)
    }

    await user.click(within(dialog).getByRole("button", { name: "Report a problem" }))
    expect(await screen.findByRole("dialog", { name: "Report a problem" })).toBeInTheDocument()
    expect(screen.queryByRole("dialog", { name: "About WireCat" })).not.toBeInTheDocument()
  })

  it("closes the menu with Escape and returns focus to the button", async () => {
    const user = userEvent.setup()
    render(<App />)
    const help = screen.getByRole("button", { name: "Help" })
    await user.click(help)
    expect(screen.getByRole("menu", { name: "Help" })).toBeInTheDocument()
    await user.keyboard("{Escape}")
    expect(screen.queryByRole("menu")).not.toBeInTheDocument()
    expect(help).toHaveFocus()
  })

  it("speaks Russian when the language is Russian", async () => {
    useLanguage.setState({ choice: "ru" })
    render(<AboutDialog open onClose={() => undefined} />)
    const dialog = screen.getByRole("dialog", { name: "О WireCat" })
    expect(within(dialog).getByRole("button", { name: "Политика конфиденциальности" })).toBeInTheDocument()
    expect(within(dialog).getByText(/Свободное ПО с открытым исходным кодом по лицензии/)).toBeInTheDocument()
  })
})
