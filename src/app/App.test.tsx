import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it } from "vitest"
import { App } from "./App"

// The browser mock stands in for Rust: Drive is the one tool not installed.
describe("WireCat Desktop", () => {
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

  it("shows the computer's readiness", async () => {
    render(<App />)
    expect(await screen.findByText("Node.js 24.19.0")).toBeInTheDocument()
  })
})
