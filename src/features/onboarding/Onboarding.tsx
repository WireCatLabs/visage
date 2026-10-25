import { Check } from "lucide-react"
import { type ComponentType, useEffect, useId, useRef } from "react"
import { Button } from "@/ui/Button"
import { cx } from "@/ui/cx"
import { Logo } from "@/ui/Logo"
import { useSystem } from "../system/store"
import { useTools } from "../tools/store"
import { Agents, Choose, Computer, Done, Install, installChosen, SignIn, Welcome } from "./steps"
import { STEPS, type StepId, useOnboarding } from "./store"

type Page = { title: string; lead: string; body: ComponentType }

const pages: Record<StepId, Page> = {
  welcome: {
    title: "Welcome to WireCat",
    lead: "Connect your AI agent (Claude Code, Codex and others) to your own messages, mail, meetings and files.",
    body: Welcome,
  },
  computer: {
    title: "Your computer",
    lead: "WireCat tools run on Node.js and install with npm. WireCat Desktop itself runs without them.",
    body: Computer,
  },
  choose: {
    title: "Choose tools",
    lead: "Pick the services your agent should reach. You can add or remove tools later.",
    body: Choose,
  },
  install: {
    title: "Install",
    lead: "Each tool is installed from npm and checked that it starts. One runs at a time.",
    body: Install,
  },
  agents: {
    title: "Connect agents",
    lead: "Your agent learns to use each tool from a skill.",
    body: Agents,
  },
  signin: {
    title: "Sign in",
    lead: "Each tool signs in with its own setup, in a terminal window. Name a profile for each account, such as personal or work.",
    body: SignIn,
  },
  done: {
    title: "You are set up",
    lead: "Your tools are on the Tools page. Help, the question mark at the top, has a short tour of the window.",
    body: Done,
  },
}

const indexOf = (id: StepId) => STEPS.findIndex((s) => s.id === id)

/** The setup steps take the sidebar's place while the flow is open. */
export function SetupSteps({ onExit }: { onExit: () => void }) {
  const step = useOnboarding((s) => s.step)
  const current = indexOf(step)
  return (
    <aside
      className="flex w-[12rem] shrink-0 flex-col border-line border-r bg-wall xl:w-[13.5rem]"
      data-tauri-drag-region
    >
      <div className="flex h-[7rem] items-center px-[1.5rem] pb-[0.6rem]" data-tauri-drag-region>
        <Logo className="flex h-[2.3rem] items-center gap-[0.75rem] [&>svg:last-child]:h-[40%]" />
      </div>
      <nav aria-label="Setup steps">
        <ol className="flex flex-col gap-[0.15rem]">
          {STEPS.map((s, i) => {
            const here = i === current
            return (
              <li key={s.id}>
                <button
                  type="button"
                  aria-current={here ? "step" : undefined}
                  onClick={() => useOnboarding.getState().go(s.id)}
                  className={cx(
                    "relative flex h-[2.3rem] w-full items-center gap-[0.75rem] px-[1.5rem] text-left text-[0.95rem]",
                    here ? "font-semibold text-ink" : "text-ink-soft hover:text-ink",
                  )}
                >
                  <span
                    aria-hidden
                    className={cx(
                      "absolute inset-y-0 left-0 w-[4px] rounded-r-full bg-brand transition-transform duration-200",
                      here ? "scale-y-100" : "scale-y-0",
                    )}
                  />
                  <span
                    aria-hidden
                    className={cx(
                      "grid size-[1.2rem] shrink-0 place-items-center rounded-full font-mono text-[0.8rem] tabular-nums",
                      here
                        ? "bg-brand text-brand-ink"
                        : i < current
                          ? "bg-app-3 text-ink-soft"
                          : "ring-1 ring-idle ring-inset",
                    )}
                  >
                    {i < current ? <Check className="size-3" strokeWidth={3} /> : i + 1}
                  </span>
                  {s.label}
                </button>
              </li>
            )
          })}
        </ol>
      </nav>
      <div className="mt-auto flex flex-col gap-[0.4rem] px-[1.1rem] pb-[1.6rem]">
        <Button
          variant="ghost"
          size="sm"
          className="justify-start"
          onClick={() => {
            leave()
            useOnboarding.getState().later()
            onExit()
          }}
        >
          Set up later
        </Button>
        <p className="px-[0.75rem] text-[0.8rem] leading-snug text-ink-dim">Finish later from the sidebar.</p>
      </div>
    </aside>
  )
}

// Successful installs would otherwise each leave an open "installed and runs" panel on the Tools page.
function leave() {
  const { sessions, dismiss } = useTools.getState()
  for (const [id, s] of Object.entries(sessions)) if (s.outcome?.event === "done") dismiss(id)
}

export function Onboarding({ onExit, onTour }: { onExit: () => void; onTour: () => void }) {
  const step = useOnboarding((s) => s.step)
  const chosen = useOnboarding((s) => s.chosen)
  const nodeReady = useSystem((s) => s.readiness?.node.ok ?? false)
  const installs = useTools((s) => s.installs)
  const heading = useRef<HTMLHeadingElement>(null)
  const scroller = useRef<HTMLElement>(null)
  const headingId = useId()
  const shown = useRef(step)
  const { go, finish } = useOnboarding.getState()

  useEffect(() => {
    useTools.getState().refresh()
  }, [])

  // Move focus to the new heading so a screen reader announces the step; not on first open, where it would jump.
  useEffect(() => {
    if (shown.current === step) return
    shown.current = step
    scroller.current?.scrollTo?.({ top: 0 })
    heading.current?.focus()
  }, [step])

  const i = indexOf(step)
  const page = pages[step]
  const Body = page.body
  const next = (id?: StepId) => go(id ?? STEPS[Math.min(i + 1, STEPS.length - 1)]?.id ?? "done")
  const toInstall = chosen.filter((id) => !installs[id]?.length).length

  const close = (tour: boolean) => {
    leave()
    finish()
    onExit()
    if (tour) onTour()
  }

  let primary: { label: string; run: () => void }
  if (step === "welcome") primary = { label: "Get started", run: () => next() }
  else if (step === "choose" && toInstall > 0 && nodeReady) {
    primary = {
      label: `Install ${toInstall} ${toInstall === 1 ? "tool" : "tools"}`,
      run: () => {
        installChosen()
        next()
      },
    }
  } else if (step === "done") primary = { label: "Open Tools", run: () => close(false) }
  else primary = { label: "Continue", run: () => next(step === "choose" && chosen.length === 0 ? "agents" : undefined) }

  const skip = step === "welcome" || step === "done" ? null : () => next(step === "choose" ? "agents" : undefined)

  return (
    <main ref={scroller} aria-labelledby={headingId} className="min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto flex min-h-full max-w-[48rem] flex-col gap-[1.5rem] px-[2.1rem] pt-[2.4rem] pb-[2.2rem]">
        <div className="flex flex-col gap-[0.8rem]">
          <h1
            ref={heading}
            id={headingId}
            tabIndex={-1}
            className="font-display text-[2.1rem] font-extrabold leading-none tracking-[-0.035em]"
            style={{ outline: "none" }}
          >
            {page.title}
          </h1>
          <p className="max-w-[60ch] text-[1.05rem] leading-relaxed text-ink-soft">{page.lead}</p>
        </div>

        <Body />

        <div className="mt-auto flex items-center gap-2 border-line border-t pt-[1.2rem]">
          {i > 0 && (
            <Button variant="ghost" onClick={() => go(STEPS[i - 1]?.id ?? "welcome")}>
              Back
            </Button>
          )}
          <span className="flex-1" />
          {skip && (
            <Button variant="ghost" onClick={skip}>
              Skip
            </Button>
          )}
          {step === "done" && <Button onClick={() => close(true)}>Take the tour</Button>}
          <Button variant="primary" onClick={primary.run}>
            {primary.label}
          </Button>
        </div>
      </div>
    </main>
  )
}
