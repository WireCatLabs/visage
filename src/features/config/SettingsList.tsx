import { EyeOff, Lock, Plus, RotateCcw, X } from "lucide-react"
import { type KeyboardEvent, type ReactNode, useState } from "react"
import { useMessages } from "@/i18n"
import type { SettingRow } from "@/platform/settings-schemas"
import { Button } from "@/ui/Button"
import { cx } from "@/ui/cx"
import { ErrorNotice } from "@/ui/ErrorNotice"
import { Pill } from "@/ui/Pill"
import { Skeleton } from "@/ui/Skeleton"
import { ReportThis } from "../report/ReportThis"
import { isReadOnly } from "./diff"
import { configMessages } from "./messages"
import { reasonText, reportText } from "./reason"
import { useConfig } from "./store"

/** Values someone wrote into a file, as opposed to built-in defaults. */
const isModified = (r: SettingRow) => r.origin !== "default" && r.origin !== "computed"

const ROW =
  "grid min-h-[3.6rem] grid-cols-[minmax(0,1fr)_minmax(11rem,19rem)_auto] items-center gap-x-[1.2rem] border-line border-b px-[1.3rem] py-2.5 last:border-b-0"

/** Rows at the real row's height while the tool answers; the first one is announced. */
export function SettingsPlaceholder({ count, label = "" }: { count: number; label?: string }) {
  return (
    <div>
      {Array.from({ length: count }, (_, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: placeholders have no identity of their own
        <div key={i} className={ROW}>
          <span className="font-mono text-[0.95rem]">
            <Skeleton chars={10 + ((i * 5) % 9)} label={i === 0 ? label : ""} />
          </span>
          <Skeleton className="h-8 w-full" />
          <ResetCell />
        </div>
      ))}
    </div>
  )
}

export function SettingsList({ rows, disabled }: { rows: readonly SettingRow[]; disabled: boolean }) {
  const m = useMessages(configMessages)
  if (rows.length === 0) return <p className="px-[1.3rem] py-6 text-[0.95rem] text-ink-soft">{m.list.noMatch}</p>
  return (
    <ul aria-label={m.tabSettings}>
      {rows.map((r) => (
        <Row key={r.key} row={r} disabled={disabled} />
      ))}
    </ul>
  )
}

function Row({ row, disabled }: { row: SettingRow; disabled: boolean }) {
  const all = useMessages(configMessages)
  const m = all.list
  const status = useConfig((s) => s.rows[row.key])
  const toolId = useConfig((s) => s.tool)
  const apply = useConfig((s) => s.apply)
  const saving = status?.state === "saving"
  const readOnly = isReadOnly(row)
  const id = `setting-${row.key}`
  const note = row.locked ?? (row.masked ? m.masked : null)

  return (
    <li className={ROW}>
      <div className="min-w-0">
        <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
          {isModified(row) && (
            <span title={m.modifiedTitle} className="size-[0.45rem] shrink-0 rounded-full bg-brand">
              <span className="sr-only">{m.modified}</span>
            </span>
          )}
          <label htmlFor={id} className="selectable truncate font-mono text-[0.95rem] text-ink">
            {row.key}
          </label>
          <Pill tone={row.origin === "environment" ? "warn" : "neutral"}>
            <span title={row.from ?? undefined}>{m.origin[row.origin]}</span>
          </Pill>
        </div>
        {status?.state === "failed" ? (
          <ErrorNotice
            inline
            className="mt-1"
            action={
              <ReportThis what={`Saving the ${row.key} setting`} tool={toolId} error={reportText(status.message)} />
            }
          >
            {reasonText(all, status.message)}
          </ErrorNotice>
        ) : (
          note && (
            <p className="mt-1 flex items-start gap-1.5 text-[0.9rem] text-ink-soft">
              {row.masked && !row.locked ? (
                <EyeOff className="mt-[0.2rem] size-3.5 shrink-0" aria-hidden />
              ) : (
                <Lock className="mt-[0.2rem] size-3.5 shrink-0" aria-hidden />
              )}
              {note}
            </p>
          )
        )}
      </div>
      <div className="flex min-w-0 items-center">
        {readOnly ? (
          <span id={id} className="selectable truncate font-mono text-[0.95rem] text-ink-soft">
            {row.value === null ? m.notSet : shown(row.value)}
          </span>
        ) : (
          <Control id={id} row={row} disabled={disabled || saving} onCommit={(v) => apply(row, v)} />
        )}
      </div>
      <ResetCell>
        {saving ? (
          <span role="status" className="text-[0.9rem] text-ink-dim">
            {m.saving}
          </span>
        ) : (
          row.resettable && (
            <Button
              size="sm"
              variant="ghost"
              disabled={disabled}
              onClick={() => apply(row, null)}
              aria-label={m.resetLabel(row.key)}
              title={m.resetTitle}
              icon={<RotateCcw className="size-3.5" aria-hidden />}
            >
              {m.reset}
            </Button>
          )
        )}
      </ResetCell>
    </li>
  )
}

/**
 * As wide as the Reset button and as "Saving…" in this language, in every row and placeholder, so neither a save nor
 * the list loading moves the value column.
 */
function ResetCell({ children }: { children?: ReactNode }) {
  const m = useMessages(configMessages).list
  const stack = "col-start-1 row-start-1"
  return (
    <div className="grid items-center justify-items-end">
      <Button
        size="sm"
        variant="ghost"
        aria-hidden
        tabIndex={-1}
        disabled
        className={cx(stack, "invisible")}
        icon={<RotateCcw className="size-3.5" />}
      >
        <span data-label={m.reset} className="after:content-[attr(data-label)]" />
      </Button>
      <span
        aria-hidden
        data-label={m.saving}
        className={cx(stack, "invisible text-[0.9rem] whitespace-nowrap after:content-[attr(data-label)]")}
      />
      {children && <div className={stack}>{children}</div>}
    </div>
  )
}

const shown = (v: unknown) => (typeof v === "string" ? v : JSON.stringify(v))

const field =
  "h-8 w-full min-w-0 rounded-[0.35rem] border border-line-strong bg-app px-2.5 font-mono text-[0.9rem] text-ink placeholder:font-sans placeholder:text-ink-dim focus-visible:border-brand disabled:opacity-45"

function Control({
  id,
  row,
  disabled,
  onCommit,
}: {
  id: string
  row: SettingRow
  disabled: boolean
  onCommit: (value: unknown) => void
}) {
  const v = row.value
  if (typeof v === "boolean") {
    return (
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={v}
        disabled={disabled}
        onClick={() => onCommit(!v)}
        className={cx(
          "relative inline-flex h-[1.4rem] w-[2.5rem] shrink-0 items-center rounded-full border transition-colors duration-150 ease-out-quart disabled:opacity-45",
          v ? "border-brand bg-brand" : "border-line-strong bg-app-3",
        )}
      >
        <span
          aria-hidden
          className={cx(
            "absolute size-[1rem] rounded-full bg-app shadow-panel transition-transform duration-150 ease-out-quart",
            v ? "translate-x-[1.15rem]" : "translate-x-[0.15rem]",
          )}
        />
      </button>
    )
  }
  if (Array.isArray(v)) return <ListControl id={id} items={v.map(String)} disabled={disabled} onCommit={onCommit} />
  return <TextControl id={id} value={v} disabled={disabled} onCommit={onCommit} />
}

function TextControl(props: { id: string; value: unknown; disabled: boolean; onCommit: (v: unknown) => void }) {
  const { id, value, disabled, onCommit } = props
  const m = useMessages(configMessages).list
  const numeric = typeof value === "number"
  const initial = value === null ? "" : String(value)
  const [text, setText] = useState(initial)
  const [seen, setSeen] = useState(initial)
  if (seen !== initial) {
    setSeen(initial)
    setText(initial)
  }

  const commit = () => {
    if (text === initial) return
    if (text.trim() === "") return onCommit(null)
    onCommit(numeric && text.trim() !== "" && !Number.isNaN(Number(text)) ? Number(text) : text)
  }
  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") e.currentTarget.blur()
    if (e.key === "Escape") setText(initial)
  }

  return (
    <input
      id={id}
      type="text"
      inputMode={numeric ? "decimal" : undefined}
      value={text}
      placeholder={m.notSet}
      disabled={disabled}
      onChange={(e) => setText(e.target.value)}
      onBlur={commit}
      onKeyDown={onKeyDown}
      spellCheck={false}
      className={cx(field, numeric && "tabular-nums")}
    />
  )
}

function ListControl(props: { id: string; items: string[]; disabled: boolean; onCommit: (v: unknown) => void }) {
  const { id, items, disabled, onCommit } = props
  const m = useMessages(configMessages).list
  const [adding, setAdding] = useState("")
  const add = () => {
    const word = adding.trim()
    if (!word || items.includes(word)) return
    setAdding("")
    onCommit([...items, word])
  }
  return (
    <div className="flex min-w-0 flex-wrap items-center gap-1.5">
      {items.map((item) => (
        <span
          key={item}
          className="inline-flex h-6 items-center gap-1 rounded-[0.3rem] bg-app-3 pr-0.5 pl-2 font-mono text-[0.85rem] text-ink"
        >
          {item}
          <button
            type="button"
            disabled={disabled}
            onClick={() => onCommit(items.filter((i) => i !== item))}
            aria-label={m.remove(item)}
            className="grid size-5 place-items-center rounded-[0.25rem] text-ink-dim hover:bg-app hover:text-ink"
          >
            <X className="size-3" aria-hidden />
          </button>
        </span>
      ))}
      <span className="inline-flex items-center gap-1">
        <input
          id={id}
          value={adding}
          disabled={disabled}
          placeholder={m.add}
          onChange={(e) => setAdding(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && add()}
          className={cx(field, "h-6 w-[5.5rem]")}
        />
        <button
          type="button"
          disabled={disabled}
          onClick={add}
          aria-label={m.addToList}
          className="grid size-6 place-items-center rounded-[0.3rem] text-ink-dim hover:bg-app-3 hover:text-ink"
        >
          <Plus className="size-3.5" aria-hidden />
        </button>
      </span>
    </div>
  )
}
