import { AlertTriangle, ExternalLink, Trash2 } from "lucide-react"
import { useEffect, useState } from "react"
import { type CatalogTool, installCommand, ownerId, packageNames, removeCommand, samePackage } from "@/domain/catalog"
import { formatBytes } from "@/domain/format"
import { platform } from "@/platform/bridge"
import type { StorageFolder } from "@/platform/schemas"
import { Button } from "@/ui/Button"
import { CopyField } from "@/ui/CopyField"
import { Dialog } from "@/ui/Dialog"
import { ErrorNotice } from "@/ui/ErrorNotice"
import { Pill } from "@/ui/Pill"
import { Skeleton } from "@/ui/Skeleton"
import { useStorage } from "../storage/store"
import { Health } from "./Health"
import { Permissions } from "./Permissions"
import { FitDetails } from "./StorageFit"
import { useTools } from "./store"

function ConfirmUninstall({ tool, open, onClose }: { tool: CatalogTool; open: boolean; onClose: () => void }) {
  const installs = useTools((s) => s.installs[tool.id] ?? [])
  const copies = installs.length
  const shared = samePackage(tool.id).length > 1
  const [deleteData, setDeleteData] = useState(false)
  const data = useOwnData(tool, open)
  const bytes = data.folders?.reduce((sum, f) => sum + f.bytes, 0) ?? 0
  const deleting = deleteData && (data.folders?.length ?? 0) > 0

  useEffect(() => {
    if (open) setDeleteData(false)
  }, [open])

  return (
    <Dialog
      open={open}
      title={`Uninstall ${packageNames(tool.id)}?`}
      onClose={onClose}
      actions={
        <>
          <Button variant="ghost" onClick={onClose} autoFocus>
            Keep it
          </Button>
          <Button
            variant="danger"
            onClick={() => {
              onClose()
              useTools.getState().uninstall(tool.id, deleting ? bytes : undefined)
            }}
          >
            {deleting ? "Uninstall and delete data" : "Uninstall"}
          </Button>
        </>
      }
    >
      {shared && (
        <p className="mb-2 font-medium text-ink">
          Uninstall removes {packageNames(tool.id)} together: they are one program.
        </p>
      )}
      <p>
        This removes the <code className="font-mono text-ink">{tool.bin}</code> command
        {copies === 2
          ? " (both copies, each with the program that installed it)"
          : copies > 2
            ? ` (all ${copies} copies, each with the program that installed it)`
            : ""}
        . Your profiles, storage and settings stay on this computer unless you delete them below.
      </p>
      <p className="mt-2">
        If you set up background services with it (a server or a timer), remove them first with the tool itself.
      </p>
      <DeleteDataChoice tool={tool} data={data} bytes={bytes} checked={deleteData} onChange={setDeleteData} />
    </Dialog>
  )
}

type OwnData = { folders: StorageFolder[] | null; error: string | null; sharedInUse: boolean }

/** The package's own folders as storage.rs computes them, and whether another installed tool keeps the shared store. */
function useOwnData(tool: CatalogTool, open: boolean): OwnData {
  const areas = useStorage((s) => s.areas)
  const error = useStorage((s) => s.error)
  const installs = useTools((s) => s.installs)
  useEffect(() => {
    if (open) useStorage.getState().load()
  }, [open])
  const owner = ownerId(tool.id)
  const mine = areas?.find((a) => a.id === owner)
  // From installs, known on the first frame, so the note never appears after the dialog has opened.
  const others = Object.entries(installs).some(([id, copies]) => copies.length > 0 && ownerId(id) !== owner)
  return { folders: mine ? mine.folders : null, error: mine ? null : error, sharedInUse: others }
}

function DeleteDataChoice(props: {
  tool: CatalogTool
  data: OwnData
  bytes: number
  checked: boolean
  onChange(v: boolean): void
}) {
  const { tool, data, bytes, checked, onChange } = props
  const name = samePackage(tool.id).length > 1 ? packageNames(tool.id) : tool.name
  const none = data.folders !== null && data.folders.length === 0
  return (
    <div className="mt-4 border-line border-t pt-3">
      <label className="flex items-start gap-2.5 text-ink">
        <input
          type="checkbox"
          checked={checked && !none}
          disabled={data.folders === null || none}
          onChange={(e) => onChange(e.target.checked)}
          className="mt-[0.3rem] size-[1.05rem] shrink-0 accent-brand"
        />
        <span>
          Also delete {name}'s data
          <span className="block text-[0.85rem] text-ink-soft">
            {none
              ? "It has no data on this computer."
              : "Its settings, sign-in sessions and caches. Deleted only if the uninstall succeeds."}
          </span>
        </span>
      </label>
      {data.sharedInUse && (
        <p className="mt-2 ml-[1.6rem] text-[0.85rem] text-ink-soft">
          Messages in the shared storage stay; other tools use it. Clear them on Storage.
        </p>
      )}
      {/* Room for three folders and the total, so the centred dialog keeps its buttons in place when they arrive. */}
      <div className="mt-2 ml-[1.6rem] min-h-[6rem]">
        {data.folders === null ? (
          data.error ? (
            <ErrorNotice inline>Could not read its folders: {data.error}</ErrorNotice>
          ) : (
            <Skeleton className="h-[6rem] w-full" label="Reading its folders" />
          )
        ) : (
          !none && (
            <ul className="flex flex-col gap-1 text-[0.85rem]" aria-label={`${name}'s data folders`}>
              {data.folders.map((f) => (
                <li key={f.path} className="flex flex-wrap items-baseline gap-x-2">
                  <code className="selectable min-w-0 break-all font-mono text-ink">{f.path}</code>
                  <span className="text-ink-dim tabular-nums">
                    {f.kind} · {formatBytes(f.bytes)}
                  </span>
                </li>
              ))}
              {data.folders.length > 1 && <li className="text-ink-soft tabular-nums">{formatBytes(bytes)} in all</li>}
            </ul>
          )
        )}
      </div>
    </div>
  )
}

export function ToolDetails({ tool }: { tool: CatalogTool }) {
  const installs = useTools((s) => s.installs[tool.id] ?? [])
  const [confirming, setConfirming] = useState(false)

  return (
    <div className="grid gap-x-[2.4rem] gap-y-6 border-line border-t bg-app-2/60 px-[1.3rem] py-[1.4rem] lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
      {installs.length > 1 && <ExtraCopies tool={tool} />}
      {installs.length > 0 ? (
        <Health tool={tool} />
      ) : (
        <p className="text-[0.95rem] text-ink-soft">Install {tool.name} to connect an account and run health checks.</p>
      )}
      <section aria-label={`About ${tool.name}`} className="flex flex-col gap-4">
        <p className="max-w-[70ch] text-[0.95rem] leading-relaxed text-ink-soft">{tool.summary}</p>
        <div className="flex gap-5">
          <ExternalLinkButton href={tool.docs}>Documentation</ExternalLinkButton>
          <ExternalLinkButton href={tool.repo}>GitHub</ExternalLinkButton>
        </div>
        <div>
          <h4 className="mb-2 text-[0.85rem] font-medium text-ink-dim">Install from a terminal</h4>
          <CopyField value={installCommand(tool)} label="Copy the install command" />
        </div>
        <div>
          <h4 className="mb-2 text-[0.85rem] font-medium text-ink-dim">Installed at</h4>
          {installs.length === 0 && <p className="text-[0.875rem] text-ink-soft">Not installed on this computer.</p>}
          <ul className="flex flex-col gap-1.5">
            {installs.map((i, n) => (
              <li key={i.path} className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[0.875rem]">
                <code className="selectable min-w-0 truncate font-mono text-ink">{i.path}</code>
                <span className="text-ink-dim">
                  {i.version ?? "does not start"} · {i.manager}
                </span>
                {installs.length > 1 &&
                  (n === 0 ? <Pill tone="brand">runs first</Pill> : <Pill tone="warn">not used</Pill>)}
              </li>
            ))}
          </ul>
        </div>
        {installs.length > 0 && <FitDetails id={tool.id} />}
        {installs.length > 0 && (
          <div>
            <Button
              size="sm"
              variant="danger"
              onClick={() => setConfirming(true)}
              icon={<Trash2 className="size-4" aria-hidden />}
            >
              Uninstall
            </Button>
          </div>
        )}
      </section>
      <ConfirmUninstall tool={tool} open={confirming} onClose={() => setConfirming(false)} />
      {installs.length > 0 && tool.permissions && <Permissions tool={tool} />}
    </div>
  )
}

// Uninstall would take every copy, so the advice removes only the ones the terminal never reaches.
function ExtraCopies({ tool }: { tool: CatalogTool }) {
  const installs = useTools((s) => s.installs[tool.id] ?? [])
  const [first, ...unused] = installs
  if (!first) return null
  return (
    <section
      aria-label={`More than one copy of ${tool.name}`}
      className="flex flex-col gap-2 rounded-[0.35rem] border border-warn/40 bg-warn/10 px-4 py-3 lg:col-span-2"
    >
      <p className="flex items-start gap-2 text-[0.95rem] text-ink">
        <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warn" aria-hidden />
        <span>
          {installs.length} copies of <code className="font-mono">{tool.bin}</code> are installed. A terminal runs{" "}
          <code className="selectable font-mono">{first.path}</code> ({first.version ?? "does not start"},{" "}
          {first.manager}); the {unused.length === 1 ? "other is" : "others are"} never used and can confuse updates.
          Remove {unused.length === 1 ? "it" : "them"} with the program that installed{" "}
          {unused.length === 1 ? "it" : "them"}:
        </span>
      </p>
      <ul className="flex flex-col gap-2 pl-6">
        {unused.map((i) => (
          <li key={i.path} className="flex flex-col gap-1">
            <span className="text-[0.85rem] text-ink-soft">
              <code className="selectable font-mono">{i.path}</code> · {i.version ?? "does not start"} · {i.manager}
            </span>
            <CopyField
              value={removeCommand(i.manager, tool.package, i.path)}
              label={`Copy the command that removes ${i.path}`}
            />
          </li>
        ))}
      </ul>
    </section>
  )
}

function ExternalLinkButton({ href, children }: { href: string; children: string }) {
  return (
    <a
      href={href}
      onClick={(e) => {
        e.preventDefault()
        platform.openUrl(href)
      }}
      className="inline-flex items-center gap-1.5 text-[0.95rem] font-medium text-brand hover:text-brand-hover hover:underline hover:underline-offset-4"
    >
      {children}
      <ExternalLink className="size-[0.95rem]" aria-hidden />
    </a>
  )
}
