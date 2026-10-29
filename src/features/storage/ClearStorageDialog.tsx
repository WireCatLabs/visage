import { TriangleAlert } from "lucide-react"
import { useEffect, useId, useState } from "react"
import { formatBytes } from "@/domain/format"
import { formatNumber, useMessages } from "@/i18n"
import { Button } from "@/ui/Button"
import { Dialog } from "@/ui/Dialog"
import { Skeleton } from "@/ui/Skeleton"
import { BackupProgress } from "./BackupProgress"
import { useBackups } from "./backup-store"
import { backupMessages } from "./messages-backup"

export function ClearStorageDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const m = useMessages(backupMessages)
  const { preview, previewError, progress, clearing, clearError, backups } = useBackups()
  const { loadPreview, clear, cancel } = useBackups.getState()
  const [backupFirst, setBackupFirst] = useState(true)
  const [typed, setTyped] = useState("")
  const wordId = useId()

  useEffect(() => {
    if (!open) return
    setTyped("")
    setBackupFirst(true)
    loadPreview()
  }, [open, loadPreview])

  const working = progress !== null || clearing
  const ready =
    preview?.supported === true && preview.exists && typed.trim().toLowerCase() === m.confirmWord && !working
  const tables = preview ? [...preview.tables].sort((a, b) => b.rows - a.rows) : []
  const rows = tables.reduce((sum, t) => sum + t.rows, 0)

  const go = async () => {
    if (await clear(backupFirst)) onClose()
  }

  return (
    <Dialog
      open={open}
      wide
      scroll
      title={m.clearTitle}
      onClose={working ? () => {} : onClose}
      actions={
        <>
          <Button variant="ghost" onClick={onClose} disabled={working} autoFocus>
            {m.keepStorage}
          </Button>
          <Button variant="danger" onClick={go} disabled={!ready}>
            {clearing ? m.clearing : backupFirst ? m.backUpAndClear : m.clearWithout}
          </Button>
        </>
      }
    >
      <p
        role="note"
        className="flex items-start gap-2 rounded-[0.3rem] border border-bad/40 bg-bad/10 px-3 py-2 text-[0.95rem] text-ink"
      >
        <TriangleAlert className="mt-[0.2rem] size-4 shrink-0 text-bad" aria-hidden />
        <span>{m.clearWarning(<strong>{m.cannotUndo}</strong>)}</span>
      </p>

      {preview === undefined ? (
        <Skeleton className="mt-4 h-40 w-full" label={m.askingDeleted} />
      ) : previewError ? (
        <p role="alert" className="mt-4 text-bad">
          {m.previewError(previewError)}
        </p>
      ) : preview?.supported ? (
        <>
          <h3 className="mt-4 font-semibold text-ink">{m.whatDeleted}</h3>
          <p className="mt-1">
            {m.storageFiles(<span className="font-mono tabular-nums">{formatBytes(preview.bytes)}</span>)}
          </p>
          <ul aria-label={m.filesDeleted} className="mt-1 flex flex-col gap-0.5">
            {preview.files.map((f) => (
              <li key={f} className="selectable truncate font-mono text-[0.85rem] text-ink">
                {f}
              </li>
            ))}
          </ul>
          <p className="mt-2">
            {m.tablesWithRows(
              tables.length,
              rows,
              <code className="font-mono">{preview.bin} store reset --dry-run</code>,
            )}
          </p>
          <table aria-label={m.tablesEmptied} className="mt-1 w-full text-[0.9rem]">
            <tbody className="block max-h-[9.5rem] overflow-y-auto rounded-[0.2rem] border border-line">
              {tables.map((t) => (
                <tr
                  key={t.name}
                  className="grid grid-cols-[minmax(0,1fr)_7rem] border-line border-b px-2 py-0.5 last:border-b-0"
                >
                  <th scope="row" className="truncate text-left font-mono font-normal text-ink">
                    {t.name}
                  </th>
                  <td className="text-right font-mono text-ink-dim tabular-nums">{formatNumber(t.rows)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <h3 className="mt-4 font-semibold text-ink">{m.whatStays}</h3>
          <p className="mt-1">
            {m.stays(
              <code className="font-mono">{backups?.folder ?? "~/WireCat backups"}</code>,
              String(preview.schema ?? "—"),
            )}
          </p>

          {preview.inUse && (
            <p role="alert" className="mt-3 rounded-[0.3rem] border border-warn/50 bg-warn/10 px-3 py-2 text-warn-ink">
              {m.inUse}
            </p>
          )}

          <label className="mt-4 flex items-start gap-2.5 text-ink">
            <input
              type="checkbox"
              checked={backupFirst}
              disabled={working}
              onChange={(e) => setBackupFirst(e.target.checked)}
              className="mt-[0.3rem] size-[1.05rem] shrink-0 accent-brand"
            />
            <span>
              {m.backUpFirst}
              <span className="block text-[0.9rem] text-ink-soft">{m.backUpFirstHelp}</span>
            </span>
          </label>

          <label htmlFor={wordId} className="mt-4 block text-ink">
            {m.typeToConfirm(<strong className="font-mono">{m.confirmWord}</strong>)}
          </label>
          <input
            id={wordId}
            data-autofocus
            type="text"
            spellCheck={false}
            autoComplete="off"
            value={typed}
            disabled={working}
            onChange={(e) => setTyped(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && ready) go()
            }}
            className="selectable mt-1 h-9 w-[12rem] rounded-[0.35rem] border border-line-strong bg-app px-2 font-mono text-[0.95rem] text-ink"
          />

          <div className="mt-3 min-h-[2rem]">
            {progress ? (
              <BackupProgress progress={progress} onCancel={() => cancel()} />
            ) : clearing ? (
              <p role="status">{m.clearingStorage}</p>
            ) : clearError ? (
              <p role="alert" className="text-bad">
                {clearError.backupFailed ? m.clearBackupFailed : clearError.message}
              </p>
            ) : null}
          </div>
        </>
      ) : (
        <p className="mt-4">{m.cannotPreview}</p>
      )}
    </Dialog>
  )
}
