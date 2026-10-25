import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { useOnboarding } from "@/features/onboarding/store"
import { platform } from "@/platform/bridge"
import { App } from "./App"

async function openReport() {
  const user = userEvent.setup()
  render(<App />)
  await user.click(await screen.findByRole("button", { name: "Help" }))
  await user.click(screen.getByRole("button", { name: "Report a problem" }))
  const dialog = await screen.findByRole("dialog", { name: "Report a problem" })
  await user.type(within(dialog).getByLabelText("Summary"), "Install fails")
  await user.type(within(dialog).getByLabelText("What happened"), "It stops at verify.")
  return { user, dialog }
}

describe("Reporting a problem", () => {
  beforeEach(() => useOnboarding.setState({ status: "done", open: false }))
  afterEach(() => vi.restoreAllMocks())

  it("sends the report with logs kept private and links the issue", async () => {
    const send = vi.spyOn(platform, "sendReport")
    const { user, dialog } = await openReport()
    await user.click(within(dialog).getByRole("checkbox", { name: /Attach recent error logs/ }))
    expect(await within(dialog).findByText(/2 failed runs from tg/)).toBeInTheDocument()
    await user.click(within(dialog).getByRole("button", { name: "Send report" }))

    expect(await screen.findByText("Thank you. The report is issue #42.")).toBeInTheDocument()
    const [draft, context] = send.mock.calls[0] ?? []
    expect(draft).toMatchObject({ summary: "Install fails", tool: null, expected: null })
    expect(draft?.idempotencyKey).toMatch(/^[0-9a-f-]{36}$/)
    expect(context?.attachments).toHaveProperty("runs")
  })

  it("offers GitHub's own form when the server cannot be reached, and retries with the same key", async () => {
    const send = vi.spyOn(platform, "sendReport").mockRejectedValue(new Error("Could not reach the WireCat server"))
    const open = vi.spyOn(platform, "openUrl").mockResolvedValue()
    const { user, dialog } = await openReport()
    const sendButton = within(dialog).getByRole("button", { name: "Send report" })
    await waitFor(() => expect(sendButton).toBeEnabled())
    await user.click(sendButton)

    expect(await within(dialog).findByRole("alert")).toHaveTextContent("Could not reach the WireCat server")
    await user.click(within(dialog).getByRole("button", { name: "Open on GitHub instead" }))
    expect(open.mock.calls[0]?.[0]).toMatch(
      /^https:\/\/github\.com\/WireCatLabs\/visage\/issues\/new\?title=Install\+fails/,
    )

    await user.click(within(dialog).getByRole("button", { name: "Try again" }))
    await within(dialog).findByRole("alert")
    expect(send.mock.calls[1]?.[0].idempotencyKey).toBe(send.mock.calls[0]?.[0].idempotencyKey)
  })
})
