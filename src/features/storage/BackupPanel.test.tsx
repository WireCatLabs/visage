import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { ResetPreview } from "@/platform/backup-schemas"
import { platform } from "@/platform/bridge"
import { BackupPanel } from "./BackupPanel"
import { useBackups } from "./backup-store"

const PREVIEW: ResetPreview = {
  answeredBy: "tg",
  bin: "tg",
  supported: true,
  exists: true,
  files: ["~/.local/share/WireCat/wirecat.db", "~/.local/share/WireCat/wirecat.db-wal"],
  bytes: 3_400_000_000,
  schema: 33,
  tables: [
    { name: "messages", rows: 16_739 },
    { name: "chats", rows: 1_784 },
  ],
  inUse: false,
}

const openDialog = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.click(await screen.findByRole("button", { name: "Clear storage…" }))
  return screen.findByRole("dialog", { name: "Clear storage?" })
}

describe("Backups and clearing storage", () => {
  beforeEach(() => {
    useBackups.setState({ progress: null, made: null, backupError: null, clearError: null, cleared: null })
    vi.spyOn(platform, "storeResetPreview").mockResolvedValue(PREVIEW)
  })
  afterEach(() => vi.restoreAllMocks())

  it("backs storage up into a zip and lists it with the others", async () => {
    const user = userEvent.setup()
    render(<BackupPanel />)
    const list = await screen.findByRole("list", { name: "Backups on this computer" })
    const before = within(list).getAllByRole("listitem").length

    await user.click(screen.getByRole("button", { name: "Back up now" }))
    expect(await screen.findByText(/Backed up to/, {}, { timeout: 8000 })).toHaveTextContent(/wirecat-store-.*\.zip/)
    await waitFor(() =>
      expect(
        within(screen.getByRole("list", { name: "Backups on this computer" })).getAllByRole("listitem"),
      ).toHaveLength(before + 1),
    )
  })

  it("lists every file and table, and enables Clear only once the word is typed", async () => {
    const user = userEvent.setup()
    render(<BackupPanel />)
    const dialog = await openDialog(user)

    expect(await within(dialog).findByRole("list", { name: "Files deleted" })).toHaveTextContent("wirecat.db-wal")
    expect(within(dialog).getByRole("rowheader", { name: "messages" })).toBeInTheDocument()
    expect(within(dialog).getByText(/cannot be undone/)).toBeInTheDocument()
    expect(within(dialog).getByRole("checkbox", { name: /Back up first/ })).toBeChecked()

    const clear = within(dialog).getByRole("button", { name: "Back up and clear" })
    expect(clear).toBeDisabled()
    await user.type(within(dialog).getByRole("textbox", { name: /to confirm/ }), "clea")
    expect(clear).toBeDisabled()
    await user.type(within(dialog).getByRole("textbox", { name: /to confirm/ }), "r")
    expect(clear).toBeEnabled()

    await user.click(within(dialog).getByRole("checkbox", { name: /Back up first/ }))
    expect(within(dialog).getByRole("button", { name: "Clear without a backup" })).toBeEnabled()
  })

  it("backs up first and clears only after the backup finished", async () => {
    const reset = vi.spyOn(platform, "storeReset")
    const user = userEvent.setup()
    render(<BackupPanel />)
    const dialog = await openDialog(user)
    await user.type(await within(dialog).findByRole("textbox", { name: /to confirm/ }), "clear")
    await user.click(within(dialog).getByRole("button", { name: "Back up and clear" }))

    expect(await screen.findByText(/Storage was cleared/, {}, { timeout: 8000 })).toBeInTheDocument()
    expect(screen.getByText(/Backed up to/)).toBeInTheDocument()
    expect(reset).toHaveBeenCalledTimes(1)
  })

  it("deletes nothing when the backup fails", async () => {
    vi.spyOn(platform, "storeBackup").mockImplementation(async (onEvent) =>
      onEvent({ event: "failed", message: "Not enough free disk space." }),
    )
    const reset = vi.spyOn(platform, "storeReset")
    const user = userEvent.setup()
    render(<BackupPanel />)
    const dialog = await openDialog(user)
    await user.type(await within(dialog).findByRole("textbox", { name: /to confirm/ }), "clear")
    await user.click(within(dialog).getByRole("button", { name: "Back up and clear" }))

    expect(await within(dialog).findByText("The backup did not finish, so nothing was deleted.")).toBeInTheDocument()
    expect(reset).not.toHaveBeenCalled()
  })

  it("keeps Clear off, and says why, while the tool is older than the preview", async () => {
    vi.spyOn(platform, "storeResetPreview").mockResolvedValue({
      ...PREVIEW,
      supported: false,
      exists: false,
      files: [],
      tables: [],
    })
    render(<BackupPanel />)

    expect(await screen.findByText(/Clearing needs a newer tg/)).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Clear storage…" })).toBeDisabled()
  })

  it("warns in the dialog when a sync has storage open", async () => {
    vi.spyOn(platform, "storeResetPreview").mockResolvedValue({ ...PREVIEW, inUse: true })
    const user = userEvent.setup()
    render(<BackupPanel />)
    const dialog = await openDialog(user)
    expect(await within(dialog).findByText(/has storage open right now/)).toBeInTheDocument()
  })
})
