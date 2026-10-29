import { Archive, FolderOpen, Lock, Trash2 } from "lucide-react"
import { useEffect, useState } from "react"
import { findTool } from "@/domain/catalog"
import { formatBytes } from "@/domain/format"
import { formatDate, useMessages } from "@/i18n"
import { Button } from "@/ui/Button"
import { Skeleton } from "@/ui/Skeleton"
import { BackupPassword } from "./BackupPassword"
import { BackupProgress } from "./BackupProgress"
import { passwordProblem } from "./backup-password"
import { useBackups } from "./backup-store"
import { ClearStorageDialog } from "./ClearStorageDialog"
import { storageMessages } from "./messages"
import { backupMessages } from "./messages-backup"

const DAY_AND_TIME: Intl.DateTimeFormatOptions = {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
}

export function BackupPanel() {
  const m = useMessages(backupMessages)
  const { duration, showInFiles } = useMessages(storageMessages)
  const { backups, listError, progress, made, backupError, clearing, preview, clearError, cleared } = useBackups()
  const { loadBackups, backup, cancel, open, loadPreview } = useBackups.getState()
  const [confirming, setConfirming] = useState(false)
  const [protect, setProtect] = useState(false)
  const [password, setPassword] = useState("")
  const [repeat, setRepeat] = useState("")

  useEffect(() => {
    loadBackups()
    loadPreview()
  }, [loadBackups, loadPreview])

  const busy = progress !== null || clearing
  const bin = preview ? (findTool(preview.answeredBy)?.bin ?? preview.answeredBy) : null
  const blocked = protect && passwordProblem(password, repeat) !== null
  const start = () => {
    const given = protect ? password : undefined
    // Typed once, used once: the fields are emptied as soon as the tool has it.
    setPassword("")
    setRepeat("")
    backup(given)
  }
  const kinds = new Set(backups?.files.map((f) => f.encrypted))
  const restoreBin = bin ?? "tg"
  const clearBlocked =
    preview === undefined
      ? m.clearAsking
      : preview === null
        ? m.clearNoTool
        : !preview.supported
          ? m.clearOld(bin ?? preview.answeredBy)
          : !preview.exists
            ? m.clearNothing
            : null

  return (
    <section aria-labelledby="backups-title" className="rounded-[0.2rem] border border-line-strong bg-app">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-line border-b px-[1.3rem] py-[0.9rem]">
        <div>
          <h2 id="backups-title" className="text-[1.08rem] font-semibold">
            {m.backups}
          </h2>
          <p className="mt-0.5 text-[0.9rem] text-ink-dim">
            {m.backupsIntro(<code className="selectable font-mono">{backups?.folder ?? "~/WireCat backups"}</code>)}
          </p>
        </div>
        <Button
          variant="primary"
          onClick={start}
          disabled={busy || blocked}
          icon={<Archive className="size-4" aria-hidden />}
          className="min-w-[9.5rem]"
        >
          {m.backUpNow}
        </Button>
      </div>

      <div className="flex flex-col gap-3 border-line border-b px-[1.3rem] py-[0.9rem]">
        <label className="flex items-start gap-2.5 text-ink">
          <input
            type="checkbox"
            checked={protect}
            disabled={busy}
            onChange={(e) => {
              setProtect(e.target.checked)
              setPassword("")
              setRepeat("")
            }}
            className="mt-[0.3rem] size-[1.05rem] shrink-0 accent-brand"
          />
          <span>
            {m.protect}
            <span className="block text-[0.9rem] text-ink-soft">{m.protectHelp}</span>
          </span>
        </label>
        {protect && (
          <BackupPassword
            password={password}
            repeat={repeat}
            onPassword={setPassword}
            onRepeat={setRepeat}
            disabled={busy}
          />
        )}
      </div>

      <div className="flex min-h-[3.4rem] flex-col justify-center gap-2 px-[1.3rem] py-[0.9rem]">
        {progress ? (
          <BackupProgress progress={progress} onCancel={() => cancel()} />
        ) : backupError ? (
          <p role="alert" className="text-[0.95rem] text-bad">
            {m.backupFailed(backupError)}
          </p>
        ) : made ? (
          <p role="status" className="text-[0.95rem] text-ink-soft">
            {m.made(
              made.file.encrypted,
              <span className="selectable font-mono text-ink">{made.file.name}</span>,
              <span className="font-mono tabular-nums">{formatBytes(made.file.bytes)}</span>,
              <span className="font-mono tabular-nums">{formatBytes(made.storeBytes)}</span>,
              <span className="font-mono tabular-nums">{duration(made.millis)}</span>,
            )}
          </p>
        ) : (
          <p className="text-[0.95rem] text-ink-soft">{m.copyNeeds}</p>
        )}
        {cleared !== null && (
          <p role="status" className="text-[0.95rem] text-ink-soft">
            {m.cleared(cleared)}
          </p>
        )}
        {clearError && !confirming && (
          <p role="alert" className="text-[0.95rem] text-bad">
            {clearError.backupFailed ? m.clearBackupFailed : clearError.message}
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
          <Skeleton className="h-[3.4rem] w-full" label={m.readingBackups} />
        ) : backups.files.length === 0 ? (
          <p className="text-[0.9rem] text-ink-dim">{m.noBackups}</p>
        ) : (
          <ul aria-label={m.backupsLabel} className="flex flex-col gap-1">
            {backups.files.map((f) => (
              <li
                key={f.name}
                className="grid grid-cols-[1rem_minmax(0,1fr)_6rem_minmax(11rem,auto)_1.5rem] items-center gap-3 text-[0.9rem]"
              >
                {f.encrypted ? (
                  <Lock className="size-3.5 text-ink-soft" role="img" aria-label={m.encrypted} />
                ) : (
                  <span />
                )}
                <span className="selectable truncate font-mono text-[0.85rem] text-ink">{f.name}</span>
                <span className="text-right font-mono text-ink-dim tabular-nums">{formatBytes(f.bytes)}</span>
                <span className="text-ink-dim tabular-nums">{formatDate(f.modified, DAY_AND_TIME)}</span>
                <button
                  type="button"
                  onClick={() => open(f.name)}
                  aria-label={m.showFile(f.name)}
                  title={showInFiles}
                  className="grid size-6 shrink-0 place-items-center rounded-[0.3rem] text-ink-dim hover:bg-app-3 hover:text-ink"
                >
                  <FolderOpen className="size-3.5" aria-hidden />
                </button>
              </li>
            ))}
          </ul>
        )}
        {backups && backups.files.length > 0 && (
          <div
            aria-label={m.howToRestore}
            role="note"
            className="mt-3 flex flex-col gap-0.5 text-[0.9rem] text-ink-soft"
          >
            {kinds.has(false) && (
              <p>
                {m.restoreZip(
                  <code className="font-mono">.zip</code>,
                  <code className="selectable font-mono text-ink">{restoreBin} store restore wirecat.db</code>,
                )}
              </p>
            )}
            {kinds.has(true) && (
              <p>
                {m.restoreSealed(
                  <code className="font-mono">.db.sealed</code>,
                  <code className="selectable font-mono text-ink">
                    {restoreBin} store restore &lt;file&gt;.db.sealed
                  </code>,
                )}
              </p>
            )}
          </div>
        )}
        {backups && backups.files.length > 0 && (
          <Button variant="ghost" size="sm" className="mt-2 -ml-3" onClick={() => open(null)}>
            <FolderOpen className="size-3.5" aria-hidden />
            {m.openBackups}
          </Button>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-line border-t px-[1.3rem] py-[0.9rem]">
        <div className="max-w-[62ch]">
          <h3 className="text-[0.98rem] font-semibold">{m.clearStorage}</h3>
          <p id="clear-why" className="mt-0.5 text-[0.9rem] text-ink-soft">
            {clearBlocked ?? m.clearWhat}
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
          {clearing ? m.clearing : m.clearOpen}
        </Button>
      </div>

      <ClearStorageDialog open={confirming} onClose={() => setConfirming(false)} />
    </section>
  )
}
