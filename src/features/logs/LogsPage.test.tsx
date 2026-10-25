import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { platform } from "@/platform/bridge"
import { LogsPage } from "./LogsPage"
import { useLogs } from "./store"

beforeEach(() => useLogs.setState(useLogs.getInitialState(), true))
afterEach(() => vi.restoreAllMocks())

const loaded = () =>
  waitFor(() => expect(screen.getByRole("button", { name: "Read again" })).toBeEnabled(), { timeout: 4000 })

describe("Logs", () => {
  it("reads every tool's runs, filters by a facet and opens a run's record", async () => {
    const user = userEvent.setup()
    const listRuns = platform.listRuns.bind(platform)
    let release = () => {}
    const held = new Promise<void>((r) => {
      release = r
    })
    vi.spyOn(platform, "listRuns").mockImplementation(async (...args) => {
      await held
      return listRuns(...args)
    })
    render(<LogsPage />)

    expect(screen.getByText(/keeps a run only when it fails/)).toBeInTheDocument()
    expect(await screen.findByRole("progressbar", { name: "Tools read" })).toBeInTheDocument()
    release()
    await loaded()

    const commands = screen.getByRole("region", { name: "Command" })
    expect(within(commands).getAllByText("(no command)").length).toBeGreaterThan(0)

    const tools = screen.getByRole("region", { name: "Tool" })
    await user.click(within(tools).getByRole("button", { name: /WhatsApp/ }))
    expect(screen.getByRole("combobox", { name: "Search runs" })).toHaveValue("tool:wa")
    const rows = screen.getAllByRole("button", { name: /^Show run wa / })
    expect(rows.length).toBeGreaterThan(0)
    expect(screen.queryByRole("cell", { name: /Telegram/ })).not.toBeInTheDocument()

    await user.click(rows[0] as HTMLElement)
    expect(await screen.findByRole("group", { name: "Run record" })).toHaveTextContent("run_id")
    expect(screen.getByRole("region", { name: "Steps" })).toHaveTextContent(/request the tool sent to WhatsApp/)
  }, 15000)

  it("keeps every run only after the owner confirms, through the defaults of config set", async () => {
    const user = userEvent.setup()
    const set = vi.spyOn(platform, "settingsSet")
    render(<LogsPage />)
    await loaded()

    const keeping = screen.getByRole("region", { name: "Which runs each tool keeps" })
    const [telegram] = await within(keeping).findAllByRole("button", { name: "Keep every run…" })
    expect(within(keeping).getAllByText("Successful runs are not kept").length).toBe(3)

    await user.click(telegram as HTMLElement)
    const dialog = screen.getByRole("dialog", { name: "Keep every Telegram run?" })
    expect(dialog).toHaveTextContent(/kept for 30 days/)
    expect(set).not.toHaveBeenCalled()

    await user.click(within(dialog).getByRole("button", { name: "Keep every run" }))
    expect(set).toHaveBeenCalledWith("tg", null, true, "record", "true")
    expect(await within(keeping).findByText("Keeps every run")).toBeInTheDocument()
    const unset = vi.spyOn(platform, "settingsUnset")
    await user.click(within(keeping).getByRole("button", { name: "Keep failed runs only…" }))
    await user.click(
      within(screen.getByRole("dialog")).getByRole("button", { name: /Keep failed runs only|Keep failed/ }),
    )
    // record: false would stop keeping failed runs too, so going back removes the setting.
    expect(unset).toHaveBeenCalledWith("tg", null, true, "record")
    await waitFor(() => expect(within(keeping).getAllByText("Successful runs are not kept")).toHaveLength(3))
  }, 15000)

  it("says an older tool gets its logs with the next update instead of failing", async () => {
    const listRuns = platform.listRuns.bind(platform)
    vi.spyOn(platform, "listRuns").mockImplementation(async (id, ...rest) => {
      if (id === "zm")
        throw new Error(`unknown command 'list' — "runs" is not a command, so it was read as a profile name`)
      if (id === "memo") throw "unknown command 'runs'"
      if (id === "drive") throw new Error("drive runs list: the program did not finish in time")
      return listRuns(id, ...rest)
    })
    render(<LogsPage />)
    await loaded()

    const sources = screen.getByRole("list", { name: "Where the runs come from" })
    expect(within(sources).getByText("arrives with the next update of Zoom")).toBeInTheDocument()
    expect(within(sources).getByText("arrives with the next update of Memo")).toBeInTheDocument()
    expect(within(sources).getByText(/did not finish in time/)).toHaveClass("text-bad")
  }, 15000)

  it("groups by a field from a facet header", async () => {
    const user = userEvent.setup()
    render(<LogsPage />)
    await loaded()

    await user.click(screen.getByRole("button", { name: "Group by Profile" }))
    expect(screen.getByRole("combobox", { name: "Group by" })).toHaveValue("profile")
    expect(screen.getByRole("columnheader", { name: "Profile" })).toBeInTheDocument()
  }, 15000)

  it("shows what went wrong in a failed run, its masked command line, and filters by the agent's session", async () => {
    const user = userEvent.setup()
    render(<LogsPage />)
    await loaded()

    const status = screen.getByRole("region", { name: "HTTP status" })
    await user.click(within(status).getByRole("button", { name: /^429/ }))
    expect(screen.getByRole("combobox", { name: "Search runs" })).toHaveValue("error.http.status:429")

    const [first] = screen.getAllByRole("button", { name: /^Show run / })
    await user.click(first as HTMLElement)
    const failure = screen.getByRole("region", { name: "What went wrong" })
    expect(failure).toHaveTextContent("CliError")
    expect(failure).toHaveTextContent(/(GET|POST) \S+\s*429/)
    await user.click(within(failure).getByRole("button", { name: /Where in the tool/ }))
    expect(failure).toHaveTextContent("transport.js")
    expect(screen.getByRole("region", { name: "Command line" })).toHaveTextContent(/^Command line(max|wa) \w+ \w+/)

    const [session] = screen.getAllByTitle(/^Only runs of session /)
    await user.click(session as HTMLElement)
    expect((screen.getByRole("combobox", { name: "Search runs" }) as HTMLInputElement).value).toMatch(
      /^error\.http\.status:429 session_id:[0-9a-f-]+$/,
    )
  }, 15000)
})
