import type { ReactNode } from "react"
import { cx } from "./cx"

type Props = {
  children: ReactNode
  detail?: ReactNode
  /** Usually a "Report this" button; it sits beside the message and wraps under it when space runs out. */
  action?: ReactNode
  /** A line inside a row or a panel instead of a box across the page. */
  inline?: boolean
  className?: string
}

/** Something that went wrong, said where it happened. */
export function ErrorNotice({ children, detail, action, inline = false, className }: Props) {
  return (
    <div
      role="alert"
      className={cx(
        "flex flex-wrap items-center gap-x-3 gap-y-1.5",
        inline ? "text-[0.875rem]" : "rounded-[0.2rem] border border-bad/40 bg-bad/10 py-2 pr-2 pl-4 text-[0.95rem]",
        className,
      )}
    >
      <div className={cx("min-w-0 flex-1 basis-[16rem]", !inline && "py-1")}>
        <p className={cx("selectable", inline && "text-bad")}>{children}</p>
        {detail && <div className="selectable mt-1 text-[0.85rem] text-ink-soft">{detail}</div>}
      </div>
      {action && <div className="flex shrink-0 gap-2">{action}</div>}
    </div>
  )
}
