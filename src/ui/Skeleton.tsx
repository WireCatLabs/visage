import { cx } from "./cx"

export function Skeleton({ className, label }: { className?: string; label?: string }) {
  if (!label) return <span aria-hidden className={cx("skeleton block", className)} />
  return (
    <span role="status" className={cx("skeleton block", className)}>
      <span className="sr-only">{label}</span>
    </span>
  )
}
