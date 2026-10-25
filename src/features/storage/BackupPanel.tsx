import { Archive, FolderOpen, Trash2 } from "lucide-react"
import { useEffect, useState } from "react"
import { findTool } from "@/domain/catalog"
import { formatDuration } from "@/domain/database"
import { formatBytes } from "@/domain/format"
import { Button } from "@/ui/Button"
import { Skeleton } from "@/ui/Skeleton"
import { BackupProgress } from "./BackupProgress"
import { useBackups } from "./backup-store"
import { ClearStorageDialog } from "./ClearStorageDialog"

const day = (ms: number) =>
  new Date(ms).toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })

export function BackupPanel() {
  const { backups, listError, progress, made, backupError, clearing, preview, clearError, cleared } = useBackups()
  const { loadBackups, backup, cancel, open, loadPreview } = useBackups.getState()
  const [confirming, setConfirming] = useState(false)

  useEffect(() => {
    loadBackups()
    loadPreview()
  }, [loadBackups, loadPreview])

  const busy = progress !== null || clearing
  const bin = preview ? (findTool(preview.answeredBy)?.bin ?? preview.answeredBy) : null
  const clearBlocked =
    preview === undefined
      ? "Asking the tool what clearing would delete…"
      : preview === null
        ? "Install Telegram, WhatsApp or MAX: clearing is done by a messenger tool."
        : !preview.supported
          ? `Clearing needs a newer ${bin}, one that lists what clearing would delete. Update ${bin} on the Tools page.`
          : !preview.exists
            ? "Storage is not created yet, so there is nothing to clear."
            : null

  return (
    <section aria-labelledby="backups-title" className="rounded-[0.2rem] border border-line-strong bg-app">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-line border-b px-[1.3rem] py-[0.9rem]">
        <div>
          <h2 id="backups-title" className="text-[1.08rem] font-semibold">
            Backups
          </h2>
          <p className="mt-0.5 text-[0.85rem] text-ink-dim">
            A zip of the whole storage database, in{" "}
            <span className="selectable font-mono">{backups?.folder ?? "~/WireCat backups"}</span>. It is not encrypted:
            keep it somewhere private.
          </p>
        </div>
        <Button
          variant="primary"
          onClick={() => backup()}
          disabled={busy}
          icon={<Archive className="size-4" aria-hidden />}
          className="min-w-[9.5rem]"
        >
          Back up now
        </Button>
      </div>

      <div className="flex min-h-[3.4rem] flex-col justify-center gap-2 px-[1.3rem] py-[0.9rem]">
        {progress ? (
          <BackupProgress progress={progress} onCancel={() => cancel()} />
        ) : backupError ? (
          <p role="alert" className="text-[0.95rem] text-bad">
            The backup did not finish: {backupError}
          </p>
        ) : made ? (
          <p role="status" className="text-[0.95rem] text-ink-soft">
            Backed up to <span className="selectable font-mono text-ink">{made.file.name}</span> ·{" "}
            <span className="font-mono tabular-nums">{formatBytes(made.file.bytes)}</span> from{" "}
            <span className="font-mono tabular-nums">{formatBytes(made.storeBytes)}</span> in{" "}
            <span className="font-mono tabular-nums">{formatDuration(made.millis)}</span>
          </p>
        ) : (
          <p className="text-[0.95rem] text-ink-soft">
            Tools keep using storage while it is copied. You need about one and a half times its size free.
          </p>
        )}
        {cleared !== null && (
          <p role="status" className="text-[0.95rem] text-ink-soft">
            Storage was cleared. It is empty at schema {cleared} and fills again with the next sync or import.
          </p>
        )}
        {clearError && !confirming && (
          <p role="alert" className="text-[0.95rem] text-bad">
            {clearError}
          </p>
        )}
      </div>

      <div className="border-line border-t px-[1.3rem] py-[0.9rem]">
        {listError && (
          <p role="alert" className="mb-2 text-[0.9rem] text-bad">
            {listError}
          </p>
        )}
        {backups === undefined ? (
          <Skeleton className="h-[3.4rem] w-full" label="Reading backups" />
        ) : backups.files.length === 0 ? (
          <p className="text-[0.9rem] text-ink-dim">No backups yet.</p>
        ) : (
          <ul aria-label="Backups on this computer" className="flex flex-col gap-1">
            {backups.files.map((f) => (
              <li
                key={f.name}
                className="grid grid-cols-[minmax(0,1fr)_6rem_11rem_1.5rem] items-center gap-3 text-[0.85rem]"
              >
                <span className="selectable truncate font-mono text-[0.8rem] text-ink">{f.name}</span>
                <span className="text-right font-mono text-ink-dim tabular-nums">{formatBytes(f.bytes)}</span>
                <span className="text-ink-dim tabular-nums">{day(f.modified)}</span>
                <button
                  type="button"
                  onClick={() => open(f.name)}
                  aria-label={`Show ${f.name} in the file manager`}
                  title="Show in file manager"
                  className="grid size-6 shrink-0 place-items-center rounded-[0.3rem] text-ink-dim hover:bg-app-3 hover:text-ink"
                >
                  <FolderOpen className="size-3.5" aria-hidden />
                </button>
              </li>
            ))}
          </ul>
        )}
        {backups && backups.files.length > 0 && (
          <Button variant="ghost" size="sm" className="mt-2 -ml-3" onClick={() => open(null)}>
            <FolderOpen className="size-3.5" aria-hidden />
            Open backups folder
          </Button>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-line border-t px-[1.3rem] py-[0.9rem]">
        <div className="max-w-[62ch]">
          <h3 className="text-[0.98rem] font-semibold">Clear storage</h3>
          <p id="clear-why" className="mt-0.5 text-[0.85rem] text-ink-soft">
            {clearBlocked ??
              "Deletes every message, chat, email, document and meeting in storage. Settings and sign-ins stay."}
          </p>
        </div>
        <Button
          variant="danger"
          onClick={() => setConfirming(true)}
          disabled={clearBlocked !== null || busy}
          aria-describedby="clear-why"
          icon={<Trash2 className="size-4" aria-hidden />}
          className="min-w-[9.5rem]"
        >
          {clearing ? "Clearing…" : "Clear storage…"}
        </Button>
      </div>

      <ClearStorageDialog open={confirming} onClose={() => setConfirming(false)} />
    </section>
  )
}
