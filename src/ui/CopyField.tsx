import { Check, Copy } from "lucide-react"
import { useEffect, useState } from "react"
import { useMessages } from "@/i18n"
import { cx } from "./cx"
import { uiMessages } from "./messages"

/** `wrap`: a command that must be read whole before it runs wraps instead of being cut short. */
export function CopyField({ value, label, wrap = false }: { value: string; label: string; wrap?: boolean }) {
  const m = useMessages(uiMessages)
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

  // Several lines are commands to read before running them, so none is cut short.
  const lines = wrap || value.includes("\n")
  return (
    <div
      className={cx(
        "flex gap-2 rounded-[0.4rem] border border-line bg-app-2 py-1 pr-1 pl-3",
        lines ? "items-start" : "items-center",
      )}
    >
      <code
        className={cx(
          "selectable min-w-0 flex-1 font-mono text-[0.875rem] text-ink",
          lines ? "py-1 whitespace-pre-wrap wrap-anywhere" : "truncate",
        )}
      >
        {value}
      </code>
      <button
        type="button"
        onClick={copy}
        aria-label={copied ? m.copied : label}
        title={copied ? m.copied : label}
        className="grid size-8 shrink-0 place-items-center rounded-[0.3rem] text-ink-dim transition-colors hover:bg-app-3 hover:text-ink"
      >
        {copied ? <Check className="size-4 text-ok" aria-hidden /> : <Copy className="size-4" aria-hidden />}
      </button>
      <span className="sr-only" aria-live="polite">
        {copied ? m.copiedAnnounce : ""}
      </span>
    </div>
  )
}
