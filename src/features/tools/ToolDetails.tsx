import { ExternalLink } from "lucide-react"
import type { CatalogTool } from "@/domain/catalog"
import { installCommand } from "@/domain/catalog"
import { platform } from "@/platform/bridge"
import { CopyField } from "@/ui/CopyField"
import { Pill } from "@/ui/Pill"
import { Health } from "./Health"
import { useTools } from "./store"

export function ToolDetails({ tool }: { tool: CatalogTool }) {
  const installs = useTools((s) => s.installs[tool.id] ?? [])

  return (
    <div className="grid gap-x-[2.4rem] gap-y-6 border-line border-t bg-app-2/60 px-[1.3rem] py-[1.4rem] lg:grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)]">
      <section aria-label={`About ${tool.name}`} className="flex flex-col gap-4">
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
      </section>
      {installs.length > 0 ? (
        <Health tool={tool} />
      ) : (
        <p className="text-[0.95rem] text-ink-soft">Install {tool.name} to connect an account and run health checks.</p>
      )}
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
