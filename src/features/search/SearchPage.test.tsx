import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { platform } from "@/platform/bridge"
import { useTools } from "../tools/store"
import { SearchPage } from "./SearchPage"
import { useSearch } from "./store"

beforeEach(() => useSearch.setState(useSearch.getInitialState(), true))
afterEach(() => vi.restoreAllMocks())

async function choose(user: ReturnType<typeof userEvent.setup>, box: string, option: string) {
  const select = await screen.findByRole("combobox", { name: box })
  await waitFor(() => expect(select).not.toHaveAttribute("aria-disabled", "true"))
  await waitFor(() => expect(select).toBeEnabled())
  await user.click(select)
  await user.click(await screen.findByRole("option", { name: option }))
}

describe("Search", () => {
  it("searches one tool for the profile the owner picks, and pages through the hits", async () => {
    const user = userEvent.setup()
    const search = vi.spyOn(platform, "searchStore")
    render(<SearchPage />)
    await waitFor(() => expect(useTools.getState().checked).toBe(true), { timeout: 4000 })

    await choose(user, "Tool", "Telegram")
    const profile = await screen.findByRole("combobox", { name: "Profile" })
    await waitFor(() => expect(profile).toHaveTextContent("Choose a profile"))
    await user.type(screen.getByRole("combobox", { name: "Search messages" }), "invoice{Enter}")
    expect(search).not.toHaveBeenCalled()
    expect(screen.getByRole("button", { name: "Search" })).toBeDisabled()

    await choose(user, "Profile", "personal")
    await user.click(screen.getByRole("button", { name: "Search" }))
    expect(await screen.findByText("50 results", {}, { timeout: 3000 })).toBeInTheDocument()
    expect(search).toHaveBeenLastCalledWith("tg", "personal", "invoice", 50, 1)
    expect(screen.getByText(/searched 12,480 messages/)).toBeInTheDocument()

    await user.click(screen.getAllByRole("button", { name: "Show the whole result: Harbour flat" })[0] as HTMLElement)
    expect(
      await screen.findByRole("group", { name: "Everything the tool returned for this result" }),
    ).toHaveTextContent("chat_title")

    await user.click(screen.getByRole("button", { name: "Next page" }))
    expect(await screen.findByText("50 results on page 2", {}, { timeout: 3000 })).toBeInTheDocument()
    expect(search).toHaveBeenLastCalledWith("tg", "personal", "invoice", 50, 2)
    expect(screen.getByRole("button", { name: "Previous page" })).toBeEnabled()
  }, 15000)

  it("shows the tool's query error at its place until the query changes", async () => {
    const user = userEvent.setup()
    render(<SearchPage />)
    await choose(user, "Tool", "Telegram")
    await choose(user, "Profile", "personal")
    const bar = screen.getByRole("combobox", { name: "Search messages" })
    await user.type(bar, "invoice bogus:x{Enter}")

    expect(await screen.findByRole("alert", {}, { timeout: 3000 })).toHaveTextContent(
      'There is no such field. The tool says: no field "bogus"',
    )
    expect(bar).toHaveAttribute("aria-invalid", "true")
    await user.type(bar, "y")
    expect(bar).not.toHaveAttribute("aria-invalid")
  }, 15000)

  it("asks a tool without profiles for no profile", async () => {
    const user = userEvent.setup()
    const search = vi.spyOn(platform, "searchStore")
    render(<SearchPage />)
    await choose(user, "Tool", "Memo")
    expect(screen.queryByRole("combobox", { name: "Profile" })).not.toBeInTheDocument()
    await user.type(screen.getByRole("combobox", { name: "Search notes" }), "plan{Enter}")
    expect(await screen.findByText("50 results", {}, { timeout: 3000 })).toBeInTheDocument()
    expect(search).toHaveBeenLastCalledWith("memo", null, "plan", 50, 1)
  }, 15000)

  it("says which update a tool too old to search needs", async () => {
    const user = userEvent.setup()
    vi.spyOn(platform, "searchStore").mockResolvedValue({ kind: "old", message: "unknown option '--offline'" })
    render(<SearchPage />)
    await choose(user, "Tool", "MAX")
    await choose(user, "Profile", "personal")
    await user.type(screen.getByRole("combobox", { name: "Search messages" }), "x{Enter}")
    expect(await screen.findByText(/MAX 0\.74\.0 can't search its local data yet/)).toBeInTheDocument()

    await choose(user, "Tool", "Telegram")
    await user.click(screen.getByRole("combobox", { name: "Tool" }))
    expect(await screen.findByRole("option", { name: "MAX — update to search" })).toHaveAttribute(
      "aria-disabled",
      "true",
    )
  }, 15000)

  it("offers ready queries, then the tool's own values after a field", async () => {
    const user = userEvent.setup()
    const values = vi.spyOn(platform, "searchValues")
    render(<SearchPage />)
    await waitFor(() => expect(useTools.getState().checked).toBe(true), { timeout: 4000 })
    await choose(user, "Tool", "Telegram")
    await choose(user, "Profile", "personal")
    await waitFor(() => expect(values).toHaveBeenCalledWith("tg", "personal", "chats"))
    await waitFor(() => expect(Object.values(useSearch.getState().lists).some((l) => l.length > 0)).toBe(true))
    const bar = screen.getByRole("combobox", { name: "Search messages" })

    await user.click(bar)
    await user.click(await screen.findByRole("option", { name: /has:photo date>=7d/ }))
    expect(bar).toHaveValue("has:photo date>=7d ")

    await user.type(bar, "chat:des")
    await user.click(await screen.findByRole("option", { name: /Design crit/ }))
    expect(bar).toHaveValue('has:photo date>=7d chat:"Design crit" ')
  }, 15000)
})
