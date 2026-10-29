import { fireEvent, render, screen, within } from "@testing-library/react"
import { beforeEach, expect, it } from "vitest"
import { App } from "@/app/App"
import { findTool } from "@/domain/catalog"
import { useOnboarding } from "@/features/onboarding/store"
import { useTools } from "./store"

const tg = findTool("tg") as NonNullable<ReturnType<typeof findTool>>

beforeEach(() => {
  useOnboarding.setState({ status: "done", open: false })
  useTools.setState(useTools.getInitialState(), true)
  window.getSelection()?.removeAllRanges()
})

it("opens a row on a click and on Enter, but not when a drag over its text ends there", async () => {
  render(<App />)
  const list = await screen.findByRole("list", { name: "WireCat tools" })
  const header = within(list).getByRole("button", { name: /^Telegram/ })
  const row = header.closest("li") as HTMLElement
  await within(row).findByRole("button", { name: "Manage" })

  fireEvent.click(header)
  expect(header).toHaveAttribute("aria-expanded", "true")
  fireEvent.keyDown(header, { key: "Enter" })
  expect(header).toHaveAttribute("aria-expanded", "false")

  const text = within(header).getByText(tg.name).firstChild as Text
  window.getSelection()?.setBaseAndExtent(text, 0, text, 4)
  fireEvent.click(header)
  expect(header).toHaveAttribute("aria-expanded", "false")
})
