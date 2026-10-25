import { ChevronRight } from "lucide-react"
import type { ReactNode } from "react"
import { Skeleton } from "./Skeleton"

export function Disclosure({ summary, children }: { summary: ReactNode; children: ReactNode }) {
  return (
    <details className="group">
      <summary className="inline-flex cursor-pointer list-none items-center gap-1 rounded text-[0.875rem] font-medium text-brand hover:text-brand-hover [&::-webkit-details-marker]:hidden">
        <ChevronRight className="size-4 transition-transform duration-150 group-open:rotate-90" aria-hidden />
        {summary}
      </summary>
      <div className="mt-2">{children}</div>
    </details>
  )
}

/** The closed summary line of a Disclosure whose text is still loading, at the same height. */
export function DisclosureSkeleton({ chars }: { chars: number }) {
  return (
    <div>
      <span className="inline-flex items-center gap-1 text-[0.875rem]">
        <span className="size-4" />
        <Skeleton chars={chars} />
      </span>
    </div>
  )
}
