import type { CatalogTool } from "@/domain/catalog"
import { type ToolStatus, toolStatus } from "@/domain/status"
import { Button } from "@/ui/Button"
import { cx } from "@/ui/cx"
import { Lamp, type LampTone } from "@/ui/Lamp"
import { Skeleton } from "@/ui/Skeleton"
import { useSystem } from "../system/store"
import { InstallPanel } from "./InstallPanel"
import { useTools } from "./store"
import { ToolDetails } from "./ToolDetails"
import { ToolIcon } from "./ToolIcon"

const lampTone: Record<ToolStatus["kind"], LampTone> = {
  checking: "idle",
  missing: "idle",
  working: "busy",
  broken: "bad",
  outdated: "warn",
  ready: "ok",
}

const lampLabel = (s: ToolStatus) =>
  ({
    checking: "Checking",
    missing: "Not installed",
    working: s.kind === "working" && s.operation === "uninstall" ? "Uninstalling" : "Installing",
    broken: "Installed, but it does not start",
    outdated: "Update available",
    ready: "Installed and up to date",
  })[s.kind]

export function ToolRow({ tool }: { tool: CatalogTool }) {
  const installs = useTools((s) => s.installs[tool.id])
  const latest = useTools((s) => (s.latest ? (s.latest[tool.id] ?? null) : undefined))
  const session = useTools((s) => s.sessions[tool.id])
  const expanded = useTools((s) => s.expanded === tool.id)
  const nodeReady = useSystem((s) => s.readiness?.node.ok ?? false)
  const { install, toggle, cancel } = useTools.getState()

  const status = toolStatus(installs, latest, session)
  const panelId = `tool-panel-${tool.id}`
  const showInstallPanel = Boolean(session)

  return (
    <li className="border-line border-b last:border-b-0">
      <div className="grid min-h-[5.75rem] grid-cols-[1.5rem_2.4rem_minmax(0,1fr)_6.6rem_8.6rem] items-center gap-x-[0.9rem] xl:grid-cols-[2.6rem_3.6rem_minmax(0,1fr)_7.8rem_9.6rem] xl:gap-x-[1.2rem] px-[1.3rem]">
        <Lamp tone={lampTone[status.kind]} label={lampLabel(status)} />
        <ToolIcon id={tool.id} className="size-[2rem] text-ink xl:size-[2.4rem]" />
        <button
          type="button"
          onClick={() => toggle(tool.id)}
          aria-expanded={expanded}
          aria-controls={panelId}
          className="group min-w-0 py-4 text-left"
        >
          <h3 className="flex items-baseline gap-[0.6rem] text-[1.18rem] font-semibold leading-tight group-hover:text-brand">
            {tool.name}
            <span className="font-mono text-[0.95rem] font-normal text-ink-soft">{tool.bin}</span>
          </h3>
          <p className="mt-1 truncate text-[0.95rem] text-ink-soft">{tool.tagline}</p>
        </button>
        <Version status={status} installed={installs?.[0]?.version ?? null} />
        <div className="flex justify-end">
          <Action
            status={status}
            expanded={expanded}
            disabled={!nodeReady && (status.kind === "missing" || status.kind === "outdated")}
            disabledReason="Node.js is needed first"
            controls={panelId}
            onInstall={() => install(tool.id)}
            onToggle={() => toggle(tool.id)}
            onCancel={() => cancel(tool.id)}
          />
        </div>
      </div>
      <div
        id={panelId}
        className={cx(
          "grid transition-[grid-template-rows] duration-300 ease-out-quart",
          expanded || showInstallPanel ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
        )}
      >
        <div className="overflow-hidden">
          {showInstallPanel ? <InstallPanel tool={tool} /> : expanded ? <ToolDetails tool={tool} /> : null}
        </div>
      </div>
    </li>
  )
}

// While a tool installs, the column keeps saying what is on the machine now; the panel below shows the progress.
function Version({ status, installed }: { status: ToolStatus; installed: string | null }) {
  if (status.kind === "checking") return <Skeleton className="h-4 w-16" label="Checking" />
  const text = status.kind === "broken" ? "Does not start" : "version" in status ? status.version : installed
  return (
    <span
      className={cx(
        "font-mono text-[1.02rem] whitespace-nowrap tabular-nums",
        text ? "text-ink" : "text-ink-soft",
        status.kind === "broken" && "text-bad",
      )}
    >
      {text ?? "Not installed"}
    </span>
  )
}

type ActionProps = {
  status: ToolStatus
  expanded: boolean
  disabled: boolean
  disabledReason: string
  controls: string
  onInstall: () => void
  onToggle: () => void
  onCancel: () => void
}

function Action({ status, expanded, disabled, disabledReason, controls, onInstall, onToggle, onCancel }: ActionProps) {
  if (status.kind === "checking") return <Skeleton className="h-[2.75rem] w-[7.6rem]" />
  if (status.kind === "working") {
    return (
      <Button variant="secondary" onClick={onCancel} className="min-w-[7.6rem]">
        Cancel
      </Button>
    )
  }
  if (status.kind === "missing" || status.kind === "outdated") {
    const update = status.kind === "outdated"
    return (
      <Button variant="primary" onClick={onInstall} disabled={disabled} title={disabled ? disabledReason : undefined}>
        {update ? `Update to ${status.latest}` : "Install"}
      </Button>
    )
  }
  return (
    <Button
      variant={status.kind === "broken" ? "danger" : "secondary"}
      onClick={onToggle}
      aria-expanded={expanded}
      aria-controls={controls}
      className="min-w-[7.6rem]"
    >
      {status.kind === "broken" ? "Fix" : "Manage"}
    </Button>
  )
}
