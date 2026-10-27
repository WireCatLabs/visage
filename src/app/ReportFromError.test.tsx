import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { useNav } from "@/features/nav"
import { useOnboarding } from "@/features/onboarding/store"
import { captureErrors, clearErrors, recentErrors } from "@/features/report/errors"
import { ReportDialog } from "@/features/report/ReportDialog"
import { ReportThis } from "@/features/report/ReportThis"
import { platform } from "@/platform/bridge"
import { ErrorBoundary } from "./ErrorBoundary"

function Broken(): null {
  throw new TypeError("Cannot read properties of undefined (reading 'length')")
}

async function openedDialog() {
  const dialog = await screen.findByRole("dialog", { name: "Report a problem" })
  const send = within(dialog).getByRole("button", { name: /Send report|Preparing/ })
  await waitFor(() => expect(send).toBeEnabled())
  return { dialog, send }
}

describe("Reporting from an error", () => {
  beforeEach(() => {
    clearErrors()
    useOnboarding.setState({ status: "done", open: false })
  })
  afterEach(() => vi.restoreAllMocks())

  it("fills the form from a failed command and sends nothing until Send is pressed", async () => {
    const sendReport = vi.spyOn(platform, "sendReport")
    const user = userEvent.setup()
    useNav.setState({ active: "agents" })
    render(
      <>
        <ReportThis
          what="Releasing the task inbox-zero"
          tool="tg"
          command="tg personal tasks release inbox-zero"
          error={new Error("task is held by another session")}
        />
        <ReportDialog />
      </>,
    )
    await user.click(screen.getByRole("button", { name: "Report this" }))
    const { dialog, send } = await openedDialog()

    expect(within(dialog).getByLabelText("Summary")).toHaveValue(
      "Releasing the task inbox-zero: task is held by another session",
    )
    expect(within(dialog).getByLabelText("About")).toHaveTextContent("(tg)")
    expect(within(dialog).getByLabelText("What were you doing?")).toHaveValue(
      "1. Opened Agents\n2. Releasing the task inbox-zero (the app ran `tg personal tasks release inbox-zero`)",
    )
    expect(within(dialog).getByLabelText("What happened?")).toHaveValue(
      "The app showed: task is held by another session",
    )
    expect(sendReport).not.toHaveBeenCalled()

    await user.click(send)
    expect(await screen.findByText("Thank you. The report is issue #42.")).toBeInTheDocument()
    expect(sendReport).toHaveBeenCalledOnce()
    expect(sendReport.mock.calls[0]?.[0]).toMatchObject({ tool: "tg" })
  })

  it("replaces a broken page with Reload and a report that carries the component stack", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined)
    const sendReport = vi.spyOn(platform, "sendReport")
    const user = userEvent.setup()
    useNav.setState({ active: "storage" })
    render(
      <>
        <ErrorBoundary scope="page">
          <Broken />
        </ErrorBoundary>
        <ReportDialog />
      </>,
    )

    expect(screen.getByRole("heading", { name: "Something broke on this page" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Reload" })).toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "Report this" }))
    const { dialog, send } = await openedDialog()

    expect(within(dialog).getByLabelText("Summary")).toHaveValue(
      "Showing this page: TypeError: Cannot read properties of undefined (reading 'length')",
    )
    expect(within(dialog).getByLabelText("About")).toHaveTextContent("WireCat Desktop")
    expect(within(dialog).getByLabelText("What were you doing?")).toHaveValue("1. Opened Storage\n2. Showing this page")
    expect((within(dialog).getByLabelText("What happened?") as HTMLTextAreaElement).value).toMatch(/at Broken/)
    await user.click(within(dialog).getByRole("button", { name: "See what is attached" }))
    expect(within(dialog).getByText(/1 recent error from this window/)).toBeInTheDocument()
    expect(sendReport).not.toHaveBeenCalled()

    await user.click(send)
    await screen.findByText("Thank you. The report is issue #42.")
    const attachments = sendReport.mock.calls[0]?.[1].attachments as { appErrors: { kind: string; name: string }[] }
    expect(attachments.appErrors).toEqual([expect.objectContaining({ kind: "render", name: "TypeError" })])
  })

  it("keeps the last ten uncaught errors and unhandled rejections", () => {
    const target = new EventTarget() as unknown as Window
    captureErrors(target)
    for (let i = 0; i < 11; i++) target.dispatchEvent(new ErrorEvent("error", { error: new Error(`boom ${i}`) }))
    const rejection = new Event("unhandledrejection") as Event & { reason: unknown }
    rejection.reason = "network down"
    target.dispatchEvent(rejection)

    const kept = recentErrors()
    expect(kept).toHaveLength(10)
    expect(kept[0]?.message).toBe("boom 2")
    expect(kept.at(-1)).toMatchObject({ kind: "rejection", message: "network down" })
  })
})
