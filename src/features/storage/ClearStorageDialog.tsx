import { TriangleAlert } from "lucide-react"
import { useEffect, useId, useState } from "react"
import { formatBytes } from "@/domain/format"
import { Button } from "@/ui/Button"
import { Dialog } from "@/ui/Dialog"
import { Skeleton } from "@/ui/Skeleton"
import { BackupProgress } from "./BackupProgress"
import { useBackups } from "./backup-store"

/** Typed to enable the button: a click alone is too easy for a deletion nobody gets back. */
export const CONFIRM_WORD = "clear"

const n = (x: number) => x.toLocaleString("en-US")

export function ClearStorageDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
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
  const ready = preview?.supported === true && preview.exists && typed.trim() === CONFIRM_WORD && !working
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
      title="Clear storage?"
      onClose={working ? () => {} : onClose}
      actions={
        <>
          <Button variant="ghost" onClick={onClose} disabled={working} autoFocus>
            Keep storage
          </Button>
          <Button variant="danger" onClick={go} disabled={!ready}>
            {clearing ? "Clearing…" : backupFirst ? "Back up and clear" : "Clear without a backup"}
          </Button>
        </>
      }
    >
      <p
        role="note"
        className="flex items-start gap-2 rounded-[0.3rem] border border-bad/40 bg-bad/10 px-3 py-2 text-[0.95rem] text-ink"
      >
        <TriangleAlert className="mt-[0.2rem] size-4 shrink-0 text-bad" aria-hidden />
        <span>
          This deletes everything in storage, for every tool and account. <strong>It cannot be undone</strong> except
          from a backup.
        </span>
      </p>

      {preview === undefined ? (
        <Skeleton className="mt-4 h-40 w-full" label="Asking what would be deleted" />
      ) : previewError ? (
        <p role="alert" className="mt-4 text-bad">
          Could not ask what would be deleted: {previewError}
        </p>
      ) : preview?.supported ? (
        <>
          <h3 className="mt-4 font-semibold text-ink">What is deleted</h3>
          <p className="mt-1">
            The storage files, <span className="font-mono tabular-nums">{formatBytes(preview.bytes)}</span>:
          </p>
          <ul aria-label="Files deleted" className="mt-1 flex flex-col gap-0.5">
            {preview.files.map((f) => (
              <li key={f} className="selectable truncate font-mono text-[0.8rem] text-ink">
                {f}
              </li>
            ))}
          </ul>
          <p className="mt-2">
            {n(tables.length)} tables with <span className="font-mono tabular-nums">{n(rows)}</span> rows, read by{" "}
            <span className="font-mono">{preview.bin} store reset --dry-run</span>:
          </p>
          <table aria-label="Tables emptied" className="mt-1 w-full text-[0.85rem]">
            <tbody className="block max-h-[9.5rem] overflow-y-auto rounded-[0.2rem] border border-line">
              {tables.map((t) => (
                <tr
                  key={t.name}
                  className="grid grid-cols-[minmax(0,1fr)_7rem] border-line border-b px-2 py-0.5 last:border-b-0"
                >
                  <th scope="row" className="truncate text-left font-mono font-normal text-ink">
                    {t.name}
                  </th>
                  <td className="text-right font-mono text-ink-dim tabular-nums">{n(t.rows)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <h3 className="mt-4 font-semibold text-ink">What stays</h3>
          <p className="mt-1">
            Each tool's settings, profiles and sign-ins, tokens in the system keyring, and backups in{" "}
            <span className="font-mono">{backups?.folder ?? "~/WireCat backups"}</span>. Storage starts again empty at
            schema {preview.schema ?? "—"}, and the next sync or import fills it, scheduled ones included.
          </p>

          {preview.inUse && (
            <p role="alert" className="mt-3 rounded-[0.3rem] border border-warn/50 bg-warn/10 px-3 py-2 text-warn-ink">
              A sync, an import, a server or an agent's WireCat MCP connection has storage open right now. Clearing is
              refused until it finishes, or until you close those agent sessions.
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
              Back up first
              <span className="block text-[0.85rem] text-ink-soft">
                A zip in the backups folder before anything is deleted. If the backup fails or you cancel it, nothing is
                deleted.
              </span>
            </span>
          </label>

          <label htmlFor={wordId} className="mt-4 block text-ink">
            Type <strong className="font-mono">{CONFIRM_WORD}</strong> to confirm
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
              <p role="status">Clearing storage…</p>
            ) : clearError ? (
              <p role="alert" className="text-bad">
                {clearError}
              </p>
            ) : null}
          </div>
        </>
      ) : (
        <p className="mt-4">The installed tool cannot say what clearing would delete, so clearing is off.</p>
      )}
    </Dialog>
  )
}
