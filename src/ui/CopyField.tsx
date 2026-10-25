import { Check, Copy } from "lucide-react"
import { useEffect, useState } from "react"

export function CopyField({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!copied) return
    const t = setTimeout(() => setCopied(false), 1600)
    return () => clearTimeout(t)
  }, [copied])

  const copy = async () => {
    await navigator.clipboard.writeText(value)
    setCopied(true)
  }

  return (
    <div className="flex items-center gap-2 rounded-[0.4rem] border border-line bg-app-2 py-1 pr-1 pl-3">
      <code className="selectable min-w-0 flex-1 truncate font-mono text-[0.875rem] text-ink">{value}</code>
      <button
        type="button"
        onClick={copy}
        aria-label={copied ? "Copied" : label}
        title={copied ? "Copied" : label}
        className="grid size-8 shrink-0 place-items-center rounded-[0.3rem] text-ink-dim transition-colors hover:bg-app-3 hover:text-ink"
      >
        {copied ? <Check className="size-4 text-ok" aria-hidden /> : <Copy className="size-4" aria-hidden />}
      </button>
      <span className="sr-only" aria-live="polite">
        {copied ? "Copied to the clipboard" : ""}
      </span>
    </div>
  )
}
