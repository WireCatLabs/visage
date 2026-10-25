import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it } from "vitest"
import { useOnboarding } from "@/features/onboarding/store"
import { App } from "./App"

// Mock: Telegram has `skill status` with an old ~/.agents copy, MAX and Zoom are too old to report, memo answers
// through doctor; Claude Code, Codex and Cursor are found.
describe("Agents", () => {
  beforeEach(() => useOnboarding.setState({ status: "done", open: false }))

  it("shows each tool's skill per place and updates one cell", async () => {
    const user = userEvent.setup()
    render(<App />)
    await user.click(screen.getByRole("button", { name: /Agents/ }))

    const table = await screen.findByRole("table", { name: "Skills for agents" })
    expect(await within(table).findByRole("columnheader", { name: /Claude Code, Cursor/ })).toBeInTheDocument()
    const tg = (await within(table).findByRole("rowheader", { name: /Telegram/ })).closest("tr") as HTMLElement
    expect(await within(tg).findByRole("img", { name: /Telegram skill for Codex.*: Old/ })).toBeInTheDocument()
    const max = within(table).getByRole("rowheader", { name: /MAX/ })
    expect(await within(max).findByText(/cannot report its skill/)).toBeInTheDocument()

    await user.click(within(tg).getByRole("button", { name: /^Update Telegram skill for Codex/ }))
    expect(
      await within(tg).findByRole("img", { name: /Telegram skill for Codex.*: Current/ }, { timeout: 4000 }),
    ).toBeInTheDocument()
  }, 15000)
})
