import { wordmarkPath } from "./wordmark"

export function Monogram({ className = "h-full w-auto" }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden="true">
      <circle cx="16" cy="16" r="16" fill="var(--brand)" />
      <path
        d="M9 21V11l4 4 3-4 3 4 4-4v10"
        fill="none"
        stroke="#fff"
        strokeWidth="2.4"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  )
}

export function Logo({ className }: { className?: string }) {
  return (
    <span className={className} role="img" aria-label="WireCat">
      <Monogram />
      <svg viewBox="0 -18 121.4 20" className="h-[62%] w-auto text-ink" aria-hidden="true">
        <path d={wordmarkPath} fill="currentColor" />
      </svg>
    </span>
  )
}
