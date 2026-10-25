import { cx } from "./cx"

/**
 * A placeholder that takes the place of what loads into it, at that thing's final size, so nothing moves when it
 * arrives. Rules: docs/dev/ARCHITECTURE.md, "Loading without layout shift".
 *
 * - `className` sizes a block (a row's height, a panel's box).
 * - `chars` makes it a run of text instead: as wide as that many characters of the surrounding font, and as tall as
 *   its line, so a version or a count can sit inside the sentence it will finish. Exact in the mono font.
 * - `label` is announced once, on the first placeholder of a group; the rest are silent.
 */
export function Skeleton({ className, label, chars }: { className?: string; label?: string; chars?: number }) {
  const text = chars !== undefined
  const look = cx(text ? "skeleton-text" : "skeleton block", className)
  const style = text ? { width: `${chars}ch` } : undefined
  // A no-break space gives the text form the parent's line box without any text a test or reader could find.
  const fill = text ? " " : null
  if (!label) {
    return (
      <span aria-hidden className={look} style={style}>
        {fill}
      </span>
    )
  }
  return (
    <span role="status" className={look} style={style}>
      {fill}
      <span className="sr-only">{label}</span>
    </span>
  )
}

/**
 * Text that changes between known values ("Check again" / "Checking…") without changing width: every variant is laid
 * out in one grid cell, so the cell is as wide as the widest. Only `value` is real text; the others are drawn from an
 * attribute, so tests, screen readers and copy-paste see one label.
 */
export function StableText({
  value,
  variants,
  className,
}: {
  value: string
  variants: readonly string[]
  className?: string
}) {
  return (
    <span className={cx("stable-text", className)}>
      <span>{value}</span>
      {variants
        .filter((v) => v !== value)
        .map((v) => (
          <span key={v} aria-hidden data-text={v} />
        ))}
    </span>
  )
}
