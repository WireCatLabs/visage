import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it } from "vitest"
import { useOnboarding } from "@/features/onboarding/store"
import { App } from "./App"

// The browser mock stands in for Rust: Drive is the one tool not installed.
describe("WireCat Desktop", () => {
  beforeEach(() => useOnboarding.setState({ status: "done", open: false }))

  it("installs a missing tool and shows it verified", async () => {
    const user = userEvent.setup()
    render(<App />)

    const list = await screen.findByRole("list", { name: "WireCat tools" })
    const drive = within(list)
      .getByRole("heading", { name: /Google Drive/ })
      .closest("li")
    if (!drive) throw new Error("no Drive row")
    await user.click(await within(drive).findByRole("button", { name: "Install" }))

    expect(await within(drive).findByText(/is installed and runs/, {}, { timeout: 8000 })).toBeInTheDocument()
    expect(await within(drive).findByText("0.30.0")).toBeInTheDocument()
  }, 15000)

  it("uninstalls a tool after confirmation and keeps its data", async () => {
    const user = userEvent.setup()
    render(<App />)

    const list = await screen.findByRole("list", { name: "WireCat tools" })
    const zoom = within(list).getByRole("heading", { name: /Zoom/ }).closest("li")
    if (!zoom) throw new Error("no Zoom row")
    await user.click(await within(zoom).findByRole("button", { name: /Manage/ }))
    await user.click(await within(zoom).findByRole("button", { name: "Uninstall" }))
    const dialog = await screen.findByRole("dialog", { name: "Uninstall Zoom?" })
    await user.click(within(dialog).getByRole("button", { name: "Uninstall" }))

    expect(await within(zoom).findByText(/is uninstalled/, {}, { timeout: 5000 })).toBeInTheDocument()
    expect(await within(zoom).findByText("Not installed")).toBeInTheDocument()
  }, 15000)

  it("says what it is checking while it loads", async () => {
    render(<App />)
    expect(await screen.findByText("Looking for WireCat tools on this computer…")).toBeInTheDocument()
    expect(await screen.findByText("Checking npm for newer versions…")).toBeInTheDocument()
    await screen.findByRole("button", { name: /Update to 0.7.0/ }, { timeout: 4000 })
    expect(screen.queryByText("Checking npm for newer versions…")).not.toBeInTheDocument()
  })

  it("shows the computer's readiness", async () => {
    render(<App />)
    expect(await screen.findByText("Node.js 24.19.0")).toBeInTheDocument()
  })

  it("lists configuration problems apart from other findings, with the fix to copy", async () => {
    const user = userEvent.setup()
    render(<App />)

    const list = await screen.findByRole("list", { name: "WireCat tools" })
    const tg = within(list)
      .getByRole("heading", { name: /Telegram/ })
      .closest("li")
    if (!tg) throw new Error("no Telegram row")
    await user.click(await within(tg).findByRole("button", { name: /Manage/ }))
    const personal = (await within(tg).findByText("personal")).closest("li")
    if (!personal) throw new Error("no personal profile")
    await user.click(within(personal).getByRole("button", { name: "Check" }))

    const group = await within(tg).findByRole("region", { name: "Configuration problems" }, { timeout: 3000 })
    expect(within(group).getByText(/permissions.bot.store.fetch is not a permission/)).toBeInTheDocument()
    expect(
      within(group).getByText("~/.config/tg-cli/config.json:14:18 · profile personal · key sync.limit"),
    ).toBeInTheDocument()
    expect(within(group).getAllByRole("button", { name: "Copy the fix command" })).toHaveLength(2)
  }, 10000)
})
