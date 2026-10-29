import { act, render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, expect, it, vi } from "vitest"
import { platform } from "@/platform/bridge"
import type { ReportContext } from "@/platform/report-schemas"
import { ReportDialog } from "./ReportDialog"
import { useReport } from "./store"

afterEach(() => {
  act(() => useReport.getState().close())
  vi.restoreAllMocks()
})

it("shows both links from the first frame and fills them in place when the context arrives", async () => {
  const real = await platform.reportContext()
  let arrive: (c: ReportContext) => void = () => undefined
  vi.spyOn(platform, "reportContext").mockReturnValue(new Promise((resolve) => (arrive = resolve)))
  render(<ReportDialog />)
  act(() => useReport.getState().start())

  const dialog = await screen.findByRole("dialog", { name: "Report a problem" })
  const attached = within(dialog).getByRole("button", { name: "See what is attached" })
  expect(within(dialog).getByRole("button", { name: "See the public issue" })).toBeInTheDocument()
  await userEvent.click(attached)
  expect(within(dialog).getAllByText("Collecting versions and recent errors…")[0]).toBeInTheDocument()

  await act(async () => arrive(real))
  expect(within(dialog).getByText(/2 failed runs from tg/)).toBeInTheDocument()
  expect(within(dialog).queryByText("Collecting versions and recent errors…")).not.toBeInTheDocument()
})
