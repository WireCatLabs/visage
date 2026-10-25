import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
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
  beforeEach(() => useOnboarding.setState({ status: "done", open: false }))

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
})
