import { act, render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { findTool } from "@/domain/catalog"
import { platform } from "@/platform/bridge"
import type { SyncEvent } from "@/platform/sync-schemas"
import { useLogs } from "../logs/store"
import { useNav } from "../nav"
import { SyncControl } from "./Sync"
import { useSync } from "./sync-store"

let send: (e: SyncEvent) => void = () => undefined
let finish: () => void = () => undefined

beforeEach(() => {
  useSync.setState(useSync.getInitialState(), true)
  vi.spyOn(platform, "syncLast").mockResolvedValue({
    at: new Date(Date.now() - 12 * 60_000).toISOString(),
    left: null,
    known: true,
  })
  vi.spyOn(platform, "syncRun").mockImplementation((_id, _profile, onEvent) => {
    send = (e) => act(() => onEvent(e))
    return new Promise((resolve) => {
      finish = resolve
    })
  })
  vi.spyOn(platform, "syncStop").mockImplementation(async () => send({ event: "stopped" }))
})

afterEach(() => vi.restoreAllMocks())

const tg = findTool("tg") as NonNullable<ReturnType<typeof findTool>>

describe("syncing a profile from the Manage panel", () => {
  it("shows the last sync, the stage while it runs, and the result until dismissed", async () => {
    render(<SyncControl tool={tg} profile="personal" />)
    expect(await screen.findByText("Last synced 12 min ago")).toBeInTheDocument()
    await userEvent.click(screen.getByRole("button", { name: "Sync now" }))
    expect(platform.syncRun).toHaveBeenCalledWith("tg", "personal", expect.any(Function))
    send({ event: "stage", stage: "Fetching messages" })
    expect(screen.getByRole("progressbar", { name: "Syncing" })).toHaveAttribute("aria-valuetext", "Fetching messages")
    send({ event: "progress", chats: 40, chatsDone: 3, fetched: 1240 })
    expect(screen.getByRole("progressbar", { name: "Syncing" })).toHaveAttribute("aria-valuenow", "8")
    expect(screen.getByText("Chat 4 of 40 · 1,240 new messages")).toBeInTheDocument()
    send({ event: "done", summary: { new: 1240, places: 3, failed: 0, left: 0, complete: true } })
    finish()
    expect(await screen.findByText("Synced 1,240 new messages in 3 chats")).toBeInTheDocument()
    expect(screen.getByText("Your agents can search them now.")).toBeInTheDocument()
    await userEvent.click(screen.getByRole("button", { name: "Dismiss" }))
    await waitFor(() => expect(screen.queryByText(/Synced 1,240/)).not.toBeInTheDocument())
    expect(screen.getByRole("button", { name: "Sync now" })).toBeInTheDocument()
  })

  it("stops the running sync and says what came in is kept", async () => {
    render(<SyncControl tool={tg} profile="personal" />)
    await userEvent.click(await screen.findByRole("button", { name: "Sync now" }))
    await userEvent.click(screen.getByRole("button", { name: "Stop" }))
    expect(platform.syncStop).toHaveBeenCalledWith("tg", "personal")
    expect(await screen.findByText("Stopped")).toBeInTheDocument()
    expect(screen.getByText(/What came in is kept/)).toBeInTheDocument()
  })

  it("does not start a second sync of the same profile", async () => {
    render(
      <>
        <SyncControl tool={tg} profile="personal" />
        <SyncControl tool={tg} profile="work" />
      </>,
    )
    await screen.findAllByText("Last synced 12 min ago")
    act(() => useSync.getState().start("tg", "personal"))
    act(() => useSync.getState().start("tg", "personal"))
    expect(platform.syncRun).toHaveBeenCalledTimes(1)
    const work = screen.getByRole("region", { name: "Sync Telegram work" })
    expect(within(work).getByRole("button", { name: "Sync now" })).toBeEnabled()
  })

  it("shows a failure as the tool's code and opens its failed run on Logs, never the tool's own words", async () => {
    render(<SyncControl tool={tg} profile="personal" />)
    await userEvent.click(await screen.findByRole("button", { name: "Sync now" }))
    send({
      event: "failed",
      message: "Telegram stopped with the error provider_error.",
      code: "provider_error",
      reason: null,
      run: "20261027T121457Z-messages-sync-db4f0a",
    })
    finish()
    expect(await screen.findByText("The sync failed")).toBeInTheDocument()
    await userEvent.click(screen.getByRole("button", { name: "Open the run on Logs" }))
    expect(useLogs.getState().query).toBe("run_id:20261027T121457Z-messages-sync-db4f0a")
    expect(useNav.getState().active).toBe("logs")
  })

  it("syncs memo and Email under one lock, without a profile", () => {
    useSync.getState().start("memo", null)
    useSync.getState().start("email", null)
    expect(platform.syncRun).toHaveBeenCalledTimes(1)
  })
})
