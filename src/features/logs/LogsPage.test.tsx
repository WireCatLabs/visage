import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { platform } from "@/platform/bridge"
import { LogsPage } from "./LogsPage"
import { timing, useLogs } from "./store"

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

    const tools = screen.getByRole("region", { name: "Tool" })
    await user.click(within(tools).getByRole("button", { name: /WhatsApp/ }))
    expect(screen.getByRole("combobox", { name: "Search runs" })).toHaveValue("-no_command:true tool:wa")
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
    const telegram = await within(keeping).findByRole("combobox", { name: "Which Telegram runs to keep" })
    expect(within(keeping).getAllByRole("img", { name: /keeps failed runs only$/ })).toHaveLength(3)
    expect(telegram).toHaveTextContent("Failed runs only")

    await user.click(telegram)
    await user.click(screen.getByRole("option", { name: "Every run" }))
    const dialog = screen.getByRole("dialog", { name: "Keep every Telegram run?" })
    expect(dialog).toHaveTextContent(/kept for 30 days/)
    expect(set).not.toHaveBeenCalled()

    await user.click(within(dialog).getByRole("button", { name: "Keep every run" }))
    expect(set).toHaveBeenCalledWith("tg", null, true, "record", "true")
    expect(await within(keeping).findByRole("img", { name: "Telegram keeps every run for 30 days" })).toBeVisible()
    expect(telegram).toHaveTextContent("Every run")

    const unset = vi.spyOn(platform, "settingsUnset")
    await user.click(telegram)
    await user.click(screen.getByRole("option", { name: "Failed runs only" }))
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Keep failed runs only" }))
    // record: false would stop keeping failed runs too, so going back removes the setting.
    expect(unset).toHaveBeenCalledWith("tg", null, true, "record")
    await waitFor(() =>
      expect(within(keeping).getAllByRole("img", { name: /keeps failed runs only$/ })).toHaveLength(3),
    )
  }, 15000)

  it("says an older tool gets its logs with the next update instead of failing", async () => {
    const listRuns = platform.listRuns.bind(platform)
    vi.spyOn(platform, "listRuns").mockImplementation(async (id, ...rest) => {
      if (id === "zm")
        throw new Error(`unknown command 'list' — "runs" is not a command, so it was read as a profile name`)
      if (id === "memo")
        throw '{"error":{"code":"validation_error","message":"unknown command \'runs\'","retry":{"safe":false}}}'
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
    expect(screen.getByRole("combobox", { name: "Group by" })).toHaveTextContent("Profile")
    expect(screen.getByRole("columnheader", { name: "Profile" })).toBeInTheDocument()
  }, 15000)

  it("shows what went wrong in a failed run, its masked command line, and filters by the agent's session", async () => {
    const user = userEvent.setup()
    render(<LogsPage />)
    await loaded()

    const status = screen.getByRole("region", { name: "HTTP status" })
    await user.click(within(status).getByRole("button", { name: /^429/ }))
    expect(screen.getByRole("combobox", { name: "Search runs" })).toHaveValue("-no_command:true error.http.status:429")

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
      /^-no_command:true error\.http\.status:429 session_id:[0-9a-f-]+$/,
    )
  }, 15000)

  it("hides runs with no command by default, counts them, and lists them again once that filter is removed", async () => {
    const user = userEvent.setup()
    render(<LogsPage />)
    await loaded()

    expect(screen.getByRole("combobox", { name: "Search runs" })).toHaveValue("-no_command:true")
    const commands = screen.getByRole("region", { name: "Command" })
    expect(within(commands).queryByText("(no command)")).not.toBeInTheDocument()
    expect(screen.queryAllByRole("button", { name: /^Show run \S+ \(no command\)/ })).toHaveLength(0)

    const show = screen.getByRole("button", { name: "Show them" })
    expect(show.parentElement).toHaveTextContent(/^\d+ runs with no command hidden Show them$/)
    await user.click(show)
    expect(screen.getByRole("combobox", { name: "Search runs" })).toHaveValue("")
    expect(within(commands).getAllByText("(no command)").length).toBeGreaterThan(0)
    expect(screen.queryByRole("button", { name: "Show them" })).not.toBeInTheDocument()
  }, 15000)
})

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
const rows = () => screen.queryAllByRole("button", { name: /^Show run / })

describe("Logs snapshot", () => {
  const saved = { ...timing }
  afterEach(() => Object.assign(timing, saved))

  it("shows the table once, after every tool has answered", async () => {
    const listRuns = platform.listRuns.bind(platform)
    let release = () => {}
    const held = new Promise<void>((r) => {
      release = r
    })
    vi.spyOn(platform, "listRuns").mockImplementation(async (id, ...rest) => {
      if (id === "tg") await held
      return listRuns(id, ...rest)
    })
    render(<LogsPage />)

    const progress = await screen.findByRole("progressbar", { name: "Tools read" })
    const total = Number(progress.getAttribute("aria-valuemax"))
    await waitFor(() => expect(progress).toHaveAttribute("aria-valuenow", String(total - 1)), { timeout: 4000 })
    expect(rows()).toHaveLength(0)
    expect(progress.parentElement).toHaveTextContent(/of \d+ tools done, reading Telegram…$/)

    release()
    await loaded()
    expect(rows().length).toBeGreaterThan(0)
    const sources = screen.getByRole("list", { name: "Where the runs come from" })
    expect(within(sources).getByText("Telegram").nextSibling).toHaveTextContent(/^\d+\+? runs$/)
  }, 15000)

  it("stops waiting for a slow tool, says so, and takes its answer in the next round without asking twice", async () => {
    timing.answer = 2000
    const user = userEvent.setup()
    const listRuns = platform.listRuns.bind(platform)
    const spy = vi.spyOn(platform, "listRuns").mockImplementation(async (id, ...rest) => {
      if (id === "tg") await sleep(1800)
      return listRuns(id, ...rest)
    })
    render(<LogsPage />)
    await loaded()

    expect(rows().length).toBeGreaterThan(0)
    const sources = screen.getByRole("list", { name: "Where the runs come from" })
    expect(within(sources).getByText("did not answer in 2 s")).toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: "Read again" }))
    await loaded()
    expect(within(sources).getByText("Telegram").nextSibling).toHaveTextContent(/^\d+\+? runs$/)
    expect(spy.mock.calls.filter(([id]) => id === "tg")).toHaveLength(1)
  }, 15000)
})

// Live rounds answered at once from each tool's first answer, so a round takes no mock wait.
function answeredOnce() {
  const listRuns = platform.listRuns.bind(platform)
  const first = new Map<string, ReturnType<typeof listRuns>>()
  return (...args: Parameters<typeof listRuns>) => {
    const [id] = args
    if (!first.has(id)) first.set(id, listRuns(...args))
    return first.get(id) as ReturnType<typeof listRuns>
  }
}

describe("Logs live", () => {
  const saved = { ...timing }
  afterEach(() => {
    Object.assign(timing, saved)
    Reflect.deleteProperty(document, "visibilityState")
  })

  it("reads again while Live is on, one round at a time, and waits while the window is hidden", async () => {
    timing.live = 100
    const user = userEvent.setup()
    const listRuns = answeredOnce()
    let calls = 0
    let inFlight = 0
    let most = 0
    vi.spyOn(platform, "listRuns").mockImplementation(async (...args) => {
      calls++
      inFlight++
      most = Math.max(most, inFlight)
      try {
        return await listRuns(...args)
      } finally {
        inFlight--
      }
    })
    render(<LogsPage />)
    await loaded()
    const perRound = calls

    const live = screen.getByRole("button", { name: "Live" })
    expect(live).toHaveAttribute("aria-pressed", "false")
    await user.click(live)
    expect(live).toHaveAttribute("aria-pressed", "true")
    await waitFor(() => expect(calls).toBeGreaterThanOrEqual(perRound * 3), { timeout: 4000 })
    expect(most).toBe(perRound)
    expect(screen.getByText(/^Updated \d+ s ago$/)).toBeInTheDocument()

    let visibility = "hidden"
    Object.defineProperty(document, "visibilityState", { configurable: true, get: () => visibility })
    await waitFor(() => expect(inFlight).toBe(0), { timeout: 4000 })
    const paused = calls
    await sleep(1500)
    expect(calls).toBe(paused)

    visibility = "visible"
    await waitFor(() => expect(calls).toBeGreaterThan(paused), { timeout: 4000 })
    await user.click(live)
    expect(live).toHaveAttribute("aria-pressed", "false")
  }, 20000)

  it("puts new runs on top, and holds them behind a button while the reader is scrolled down", async () => {
    timing.live = 100
    const user = userEvent.setup()
    const listRuns = answeredOnce()
    let added = 0
    vi.spyOn(platform, "listRuns").mockImplementation(async (id, ...rest) => {
      const res = await listRuns(id, ...rest)
      const model = res.items[0]
      if (id !== "tg" || !model) return res
      const items = Array.from({ length: added }, (_, i) => ({
        ...model,
        run_id: `new-${i}`,
        command: `watch ${i}`,
        cli_command: `tg watch ${i}`,
        status: "failed",
        started_at: new Date().toISOString(),
      }))
      return { ...res, items: [...items, ...res.items] }
    })
    let down = true
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (this: HTMLElement) {
      const top = this.tagName === "MAIN" ? 0 : down ? -400 : 10
      return { x: 0, y: top, top, left: 0, right: 0, bottom: 0, width: 0, height: 0, toJSON: () => ({}) }
    })
    const scrollTo = vi.fn(() => {
      down = false
    })
    Object.defineProperty(HTMLElement.prototype, "scrollTo", { configurable: true, value: scrollTo })
    try {
      render(
        <main>
          <LogsPage />
        </main>,
      )
      await loaded()
      added = 2
      await user.click(screen.getByRole("button", { name: "Live" }))

      const more = await screen.findByRole("button", { name: "2 new runs" }, { timeout: 4000 })
      expect(screen.queryByRole("button", { name: /^Show run tg watch/ })).not.toBeInTheDocument()
      await user.click(more)
      expect(scrollTo).toHaveBeenCalled()
      const [first, second] = rows()
      expect(first).toHaveAccessibleName(/^Show run tg watch \d/)
      expect(second).toHaveAccessibleName(/^Show run tg watch \d/)
      expect(screen.queryByRole("button", { name: /new runs?$/ })).not.toBeInTheDocument()

      added = 3
      expect(
        await screen.findByRole("button", { name: /^Show run tg watch 2 / }, { timeout: 4000 }),
      ).toBeInTheDocument()
      expect(screen.queryByRole("button", { name: /new runs?$/ })).not.toBeInTheDocument()
      await user.click(screen.getByRole("button", { name: "Live" }))
    } finally {
      Reflect.deleteProperty(HTMLElement.prototype, "scrollTo")
    }
  }, 20000)
})
