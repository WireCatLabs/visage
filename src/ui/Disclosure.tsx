import { ChevronRight } from "lucide-react"
import type { ReactNode } from "react"

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
