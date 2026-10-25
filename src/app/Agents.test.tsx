import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { useOnboarding } from "@/features/onboarding/store"
import { platform } from "@/platform/bridge"
import { App } from "./App"

const wait = { timeout: 5000 }

async function openAgents() {
  const user = userEvent.setup()
  render(<App />)
  await user.click(screen.getByRole("button", { name: /Agents/ }))
  return user
}

// Mock: Telegram has `skill status` with an old ~/.agents copy, MAX and Zoom are too old to report, memo answers
// through doctor; Claude Code, Codex and Cursor are found. Claude Code has tg-personal registered over MCP and holds Q-15;
// Zoom is not on a terminal's PATH.
describe("Agents", () => {
  beforeEach(() => useOnboarding.setState({ status: "done", open: false }))

  it("shows every known agent as a card, found or not", async () => {
    await openAgents()
    const grid = await screen.findByRole("list", { name: "Agents" })
    expect(await within(grid).findByRole("button", { name: "Manage Codex" }, wait)).toBeInTheDocument()
    expect(within(grid).getByRole("heading", { name: "Gemini CLI" })).toBeInTheDocument()
    expect(await within(grid).findAllByText("Not found on this computer", {}, wait)).not.toHaveLength(0)
    expect(screen.queryByText("Agents this app knows")).not.toBeInTheDocument()
  }, 20000)

  it("shows each tool's skill per place and updates one cell after confirming", async () => {
    const user = await openAgents()

    const table = await screen.findByRole("table", { name: "Skills for agents" }, wait)
    expect(await within(table).findByRole("columnheader", { name: /Claude Code, Cursor/ }, wait)).toBeInTheDocument()
    const tg = (await within(table).findByRole("rowheader", { name: /Telegram/ }, wait)).closest("tr") as HTMLElement
    expect(await within(tg).findByRole("img", { name: /Telegram skill for Codex.*: Old/ }, wait)).toBeInTheDocument()
    expect(await screen.findByText(/MAX and Zoom cannot report their skills/, {}, wait)).toBeInTheDocument()

    await user.click(within(tg).getByRole("button", { name: /^Update Telegram skill for Codex/ }))
    const dialog = await screen.findByRole("dialog", { name: /Update the Telegram skill/ })
    expect(within(dialog).getByText("tg skill install --for agents --json")).toBeInTheDocument()
    await user.click(within(dialog).getByRole("button", { name: "Update" }))
    expect(
      await within(tg).findByRole("img", { name: /Telegram skill for Codex.*: Current/ }, wait),
    ).toBeInTheDocument()
  }, 20000)

  it("keeps MCP out of the main flow and lists existing servers read-only under Advanced", async () => {
    const add = vi.spyOn(platform, "mcpAdd")
    const check = vi.spyOn(platform, "mcpCheck")
    const remove = vi.spyOn(platform, "mcpRemove")
    const user = await openAgents()
    await user.click(await screen.findByRole("button", { name: "Manage Claude Code" }, wait))
    const details = screen.getByRole("region", { name: "Claude Code details" })
    await within(details).findByText(/check(s)? passed\.$/, {}, wait)

    expect(within(details).queryByRole("button", { name: /Connect/ })).not.toBeInTheDocument()
    expect(within(details).queryByRole("columnheader", { name: /MCP/ })).not.toBeInTheDocument()
    expect(screen.getByRole("list", { name: "What to fix for Claude Code" })).not.toHaveTextContent(/MCP/)
    expect(screen.getByRole("list", { name: "Agents" })).not.toHaveTextContent(/MCP/)
    expect(check).not.toHaveBeenCalled()

    const advanced = within(details).getByText("Advanced: MCP")
    expect(advanced.closest("details")).not.toHaveAttribute("open")
    await user.click(advanced)
    expect(within(details).getByText(/Agents on this computer use the tools directly/)).toBeVisible()
    const servers = await within(details).findByRole("list", { name: "WireCat MCP servers in Claude Code" }, wait)
    expect(within(servers).getByText("tg-personal")).toBeInTheDocument()

    await user.click(
      within(servers).getByRole("button", { name: "Remove the tg-personal MCP server from Claude Code" }),
    )
    const dialog = await screen.findByRole("dialog", { name: "Remove the tg-personal MCP server from Claude Code?" })
    expect(within(dialog).getByText("claude mcp remove tg-personal --scope user")).toBeInTheDocument()
    await user.click(within(dialog).getByRole("button", { name: "Remove" }))
    expect(remove).toHaveBeenCalledWith("tg", "personal", "claude")
    expect(
      await within(details).findByText("Claude Code has no WireCat MCP server registered.", {}, wait),
    ).toBeInTheDocument()
    expect(add).not.toHaveBeenCalled()
  }, 20000)

  it("Manage checks the agent, lists what stops it with each fix, and releases a held task", async () => {
    const user = await openAgents()
    const manage = await screen.findByRole("button", { name: "Manage Claude Code" }, wait)
    await user.click(manage)
    expect(manage).toHaveAttribute("aria-expanded", "true")
    expect(screen.getByRole("region", { name: "Claude Code details" })).toBeInTheDocument()

    const fixes = await screen.findByRole("list", { name: "What to fix for Claude Code" }, wait)
    expect(await within(fixes).findByText("Zoom is not on a terminal's PATH", {}, wait)).toBeInTheDocument()
    expect(within(fixes).getByText(/^export PATH=/)).toBeInTheDocument()
    expect(await within(fixes).findByText(/check(s)? passed\.$/, {}, wait)).toBeInTheDocument()
    expect(within(fixes).queryByText(/MCP connection/)).not.toBeInTheDocument()

    await user.click(await screen.findByRole("button", { name: "Release Q-15" }, wait))
    const dialog = await screen.findByRole("dialog", { name: "Release Q-15?" })
    expect(within(dialog).getByText("tg personal tasks release Q-15 --holder owner --json")).toBeInTheDocument()
    await user.click(within(dialog).getByRole("button", { name: "Release" }))
    expect(await screen.findByText("Claude Code holds no task.", {}, wait)).toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: "Close Claude Code details" }))
    expect(screen.queryByRole("region", { name: "Claude Code details" })).not.toBeInTheDocument()
    await waitFor(() => expect(manage).toHaveFocus())
  }, 20000)
})
