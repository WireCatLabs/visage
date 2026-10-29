import { X } from "lucide-react"
import { useState } from "react"
import { useMessages } from "@/i18n"
import { Button } from "@/ui/Button"
import { useNav } from "../nav"
import { useOnboarding } from "../onboarding/store"
import { toolsMessages } from "./messages"
import { useTools } from "./store"

const KEY = "wirecat.tools.intro"

function readHidden() {
  try {
    return localStorage.getItem(KEY) === "hidden"
  } catch {
    return false
  }
}

function writeHidden() {
  try {
    localStorage.setItem(KEY, "hidden")
  } catch {
    // Private windows may refuse storage; the intro then simply returns next time.
  }
}

/** Static text on the first frame, so the list below never moves; only the action at the right waits for the scan. */
export function ToolsIntro() {
  const [hidden, setHidden] = useState(readHidden)
  const none = useTools((s) => s.checked && !Object.values(s.installs).some((copies) => copies.length > 0))
  const go = useNav((s) => s.go)
  const m = useMessages(toolsMessages).intro
  if (hidden && !none) return null
  const em = (text: string) => <span className="font-medium text-ink">{text}</span>
  const link = (text: string) => (
    <button
      type="button"
      onClick={() => go("agents")}
      className="font-medium text-brand hover:text-brand-hover hover:underline hover:underline-offset-4"
    >
      {text}
    </button>
  )
  const steps = [m.install(em), m.signIn(em), m.connect(link)]

  return (
    <section
      aria-label={m.label}
      className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3 rounded-[0.45rem] border border-line bg-app-2/60 px-[1.3rem] py-[1rem]"
    >
      <div className="min-w-0 max-w-[80ch] flex-1">
        <p className="text-[0.95rem] leading-relaxed text-ink">{m.text}</p>
        <ol className="mt-2 flex flex-wrap gap-x-6 gap-y-1 text-[0.9rem] text-ink-soft">
          {steps.map((step, n) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: three fixed steps, never reordered
            <li key={n}>
              <span className="mr-1.5 font-mono text-ink-dim">{n + 1}</span>
              {step}
            </li>
          ))}
        </ol>
      </div>
      {none ? (
        <Button variant="primary" onClick={() => useOnboarding.getState().reopen("choose")}>
          {m.choose}
        </Button>
      ) : (
        <Button
          size="sm"
          variant="ghost"
          aria-label={m.hide}
          title={m.hide}
          icon={<X className="size-4" aria-hidden />}
          onClick={() => {
            writeHidden()
            setHidden(true)
          }}
        />
      )}
    </section>
  )
}
