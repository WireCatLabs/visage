import { Database, Trash2 } from "lucide-react"
import { useEffect, useState } from "react"
import { findTool, sharedStorage } from "@/domain/catalog"
import { formatBytes } from "@/domain/format"
import type { StorageArea } from "@/platform/schemas"
import { Button } from "@/ui/Button"
import { Dialog } from "@/ui/Dialog"
import { Skeleton } from "@/ui/Skeleton"
import { ToolIcon } from "../tools/ToolIcon"
import { areaBytes, useStorage } from "./store"

const areaName = (id: string) => (id === "shared" ? sharedStorage.label : (findTool(id)?.name ?? id))
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
          <h1 className="font-display text-[2.85rem] font-extrabold leading-none tracking-[-0.035em]">Storage</h1>
          <p className="mt-3 max-w-[46rem] text-[0.95rem] text-ink-soft">
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
        <p role="alert" className="rounded-[0.45rem] border border-bad/40 bg-bad/10 px-4 py-3 text-[0.95rem]">
          {error}
        </p>
      )}

      <ul
        aria-label="Data on this computer"
        className="overflow-hidden rounded-[0.55rem] border border-line bg-app shadow-panel"
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
    <li className="grid min-h-[5.75rem] grid-cols-[2.4rem_minmax(0,1fr)_7rem_9.6rem] items-center gap-x-[1.2rem] border-line border-b px-[1.3rem] py-4 last:border-b-0">
      {area.id === "shared" ? (
        <Database className="size-[2rem] text-ink" strokeWidth={1.75} aria-hidden />
      ) : (
        <ToolIcon id={area.id} className="size-[2rem] text-ink" />
      )}
      <div className="min-w-0">
        <h3 className="text-[1.1rem] font-semibold leading-tight">{areaName(area.id)}</h3>
        <p className={`mt-1 text-[0.9rem] ${!empty && !inUse ? "text-warn" : "text-ink-soft"}`}>{status}</p>
        {!empty && (
          <ul className="mt-1.5 flex flex-col gap-0.5">
            {area.folders.map((f) => (
              <li key={f.path} className="selectable truncate font-mono text-[0.8rem] text-ink-dim">
                {f.path}
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
