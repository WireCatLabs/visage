import type { ButtonHTMLAttributes, ReactNode } from "react"
import { cx } from "./cx"

type Variant = "primary" | "secondary" | "ghost" | "danger"
type Size = "lg" | "md" | "sm"

const variants: Record<Variant, string> = {
  primary: "bg-brand text-brand-ink hover:bg-brand-hover border-transparent",
  secondary: "bg-app text-ink border-line-strong hover:bg-app-2 hover:border-ink-dim/60",
  ghost: "bg-transparent text-ink-soft border-transparent hover:bg-app-3 hover:text-ink",
  danger: "bg-app text-bad border-line-strong hover:border-bad/60",
}

const sizes: Record<Size, string> = {
  lg: "h-[2.9rem] px-[1.6rem] text-[1.02rem] rounded-[0.45rem]",
  md: "h-[2.4rem] px-[1.1rem] text-[0.95rem] rounded-[0.4rem]",
  sm: "h-8 px-3 text-[0.875rem] rounded-[0.35rem]",
}

type Props = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size; icon?: ReactNode }

export function Button({ variant = "secondary", size = "md", icon, className, children, type, ...rest }: Props) {
  return (
    <button
      type={type ?? "button"}
      className={cx(
        "inline-flex shrink-0 items-center justify-center gap-2 border font-medium whitespace-nowrap",
        "transition-[background-color,border-color,color,transform] duration-150 ease-out-quart active:translate-y-px",
        "disabled:pointer-events-none disabled:opacity-45",
        variants[variant],
        sizes[size],
        className,
      )}
      {...rest}
    >
      {icon}
      {children}
    </button>
  )
}
