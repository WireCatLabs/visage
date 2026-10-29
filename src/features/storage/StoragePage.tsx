import { Database, FolderOpen, KeyRound, LoaderCircle, Trash2 } from "lucide-react"
import { useEffect, useState } from "react"
import { findTool, tools } from "@/domain/catalog"
import { describeEntry } from "@/domain/files"
import { formatBytes } from "@/domain/format"
import { formatList, useMessages } from "@/i18n"
import type { StorageArea } from "@/platform/schemas"
import { Button } from "@/ui/Button"
import { Dialog } from "@/ui/Dialog"
import { Disclosure, DisclosureSkeleton } from "@/ui/Disclosure"
import { ErrorNotice } from "@/ui/ErrorNotice"
import { Skeleton } from "@/ui/Skeleton"
import { ReportThis } from "../report/ReportThis"
import { useCompat } from "../tools/compat-store"
import { StorageSummary } from "../tools/StorageFit"
import { ToolIcon } from "../tools/ToolIcon"
import { ArchiveSummary } from "./ArchiveSummary"
import { BackupPanel } from "./BackupPanel"
import { storageMessages } from "./messages"
import { areaBytes, useStorage } from "./store"

type M = typeof storageMessages.en

const areaName = (id: string, m: M) => (id === "shared" ? m.shared : (findTool(id)?.name ?? id))

// The same areas, in the same order, as storage.rs reports: every tool that owns its data, then shared storage.
const AREA_IDS = [...tools.filter((t) => !t.partOf).map((t) => t.id), "shared"]

const toolNames = (ids: string[]) => formatList(ids.map((id) => findTool(id)?.name ?? id))

export function StoragePage() {
  const m = useMessages(storageMessages)
  const { areas, error, clearing, revalidating, refresh, clear, clearAll } = useStorage()
  const [confirm, setConfirm] = useState<StorageArea | "all" | null>(null)
  const compatAsked = useCompat((s) => s.compat !== undefined)

  useEffect(() => {
    refresh()
    if (useCompat.getState().compat === undefined) useCompat.getState().load()
  }, [refresh])

  const leftovers = (areas ?? []).filter((a) => a.folders.length > 0 && a.usedBy.length === 0)
  const leftoverBytes = leftovers.reduce((sum, a) => sum + areaBytes(a), 0)

  return (
    <div className="flex flex-col gap-[1.5rem] px-[2.1rem] pt-[1.6rem] pb-[2.2rem]">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="flex items-baseline gap-[1.2rem]">
            <h1 className="font-display text-[2.1rem] font-extrabold leading-none tracking-[-0.035em]">{m.title}</h1>
            <p aria-live="polite" className="flex items-center gap-1.5 text-[0.9rem] text-ink-soft">
              {revalidating && areas !== null && (
                <>
                  <LoaderCircle className="size-4 shrink-0 animate-spin text-brand" aria-hidden />
                  {m.checking}
                </>
              )}
            </p>
          </div>
          <p className="mt-3 max-w-[70ch] text-[0.95rem] text-ink-soft">{m.intro}</p>
        </div>
        {leftovers.length > 1 && (
          <Button variant="danger" onClick={() => setConfirm("all")} icon={<Trash2 className="size-4" aria-hidden />}>
            {m.deleteAll}
          </Button>
        )}
      </div>

      {error && (
        <ErrorNotice action={<ReportThis what="Working with data on this computer" error={error} />}>
          {error}
        </ErrorNotice>
      )}

      {/* Room for the one-line warning box, so it arriving after the page does not push everything down. */}
      <div className="flex min-h-[2.75rem] flex-col justify-center">
        {compatAsked ? <StorageSummary /> : <Skeleton className="h-[2.75rem] w-full rounded-[0.2rem]" />}
      </div>

      <ArchiveSummary />

      <BackupPanel />

      <ul aria-label={m.areasLabel} className="overflow-hidden rounded-[0.2rem] border border-line-strong bg-app">
        {areas === null
          ? AREA_IDS.map((id, i) => <RowSkeleton key={id} id={id} first={i === 0} />)
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
  const m = useMessages(storageMessages)
  const open = useStorage((s) => s.open)
  const empty = area.folders.length === 0
  const inUse = area.usedBy.length > 0
  const status = empty
    ? m.nothingStored
    : inUse
      ? area.id === "shared"
        ? m.usedBy(toolNames(area.usedBy))
        : m.usedByKept(toolNames(area.usedBy))
      : m.leftBehind

  return (
    <li className="grid min-h-[4.5rem] grid-cols-[1.8rem_minmax(0,1fr)_7rem_9.6rem] items-center gap-x-[1.2rem] border-line border-b px-[1.3rem] py-4 last:border-b-0">
      <AreaIcon id={area.id} />
      <div className="min-w-0">
        <h3 className="text-[1.08rem] font-semibold leading-tight">{areaName(area.id, m)}</h3>
        <p className={`mt-1 text-[0.9rem] ${!empty && !inUse ? "text-warn-ink" : "text-ink-soft"}`}>{status}</p>
        {!empty && (
          <ul className="mt-1.5 flex flex-col gap-0.5">
            {area.folders.map((f) => (
              <li key={f.path} className="flex min-w-0 items-center gap-2 text-[0.85rem]">
                <span className="min-w-[3.6rem] shrink-0 text-ink-soft">{m.folderKind[f.kind]}</span>
                <span className="selectable truncate font-mono text-ink-dim">{f.path}</span>
                <span className="shrink-0 font-mono text-ink-dim tabular-nums">{formatBytes(f.bytes)}</span>
                <button
                  type="button"
                  onClick={() => open(area.id, f.kind)}
                  aria-label={m.openFolder(f.kind, f.path)}
                  title={m.openInFiles}
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
            {busy ? m.deleting : m.delete}
          </Button>
        )}
      </div>
      {!empty && <Entries area={area} />}
    </li>
  )
}

function AreaIcon({ id }: { id: string }) {
  return id === "shared" ? (
    <Database className="size-[1.6rem] text-ink" strokeWidth={1.75} aria-hidden />
  ) : (
    <ToolIcon id={id} className="size-[1.6rem] text-ink" />
  )
}

function RowSkeleton({ id, first }: { id: string; first: boolean }) {
  const m = useMessages(storageMessages)
  return (
    <li className="grid min-h-[4.5rem] grid-cols-[1.8rem_minmax(0,1fr)_7rem_9.6rem] items-center gap-x-[1.2rem] border-line border-b px-[1.3rem] py-4 last:border-b-0">
      <AreaIcon id={id} />
      <div className="min-w-0">
        <h3 className="text-[1.08rem] font-semibold leading-tight">{areaName(id, m)}</h3>
        <p className="mt-1 text-[0.9rem]">
          <Skeleton chars={30} {...(first ? { label: m.measuringFolders } : {})} />
        </p>
        <ul className="mt-1.5 flex flex-col gap-0.5">
          {(["config", "state"] as const).map((kind) => (
            <li key={kind} className="flex h-6 min-w-0 items-center gap-2 text-[0.85rem]">
              <span className="min-w-[3.6rem] shrink-0 text-ink-soft">{m.folderKind[kind]}</span>
              <span className="font-mono">
                <Skeleton chars={28} />
              </span>
            </li>
          ))}
        </ul>
      </div>
      <span className="font-mono text-[1rem]">
        <Skeleton chars={7} />
      </span>
      <div className="col-start-2 -col-end-1 mt-1">
        <DisclosureSkeleton chars={18} />
      </div>
    </li>
  )
}

function Entries({ area }: { area: StorageArea }) {
  const m = useMessages(storageMessages)
  const open = useStorage((s) => s.open)
  const entries = area.folders.flatMap((f) =>
    f.entries.map((e) => ({
      ...e,
      kind: f.kind,
      key: `${f.kind}/${e.name}`,
      info: describeEntry(area.id, f.kind, e.name),
    })),
  )
  if (entries.length === 0) return null
  return (
    <div className="col-start-2 -col-end-1 mt-1">
      <Disclosure summary={m.whatIsHere(entries.length)}>
        <ul aria-label={m.keeps(areaName(area.id, m))} className="flex flex-col gap-1">
          {entries.map((e) => (
            <li
              key={e.key}
              className="grid grid-cols-[minmax(8rem,14rem)_minmax(0,1fr)_5.5rem_1.5rem] items-center gap-3 text-[0.9rem]"
            >
              <span className="selectable flex min-w-0 items-center gap-1.5 truncate font-mono text-[0.85rem] text-ink">
                {e.info?.secret && <KeyRound className="size-3.5 shrink-0 text-warn" aria-label={m.credentials} />}
                <span className="truncate">
                  {e.name}
                  {e.dir ? "/" : ""}
                </span>
              </span>
              <span className={e.info ? "text-ink-soft" : "text-ink-dim"}>
                {e.info ? m.entry[e.info.key] : m.notDescribed}
              </span>
              <span className="text-right font-mono text-[0.85rem] text-ink-dim tabular-nums">
                {formatBytes(e.bytes)}
              </span>
              <button
                type="button"
                onClick={() => open(area.id, e.kind, e.name)}
                aria-label={m.openEntry(e.name)}
                title={e.dir ? m.openInFiles : m.showInFiles}
                className="grid size-6 shrink-0 place-items-center rounded-[0.3rem] text-ink-dim hover:bg-app-3 hover:text-ink"
              >
                <FolderOpen className="size-3.5" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      </Disclosure>
    </div>
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
  const m = useMessages(storageMessages)
  const areas = target === "all" ? leftovers : target ? [target] : []
  const bytes = target === "all" ? leftoverBytes : target ? areaBytes(target) : 0
  const title = target === "all" ? m.confirmAll : target ? m.confirmOne(areaName(target.id, m)) : ""
  return (
    <Dialog
      open={target !== null}
      title={title}
      onClose={onCancel}
      actions={
        <>
          <Button variant="ghost" onClick={onCancel} autoFocus>
            {m.keepIt}
          </Button>
          <Button variant="danger" onClick={onConfirm} icon={<Trash2 className="size-4" aria-hidden />}>
            {m.deleteSize(formatBytes(bytes))}
          </Button>
        </>
      }
    >
      <p>{m.deletedForGood}</p>
      <ul className="mt-3 flex flex-col gap-1">
        {areas.flatMap((a) =>
          a.folders.map((f) => (
            <li key={f.path} className="selectable truncate font-mono text-[0.85rem] text-ink">
              {f.path}
            </li>
          )),
        )}
      </ul>
    </Dialog>
  )
}
