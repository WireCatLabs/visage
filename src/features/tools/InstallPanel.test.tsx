import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it } from "vitest"
import { findTool } from "@/domain/catalog"
import type { InstallSession } from "@/domain/status"
import { useTools } from "./store"
import { ToolRow } from "./ToolRow"

const done = (version: string): InstallSession => ({
  operation: "install",
  step: "verify",
  log: [],
  outcome: { event: "done", version, path: "~/bin/x", shadowedBy: null },
})

const rows = (ids: string[]) =>
  render(
    <ul>
      {ids.map((id) => {
        const tool = findTool(id)
        return tool ? <ToolRow key={id} tool={tool} /> : null
      })}
    </ul>,
  )

const row = (name: string) => screen.getAllByRole("listitem").find((li) => within(li).queryByText(name)) as HTMLElement
const panelOpen = (name: string) => within(row(name)).queryByRole("button", { name: "Done" }) !== null

beforeEach(() => useTools.setState(useTools.getInitialState(), true))

describe("Done on a finished install", () => {
  it("closes only that tool's panel", async () => {
    useTools.setState({ sessions: { tg: done("0.89.0"), wa: done("0.7.0") } })
    rows(["tg", "wa"])

    await userEvent.click(within(row("Telegram")).getByRole("button", { name: "Done" }))

    expect(panelOpen("Telegram")).toBe(false)
    expect(panelOpen("WhatsApp")).toBe(true)
  })

  it("leaves the other row of a shared package open until it is closed too", async () => {
    useTools.setState({ sessions: { memo: done("0.95.0") } })
    rows(["memo", "email"])

    await userEvent.click(within(row("Memo")).getByRole("button", { name: "Done" }))
    expect(panelOpen("Memo")).toBe(false)
    expect(panelOpen("Email")).toBe(true)

    await userEvent.click(within(row("Email")).getByRole("button", { name: "Done" }))
    expect(useTools.getState().sessions).toEqual({})
  })
})
