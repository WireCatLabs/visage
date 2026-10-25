import { fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { findTool } from "@/domain/catalog"
import { platform } from "@/platform/bridge"
import { Permissions } from "./Permissions"

const tg = findTool("tg")
if (!tg) throw new Error("tg is in the catalog")

beforeEach(() => localStorage.clear())
afterEach(() => vi.restoreAllMocks())

async function choose(user: ReturnType<typeof userEvent.setup>, select: HTMLElement, option: string) {
  await user.click(select)
  await user.click(await screen.findByRole("option", { name: option }))
}

function show() {
  if (!tg) throw new Error("tg is in the catalog")
  render(<Permissions tool={tg} />)
  fireEvent.click(screen.getByRole("button", { name: /^Permissions — what agents may do/ }))
}

const row = (name: string) => {
  const select = screen.getByRole("combobox", { name: `${name} permission` })
  return select.closest("li") as HTMLElement
}

describe("Permissions", () => {
  it("stays closed behind its heading, with a one-line summary of the groups", async () => {
    localStorage.setItem("wirecat.config.last", JSON.stringify({ targets: { tg: "personal" } }))
    render(<Permissions tool={tg} />)
    const toggle = screen.getByRole("button", { name: /^Permissions — what agents may do/ })
    expect(toggle).toHaveAttribute("aria-expanded", "false")
    await waitFor(() => expect(toggle).toHaveTextContent(/groups? · as personal$/))
    expect(screen.queryByRole("combobox", { name: "Profile" })).not.toBeInTheDocument()
  })

  it("opens on the defaults, then shows a profile's partial group with its blocked commands", async () => {
    const user = userEvent.setup()
    show()
    expect(await screen.findByText(/Choose a profile to see which commands it may run/)).toBeInTheDocument()

    const picker = await screen.findByRole("combobox", { name: "Profile" })
    await choose(user, picker, "personal")
    await waitFor(() => expect(within(row("Messages")).getByText("Partial write")).toBeInTheDocument())
    expect(within(row("Messages")).getByText(/1 of 5 changes allowed/)).toBeInTheDocument()
    expect(within(row("Contacts")).getByText("Allowed")).toBeInTheDocument()
    expect(screen.getByRole("combobox", { name: "Contacts permission" })).toHaveTextContent("Allowed (default)")

    await user.click(within(row("Messages")).getByText(/4 blocked commands · 1 set separately/))
    expect(within(row("Messages")).getByText("tg messages edit")).toBeInTheDocument()
    expect(within(row("Messages")).getByText("messages.send")).toBeInTheDocument()
  })

  it("confirms before widening a group and saves its key through config set", async () => {
    const user = userEvent.setup()
    const set = vi.spyOn(platform, "settingsSet")
    localStorage.setItem("wirecat.config.last", JSON.stringify({ targets: { tg: "personal" } }))
    show()
    await waitFor(() => expect(within(row("Messages")).getByText("Partial write")).toBeInTheDocument())

    await choose(user, screen.getByRole("combobox", { name: "Messages permission" }), "Allow")
    const dialog = await screen.findByRole("dialog", { name: "Allow: Messages?" })
    expect(within(dialog).getByText("tg personal config set --json permissions.messages allow")).toBeInTheDocument()
    expect(within(dialog).getByText(/These stay as they are/)).toHaveTextContent("messages.send (allow)")
    expect(set).not.toHaveBeenCalled()

    await user.click(within(dialog).getByRole("button", { name: "Allow" }))
    expect(set).toHaveBeenCalledWith("tg", "personal", false, "permissions.messages", "allow")
    await waitFor(() => expect(within(row("Messages")).getByText("Allowed")).toBeInTheDocument())
  })

  it("narrows without asking", async () => {
    const user = userEvent.setup()
    const set = vi.spyOn(platform, "settingsSet")
    localStorage.setItem("wirecat.config.last", JSON.stringify({ targets: { tg: "work" } }))
    show()
    await waitFor(() => expect(within(row("Contacts")).getByText("Blocked")).toBeInTheDocument())

    await choose(user, screen.getByRole("combobox", { name: "Polls permission" }), "Read only")
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    expect(set).toHaveBeenCalledWith("tg", "work", false, "permissions.polls", "readonly")
  })

  it("locks what this view cannot change and explains the first-run answer", async () => {
    vi.spyOn(platform, "permissionsShow").mockResolvedValue({
      levels: [
        { key: "messages", level: "readonly", origin: "profile", from: "config file: personal.profiles.default" },
      ],
      ceiling: "readonly",
      commands: null,
      commandsError: null,
    })
    show()
    const select = await screen.findByRole("combobox", { name: "Messages permission" })
    expect(select).toBeDisabled()
    expect(within(row("Messages")).getByText(/Choose that profile to change it/)).toBeInTheDocument()
    expect(screen.getByText(/you chose this when you first set up WireCat/)).toBeInTheDocument()
  })

  it("says so when the tool is too old to report per command", async () => {
    vi.spyOn(platform, "permissionsShow").mockResolvedValue({
      levels: [],
      ceiling: null,
      commands: null,
      commandsError: null,
    })
    localStorage.setItem("wirecat.config.last", JSON.stringify({ targets: { tg: "personal" } }))
    show()
    expect(await screen.findByText(/does not say which commands a profile may run/)).toBeInTheDocument()
    expect(within(row("Messages")).getByText("Not set")).toBeInTheDocument()
  })
})
