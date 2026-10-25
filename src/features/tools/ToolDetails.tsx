import { ExternalLink, Trash2 } from "lucide-react"
import { useState } from "react"
import { type CatalogTool, installCommand, packageNames, samePackage } from "@/domain/catalog"
import { platform } from "@/platform/bridge"
import { Button } from "@/ui/Button"
import { CopyField } from "@/ui/CopyField"
import { Dialog } from "@/ui/Dialog"
import { Pill } from "@/ui/Pill"
import { Health } from "./Health"
import { Permissions } from "./Permissions"
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
    <div className="grid gap-x-[2.4rem] gap-y-6 border-line border-t bg-app-2/60 px-[1.3rem] py-[1.4rem] lg:grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)]">
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
      {installs.length > 0 ? (
        <Health tool={tool} />
      ) : (
        <p className="text-[0.95rem] text-ink-soft">Install {tool.name} to connect an account and run health checks.</p>
      )}
      {installs.length > 0 && tool.permissions && <Permissions tool={tool} />}
    </div>
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
