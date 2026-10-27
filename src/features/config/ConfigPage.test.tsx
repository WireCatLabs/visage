import { fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { platform } from "@/platform/bridge"
import { useTools } from "../tools/store"
import { ConfigPage } from "./ConfigPage"
import { useConfig } from "./store"

beforeEach(() => {
  useConfig.setState(useConfig.getInitialState(), true)
  localStorage.clear()
})
afterEach(() => vi.restoreAllMocks())

const edit = (text: string, change: (doc: Record<string, unknown>) => void) => {
  const doc = JSON.parse(text)
  change(doc)
  return JSON.stringify(doc, null, 2)
}

const installed = { tg: [{ path: "~/bin/tg", version: "0.88.0", manager: "pnpm", problem: null }], zm: [] }

describe("Config", () => {
  it("opens on the first installed tool's defaults, then on the view chosen last", async () => {
    const user = userEvent.setup()
    useTools.setState({ installs: installed })
    const { unmount } = render(<ConfigPage />)
    await waitFor(() => expect(screen.getByRole("radio", { name: "Defaults (all profiles)" })).toBeChecked())
    await user.click(await screen.findByRole("radio", { name: "work" }))
    unmount()

    useConfig.setState(useConfig.getInitialState(), true)
    render(<ConfigPage />)
    await waitFor(() => expect(screen.getByRole("radio", { name: "work" })).toBeChecked())
  })

  it("asks for the defaults without waiting for the profile list", async () => {
    vi.spyOn(platform, "listProfiles").mockReturnValue(new Promise(() => undefined))
    const show = vi.spyOn(platform, "settingsShow")
    void useConfig.getState().chooseTool("tg")
    await waitFor(() => expect(show).toHaveBeenCalledWith("tg", null))
  })

  it("waits for the profile list before opening a remembered profile", async () => {
    localStorage.setItem("wirecat.config.last", JSON.stringify({ targets: { tg: "work" } }))
    vi.spyOn(platform, "listProfiles").mockReturnValue(new Promise(() => undefined))
    const show = vi.spyOn(platform, "settingsShow")
    void useConfig.getState().chooseTool("tg")
    await Promise.resolve()
    expect(show).not.toHaveBeenCalled()
  })

  it("saves JSON edits through config set and stops at the first value the tool refuses", async () => {
    const user = userEvent.setup()
    render(<ConfigPage />)

    await user.click(screen.getByRole("radio", { name: /Telegram/ }))
    expect(screen.getByRole("tab", { name: "Settings" })).toBeInTheDocument()
    await user.click(await screen.findByRole("radio", { name: "work" }))
    expect((await screen.findAllByRole("switch", {}, { timeout: 3000 })).length).toBeGreaterThan(0)
    expect(screen.getByText(/TG_REQUESTS_PER_MINUTE/)).toBeInTheDocument()

    await user.click(screen.getByRole("tab", { name: "JSON" }))
    const editor = screen.getByRole("textbox", { name: "Settings as JSON" }) as HTMLTextAreaElement
    fireEvent.change(editor, {
      target: {
        value: edit(editor.value, (d) => {
          d.limit = "abc"
          d.record = false
        }),
      },
    })
    await user.click(screen.getByRole("button", { name: "Save" }))

    const progress = await screen.findByRole("list", { name: "Save progress" })
    expect(await within(progress).findByText("Refused")).toBeInTheDocument()
    expect(within(progress).getByText("Not tried")).toBeInTheDocument()
    expect((await screen.findAllByText(/limit takes a whole number/)).length).toBeGreaterThan(0)

    fireEvent.change(editor, { target: { value: edit(editor.value, (d) => (d.limit = 25)) } })
    await user.click(screen.getByRole("button", { name: "Save" }))
    await waitFor(() => expect(screen.getAllByText("Saved")).toHaveLength(2))
    await waitFor(() => expect(screen.getByRole("button", { name: "Save" })).toBeDisabled())
    expect(JSON.parse(editor.value)).toMatchObject({ limit: 25, record: false })
  }, 15000)

  it("asks before dropping unsaved JSON when switching profile", async () => {
    const user = userEvent.setup()
    render(<ConfigPage />)
    await user.click(screen.getByRole("radio", { name: /Telegram/ }))
    await user.click(await screen.findByRole("radio", { name: "personal" }))
    await user.click(await screen.findByRole("tab", { name: "JSON" }))
    const editor = await screen.findByRole("textbox", { name: "Settings as JSON" })
    fireEvent.change(editor, { target: { value: "{ broken" } })

    await user.click(screen.getByRole("radio", { name: /Defaults/ }))
    const dialog = await screen.findByRole("dialog", { name: "Discard unsaved JSON changes?" })
    await user.click(within(dialog).getByRole("button", { name: "Keep editing" }))
    expect(screen.getByRole("radio", { name: "personal" })).toBeChecked()
  }, 15000)

  it("keeps shared settings out of a profile's list", async () => {
    const user = userEvent.setup()
    render(<ConfigPage />)
    await user.click(screen.getByRole("radio", { name: /Telegram/ }))
    await user.click(await screen.findByRole("radio", { name: "work" }))
    const list = await screen.findByRole("list", { name: "Settings" }, { timeout: 3000 })
    expect(within(list).getByText("limit")).toBeInTheDocument()
    expect(within(list).queryByText(/task_categories|phone_countries/)).not.toBeInTheDocument()
  })

  it("edits and removes a task category through config set without a profile or --defaults", async () => {
    const user = userEvent.setup()
    const set = vi.spyOn(platform, "settingsSet")
    const unset = vi.spyOn(platform, "settingsUnset")
    useTools.setState({ installs: installed })
    render(<ConfigPage />)
    await user.click(await screen.findByRole("radio", { name: "WireCat (shared)" }))
    const list = await screen.findByRole("list", { name: "Task categories" }, { timeout: 3000 })
    expect(screen.getByText(/Read through/)).toHaveTextContent("tg 0.88.0")
    expect(screen.queryByRole("radio", { name: "work" })).not.toBeInTheDocument()

    await user.click(within(list).getByRole("button", { name: "Edit travel" }))
    const meaning = screen.getByRole("textbox", { name: "What it is for" })
    await user.clear(meaning)
    await user.type(meaning, "trips abroad")
    await user.click(screen.getByRole("button", { name: "Save" }))
    await waitFor(() =>
      expect(set).toHaveBeenCalledWith(
        "tg",
        null,
        false,
        "task_categories.travel",
        "trips abroad | flight, hotel, visa, билет, es:vuelo",
      ),
    )
    expect(await within(list).findByText("trips abroad")).toBeInTheDocument()

    await user.click(within(list).getByRole("button", { name: "Remove garden" }))
    await waitFor(() => expect(unset).toHaveBeenCalledWith("tg", null, false, "task_categories.garden"))
    expect(await screen.findByText(/Removed/)).toBeInTheDocument()
    expect(within(list).queryByText("garden")).not.toBeInTheDocument()
    expect(within(list).queryByRole("button", { name: "Remove other" })).not.toBeInTheDocument()
  }, 15000)
})
