import { RefreshCw, Terminal } from "lucide-react"
import { type ReactNode, useCallback, useEffect, useId, useRef, useState } from "react"
import type { CatalogTool } from "@/domain/catalog"
import { setupCommand } from "@/domain/catalog"
import { readLast, remember } from "@/features/config/store"
import { platform } from "@/platform/bridge"
import type { CommandAccess, Permissions as Data, Level, OwnLevel } from "@/platform/permissions-schemas"
import { Button } from "@/ui/Button"
import { CopyField } from "@/ui/CopyField"
import { cx } from "@/ui/cx"
import { Dialog } from "@/ui/Dialog"
import { Disclosure } from "@/ui/Disclosure"
import { Lamp, type LampTone } from "@/ui/Lamp"
import { Skeleton } from "@/ui/Skeleton"
import { useProfiles } from "./Health"
import {
  blockedCommands,
  type Count,
  commandLine,
  type GroupState,
  type GroupSummary,
  LEVEL_LABEL,
  LEVELS,
  layerOf,
  lockReason,
  partialDetail,
  STATE_LABEL,
  summarize,
  widens,
  widensLevel,
} from "./permissions"

const TONE: Record<GroupState, LampTone> = {
  allowed: "ok",
  ask: "ok",
  readonly: "idle",
  blocked: "bad",
  partial: "warn",
  default: "idle",
}

/** What the confirm dialog says each level lets through. */
const MEANS: Record<Level, string> = {
  allow: "run these commands, including changes, without asking",
  ask: "run these commands; a change asks for a yes in the terminal, and over MCP the agent's app decides",
  readonly: "read, but not change anything",
  deny: "not run these commands at all",
}

type Change = { key: string; label: string; level: Level | null; from: Level | undefined; overrides: OwnLevel[] }
type Row = { state: "saving" } | { state: "failed"; message: string }

const message = (e: unknown) => (e instanceof Error ? e.message : String(e))

function initialProfile(id: string): string | null {
  const last = readLast().targets?.[id]
  return typeof last === "string" ? last : null
}

export function Permissions({ tool }: { tool: CatalogTool }) {
  const groups = tool.permissions?.groups ?? []
  const headingId = useId()
  const { profiles } = useProfiles(tool.id)
  const [profile, setProfile] = useState<string | null>(() => initialProfile(tool.id))
  const [data, setData] = useState<Data | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [rows, setRows] = useState<Record<string, Row>>({})
  const [confirming, setConfirming] = useState<Change | null>(null)
  const latest = useRef(0)
  const defaultsView = profile === null

  const load = useCallback(async () => {
    const call = ++latest.current
    setLoading(true)
    try {
      const next = await platform.permissionsShow(tool.id, profile)
      if (call !== latest.current) return
      setData(next)
      setError(null)
    } catch (e) {
      if (call === latest.current) setError(message(e))
    } finally {
      if (call === latest.current) setLoading(false)
    }
  }, [tool.id, profile])

  useEffect(() => {
    load()
  }, [load])

  // A profile remembered from another page may be gone; the defaults are never someone's account.
  useEffect(() => {
    if (profile !== null && profiles && !profiles.some((p) => p.name === profile)) setProfile(null)
  }, [profiles, profile])

  const choose = (next: string | null) => {
    remember((l) => ({ ...l, targets: { ...l.targets, [tool.id]: next } }))
    setRows({})
    setProfile(next)
  }

  const save = async (change: Change) => {
    setRows((r) => ({ ...r, [change.key]: { state: "saving" } }))
    try {
      const setting = `permissions.${change.key}`
      if (change.level === null) await platform.settingsUnset(tool.id, profile, defaultsView, setting)
      else await platform.settingsSet(tool.id, profile, defaultsView, setting, change.level)
      setRows(({ [change.key]: _, ...rest }) => rest)
    } catch (e) {
      setRows((r) => ({ ...r, [change.key]: { state: "failed", message: message(e) } }))
    }
    await load()
  }

  const request = (change: Change, widening: boolean) => (widening ? setConfirming(change) : save(change))

  const summaries = data ? groups.map((g) => summarize(g, data)) : []

  return (
    <section aria-labelledby={headingId} className="flex min-w-0 flex-col gap-3 lg:col-span-2">
      <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-2">
        <div className="min-w-0">
          <h4 id={headingId} className="text-[0.85rem] font-medium text-ink-dim">
            Permissions
          </h4>
          <p className="text-[0.9rem] text-ink-soft">
            What your agent and scripts may do through {tool.bin}
            {profile ? (
              <>
                {" "}
                as <span className="font-medium text-ink">{profile}</span>
              </>
            ) : (
              " in every profile that sets nothing of its own"
            )}
            .
          </p>
        </div>
        <div className="flex items-center gap-2">
          <label className="sr-only" htmlFor={`${headingId}-profile`}>
            Profile
          </label>
          <select
            id={`${headingId}-profile`}
            value={profile ?? ""}
            onChange={(e) => choose(e.target.value === "" ? null : e.target.value)}
            className="h-8 rounded-[0.35rem] border border-line-strong bg-app px-2 text-[0.875rem] text-ink"
          >
            <option value="">Defaults (all profiles)</option>
            {(profiles ?? []).map((p) => (
              <option key={p.name} value={p.name}>
                {p.name}
              </option>
            ))}
          </select>
          <Button
            size="sm"
            variant="ghost"
            onClick={load}
            disabled={loading}
            aria-label="Read permissions again"
            icon={<RefreshCw className={cx("size-4", loading && "animate-spin")} aria-hidden />}
          />
        </div>
      </div>

      {error && <p className="text-[0.9rem] text-bad">Could not read permissions: {error}</p>}
      {data?.ceiling && <Ceiling tool={tool} profile={profile} ceiling={data.ceiling} />}
      {data && <Notes tool={tool} data={data} defaultsView={defaultsView} />}
      {data && <Totals summaries={summaries} />}

      {!data && !error ? (
        <Skeleton className="h-40 w-full" label="Loading permissions" />
      ) : data ? (
        <ul
          aria-label={`${tool.name} permissions`}
          className={cx(
            "divide-y divide-line rounded-[0.45rem] border border-line bg-app transition-opacity duration-150",
            loading && "opacity-60",
          )}
        >
          {summaries.map((s) => (
            <GroupRow
              key={s.group.key}
              tool={tool}
              summary={s}
              defaultsView={defaultsView}
              rows={rows}
              onChange={request}
            />
          ))}
        </ul>
      ) : null}

      {confirming && (
        <ConfirmWiden
          tool={tool}
          profile={profile}
          change={confirming}
          ceiling={data?.ceiling ?? null}
          onClose={() => setConfirming(null)}
          onConfirm={() => {
            const change = confirming
            setConfirming(null)
            save(change)
          }}
        />
      )}
    </section>
  )
}

function Totals({ summaries }: { summaries: GroupSummary[] }) {
  const sum = (pick: (s: GroupSummary) => Count | null) =>
    summaries.reduce(
      (t, s) => {
        const c = pick(s)
        return c ? { allowed: t.allowed + c.allowed, total: t.total + c.total } : t
      },
      { allowed: 0, total: 0 },
    )
  const reads = sum((s) => s.reads)
  const writes = sum((s) => s.writes)
  if (reads.total + writes.total === 0) return null
  const part = (name: string, c: Count) =>
    c.allowed === c.total ? `${name}: all ${c.total} allowed` : `${name}: ${c.allowed} of ${c.total} allowed`
  return (
    <p className="text-[0.9rem] text-ink tabular-nums">
      {part("Reading", reads)} · {part("Changing", writes)}
    </p>
  )
}

function Notes({ tool, data, defaultsView }: { tool: CatalogTool; data: Data; defaultsView: boolean }) {
  if (defaultsView)
    return (
      <p className="text-[0.875rem] text-ink-soft">
        Choose a profile to see which commands it may run. A level a profile sets wins over these defaults.
      </p>
    )
  if (data.commandsError)
    return <p className="text-[0.875rem] text-bad">Could not list the commands: {data.commandsError}</p>
  if (data.commands === null)
    return (
      <p className="text-[0.875rem] text-ink-soft">
        This version of {tool.bin} does not say which commands a profile may run, so only the levels in its settings
        file are shown. Update {tool.name} to see every command.
      </p>
    )
  return null
}

function Ceiling({ tool, profile, ceiling }: { tool: CatalogTool; profile: string | null; ceiling: Level }) {
  const command = setupCommand(tool, profile)
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-[0.2rem] border border-warn/40 bg-warn/10 px-3 py-2">
      <p className="min-w-0 flex-1 text-[0.9rem] text-ink">
        Every WireCat tool here is {ceiling === "deny" ? "blocked" : "read only"}: you chose this when you first set up
        WireCat. Nothing below goes above it. Run setup again to change it.
      </p>
      {tool.setup && profile ? (
        <Button
          size="sm"
          onClick={() => platform.openSetup(tool.id, profile)}
          icon={<Terminal className="size-4" aria-hidden />}
        >
          Open setup
        </Button>
      ) : (
        command && <code className="selectable font-mono text-[0.8rem] text-ink">{command}</code>
      )}
    </div>
  )
}

function GroupRow(props: {
  tool: CatalogTool
  summary: GroupSummary
  defaultsView: boolean
  rows: Record<string, Row>
  onChange: (change: Change, widening: boolean) => void
}) {
  const { tool, summary: s, defaultsView, rows, onChange } = props
  const status = rows[s.group.key]
  const lock = lockReason(s.own, defaultsView)
  const blocked = blockedCommands(s)
  const detail =
    lock ??
    partialDetail(s) ??
    (s.own && layerOf(s.own, defaultsView) === "defaults" ? `${LEVEL_LABEL[s.own.level]}, from the defaults` : null)
  const separately = s.overrides.length

  return (
    <li className="flex flex-col gap-2 px-3 py-2.5">
      <div className="grid grid-cols-[minmax(0,1fr)_7.5rem_9.5rem] items-center gap-x-3">
        <div className="min-w-0">
          <div className="flex min-w-0 items-baseline gap-2">
            <span className="truncate font-medium text-ink">{s.group.label}</span>
            <span className="font-mono text-[0.8rem] text-ink-dim">{s.group.key}</span>
          </div>
          {detail && <p className="text-[0.85rem] text-ink-soft">{detail}</p>}
        </div>
        <span className="flex items-center gap-2 text-[0.875rem] text-ink">
          <Lamp tone={TONE[s.state]} size="sm" />
          {STATE_LABEL[s.state]}
        </span>
        <LevelSelect
          label={`${s.group.label} permission`}
          own={s.own}
          defaultsView={defaultsView}
          disabled={Boolean(lock) || status?.state === "saving"}
          onChange={(level) =>
            onChange(
              { key: s.group.key, label: s.group.label, level, from: s.own?.level, overrides: s.overrides },
              level === null ? s.own?.level === "readonly" || s.own?.level === "deny" : widens(s, level),
            )
          }
        />
      </div>
      <RowStatus row={status} />
      {(blocked.length > 0 || separately > 0) && (
        <Disclosure summary={disclosureLabel(blocked.length, separately)}>
          <div className="flex flex-col gap-3 pb-1 pl-5">
            {separately > 0 && (
              <SubList title="Set separately">
                <ul aria-label={`${s.group.label}: set separately`} className="flex flex-col gap-1.5">
                  {s.overrides.map((o) => (
                    <Override
                      key={o.key}
                      level={o}
                      defaultsView={defaultsView}
                      row={rows[o.key]}
                      onChange={(level) =>
                        onChange(
                          { key: o.key, label: o.key, level, from: o.level, overrides: [] },
                          level === null ? o.level === "readonly" || o.level === "deny" : widensLevel(o.level, level),
                        )
                      }
                    />
                  ))}
                </ul>
              </SubList>
            )}
            {blocked.length > 0 && (
              <SubList title={defaultsView ? "Blocked" : "Blocked for this profile"}>
                <ul aria-label={`${s.group.label}: blocked commands`} className="flex flex-col gap-1.5">
                  {blocked.map((c) => (
                    <Blocked
                      key={c.path.join(" ")}
                      tool={tool}
                      command={c}
                      row={c.permission ? rows[c.permission] : undefined}
                      allowed={!defaultsView}
                      onAllow={(key) =>
                        onChange({ key, label: key, level: "allow", from: undefined, overrides: [] }, true)
                      }
                    />
                  ))}
                </ul>
              </SubList>
            )}
          </div>
        </Disclosure>
      )}
    </li>
  )
}

function SubList({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <h5 className="text-[0.8rem] font-medium text-ink-dim">{title}</h5>
      {children}
    </div>
  )
}

const disclosureLabel = (blocked: number, separately: number) =>
  [
    blocked > 0 && `${blocked} blocked ${blocked === 1 ? "command" : "commands"}`,
    separately > 0 && `${separately} set separately`,
  ]
    .filter(Boolean)
    .join(" · ")

function LevelSelect(props: {
  label: string
  own: OwnLevel | undefined
  defaultsView: boolean
  disabled: boolean
  onChange: (level: Level | null) => void
}) {
  const { label, own, defaultsView, disabled, onChange } = props
  const removable = own !== undefined && layerOf(own, defaultsView) === "here"
  return (
    <select
      aria-label={label}
      value={own?.level ?? ""}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value === "" ? null : (e.target.value as Level))}
      className="h-8 w-full rounded-[0.35rem] border border-line-strong bg-app px-2 text-[0.875rem] text-ink disabled:opacity-45"
    >
      {(own === undefined || removable) && (
        <option value="" disabled={!removable}>
          Tool default
        </option>
      )}
      {LEVELS.map((l) => (
        <option key={l} value={l}>
          {LEVEL_LABEL[l]}
        </option>
      ))}
    </select>
  )
}

function Override(props: {
  level: OwnLevel
  defaultsView: boolean
  row: Row | undefined
  onChange: (level: Level | null) => void
}) {
  const { level, defaultsView, row, onChange } = props
  const lock = lockReason(level, defaultsView)
  return (
    <li className="flex flex-col gap-1">
      <div className="grid grid-cols-[minmax(0,1fr)_9.5rem] items-center gap-x-3">
        <span className="min-w-0">
          <code className="selectable font-mono text-[0.85rem] text-ink">{level.key}</code>
          {layerOf(level, defaultsView) === "defaults" && (
            <span className="ml-2 text-[0.85rem] text-ink-soft">from the defaults</span>
          )}
          {lock && <span className="block text-[0.85rem] text-ink-soft">{lock}</span>}
        </span>
        <LevelSelect
          label={`${level.key} permission`}
          own={level}
          defaultsView={defaultsView}
          disabled={Boolean(lock) || row?.state === "saving"}
          onChange={onChange}
        />
      </div>
      <RowStatus row={row} />
    </li>
  )
}

function Blocked(props: {
  tool: CatalogTool
  command: CommandAccess
  row: Row | undefined
  allowed: boolean
  onAllow: (key: string) => void
}) {
  const { tool, command, row, allowed, onAllow } = props
  const key = command.permission
  return (
    <li className="flex flex-col gap-1">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <code className="selectable min-w-0 font-mono text-[0.85rem] text-ink">
          {tool.bin} {command.path.join(" ")}
        </code>
        {command.reason && <span className="min-w-0 flex-1 text-[0.85rem] text-ink-soft">{command.reason}</span>}
        {key && allowed && (
          <Button size="sm" variant="ghost" disabled={row?.state === "saving"} onClick={() => onAllow(key)}>
            Allow
          </Button>
        )}
      </div>
      <RowStatus row={row} />
    </li>
  )
}

function RowStatus({ row }: { row: Row | undefined }) {
  if (!row) return null
  if (row.state === "saving")
    return (
      <p role="status" className="text-[0.85rem] text-ink-soft">
        Saving…
      </p>
    )
  return (
    <p role="alert" className="text-[0.85rem] text-bad">
      {row.message}
    </p>
  )
}

function ConfirmWiden(props: {
  tool: CatalogTool
  profile: string | null
  change: Change
  ceiling: Level | null
  onClose: () => void
  onConfirm: () => void
}) {
  const { tool, profile, change, ceiling, onClose, onConfirm } = props
  const who = profile ? `the ${profile} profile` : "every profile that sets nothing of its own"
  const verb = change.level === null ? "Remove the level" : LEVEL_LABEL[change.level]
  return (
    <Dialog
      open
      wide
      title={change.level === null ? `Remove the level for ${change.label}?` : `${verb}: ${change.label}?`}
      onClose={onClose}
      actions={
        <>
          <Button variant="ghost" onClick={onClose} data-autofocus>
            Keep it
          </Button>
          <Button variant="danger" onClick={onConfirm}>
            {change.level === null ? "Remove" : LEVEL_LABEL[change.level]}
          </Button>
        </>
      }
    >
      <p>
        {change.level === null
          ? `The tool's own default then applies to ${who}. It may let more through than ${LEVEL_LABEL[change.from ?? "readonly"].toLowerCase()}.`
          : `Agents and scripts using ${who} will ${MEANS[change.level]}.`}
      </p>
      {change.overrides.length > 0 && (
        <p className="mt-2">
          These stay as they are:{" "}
          {change.overrides.map((o, n) => (
            <span key={o.key}>
              {n > 0 && ", "}
              <code className="font-mono text-ink">{o.key}</code> ({LEVEL_LABEL[o.level].toLowerCase()})
            </span>
          ))}
          .
        </p>
      )}
      {ceiling && (
        <p className="mt-2">
          Your first-run answer still keeps every tool read only, so this has no effect until then.
        </p>
      )}
      <p className="mt-3 mb-1.5 text-[0.85rem]">WireCat runs:</p>
      <CopyField
        value={commandLine(tool, profile, { key: change.key, level: change.level })}
        label="Copy the command"
      />
    </Dialog>
  )
}
