import { ChevronRight, RefreshCw, Terminal } from "lucide-react"
import { type ReactNode, useCallback, useEffect, useId, useRef, useState } from "react"
import type { CatalogTool } from "@/domain/catalog"
import { setupCommand } from "@/domain/catalog"
import { readLast, remember } from "@/features/config/store"
import { useMessages } from "@/i18n"
import { platform } from "@/platform/bridge"
import type { CommandAccess, Permissions as Data, Level, OwnLevel } from "@/platform/permissions-schemas"
import { Button } from "@/ui/Button"
import { Collapse } from "@/ui/Collapse"
import { CopyField } from "@/ui/CopyField"
import { cx } from "@/ui/cx"
import { Dialog } from "@/ui/Dialog"
import { Disclosure } from "@/ui/Disclosure"
import { ErrorNotice } from "@/ui/ErrorNotice"
import { Lamp, type LampTone } from "@/ui/Lamp"
import { Select } from "@/ui/Select"
import { Skeleton } from "@/ui/Skeleton"
import { ReportThis } from "../report/ReportThis"
import { useProfiles } from "./Health"
import { LevelsHelp } from "./LevelsHelp"
import { toolsMessages } from "./messages"
import { type PermissionsText, permissionsMessages } from "./messages-permissions"
import {
  blockedCommands,
  type Count,
  capped,
  commandLine,
  defaultLevel,
  type GroupState,
  type GroupSummary,
  isLock,
  LEVELS,
  layerOf,
  lockReason,
  locks,
  moreBlocked,
  overview,
  partialDetail,
  removalWidens,
  stillAllowed,
  summarize,
  widensLevel,
} from "./permissions"
import { groupLabel } from "./tool-text"

type Words = PermissionsText

const TONE: Record<GroupState, LampTone> = {
  allowed: "ok",
  ask: "ok",
  readonly: "idle",
  blocked: "bad",
  partial: "warn",
}

/** `level: null` removes the key; `after` is the level that applies after, when the app knows it. */
type Change = {
  key: string
  label: string
  level: Level | null
  after?: Level
  from: Level | undefined
  overrides: OwnLevel[]
}
type Row = { state: "saving" } | { state: "failed"; message: string; tool: string; key: string }

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
  // A profile's own key hides the same key in `defaults`, so what removing it gives back is read separately.
  const [defaults, setDefaults] = useState<OwnLevel[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [rows, setRows] = useState<Record<string, Row>>({})
  const [confirming, setConfirming] = useState<Change | null>(null)
  const [open, setOpen] = useState(false)
  const latest = useRef(0)
  const defaultsView = profile === null
  const t = useMessages(toolsMessages)
  const m = useMessages(permissionsMessages).permissions

  const load = useCallback(async () => {
    const call = ++latest.current
    setLoading(true)
    try {
      const [next, base] = await Promise.all([
        platform.permissionsShow(tool.id, profile),
        profile === null ? null : platform.permissionsShow(tool.id, null),
      ])
      if (call !== latest.current) return
      setData(next)
      setDefaults(base?.levels ?? null)
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
      setRows((r) => ({ ...r, [change.key]: { state: "failed", message: message(e), tool: tool.id, key: change.key } }))
    }
    await load()
  }

  const request = (change: Change, widening: boolean) => (widening ? setConfirming(change) : save(change))

  const summaries = data
    ? groups.map((g) => summarize({ ...g, label: groupLabel(t, g.key, g.label) }, data, defaultLevel(g.key, defaults)))
    : []

  return (
    <section
      aria-labelledby={headingId}
      className="flex min-w-0 flex-col gap-3 border-line border-t pt-4 lg:col-span-2"
    >
      <h4 id={headingId}>
        <button
          type="button"
          aria-expanded={open}
          aria-controls={`${headingId}-body`}
          onClick={() => setOpen((o) => !o)}
          className="group flex w-full min-w-0 flex-wrap items-baseline gap-x-3 gap-y-1 rounded text-left"
        >
          <span className="flex items-center gap-1.5 text-[1.02rem] font-semibold text-ink group-hover:text-brand">
            <ChevronRight
              className={cx(
                "size-4 shrink-0 self-center text-ink-dim transition-transform duration-150 motion-reduce:transition-none",
                open && "rotate-90",
              )}
              aria-hidden
            />
            {m.heading}
          </span>
          {!open && (
            <span className="min-w-0 text-[0.9rem] font-normal text-ink-soft tabular-nums">
              {data ? m.closed(overview(summaries, m), profile) : error ? m.readFailedShort : <Skeleton chars={34} />}
            </span>
          )}
        </button>
      </h4>
      {/* Outside the closed body: these limit every level, so they stay in sight. */}
      {data?.ceiling && <Ceiling tool={tool} profile={profile} ceiling={data.ceiling} />}
      {data &&
        locks(data.commands, m).map((reason) => (
          <p
            key={reason}
            className="rounded-[0.2rem] border border-warn/40 bg-warn/10 px-3 py-2 text-[0.9rem] text-ink"
          >
            {m.blocksSome(tool.name, reason)}
          </p>
        ))}
      <Collapse open={open} id={`${headingId}-body`} className="flex min-w-0 flex-col gap-3">
        <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-2">
          <div className="min-w-0">
            <p className="text-[0.9rem] text-ink-soft">
              {profile
                ? m.introProfile(
                    tool.bin,
                    <span className="font-medium text-ink">{profile}</span>,
                    <LevelsHelp tool={tool} />,
                  )
                : m.introDefaults(tool.bin, <LevelsHelp tool={tool} />)}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <label className="sr-only" htmlFor={`${headingId}-profile`}>
              {m.profile}
            </label>
            <Select
              id={`${headingId}-profile`}
              size="sm"
              value={profile ?? ""}
              onChange={(p) => choose(p === "" ? null : p)}
              options={[
                { value: "", label: m.defaultsOption },
                ...(profiles ?? []).map((p) => ({ value: p.name, label: p.name })),
              ]}
              className="min-w-[11rem]"
            />
            <Button
              size="sm"
              variant="ghost"
              onClick={load}
              disabled={loading}
              aria-label={m.reload}
              icon={<RefreshCw className={cx("size-4", loading && "animate-spin")} aria-hidden />}
            />
          </div>
        </div>

        {error && (
          <ErrorNotice
            inline
            action={<ReportThis what={`Reading ${tool.name} permissions`} tool={tool.id} error={error} />}
          >
            {m.readFailed(error)}
          </ErrorNotice>
        )}
        <Notes tool={tool} data={data} defaultsView={defaultsView} m={m} />
        {data ? <Totals summaries={summaries} m={m} /> : !error && !defaultsView && <Skeleton chars={44} />}

        {!data && !error ? (
          <ul className="divide-y divide-line rounded-[0.45rem] border border-line bg-app">
            {groups.map((g, n) => (
              <li key={g.key} className={ROW}>
                <div className={ROW_GRID}>
                  <GroupName label={groupLabel(t, g.key, g.label)} groupKey={g.key} detail={null} />
                  <Skeleton className="h-8 w-full" label={n === 0 ? m.loading : ""} />
                </div>
              </li>
            ))}
          </ul>
        ) : data ? (
          <ul
            aria-label={m.list(tool.name)}
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
                ceiling={data.ceiling}
                defaultsView={defaultsView}
                rows={rows}
                onChange={request}
                m={m}
              />
            ))}
          </ul>
        ) : null}
      </Collapse>

      {confirming && (
        <ConfirmWiden
          tool={tool}
          profile={profile}
          change={confirming}
          ceiling={data?.ceiling ?? null}
          m={m}
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

function Totals({ summaries, m }: { summaries: GroupSummary[]; m: Words }) {
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
  return <p className="text-[0.9rem] text-ink tabular-nums">{m.totals(reads, writes)}</p>
}

function Notes(props: { tool: CatalogTool; data: Data | null; defaultsView: boolean; m: Words }) {
  const { tool, data, defaultsView, m } = props
  if (defaultsView) return <p className="text-[0.875rem] text-ink-soft">{m.chooseProfile}</p>
  if (!data) return null
  if (data.commandsError)
    return (
      <ErrorNotice
        inline
        action={<ReportThis what={`Listing ${tool.name} commands`} tool={tool.id} error={data.commandsError} />}
      >
        {m.commandsFailed(data.commandsError)}
      </ErrorNotice>
    )
  if (data.commands === null)
    return <p className="text-[0.875rem] text-ink-soft">{m.noCommands(tool.bin, tool.name)}</p>
  return null
}

function Ceiling({ tool, profile, ceiling }: { tool: CatalogTool; profile: string | null; ceiling: Level }) {
  const command = setupCommand(tool, profile)
  const m = useMessages(permissionsMessages).permissions
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-[0.2rem] border border-warn/40 bg-warn/10 px-3 py-2">
      <p className="min-w-0 flex-1 text-[0.9rem] text-ink">{m.ceiling(ceiling === "deny")}</p>
      {tool.setup && profile ? (
        <Button
          size="sm"
          onClick={() => platform.openSetup(tool.id, profile)}
          icon={<Terminal className="size-4" aria-hidden />}
        >
          {m.openSetup}
        </Button>
      ) : (
        command && <code className="selectable font-mono text-[0.85rem] text-ink">{command}</code>
      )}
    </div>
  )
}

const ROW = "flex flex-col gap-2 px-3 py-2.5"
// Wide enough for "Только чтение (по умолчанию)"; the same in every row, so the selects line up.
const ROW_GRID = "grid grid-cols-[minmax(0,1fr)_min(17rem,45%)] items-center gap-x-3"

function GroupName(props: { label: string; groupKey: string; detail: string | null; tone?: LampTone }) {
  const { label, groupKey, detail, tone } = props
  return (
    <div className="min-w-0">
      <div className="flex min-w-0 items-baseline gap-2">
        {tone && (
          <span className="flex self-center">
            <Lamp tone={tone} size="sm" />
          </span>
        )}
        <span className="truncate font-medium text-ink">{label}</span>
        <span className="font-mono text-[0.85rem] text-ink-dim">{groupKey}</span>
      </div>
      {detail && <p className="text-[0.9rem] text-ink-soft">{detail}</p>}
    </div>
  )
}

function GroupRow(props: {
  tool: CatalogTool
  summary: GroupSummary
  ceiling: Level | null
  defaultsView: boolean
  rows: Record<string, Row>
  onChange: (change: Change, widening: boolean) => void
  m: Words
}) {
  const { tool, summary: s, ceiling, defaultsView, rows, onChange, m } = props
  const status = rows[s.group.key]
  const lock = lockReason(s.own, defaultsView, m) ?? s.commands.find(isLock)?.reason ?? null
  const still = stillAllowed(s)
  const blocked = blockedCommands(s)
  const held = capped(s.level, ceiling)
  const detail = lock ?? (held !== s.level ? m.heldFor(held) : null) ?? partialDetail(s, m) ?? moreBlocked(s, held, m)
  const separately = s.overrides.length
  const removable = s.own !== undefined && layerOf(s.own, defaultsView) === "here"

  const choose = (level: Level) => {
    if (level === s.level) return
    const base = { key: s.group.key, label: s.group.label, from: s.level, overrides: s.overrides }
    const widening = widensLevel(s.level, level)
    if (level === s.fallback && removable) onChange({ ...base, level: null, after: level }, widening)
    else onChange({ ...base, level }, widening)
  }

  return (
    <li className={ROW}>
      <div className={ROW_GRID}>
        <GroupName label={s.group.label} groupKey={s.group.key} detail={detail} tone={TONE[s.state]} />
        <Select<Level>
          aria-label={m.select(s.group.label)}
          className="w-full"
          size="sm"
          value={s.level}
          disabled={Boolean(lock) || status?.state === "saving"}
          onChange={choose}
          options={LEVELS.map((l) => ({
            value: l,
            label: l === s.fallback ? m.levelDefault(m.levels[l]) : m.levels[l],
          }))}
        />
      </div>
      <RowStatus row={status} m={m} />
      {(blocked.length > 0 || separately > 0) && (
        <Disclosure summary={m.disclosure(blocked.length, separately)}>
          <div className="flex flex-col gap-3 pb-1 pl-5">
            {separately > 0 && (
              <SubList title={m.setSeparately}>
                <ul aria-label={m.setSeparatelyList(s.group.label)} className="flex flex-col gap-1.5">
                  {s.overrides.map((o) => (
                    <Override
                      key={o.key}
                      level={o}
                      defaultsView={defaultsView}
                      row={rows[o.key]}
                      m={m}
                      onChange={(level) =>
                        onChange(
                          { key: o.key, label: o.key, level, from: o.level, overrides: [] },
                          level === null ? removalWidens(o) : widensLevel(o.level, level),
                        )
                      }
                    />
                  ))}
                </ul>
              </SubList>
            )}
            {blocked.length > 0 && (
              <SubList title={defaultsView ? m.blocked : m.blockedForProfile}>
                <ul aria-label={m.blockedList(s.group.label)} className="flex flex-col gap-1.5">
                  {blocked.map((c) => (
                    <Blocked
                      key={c.path.join(" ")}
                      tool={tool}
                      command={c}
                      row={c.permission ? rows[c.permission] : undefined}
                      allowed={!defaultsView}
                      m={m}
                      onAllow={(key) =>
                        onChange({ key, label: key, level: "allow", from: undefined, overrides: [] }, true)
                      }
                    />
                  ))}
                </ul>
              </SubList>
            )}
            {still.length > 0 && (
              <SubList title={m.stillAllowed}>
                <ul aria-label={m.stillAllowedList(s.group.label)} className="flex flex-col gap-1">
                  {still.map((c) => (
                    <li key={c.path.join(" ")}>
                      <code className="selectable font-mono text-[0.9rem] text-ink">
                        {tool.bin} {c.path.join(" ")}
                      </code>
                    </li>
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
      <h5 className="text-[0.85rem] font-medium text-ink-dim">{title}</h5>
      {children}
    </div>
  )
}

/** A key under a group: its built-in default lives in the tool, so removing it is offered as such, not as a level. */
function KeySelect(props: {
  label: string
  own: OwnLevel
  defaultsView: boolean
  disabled: boolean
  onChange: (level: Level | null) => void
  m: Words
}) {
  const { label, own, defaultsView, disabled, onChange, m } = props
  const removable = layerOf(own, defaultsView) === "here"
  return (
    <Select<Level | "">
      aria-label={label}
      className="w-full"
      size="sm"
      value={own.level}
      disabled={disabled}
      onChange={(l) => onChange(l === "" ? null : l)}
      options={[
        ...LEVELS.map((l) => ({ value: l, label: m.levels[l] })),
        ...(removable ? [{ value: "" as const, label: m.removeKey }] : []),
      ]}
    />
  )
}

function Override(props: {
  level: OwnLevel
  defaultsView: boolean
  row: Row | undefined
  onChange: (level: Level | null) => void
  m: Words
}) {
  const { level, defaultsView, row, onChange, m } = props
  const lock = lockReason(level, defaultsView, m)
  return (
    <li className="flex flex-col gap-1">
      <div className={ROW_GRID}>
        <span className="min-w-0">
          <code className="selectable font-mono text-[0.9rem] text-ink">{level.key}</code>
          {layerOf(level, defaultsView) === "defaults" && (
            <span className="ml-2 text-[0.9rem] text-ink-soft">{m.fromDefaults}</span>
          )}
          {lock && <span className="block text-[0.9rem] text-ink-soft">{lock}</span>}
        </span>
        <KeySelect
          label={m.select(level.key)}
          own={level}
          defaultsView={defaultsView}
          disabled={Boolean(lock) || row?.state === "saving"}
          onChange={onChange}
          m={m}
        />
      </div>
      <RowStatus row={row} m={m} />
    </li>
  )
}

function Blocked(props: {
  tool: CatalogTool
  command: CommandAccess
  row: Row | undefined
  allowed: boolean
  onAllow: (key: string) => void
  m: Words
}) {
  const { tool, command, row, allowed, onAllow, m } = props
  const key = command.permission === "*" ? null : command.permission
  const own = key === command.path.join(".")
  return (
    <li className="flex flex-col gap-1">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <code className="selectable min-w-0 font-mono text-[0.9rem] text-ink">
          {tool.bin} {command.path.join(" ")}
        </code>
        {command.reason && <span className="min-w-0 flex-1 text-[0.9rem] text-ink-soft">{command.reason}</span>}
        {key && allowed && (
          <Button size="sm" variant="ghost" disabled={row?.state === "saving"} onClick={() => onAllow(key)}>
            {own ? m.allow : m.allowAll(key)}
          </Button>
        )}
      </div>
      <RowStatus row={row} m={m} />
    </li>
  )
}

function RowStatus({ row, m }: { row: Row | undefined; m: Words }) {
  if (!row) return null
  if (row.state === "saving")
    return (
      <p role="status" className="text-[0.9rem] text-ink-soft">
        {m.saving}
      </p>
    )
  return (
    <ErrorNotice
      inline
      action={<ReportThis what={`Saving the ${row.key} permission`} tool={row.tool} error={row.message} />}
    >
      {row.message}
    </ErrorNotice>
  )
}

function ConfirmWiden(props: {
  tool: CatalogTool
  profile: string | null
  change: Change
  ceiling: Level | null
  m: Words
  onClose: () => void
  onConfirm: () => void
}) {
  const { tool, profile, change, ceiling, m, onClose, onConfirm } = props
  const next = change.level ?? change.after
  return (
    <Dialog
      open
      wide
      title={next ? m.confirmTitle(m.levels[next], change.label) : m.removeTitle(change.label)}
      onClose={onClose}
      actions={
        <>
          <Button variant="ghost" onClick={onClose} data-autofocus>
            {m.keep}
          </Button>
          <Button variant="danger" onClick={onConfirm}>
            {next ? m.levels[next] : m.remove}
          </Button>
        </>
      }
    >
      <p>{next ? m.means(next, profile) : m.fallsBack(profile, change.from ?? "readonly")}</p>
      {change.overrides.length > 0 && (
        <p className="mt-2">
          {m.overridesStay(
            change.overrides.map((o, n) => (
              <span key={o.key}>
                {n > 0 && ", "}
                <code className="font-mono text-ink">{o.key}</code> ({m.levelInline[o.level]})
              </span>
            )),
          )}
        </p>
      )}
      {ceiling && <p className="mt-2">{m.ceilingNoEffect}</p>}
      <p className="mt-3 mb-1.5 text-[0.9rem]">{m.runs}</p>
      <CopyField value={commandLine(tool, profile, { key: change.key, level: change.level })} label={m.copyCommand} />
    </Dialog>
  )
}
