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

  it("asks for the password twice and refuses one that cannot be used", async () => {
    const user = userEvent.setup()
    render(<BackupPanel />)
    const backUp = screen.getByRole("button", { name: "Back up now" })
    await user.click(screen.getByRole("checkbox", { name: /Protect with a password/ }))

    expect(screen.getByText("If you lose it, the backup cannot be opened. WireCat does not keep it.")).toBeVisible()
    const first = screen.getByLabelText("Password")
    const again = screen.getByLabelText("Repeat password")
    expect(first).toHaveAttribute("type", "password")
    expect(backUp).toBeDisabled()

    await user.type(first, "short")
    expect(screen.getByText("Strength: Too short")).toBeInTheDocument()
    expect(screen.getByText("Use at least 8 characters.")).toBeInTheDocument()

    await user.clear(first)
    await user.type(first, " padded password")
    expect(screen.getByRole("alert")).toHaveTextContent("A password cannot start or end with a space.")

    await user.clear(first)
    await user.type(first, "Long Unrelated Words 7")
    await user.type(again, "Long Unrelated Words")
    expect(screen.getByRole("alert")).toHaveTextContent("The two passwords differ.")
    expect(again).toHaveAttribute("aria-invalid", "true")
    expect(backUp).toBeDisabled()

    await user.type(again, " 7")
    expect(screen.getByText("Strength: Strong")).toBeInTheDocument()
    expect(screen.getByText("The passwords match.")).toBeInTheDocument()
    expect(backUp).toBeEnabled()

    await user.click(screen.getByRole("button", { name: "Show password" }))
    expect(first).toHaveAttribute("type", "text")
    expect(again).toHaveAttribute("type", "text")
  })

  it("hands the password to the tool, empties the fields and lists the backup as encrypted", async () => {
    const backup = vi.spyOn(platform, "storeBackup")
    const user = userEvent.setup()
    render(<BackupPanel />)
    await user.click(screen.getByRole("checkbox", { name: /Protect with a password/ }))
    await user.type(screen.getByLabelText("Password"), "correct horse battery")
    await user.type(screen.getByLabelText("Repeat password"), "correct horse battery")
    await user.click(screen.getByRole("button", { name: "Back up now" }))

    expect(backup).toHaveBeenCalledWith(expect.any(Function), "correct horse battery")
    expect(screen.getByLabelText("Password")).toHaveValue("")
    expect(screen.getByLabelText("Repeat password")).toHaveValue("")
    expect(await screen.findByText(/Backed up with a password to/, {}, { timeout: 8000 })).toHaveTextContent(
      /wirecat-store-.*\.db\.sealed/,
    )
    const list = screen.getByRole("list", { name: "Backups on this computer" })
    await waitFor(() => expect(within(list).getAllByRole("img", { name: "Encrypted with a password" })).toHaveLength(2))
    const note = screen.getByRole("note", { name: "How to restore" })
    expect(note).toHaveTextContent("unzip it, then run tg store restore wirecat.db")
    expect(note).toHaveTextContent("tg store restore <file>.db.sealed; it asks for the password")
  })

  it("backs up without a password unless the box is ticked", async () => {
    const backup = vi
      .spyOn(platform, "storeBackup")
      .mockImplementation(async (onEvent) => onEvent({ event: "cancelled" }))
    const user = userEvent.setup()
    render(<BackupPanel />)
    await user.click(screen.getByRole("button", { name: "Back up now" }))
    expect(backup).toHaveBeenCalledWith(expect.any(Function), undefined)
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
