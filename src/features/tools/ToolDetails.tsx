import { AlertTriangle, ExternalLink, Trash2 } from "lucide-react"
import { useEffect, useState } from "react"
import { type CatalogTool, installCommand, ownerId, removeCommand, samePackage } from "@/domain/catalog"
import { formatBytes } from "@/domain/format"
import { useMessages } from "@/i18n"
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
import { packageNamesOf } from "./InstallPanel"
import { McpServer } from "./McpServer"
import { type ToolsText, toolsMessages, toolText } from "./messages"
import { Permissions } from "./Permissions"
import { FitDetails } from "./StorageFit"
import { useTools } from "./store"

function ConfirmUninstall({ tool, open, onClose }: { tool: CatalogTool; open: boolean; onClose: () => void }) {
  const installs = useTools((s) => s.installs[tool.id]) ?? []
  const copies = installs.length
  const shared = samePackage(tool.id).length > 1
  const [deleteData, setDeleteData] = useState(false)
  const data = useOwnData(tool, open)
  const m = useMessages(toolsMessages).uninstall
  const names = packageNamesOf(tool.id)
  const bytes = data.folders?.reduce((sum, f) => sum + f.bytes, 0) ?? 0
  const deleting = deleteData && (data.folders?.length ?? 0) > 0

  useEffect(() => {
    if (open) setDeleteData(false)
  }, [open])

  return (
    <Dialog
      open={open}
      title={m.title(names)}
      onClose={onClose}
      actions={
        <>
          <Button variant="ghost" onClick={onClose} autoFocus>
            {m.keep}
          </Button>
          <Button
            variant="danger"
            onClick={() => {
              onClose()
              useTools.getState().uninstall(tool.id, deleting ? bytes : undefined)
            }}
          >
            {deleting ? m.andDelete : m.uninstall}
          </Button>
        </>
      }
    >
      {shared && <p className="mb-2 font-medium text-ink">{m.together(names)}</p>}
      <p>{m.removes(<code className="font-mono text-ink">{tool.bin}</code>, copies)}</p>
      <p className="mt-2">{m.services}</p>
      <DeleteDataChoice tool={tool} data={data} bytes={bytes} checked={deleteData} onChange={setDeleteData} m={m} />
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
  m: ToolsText["uninstall"]
}) {
  const { tool, data, bytes, checked, onChange, m } = props
  const kinds = useMessages(toolsMessages).details.kind
  const name = samePackage(tool.id).length > 1 ? packageNamesOf(tool.id) : tool.name
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
          {m.alsoDelete(name)}
          <span className="block text-[0.9rem] text-ink-soft">{none ? m.noData : m.dataWhat}</span>
        </span>
      </label>
      {data.sharedInUse && <p className="mt-2 ml-[1.6rem] text-[0.9rem] text-ink-soft">{m.sharedStays}</p>}
      {/* Room for three folders and the total, so the centred dialog keeps its buttons in place when they arrive. */}
      <div className="mt-2 ml-[1.6rem] min-h-[6rem]">
        {data.folders === null ? (
          data.error ? (
            <ErrorNotice inline>{m.foldersFailed(data.error)}</ErrorNotice>
          ) : (
            <Skeleton className="h-[6rem] w-full" label={m.readingFolders} />
          )
        ) : (
          !none && (
            <ul className="flex flex-col gap-1 text-[0.9rem]" aria-label={m.folders(name)}>
              {data.folders.map((f) => (
                <li key={f.path} className="flex flex-wrap items-baseline gap-x-2">
                  <code className="selectable min-w-0 break-all font-mono text-ink">{f.path}</code>
                  <span className="text-ink-dim tabular-nums">
                    {kinds[f.kind] ?? f.kind} · {formatBytes(f.bytes)}
                  </span>
                </li>
              ))}
              {data.folders.length > 1 && <li className="text-ink-soft tabular-nums">{m.inAll(formatBytes(bytes))}</li>}
            </ul>
          )
        )}
      </div>
    </div>
  )
}

export function ToolDetails({ tool }: { tool: CatalogTool }) {
  const installs = useTools((s) => s.installs[tool.id]) ?? []
  const [confirming, setConfirming] = useState(false)
  const t = useMessages(toolsMessages)
  const m = t.details

  return (
    <div className="grid gap-x-[2.4rem] gap-y-6 border-line border-t bg-app-2/60 px-[1.3rem] py-[1.4rem] lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
      {installs.length > 1 && <ExtraCopies tool={tool} />}
      {installs.length > 0 ? (
        <Health tool={tool} />
      ) : (
        <p className="text-[0.95rem] text-ink-soft">{m.installFirst(tool.name)}</p>
      )}
      <section aria-label={m.about(tool.name)} className="flex flex-col gap-4">
        <p className="max-w-[70ch] text-[0.95rem] leading-relaxed text-ink-soft">{toolText(t, tool).summary}</p>
        <div className="flex gap-5">
          <ExternalLinkButton href={tool.docs}>{m.docs}</ExternalLinkButton>
          <ExternalLinkButton href={tool.repo}>{m.github}</ExternalLinkButton>
        </div>
        <div>
          <h4 className="mb-2 text-[0.9rem] font-medium text-ink-dim">{m.installFromTerminal}</h4>
          <CopyField value={installCommand(tool)} label={m.copyInstall} />
        </div>
        <div>
          <h4 className="mb-2 text-[0.9rem] font-medium text-ink-dim">{m.installedAt}</h4>
          {installs.length === 0 && <p className="text-[0.875rem] text-ink-soft">{m.notInstalledHere}</p>}
          <ul className="flex flex-col gap-1.5">
            {installs.map((i, n) => (
              <li key={i.path} className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[0.875rem]">
                <code className="selectable min-w-0 truncate font-mono text-ink">{i.path}</code>
                <span className="text-ink-dim">
                  {i.version ?? m.doesNotStart} · {i.manager}
                </span>
                {installs.length > 1 &&
                  (n === 0 ? <Pill tone="brand">{m.runsFirst}</Pill> : <Pill tone="warn">{m.notUsed}</Pill>)}
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
              {m.uninstall}
            </Button>
          </div>
        )}
      </section>
      <ConfirmUninstall tool={tool} open={confirming} onClose={() => setConfirming(false)} />
      {installs.length > 0 && tool.permissions && <Permissions tool={tool} />}
      {installs.length > 0 && tool.mcpServer && <McpServer tool={tool} />}
    </div>
  )
}

// Uninstall would take every copy, so the advice removes only the ones the terminal never reaches.
function ExtraCopies({ tool }: { tool: CatalogTool }) {
  const installs = useTools((s) => s.installs[tool.id]) ?? []
  const [first, ...unused] = installs
  const m = useMessages(toolsMessages).details
  if (!first) return null
  return (
    <section
      aria-label={m.extraLabel(tool.name)}
      className="flex flex-col gap-2 rounded-[0.35rem] border border-warn/40 bg-warn/10 px-4 py-3 lg:col-span-2"
    >
      <p className="flex items-start gap-2 text-[0.95rem] text-ink">
        <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warn" aria-hidden />
        <span>
          {m.extra(
            installs.length,
            <code className="font-mono">{tool.bin}</code>,
            <code className="selectable font-mono">{first.path}</code>,
            first.version ?? m.doesNotStart,
            first.manager,
          )}
        </span>
      </p>
      <ul className="flex flex-col gap-2 pl-6">
        {unused.map((i) => (
          <li key={i.path} className="flex flex-col gap-1">
            <span className="text-[0.9rem] text-ink-soft">
              <code className="selectable font-mono">{i.path}</code> · {i.version ?? m.doesNotStart} · {i.manager}
            </span>
            <CopyField value={removeCommand(i.manager, tool.package, i.path)} label={m.removeCopy(i.path)} />
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
