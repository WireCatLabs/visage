import { X } from "lucide-react"
import { useState } from "react"
import { Button } from "@/ui/Button"
import { useNav } from "../nav"
import { useOnboarding } from "../onboarding/store"
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

const STEPS = [
  ["Install", "the tools for the services you use."],
  ["Sign in", "to an account under Manage."],
  ["Connect your agent", "on the Agents page."],
] as const

/** Static text on the first frame, so the list below never moves; only the action at the right waits for the scan. */
export function ToolsIntro() {
  const [hidden, setHidden] = useState(readHidden)
  const none = useTools((s) => s.checked && !Object.values(s.installs).some((copies) => copies.length > 0))
  const go = useNav((s) => s.go)
  if (hidden && !none) return null

  return (
    <section
      aria-label="About WireCat"
      className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3 rounded-[0.45rem] border border-line bg-app-2/60 px-[1.3rem] py-[1rem]"
    >
      <div className="min-w-0 max-w-[80ch] flex-1">
        <p className="text-[0.95rem] leading-relaxed text-ink">
          WireCat gives your AI agent your messengers, meetings, mail and documents. Each service has a small
          command-line tool that your agent runs; everything stays on this computer.
        </p>
        <ol className="mt-2 flex flex-wrap gap-x-6 gap-y-1 text-[0.9rem] text-ink-soft">
          {STEPS.map(([lead, rest], n) => (
            <li key={lead}>
              <span className="mr-1.5 font-mono text-ink-dim">{n + 1}</span>
              {lead === "Connect your agent" ? (
                <button
                  type="button"
                  onClick={() => go("agents")}
                  className="font-medium text-brand hover:text-brand-hover hover:underline hover:underline-offset-4"
                >
                  {lead}
                </button>
              ) : (
                <span className="font-medium text-ink">{lead}</span>
              )}{" "}
              {rest}
            </li>
          ))}
        </ol>
      </div>
      {none ? (
        <Button variant="primary" onClick={() => useOnboarding.getState().reopen("choose")}>
          Choose tools to install
        </Button>
      ) : (
        <Button
          size="sm"
          variant="ghost"
          aria-label="Hide this introduction"
          title="Hide this introduction"
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
