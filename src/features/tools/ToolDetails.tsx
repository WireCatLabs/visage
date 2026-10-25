import { AlertTriangle, ExternalLink, Trash2 } from "lucide-react"
import { useState } from "react"
import { type CatalogTool, installCommand, packageNames, removeCommand, samePackage } from "@/domain/catalog"
import { platform } from "@/platform/bridge"
import { Button } from "@/ui/Button"
import { CopyField } from "@/ui/CopyField"
import { Dialog } from "@/ui/Dialog"
import { Pill } from "@/ui/Pill"
import { Health } from "./Health"
import { Permissions } from "./Permissions"
import { FitDetails } from "./StorageFit"
import { useTools } from "./store"

function ConfirmUninstall({ tool, open, onClose }: { tool: CatalogTool; open: boolean; onClose: () => void }) {
  const installs = useTools((s) => s.installs[tool.id] ?? [])
  const copies = installs.length
  const shared = samePackage(tool.id).length > 1
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
              useTools.getState().uninstall(tool.id)
            }}
          >
            Uninstall
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
        . Your profiles, storage and settings stay on this computer; you can delete them later in Storage.
      </p>
      <p className="mt-2">
        If you set up background services with it (a server or a timer), remove them first with the tool itself.
      </p>
    </Dialog>
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
