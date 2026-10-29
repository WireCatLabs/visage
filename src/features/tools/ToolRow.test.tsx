import { fireEvent, render, screen, within } from "@testing-library/react"
import { beforeEach, expect, it } from "vitest"
import { App } from "@/app/App"
import { findTool } from "@/domain/catalog"
import { useOnboarding } from "@/features/onboarding/store"
import { useLanguage } from "@/i18n"
import { useTools } from "./store"
import { ToolRow } from "./ToolRow"

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

it("opens a row while the tool check is still running (BUG-24)", async () => {
  render(<App />)
  const list = await screen.findByRole("list", { name: "WireCat tools" })
  const header = within(list).getByRole("button", { name: /^Telegram/ })
  expect(useTools.getState().installs.tg).toBeUndefined()

  fireEvent.click(header)
  expect(header).toHaveAttribute("aria-expanded", "true")
  expect(await within(header.closest("li") as HTMLElement).findByRole("button", { name: "Manage" })).toBeVisible()
})

it("speaks Russian, with the count in its own plural form", () => {
  useLanguage.setState({ choice: "ru" })
  const copy = (path: string) => ({ path, version: "0.89.0", manager: "npm", problem: null })
  useTools.setState({ installs: { tg: [copy("~/a/tg"), copy("~/b/tg"), copy("~/c/tg")] }, latest: { tg: "0.89.0" } })
  render(
    <ul>
      <ToolRow tool={tg} />
    </ul>,
  )
  expect(screen.getByText("3 копии установлены")).toBeInTheDocument()
  expect(screen.getByText("Ваш аккаунт Telegram для терминала и ИИ-агентов")).toBeInTheDocument()
  expect(screen.getByRole("button", { name: "Управление" })).toBeInTheDocument()
})
