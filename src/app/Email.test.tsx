import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { useOnboarding } from "@/features/onboarding/store"
import { useTools } from "@/features/tools/store"
import { platform } from "@/platform/bridge"
import { App } from "./App"

const row = (list: HTMLElement, name: RegExp) => {
  const li = within(list).getByRole("heading", { name }).closest("li")
  if (!li) throw new Error(`no row for ${name}`)
  return li
}

// In the browser mock Memo is installed, so Email, which ships in Memo's package, is too.
describe("Email, a part of Memo", () => {
  beforeEach(() => {
    useOnboarding.setState({ status: "done", open: false })
    useTools.setState({ sessions: {}, expanded: null })
  })
  afterEach(() => vi.restoreAllMocks())

  it("uninstalls with Memo, then installs Memo's package once from either row", async () => {
    const user = userEvent.setup()
    const install = vi.spyOn(platform, "install")
    render(<App />)

    const list = await screen.findByRole("list", { name: "WireCat tools" })
    const email = row(list, /^Email/)
    const memo = row(list, /^Memo/)
    expect(within(email).getByText("Part of Memo")).toBeInTheDocument()

    await user.click(await within(email).findByRole("button", { name: /Manage/ }))
    await user.click(await within(email).findByRole("button", { name: "Uninstall" }))
    const dialog = await screen.findByRole("dialog", { name: "Uninstall Memo and Email?" })
    expect(within(dialog).getByText(/removes Memo and Email together/)).toBeInTheDocument()
    await user.click(within(dialog).getByRole("button", { name: "Uninstall" }))
    expect(await within(memo).findByText(/are uninstalled/, {}, { timeout: 5000 })).toBeInTheDocument()

    await user.click(within(memo).getByRole("button", { name: "Done" }))
    await user.click(await within(email).findByRole("button", { name: "Install" }, { timeout: 4000 }))
    // Memo's row now shows the same progress, so the second ask can only come from code such as onboarding.
    expect(within(memo).getByRole("button", { name: "Cancel" })).toBeInTheDocument()
    await useTools.getState().install("memo")

    expect(await within(email).findByText(/are installed and run/, {}, { timeout: 8000 })).toBeInTheDocument()
    expect(install.mock.calls.map(([id]) => id)).toEqual(["memo"])
  }, 20000)

  it("deletes the package's own folders after the uninstall when asked, and keeps the shared storage", async () => {
    const user = userEvent.setup()
    const order: string[] = []
    // The mock's own uninstall would leave Memo uninstalled for the next test.
    vi.spyOn(platform, "uninstall").mockImplementation(async (id, onEvent) => {
      order.push(`uninstall ${id}`)
      onEvent({ event: "removed" })
    })
    const clear = vi.spyOn(platform, "clearStorage")
    clear.mockImplementation(async (id) => {
      order.push(`clear ${id}`)
    })
    render(<App />)

    const list = await screen.findByRole("list", { name: "WireCat tools" })
    const email = row(list, /^Email/)
    await user.click(await within(email).findByRole("button", { name: /Manage/ }))
    await user.click(await within(email).findByRole("button", { name: "Uninstall" }))
    const dialog = await screen.findByRole("dialog", { name: "Uninstall Memo and Email?" })
    const box = within(dialog).getByRole("checkbox", { name: /Also delete Memo and Email's data/ })
    expect(box).not.toBeChecked()
    const folders = await within(dialog).findByRole(
      "list",
      { name: "Memo and Email's data folders" },
      { timeout: 3000 },
    )
    expect(within(folders).getByText("~/.config/cli-memo")).toBeInTheDocument()
    expect(within(folders).getByText("~/.local/share/cli-memo")).toBeInTheDocument()
    expect(folders).not.toHaveTextContent("WireCat")
    expect(within(dialog).getByText(/Messages in the shared storage stay; other tools use it/)).toBeInTheDocument()

    await user.click(box)
    await user.click(within(dialog).getByRole("button", { name: "Uninstall and delete data" }))
    const memo = row(list, /^Memo/)
    expect(await within(memo).findByText(/Its data \(.+\) is deleted/, {}, { timeout: 6000 })).toBeInTheDocument()
    expect(order).toEqual(["uninstall memo", "clear memo"])
  }, 20000)

  it("never deletes data when the uninstall fails", async () => {
    const user = userEvent.setup()
    vi.spyOn(platform, "uninstall").mockImplementation(async (_id, onEvent) => {
      onEvent({ event: "failed", reason: "failed", message: "npm failed.", hint: null })
    })
    const clear = vi.spyOn(platform, "clearStorage")
    render(<App />)

    const list = await screen.findByRole("list", { name: "WireCat tools" })
    const memo = row(list, /^Memo/)
    await user.click(await within(memo).findByRole("button", { name: /Manage/ }))
    await user.click(await within(memo).findByRole("button", { name: "Uninstall" }))
    const dialog = await screen.findByRole("dialog", { name: "Uninstall Memo and Email?" })
    await within(dialog).findByRole("list", { name: "Memo and Email's data folders" }, { timeout: 3000 })
    await user.click(within(dialog).getByRole("checkbox", { name: /Also delete/ }))
    await user.click(within(dialog).getByRole("button", { name: "Uninstall and delete data" }))

    expect(await within(memo).findByText(/Its data was not touched/, {}, { timeout: 4000 })).toBeInTheDocument()
    expect(clear).not.toHaveBeenCalled()
  }, 20000)
})
