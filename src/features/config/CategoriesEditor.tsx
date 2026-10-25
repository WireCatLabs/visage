import { Lock, Pencil, Plus, Trash2 } from "lucide-react"
import { type FormEvent, type ReactNode, useEffect, useId, useRef, useState } from "react"
import type { SettingRow } from "@/platform/settings-schemas"
import { Button } from "@/ui/Button"
import { cx } from "@/ui/cx"
import { ErrorNotice } from "@/ui/ErrorNotice"
import { Skeleton } from "@/ui/Skeleton"
import { ReportThis } from "../report/ReportThis"
import { isReadOnly, type Op } from "./diff"
import { CATEGORY, type Category, categoryValue, FALLBACK, removeCategory, setCategory, toCategory } from "./scope"
import { useConfig } from "./store"

const field =
  "h-8 w-full min-w-0 rounded-[0.35rem] border border-line-strong bg-app px-2.5 text-[0.95rem] text-ink placeholder:text-ink-dim focus-visible:border-brand disabled:opacity-45"

/** Saves one change and says whether the tool took it; the store keeps the tool's refusal by setting name. */
async function save(op: Op): Promise<string | null> {
  await useConfig.getState().applyOp(op)
  const status = useConfig.getState().rows[op.key]
  return status?.state === "failed" ? status.message : null
}

const focusSoon = (id: string) => requestAnimationFrame(() => document.getElementById(id)?.focus())

export function CategoriesEditor(props: {
  rows: readonly SettingRow[]
  /** The tool's words when it could not read the shared file. */
  unreadable: string | null
  query: string
  disabled: boolean
}) {
  const { rows, unreadable, query, disabled } = props
  const headingId = useId()
  const ids = {
    add: `${headingId}-add`,
    undo: `${headingId}-undo`,
    edit: (name: string) => `${headingId}-edit-${name}`,
  }
  const [editing, setEditing] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
  const [removed, setRemoved] = useState<{ name: string; value: string; error: string | null } | null>(null)
  const toolId = useConfig((s) => s.tool)
  const all = rows.map(toCategory)
  const q = query.trim().toLowerCase()
  const shown = q ? all.filter((c) => `${c.name} ${c.meaning} ${c.words}`.toLowerCase().includes(q)) : all

  const remove = async (c: Category) => {
    const error = await save(removeCategory(c.name))
    if (error) return
    setRemoved({ name: c.name, value: c.value, error: null })
    focusSoon(ids.undo)
  }
  const undo = async () => {
    if (!removed) return
    const error = await save(setCategory(removed.name, removed.value))
    setRemoved(error ? { ...removed, error } : null)
  }

  return (
    <section aria-labelledby={headingId} className="border-line border-b">
      <Header
        headingId={headingId}
        count={all.length}
        action={
          !adding && (
            <Button
              id={ids.add}
              size="sm"
              disabled={disabled}
              onClick={() => {
                setAdding(true)
                setEditing(null)
              }}
              icon={<Plus className="size-3.5" aria-hidden />}
            >
              Add category
            </Button>
          )
        }
      />

      {removed && (
        <p
          role="status"
          className="flex flex-wrap items-center gap-x-3 border-line border-t bg-app-2 px-[1.3rem] py-2 text-[0.95rem]"
        >
          <span>
            Removed <span className="font-mono">{removed.name}</span>. Tasks that have it keep it.
          </span>
          <Button id={ids.undo} size="sm" variant="ghost" disabled={disabled} onClick={undo}>
            Undo
          </Button>
          {removed.error && <span className="text-bad">{removed.error}</span>}
          {removed.error && (
            <ReportThis what={`Removing the ${removed.name} category`} tool={toolId} error={removed.error} />
          )}
        </p>
      )}

      {adding && (
        <CategoryForm
          names={all.map((c) => c.name)}
          disabled={disabled}
          onDone={() => {
            setAdding(false)
            focusSoon(ids.add)
          }}
          className="border-line border-t"
        />
      )}

      {shown.length === 0 ? (
        <p className="border-line border-t px-[1.3rem] py-4 text-[0.95rem] text-ink-soft">
          {all.length > 0 ? "No category matches." : (unreadable ?? "The tool reported no categories.")}
        </p>
      ) : (
        <ul aria-label="Task categories">
          {shown.map((c) =>
            editing === c.name ? (
              <li key={c.name}>
                <CategoryForm
                  category={c}
                  disabled={disabled}
                  onDone={() => {
                    setEditing(null)
                    focusSoon(ids.edit(c.name))
                  }}
                />
              </li>
            ) : (
              <CategoryRow
                key={c.name}
                category={c}
                editId={ids.edit(c.name)}
                disabled={disabled}
                onEdit={() => {
                  setEditing(c.name)
                  setAdding(false)
                }}
                onRemove={() => remove(c)}
              />
            ),
          )}
        </ul>
      )}
    </section>
  )
}

function Header(props: { headingId: string; count: ReactNode; action: ReactNode }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3 px-[1.3rem] pt-4 pb-3">
      <div className="min-w-0">
        <h3 id={props.headingId} className="text-[1.08rem] font-semibold leading-tight">
          Task categories <span className="font-normal text-ink-dim tabular-nums">{props.count}</span>
        </h3>
        <p className="mt-1 max-w-[70ch] text-[0.95rem] text-ink-soft">
          A new task takes the category whose trigger words its message matches best; with no match it goes to{" "}
          <span className="font-mono">other</span>. Order breaks ties.
        </p>
      </div>
      {props.action}
    </div>
  )
}

const CATEGORY_ROW =
  "grid grid-cols-[minmax(7rem,11rem)_minmax(0,1fr)_auto] items-start gap-x-[1.2rem] border-line border-t px-[1.3rem] py-2.5"

/** The editor as it will look, with a row per category the tool reported last time. */
export function CategoriesPlaceholder({ count }: { count: number }) {
  const headingId = useId()
  return (
    <section aria-labelledby={headingId} className="border-line border-b">
      <Header
        headingId={headingId}
        count={<Skeleton chars={1} label="Reading settings" />}
        action={
          <Button size="sm" disabled icon={<Plus className="size-3.5" aria-hidden />}>
            Add category
          </Button>
        }
      />
      {Array.from({ length: count }, (_, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: placeholders have no identity of their own
        <div key={i} className={CATEGORY_ROW}>
          <span className="pt-[0.1rem] font-mono text-[0.95rem]">
            <Skeleton chars={5 + (i % 3)} />
          </span>
          <div>
            <p className="text-[0.95rem]">
              <Skeleton chars={24 + ((i * 7) % 16)} />
            </p>
            <p className="mt-0.5 text-[0.85rem]">
              <Skeleton chars={36 + ((i * 11) % 20)} />
            </p>
          </div>
          <span className="w-[4.25rem]" />
        </div>
      ))}
    </section>
  )
}

function CategoryRow(props: {
  category: Category
  editId: string
  disabled: boolean
  onEdit: () => void
  onRemove: () => void
}) {
  const { category: c, editId, disabled, onEdit, onRemove } = props
  const status = useConfig((s) => s.rows[`${CATEGORY}${c.name}`])
  const toolId = useConfig((s) => s.tool)
  const busy = status?.state === "saving"
  const readOnly = isReadOnly(c.row)
  return (
    <li className={CATEGORY_ROW}>
      <span className="selectable truncate pt-[0.1rem] font-mono text-[0.95rem] text-ink">{c.name}</span>
      <div className="min-w-0">
        <p className="selectable text-[0.95rem] text-ink">
          {c.meaning || <span className="text-ink-dim">no meaning</span>}
        </p>
        {c.words && <p className="selectable mt-0.5 line-clamp-2 text-[0.85rem] text-ink-dim">{c.words}</p>}
        {status?.state === "failed" && (
          <ErrorNotice
            inline
            className="mt-1"
            action={<ReportThis what={`Saving the ${c.name} category`} tool={toolId} error={status.message} />}
          >
            {status.message}
          </ErrorNotice>
        )}
        {readOnly && (
          <p className="mt-1 flex items-start gap-1.5 text-[0.85rem] text-ink-soft">
            <Lock className="mt-[0.2rem] size-3.5 shrink-0" aria-hidden />
            Hidden because it may hold personal data. Change it in a terminal.
          </p>
        )}
      </div>
      <div className="flex items-center gap-1">
        {busy ? (
          <span role="status" className="text-[0.85rem] text-ink-dim">
            Saving…
          </span>
        ) : (
          !readOnly && (
            <>
              <IconButton id={editId} label={`Edit ${c.name}`} disabled={disabled} onClick={onEdit}>
                <Pencil className="size-3.5" aria-hidden />
              </IconButton>
              {c.name === FALLBACK ? (
                <span
                  className="grid size-8 place-items-center text-ink-dim"
                  title="other stays: tasks that match no category go there"
                >
                  <Lock className="size-3.5" aria-hidden />
                  <span className="sr-only">other cannot be removed</span>
                </span>
              ) : (
                <IconButton label={`Remove ${c.name}`} disabled={disabled} onClick={onRemove} danger>
                  <Trash2 className="size-3.5" aria-hidden />
                </IconButton>
              )}
            </>
          )
        )}
      </div>
    </li>
  )
}

function IconButton(props: {
  id?: string
  label: string
  disabled: boolean
  danger?: boolean
  onClick: () => void
  children: ReactNode
}) {
  const { id, label, disabled, danger, onClick, children } = props
  return (
    <button
      id={id}
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className={cx(
        "grid size-8 place-items-center rounded-[0.35rem] text-ink-dim transition-colors duration-150 hover:bg-app-3 disabled:opacity-45",
        danger ? "hover:text-bad" : "hover:text-ink",
      )}
    >
      {children}
    </button>
  )
}

function CategoryForm(props: {
  category?: Category
  names?: readonly string[]
  disabled: boolean
  onDone: () => void
  className?: string
}) {
  const { category, names = [], disabled, onDone, className } = props
  const id = useId()
  const [name, setName] = useState("")
  const [meaning, setMeaning] = useState(category?.meaning ?? "")
  const [words, setWords] = useState(category?.words ?? "")
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const form = useRef<HTMLFormElement>(null)
  useEffect(() => {
    form.current?.querySelector("input")?.focus()
  }, [])

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    const target = category?.name ?? name.trim().toLowerCase()
    if (!category && !target) return setError("Give the category a name.")
    if (!category && names.includes(target)) return setError(`${target} already exists; edit it instead.`)
    const value = categoryValue(meaning, words)
    if (value instanceof Error) return setError(value.message)
    if (category && value === category.value) return onDone()
    setBusy(true)
    const refused = await save(setCategory(target, value))
    setBusy(false)
    if (refused) setError(refused)
    else onDone()
  }

  const off = disabled || busy
  return (
    <form
      ref={form}
      onSubmit={submit}
      onKeyDown={(e) => e.key === "Escape" && onDone()}
      aria-label={category ? `Edit ${category.name}` : "New category"}
      className={cx("flex flex-col gap-3 border-line border-t bg-app-2/60 px-[1.3rem] py-4", className)}
    >
      <div className="grid grid-cols-[minmax(7rem,11rem)_minmax(0,1fr)] gap-x-[1.2rem] gap-y-3">
        {category ? (
          <span className="pt-[0.35rem] font-mono text-[0.95rem] text-ink">{category.name}</span>
        ) : (
          <label className="flex flex-col gap-1">
            <span className="text-[0.85rem] font-medium text-ink-dim">Name</span>
            <input
              value={name}
              disabled={off}
              onChange={(e) => setName(e.target.value)}
              placeholder="pets"
              spellCheck={false}
              className={cx(field, "font-mono text-[0.85rem]")}
            />
          </label>
        )}
        <div className="flex flex-col gap-3">
          <label className="flex flex-col gap-1">
            <span className="text-[0.85rem] font-medium text-ink-dim">What it is for</span>
            <input
              value={meaning}
              disabled={off}
              onChange={(e) => setMeaning(e.target.value)}
              placeholder="flights, hotels, visas"
              className={field}
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[0.85rem] font-medium text-ink-dim">Trigger words</span>
            <input
              value={words}
              disabled={off}
              onChange={(e) => setWords(e.target.value)}
              placeholder="flight, hotel, билет, es:vuelo"
              spellCheck={false}
              aria-describedby={`${id}-words`}
              className={field}
            />
            <span id={`${id}-words`} className="text-[0.85rem] text-ink-dim">
              Comma-separated. Cyrillic words count as Russian; mark Spanish ones with es:.
            </span>
          </label>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2 pl-[calc(min(11rem,100%)+1.2rem)]">
        <Button type="submit" size="sm" variant="primary" disabled={off}>
          {busy ? "Saving…" : category ? "Save" : "Add"}
        </Button>
        <Button size="sm" variant="ghost" disabled={busy} onClick={onDone}>
          Cancel
        </Button>
        {error && (
          <span role="alert" className="selectable text-[0.95rem] text-bad">
            {error}
          </span>
        )}
      </div>
    </form>
  )
}
