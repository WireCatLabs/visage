import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it } from "vitest"
import { LogsPage } from "./LogsPage"

describe("Logs", () => {
  it("reads every tool's runs, filters by a facet and opens a run's record", async () => {
    const user = userEvent.setup()
    render(<LogsPage />)

    expect(screen.getByText(/keeps a run only when it fails/)).toBeInTheDocument()
    expect(await screen.findByRole("progressbar", { name: "Tools read" })).toBeInTheDocument()
    await screen.findByText("38 runs", {}, { timeout: 4000 })

    const tools = screen.getByRole("region", { name: "Tool" })
    await user.click(within(tools).getByRole("button", { name: /WhatsApp/ }))
    expect(screen.getByRole("combobox", { name: "Search runs" })).toHaveValue("tool:wa")
    const rows = screen.getAllByRole("button", { name: /^Show run/ })
    expect(rows.length).toBeGreaterThan(0)
    expect(screen.queryByRole("cell", { name: /Telegram/ })).not.toBeInTheDocument()

    await user.click(rows[0] as HTMLElement)
    expect(await screen.findByRole("group", { name: "Run record" })).toHaveTextContent("run_id")
  }, 15000)
})
