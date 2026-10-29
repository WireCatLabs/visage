import { Check } from "lucide-react"
import { type ComponentType, useEffect, useId, useRef } from "react"
import { useMessages } from "@/i18n"
import { Button } from "@/ui/Button"
import { cx } from "@/ui/cx"
import { Logo } from "@/ui/Logo"
import { reducedMotion } from "@/ui/motion"
import { AgentsMatrix } from "../agents/AgentsMatrix"
import { useSystem } from "../system/store"
import { useTools } from "../tools/store"
import { onboardingMessages } from "./messages"
import { Agents, Choose, Computer, Done, Install, installChosen, leave, SignIn, Welcome } from "./steps"
import { STEPS, type StepId, useOnboarding } from "./store"

const bodies: Record<StepId, ComponentType> = {
  welcome: Welcome,
  computer: Computer,
  choose: Choose,
  install: Install,
  agents: AgentsStep,
  signin: SignIn,
  done: Done,
}

function AgentsStep() {
  const chosen = useOnboarding((s) => s.chosen)
  return <Agents matrix={<AgentsMatrix compact expected={chosen} />} />
}

const indexOf = (id: StepId) => STEPS.findIndex((s) => s.id === id)

/** The setup steps take the sidebar's place while the flow is open. */
export function SetupSteps({ onExit }: { onExit: () => void }) {
  const step = useOnboarding((s) => s.step)
  const m = useMessages(onboardingMessages)
  const current = indexOf(step)
  return (
    <aside
      className="flex w-[12rem] shrink-0 flex-col border-line border-r bg-wall xl:w-[13.5rem]"
      data-tauri-drag-region
    >
      <div className="flex h-[7rem] items-center px-[1.5rem] pb-[0.6rem]" data-tauri-drag-region>
        <Logo className="flex h-[2.3rem] items-center gap-[0.75rem] [&>svg:last-child]:h-[40%]" />
      </div>
      <nav aria-label={m.flow.stepsNav}>
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
                    "relative flex min-h-[2.3rem] w-full items-center gap-[0.75rem] px-[1.5rem] py-[0.3rem] text-left text-[0.95rem] leading-tight",
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
                      "grid size-[1.2rem] shrink-0 place-items-center rounded-full font-mono text-[0.85rem] tabular-nums",
                      here
                        ? "bg-brand text-brand-ink"
                        : i < current
                          ? "bg-app-3 text-ink-soft"
                          : "ring-1 ring-idle ring-inset",
                    )}
                  >
                    {i < current ? <Check className="size-3" strokeWidth={3} /> : i + 1}
                  </span>
                  {m.steps[s.id]}
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
          {m.flow.later}
        </Button>
        <p className="px-[0.75rem] text-[0.85rem] leading-snug text-ink-dim">{m.flow.laterNote}</p>
      </div>
    </aside>
  )
}

export function Onboarding({ onExit, onTour }: { onExit: () => void; onTour: () => void }) {
  const step = useOnboarding((s) => s.step)
  const chosen = useOnboarding((s) => s.chosen)
  const m = useMessages(onboardingMessages)
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
    scroller.current?.scrollTo?.({ top: 0, behavior: reducedMotion() ? "auto" : "smooth" })
    heading.current?.focus({ preventScroll: true })
  }, [step])

  const i = indexOf(step)
  const page = m.pages[step]
  const Body = bodies[step]
  const next = (id?: StepId) => go(id ?? STEPS[Math.min(i + 1, STEPS.length - 1)]?.id ?? "done")
  const toInstall = chosen.filter((id) => !installs[id]?.length).length

  const close = (tour: boolean) => {
    leave()
    finish()
    onExit()
    if (tour) onTour()
  }

  let primary: { label: string; run: () => void }
  if (step === "welcome") primary = { label: m.flow.getStarted, run: () => next() }
  else if (step === "choose" && toInstall > 0 && nodeReady) {
    primary = {
      label: m.flow.installTools(toInstall),
      run: () => {
        installChosen()
        next()
      },
    }
  } else if (step === "done") primary = { label: m.flow.openTools, run: () => close(false) }
  else
    primary = {
      label: m.flow.continue,
      run: () => next(step === "choose" && chosen.length === 0 ? "agents" : undefined),
    }

  const skip = step === "welcome" || step === "done" ? null : () => next(step === "choose" ? "agents" : undefined)

  return (
    <main ref={scroller} aria-labelledby={headingId} className="min-h-0 flex-1 overflow-y-auto">
      <div
        className={cx(
          "mx-auto flex min-h-full max-w-[48rem] flex-col gap-[1.5rem] px-[2.1rem] pt-[2.4rem]",
          step === "welcome" ? "justify-center pb-[4rem]" : "pb-0",
        )}
      >
        {/* Each step slides in where the last one was; the footer below stays put. */}
        <div key={step} className="step-in flex flex-col gap-[1.5rem]">
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
        </div>

        {step === "welcome" ? (
          <div>
            <Button variant="primary" size="lg" onClick={primary.run}>
              {primary.label}
            </Button>
          </div>
        ) : (
          // Pinned to the bottom of the window, so a step's content loading or growing never moves it.
          <div className="sticky bottom-0 mt-auto flex items-center gap-2 border-line border-t bg-wall pt-[1.2rem] pb-[2.2rem]">
            {i > 0 && (
              <Button variant="ghost" onClick={() => go(STEPS[i - 1]?.id ?? "welcome")}>
                {m.flow.back}
              </Button>
            )}
            <span className="flex-1" />
            {skip && (
              <Button variant="ghost" onClick={skip}>
                {m.flow.skip}
              </Button>
            )}
            {step === "done" && <Button onClick={() => close(true)}>{m.flow.tour}</Button>}
            <Button variant="primary" size="lg" onClick={primary.run}>
              {primary.label}
            </Button>
          </div>
        )}
      </div>
    </main>
  )
}
