import { Database, FolderOpen, Trash2 } from "lucide-react"
import { useEffect, useState } from "react"
import { findTool, sharedStorage } from "@/domain/catalog"
import { formatBytes } from "@/domain/format"
import type { StorageArea, StorageFolder } from "@/platform/schemas"
import { Button } from "@/ui/Button"
import { Dialog } from "@/ui/Dialog"
import { Skeleton } from "@/ui/Skeleton"
import { ToolIcon } from "../tools/ToolIcon"
import { areaBytes, useStorage } from "./store"

const areaName = (id: string) => (id === "shared" ? sharedStorage.label : (findTool(id)?.name ?? id))
const kindLabel: Record<StorageFolder["kind"], string> = { config: "Settings", state: "Data", cache: "Cache" }

const toolNames = (ids: string[]) => ids.map((id) => findTool(id)?.name ?? id).join(", ")

export function StoragePage() {
  const { areas, error, clearing, load, clear, clearAll } = useStorage()
  const [confirm, setConfirm] = useState<StorageArea | "all" | null>(null)

  useEffect(() => {
    load()
  }, [load])

  const leftovers = (areas ?? []).filter((a) => a.folders.length > 0 && a.usedBy.length === 0)
  const leftoverBytes = leftovers.reduce((sum, a) => sum + areaBytes(a), 0)

  return (
    <div className="flex flex-col gap-[1.5rem] px-[2.1rem] pt-[1.6rem] pb-[2.2rem]">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-[2.1rem] font-extrabold leading-none tracking-[-0.035em]">Storage</h1>
          <p className="mt-3 max-w-[70ch] text-[0.95rem] text-ink-soft">
            What WireCat tools keep on this computer: settings, sessions, message archives and caches. A tool's data can
            be deleted once the tool is uninstalled. Sign-in tokens in your system keyring are not touched.
          </p>
        </div>
        {leftovers.length > 1 && (
          <Button variant="danger" onClick={() => setConfirm("all")} icon={<Trash2 className="size-4" aria-hidden />}>
            Delete all leftover data
          </Button>
        )}
      </div>

      {error && (
        <p role="alert" className="rounded-[0.2rem] border border-bad/40 bg-bad/10 px-4 py-3 text-[0.95rem]">
          {error}
        </p>
      )}

      <ul
        aria-label="Data on this computer"
        className="overflow-hidden rounded-[0.2rem] border border-line-strong bg-app"
      >
        {areas === null
          ? [0, 1, 2].map((i) => (
              <li key={i} className="border-line border-b px-[1.3rem] py-5 last:border-b-0">
                {i === 0 ? (
                  <Skeleton className="h-10 w-full" label="Measuring folders" />
                ) : (
                  <Skeleton className="h-10 w-full" />
                )}
              </li>
            ))
          : areas.map((a) => <Row key={a.id} area={a} busy={clearing === a.id} onDelete={() => setConfirm(a)} />)}
      </ul>

      <ConfirmDelete
        target={confirm}
        leftovers={leftovers}
        leftoverBytes={leftoverBytes}
        onCancel={() => setConfirm(null)}
        onConfirm={() => {
          const target = confirm
          setConfirm(null)
          if (target === "all") clearAll()
          else if (target) clear(target.id)
        }}
      />
    </div>
  )
}

function Row({ area, busy, onDelete }: { area: StorageArea; busy: boolean; onDelete: () => void }) {
  const open = useStorage((s) => s.open)
  const empty = area.folders.length === 0
  const inUse = area.usedBy.length > 0
  const status = empty
    ? "Nothing stored"
    : inUse
      ? area.id === "shared"
        ? `Used by ${toolNames(area.usedBy)}`
        : "In use: uninstall the tool to delete its data"
      : "Left behind after uninstalling"

  return (
    <li className="grid min-h-[4.5rem] grid-cols-[1.8rem_minmax(0,1fr)_7rem_9.6rem] items-center gap-x-[1.2rem] border-line border-b px-[1.3rem] py-4 last:border-b-0">
      {area.id === "shared" ? (
        <Database className="size-[1.6rem] text-ink" strokeWidth={1.75} aria-hidden />
      ) : (
        <ToolIcon id={area.id} className="size-[1.6rem] text-ink" />
      )}
      <div className="min-w-0">
        <h3 className="text-[1.08rem] font-semibold leading-tight">{areaName(area.id)}</h3>
        <p className={`mt-1 text-[0.9rem] ${!empty && !inUse ? "text-warn-ink" : "text-ink-soft"}`}>{status}</p>
        {!empty && (
          <ul className="mt-1.5 flex flex-col gap-0.5">
            {area.folders.map((f) => (
              <li key={f.path} className="flex min-w-0 items-center gap-2 text-[0.8rem]">
                <span className="w-[3.6rem] shrink-0 text-ink-soft">{kindLabel[f.kind]}</span>
                <span className="selectable truncate font-mono text-ink-dim">{f.path}</span>
                <span className="shrink-0 font-mono text-ink-dim tabular-nums">{formatBytes(f.bytes)}</span>
                <button
                  type="button"
                  onClick={() => open(area.id, f.kind)}
                  aria-label={`Open ${kindLabel[f.kind].toLowerCase()} folder ${f.path}`}
                  title="Open in file manager"
                  className="grid size-6 shrink-0 place-items-center rounded-[0.3rem] text-ink-dim hover:bg-app-3 hover:text-ink"
                >
                  <FolderOpen className="size-3.5" aria-hidden />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      <span className="font-mono text-[1rem] tabular-nums">{empty ? "—" : formatBytes(areaBytes(area))}</span>
      <div className="flex justify-end">
        {!empty && !inUse && (
          <Button variant="danger" onClick={onDelete} disabled={busy} className="min-w-[7.6rem]">
            {busy ? "Deleting…" : "Delete"}
          </Button>
        )}
      </div>
    </li>
  )
}

function ConfirmDelete(props: {
  target: StorageArea | "all" | null
  leftovers: StorageArea[]
  leftoverBytes: number
  onCancel: () => void
  onConfirm: () => void
}) {
  const { target, leftovers, leftoverBytes, onCancel, onConfirm } = props
  const areas = target === "all" ? leftovers : target ? [target] : []
  const bytes = target === "all" ? leftoverBytes : target ? areaBytes(target) : 0
  const title =
    target === "all" ? "Delete all leftover WireCat data?" : target ? `Delete ${areaName(target.id)} data?` : ""
  return (
    <Dialog
      open={target !== null}
      title={title}
      onClose={onCancel}
      actions={
        <>
          <Button variant="ghost" onClick={onCancel} autoFocus>
            Keep it
          </Button>
          <Button variant="danger" onClick={onConfirm} icon={<Trash2 className="size-4" aria-hidden />}>
            Delete {formatBytes(bytes)}
          </Button>
        </>
      }
    >
      <p>These folders are deleted for good. Archives, sessions and settings in them cannot be recovered.</p>
      <ul className="mt-3 flex flex-col gap-1">
        {areas.flatMap((a) =>
          a.folders.map((f) => (
            <li key={f.path} className="selectable truncate font-mono text-[0.8rem] text-ink">
              {f.path}
            </li>
          )),
        )}
      </ul>
    </Dialog>
  )
}
