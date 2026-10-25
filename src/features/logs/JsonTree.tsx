import { Check, ChevronRight, Copy, Filter, FilterX } from "lucide-react"
import { useEffect, useState } from "react"
import { cx } from "@/ui/cx"

/** Maps a leaf's path to a run field the query can filter on, or null when no run summary carries it. */
export type FieldOf = (path: string[]) => string | null

type Props = {
  value: unknown
  fieldOf: FieldOf
  onFilter: (field: string, value: string, negate: boolean) => void
  label: string
}

export function JsonTree({ value, fieldOf, onFilter, label }: Props) {
  return (
    <fieldset aria-label={label} className="selectable min-w-0 border-0 p-0 font-mono text-[0.8rem] leading-[1.7]">
      <Children value={value} path={[]} depth={0} fieldOf={fieldOf} onFilter={onFilter} />
    </fieldset>
  )
}

type NodeProps = Omit<Props, "label"> & { path: string[]; depth: number }

function Children({ value, path, depth, fieldOf, onFilter }: NodeProps) {
  const entries = Array.isArray(value)
    ? value.map((v, i) => [String(i), v] as const)
    : Object.entries((value ?? {}) as Record<string, unknown>)
  return (
    <ul className={cx(depth > 0 && "ml-[0.55rem] border-line border-l pl-[0.7rem]")}>
      {entries.map(([k, v]) => (
        <Node key={k} name={k} value={v} path={[...path, k]} depth={depth + 1} fieldOf={fieldOf} onFilter={onFilter} />
      ))}
    </ul>
  )
}

function Node({ name, value, path, depth, fieldOf, onFilter }: NodeProps & { name: string }) {
  const nested = value !== null && typeof value === "object"
  const size = nested ? (Array.isArray(value) ? value.length : Object.keys(value as object).length) : 0
  const [open, setOpen] = useState(depth < 3 && size <= 12)

  if (nested) {
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
        {open && size > 0 && <Children value={value} path={path} depth={depth} fieldOf={fieldOf} onFilter={onFilter} />}
      </li>
    )
  }
  return <Leaf name={name} value={value} path={path} fieldOf={fieldOf} onFilter={onFilter} />
}

function Leaf({ name, value, path, fieldOf, onFilter }: Omit<NodeProps, "depth"> & { name: string }) {
  const field = value === null ? null : fieldOf(path)
  const text = value === null ? "null" : String(value)
  return (
    <li className="group flex min-w-0 items-baseline gap-2 rounded-[0.3rem] hover:bg-app-3/60">
      <span className="shrink-0 text-ink-soft">{name}</span>
      <span
        className={cx(
          "min-w-0 break-all",
          typeof value === "string" && "text-ink",
          (typeof value === "number" || typeof value === "boolean") && "text-ink tabular-nums",
          value === null && "text-ink-dim italic",
        )}
      >
        {typeof value === "string" ? `"${text}"` : text}
      </span>
      <span className="ml-auto flex shrink-0 gap-0.5 opacity-0 transition-opacity duration-150 group-hover:opacity-100 focus-within:opacity-100">
        {field && (
          <>
            <LeafAction label={`Filter by ${field}:${text}`} onClick={() => onFilter(field, text, false)}>
              <Filter className="size-[0.85rem]" aria-hidden />
            </LeafAction>
            <LeafAction label={`Exclude ${field}:${text}`} onClick={() => onFilter(field, text, true)}>
              <FilterX className="size-[0.85rem]" aria-hidden />
            </LeafAction>
          </>
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
