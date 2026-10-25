import { Check, ChevronRight, Copy, Filter, FilterX, Group } from "lucide-react"
import { useEffect, useState } from "react"
import { inlineJson } from "@/domain/runs"
import { cx } from "@/ui/cx"

/** Maps a leaf's path to a run field the query can filter on, or null when no run summary carries it. */
export type FieldOf = (path: string[]) => string | null

type Props = {
  value: unknown
  fieldOf: FieldOf
  onFilter: (field: string, value: string, negate: boolean) => void
  onGroup: (field: string) => void
  label: string
}

export function JsonTree({ value, fieldOf, onFilter, onGroup, label }: Props) {
  return (
    <fieldset aria-label={label} className="selectable min-w-0 border-0 p-0 font-mono text-[0.85rem] leading-[1.7]">
      <Children value={value} path={[]} depth={0} fieldOf={fieldOf} onFilter={onFilter} onGroup={onGroup} />
    </fieldset>
  )
}

type NodeProps = Omit<Props, "label"> & { path: string[]; depth: number }

function Children({ value, path, depth, ...rest }: NodeProps) {
  const entries = Array.isArray(value)
    ? value.map((v, i) => [String(i), v] as const)
    : Object.entries((value ?? {}) as Record<string, unknown>)
  return (
    <ul className={cx(depth > 0 && "ml-[0.55rem] border-line border-l pl-[0.7rem]")}>
      {entries.map(([k, v]) => (
        <Node key={k} name={k} value={v} path={[...path, k]} depth={depth + 1} {...rest} />
      ))}
    </ul>
  )
}

function Node({ name, value, path, depth, fieldOf, onFilter, onGroup }: NodeProps & { name: string }) {
  const nested = value !== null && typeof value === "object"
  const size = nested ? (Array.isArray(value) ? value.length : Object.keys(value as object).length) : 0
  const [open, setOpen] = useState(depth < 3 && size <= 12)
  const inline = inlineJson(value)

  if (nested && inline === null) {
    const brackets = Array.isArray(value) ? ["[", "]"] : ["{", "}"]
    return (
      <li>
        <button
          type="button"
          onClick={() => setOpen(!open)}
          className="-ml-[1.1rem] inline-flex items-center gap-[0.15rem] rounded-[0.3rem] pr-1 text-left hover:bg-app-3"
        >
          <ChevronRight
            aria-hidden
            className={cx("size-[0.9rem] text-ink-dim transition-transform duration-150", open && "rotate-90")}
          />
          <span className="text-ink-soft">{name}</span>
          <span className="text-ink-dim">
            {open ? brackets[0] : `${brackets[0]} ${size} ${size === 1 ? "item" : "items"} ${brackets[1]}`}
          </span>
        </button>
        {open && (
          <Children value={value} path={path} depth={depth} fieldOf={fieldOf} onFilter={onFilter} onGroup={onGroup} />
        )}
      </li>
    )
  }

  // A one-element list filters on its element; a longer list or an object has no single value to filter on.
  const only = Array.isArray(value) && value.length === 1 ? (value[0] as unknown) : undefined
  const scalar = nested ? (only ?? null) : value
  const field = fieldOf(path)
  const filterable = field !== null && scalar !== null && scalar !== undefined
  const groupable = field !== null && (!nested || Array.isArray(value))
  const text = nested ? (inline as string) : value === null ? "null" : String(value)
  const term = String(scalar)

  return (
    <li className="group flex min-w-0 items-baseline gap-2 rounded-[0.3rem] hover:bg-app-3/60">
      <span className="shrink-0 text-ink-soft">{name}</span>
      <span
        className={cx(
          "min-w-0 break-all",
          nested && (size === 0 ? "text-ink-dim" : "text-ink"),
          typeof value === "string" && "text-ink",
          (typeof value === "number" || typeof value === "boolean") && "text-ink tabular-nums",
          value === null && "text-ink-dim italic",
        )}
      >
        {typeof value === "string" ? `"${text}"` : text}
      </span>
      <span className="ml-auto flex shrink-0 gap-0.5 opacity-0 transition-opacity duration-150 group-hover:opacity-100 focus-within:opacity-100">
        {filterable && (
          <>
            <LeafAction label={`Filter by ${field}:${term}`} onClick={() => onFilter(field, term, false)}>
              <Filter className="size-[0.85rem]" aria-hidden />
            </LeafAction>
            <LeafAction label={`Exclude ${field}:${term}`} onClick={() => onFilter(field, term, true)}>
              <FilterX className="size-[0.85rem]" aria-hidden />
            </LeafAction>
          </>
        )}
        {groupable && (
          <LeafAction label={`Group by ${field}`} onClick={() => onGroup(field)}>
            <Group className="size-[0.85rem]" aria-hidden />
          </LeafAction>
        )}
        <CopyValue value={text} />
      </span>
    </li>
  )
}

function LeafAction({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className="grid size-[1.35rem] place-items-center rounded-[0.3rem] text-ink-dim hover:bg-app hover:text-ink"
    >
      {children}
    </button>
  )
}

export function CopyValue({ value, label = "Copy value" }: { value: string; label?: string }) {
  const [copied, setCopied] = useState(false)
  useEffect(() => {
    if (!copied) return
    const t = setTimeout(() => setCopied(false), 1600)
    return () => clearTimeout(t)
  }, [copied])
  return (
    <LeafAction
      label={copied ? "Copied" : label}
      onClick={() => navigator.clipboard.writeText(value).then(() => setCopied(true))}
    >
      {copied ? (
        <Check className="size-[0.85rem] text-ok" aria-hidden />
      ) : (
        <Copy className="size-[0.85rem]" aria-hidden />
      )}
    </LeafAction>
  )
}
