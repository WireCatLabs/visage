import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it } from "vitest"
import { useOnboarding } from "@/features/onboarding/store"
import { App } from "./App"

const stored = () => JSON.parse(localStorage.getItem("wirecat.onboarding") ?? "{}").state?.status

describe("First start", () => {
  beforeEach(() => {
    localStorage.clear()
    useOnboarding.setState({ status: "new", open: true, step: "welcome", chosen: [] })
  })

  it("installs the chosen tool, then lands on Tools and is not shown again", async () => {
    const user = userEvent.setup()
    render(<App />)

    expect(screen.getByRole("heading", { level: 1, name: "Welcome to WireCat" })).toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "Get started" }))
    expect(await screen.findByText("Ready to install WireCat tools.")).toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "Continue" }))

    await waitFor(() => expect(screen.getAllByRole("checkbox")).toHaveLength(1))
    const drive = screen.getByRole("checkbox", { name: /Google Drive/ })
    expect(drive).not.toBeChecked()
    await user.click(drive)
    await user.click(screen.getByRole("button", { name: "Install 1 tool" }))

    const progress = await screen.findByRole("list", { name: "Installing" })
    expect(await within(progress).findByText("0.30.0", {}, { timeout: 8000 })).toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: "Continue" }))
    await user.click(screen.getByRole("button", { name: "Continue" }))
    const signIn = screen.getByRole("list", { name: "Tools to sign in to" })
    expect(await within(signIn).findByText("Google Drive")).toBeInTheDocument()
    const telegram = await within(signIn).findByRole("list", { name: "Telegram accounts" })
    expect(within(telegram).getByText(/Signed in as profile/)).toHaveTextContent("Signed in as profile personal")
    await user.click(within(telegram).getByRole("button", { name: "Sign in" }))
    const dialog = await screen.findByRole("dialog", { name: "Sign in to Telegram" })
    await user.click(within(dialog).getByRole("button", { name: "Cancel" }))
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Sign in to Telegram" })).toBeNull())
    const driveSignIn = within(signIn).getByRole("heading", { name: "Google Drive" }).closest("li") as HTMLElement
    await user.click(await within(driveSignIn).findByRole("button", { name: "Add another account" }))
    expect(within(driveSignIn).getByRole("textbox", { name: "Name for another account, Google Drive" })).toHaveValue("")
    await user.click(screen.getByRole("button", { name: "Continue" }))
    await user.click(screen.getByRole("button", { name: "Open Tools" }))

    expect(screen.getByRole("heading", { level: 1, name: "Tools" })).toBeInTheDocument()
    expect(stored()).toBe("done")
    expect(screen.queryByRole("button", { name: "Finish setup" })).not.toBeInTheDocument()
  }, 15000)

  it("names the chosen tools on the Agents step before the installed ones are found", () => {
    useOnboarding.setState({ step: "agents", chosen: ["tg"] })
    render(<App />)

    const table = screen.getByRole("table", { name: "Skills for agents" })
    expect(within(table).getByRole("rowheader", { name: /Telegram/ })).toBeInTheDocument()
  })

  it("can be put off and picked up again from the sidebar", async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole("button", { name: "Set up later" }))
    expect(screen.getByRole("heading", { level: 1, name: "Tools" })).toBeInTheDocument()
    expect(stored()).toBe("later")

    await user.click(screen.getByRole("button", { name: "Finish setup" }))
    expect(screen.getByRole("navigation", { name: "Setup steps" })).toBeInTheDocument()
  })
})

describe("Help", () => {
  beforeEach(() => useOnboarding.setState({ status: "done", open: false }))

  it("shows the welcome again without undoing a finished setup", async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole("button", { name: "Help" }))
    await user.click(screen.getByRole("menuitem", { name: "Show the welcome again" }))
    expect(screen.getByRole("heading", { level: 1, name: "Welcome to WireCat" })).toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "Set up later" }))

    expect(useOnboarding.getState().status).toBe("done")
    expect(screen.queryByRole("button", { name: "Finish setup" })).not.toBeInTheDocument()
  })

  it("walks through the window and closes with Escape", async () => {
    const user = userEvent.setup()
    render(<App />)
    await screen.findByRole("list", { name: "WireCat tools" })

    const help = screen.getByRole("button", { name: "Help" })
    await user.click(help)
    await user.click(screen.getByRole("menuitem", { name: "Take the tour" }))

    const first = await screen.findByRole("dialog", { name: "Your computer" })
    expect(within(first).getByRole("button", { name: "Next" })).toHaveFocus()
    await user.keyboard("{Enter}")
    expect(await screen.findByRole("dialog", { name: "Status lamps" })).toBeInTheDocument()

    await user.keyboard("{Escape}")
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    expect(help).toHaveFocus()
  })
})
