import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { useOnboarding } from "@/features/onboarding/store"
import { platform } from "@/platform/bridge"
import { App } from "./App"

async function openReport() {
  const user = userEvent.setup()
  render(<App />)
  await user.click(await screen.findByRole("button", { name: "Report a problem" }))
  const dialog = await screen.findByRole("dialog", { name: "Report a problem" })
  const send = within(dialog).getByRole("button", { name: /Send report|Preparing/ })
  await waitFor(() => expect(send).toBeEnabled())
  return { user, dialog, send }
}

async function fillIn(user: ReturnType<typeof userEvent.setup>, dialog: HTMLElement) {
  await user.type(within(dialog).getByLabelText("Summary"), "Install fails")
  await user.selectOptions(within(dialog).getByLabelText("About"), "WireCat Desktop")
  await user.type(within(dialog).getByLabelText("What were you doing?"), "1. Pressed Install")
  await user.type(within(dialog).getByLabelText("What happened?"), "It stops at verify.")
}

describe("Reporting a problem", () => {
  beforeEach(() => useOnboarding.setState({ status: "done", open: false }))
  afterEach(() => vi.restoreAllMocks())

  it("asks for the missing fields on send, starting with the first", async () => {
    const sendReport = vi.spyOn(platform, "sendReport")
    const { user, dialog, send } = await openReport()
    await user.type(within(dialog).getByLabelText("Summary"), "Install fails")
    await user.click(send)

    const about = within(dialog).getByLabelText("About")
    expect(about).toHaveFocus()
    expect(about).toHaveAttribute("aria-invalid", "true")
    expect(about).toHaveAccessibleDescription("Choose the app or a tool.")
    expect(within(dialog).getByLabelText("What happened?")).toHaveAccessibleDescription(/Describe what went wrong\./)
    expect(within(dialog).getByLabelText("Summary")).toHaveAttribute("aria-invalid", "false")
    expect(sendReport).not.toHaveBeenCalled()
  })

  it("sends the template with the logs always attached and links the issue", async () => {
    const sendReport = vi.spyOn(platform, "sendReport")
    const { user, dialog } = await openReport()
    expect(within(dialog).queryByRole("checkbox")).not.toBeInTheDocument()
    await fillIn(user, dialog)
    await user.keyboard("{Control>}{Enter}{/Control}")

    expect(await screen.findByText("Thank you. The report is issue #42.")).toBeInTheDocument()
    const [draft, context] = sendReport.mock.calls[0] ?? []
    expect(draft).toMatchObject({ summary: "Install fails", tool: null, expected: null })
    expect(draft?.details).toBe(
      "### What I was doing\n\n1. Pressed Install\n\n### What happened\n\nIt stops at verify.",
    )
    expect(draft?.idempotencyKey).toMatch(/^[0-9a-f-]{36}$/)
    expect(context?.attachments).toHaveProperty("runs")
  })

  it("offers GitHub's own form when the server cannot be reached, and retries with the same key", async () => {
    const sendReport = vi
      .spyOn(platform, "sendReport")
      .mockRejectedValue(new Error("Could not reach the WireCat server"))
    const open = vi.spyOn(platform, "openUrl").mockResolvedValue()
    const { user, dialog, send } = await openReport()
    await fillIn(user, dialog)
    await user.click(send)

    expect(await within(dialog).findByRole("alert")).toHaveTextContent("Could not reach the WireCat server")
    await user.click(within(dialog).getByRole("button", { name: "Open on GitHub instead" }))
    expect(open.mock.calls[0]?.[0]).toMatch(
      /^https:\/\/github\.com\/WireCatLabs\/visage\/issues\/new\?title=Install\+fails/,
    )

    await user.click(within(dialog).getByRole("button", { name: "Try again" }))
    await within(dialog).findByRole("alert")
    expect(sendReport.mock.calls[1]?.[0].idempotencyKey).toBe(sendReport.mock.calls[0]?.[0].idempotencyKey)
  })
})
