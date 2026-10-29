import { Bot, HardDrive, LogIn, RefreshCw, Terminal } from "lucide-react"
import { type ReactNode, useEffect, useRef, useState } from "react"
import { type CatalogTool, findTool, ownerId, samePackage, signsInHere, tools } from "@/domain/catalog"
import { toolStatus } from "@/domain/status"
import { formatList, useMessages } from "@/i18n"
import { platform } from "@/platform/bridge"
import type { Profile } from "@/platform/schemas"
import { Button } from "@/ui/Button"
import { cx } from "@/ui/cx"
import { ErrorNotice } from "@/ui/ErrorNotice"
import { Lamp, type LampTone } from "@/ui/Lamp"
import { Pill } from "@/ui/Pill"
import { Skeleton, StableText } from "@/ui/Skeleton"
import { useNav } from "../nav"
import { ReportThis } from "../report/ReportThis"
import { useSignIn } from "../signin/store"
import { NodeNotice } from "../system/NodeNotice"
import { useSystem } from "../system/store"
import { openConnect } from "../tools/go"
import { FinishInTerminal, ManualSetup, NewProfile, useProfiles } from "../tools/Health"
import { toolsMessages } from "../tools/messages"
import { useTools } from "../tools/store"
import { ToolIcon } from "../tools/ToolIcon"
import { toolText } from "../tools/tool-text"
import { onboardingMessages } from "./messages"
import { useOnboarding } from "./store"

const rack = "overflow-hidden rounded-[0.2rem] border border-line-strong bg-app"
const row = "flex items-center gap-[0.9rem] border-line border-b px-[1.3rem] py-[0.9rem] last:border-b-0"

function Fact({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
  return (
    <li className={cx(row, "items-start py-[1.1rem]")}>
      <span className="mt-[0.1rem] text-brand">{icon}</span>
      <div className="min-w-0">
        <h3 className="text-[1.08rem] font-semibold leading-tight">{title}</h3>
        <p className="mt-1 text-[0.95rem] leading-relaxed text-ink-soft">{children}</p>
      </div>
    </li>
  )
}

export function Welcome() {
  const m = useMessages(onboardingMessages).welcome
  const icon = "size-[1.5rem]"
  return (
    <>
      <ul aria-label={m.list} className={rack}>
        <Fact icon={<HardDrive className={icon} strokeWidth={1.6} aria-hidden />} title={m.localTitle}>
          {m.local}
        </Fact>
        <Fact icon={<Terminal className={icon} strokeWidth={1.6} aria-hidden />} title={m.openTitle}>
          {m.open}
        </Fact>
        <Fact icon={<Bot className={icon} strokeWidth={1.6} aria-hidden />} title={m.agentTitle}>
          {m.agent}
        </Fact>
      </ul>
      <p className="text-[0.95rem] text-ink-soft">{m.time}</p>
    </>
  )
}

export function Computer() {
  const r = useSystem((s) => s.readiness)
  const refreshing = useTools((s) => s.refreshing)
  const m = useMessages(onboardingMessages).computer
  const items: { key: string; label: string; value: string; tone: LampTone; note?: string | null | undefined }[] = [
    { key: "system", label: m.system, value: r ? r.os : "…", tone: r ? "ok" : "idle" },
    {
      key: "node",
      label: "Node.js",
      value: !r ? "…" : (r.node.version ?? m.notFound),
      tone: !r ? "idle" : r.node.ok ? "ok" : "bad",
      note: r?.node.version ? r.node.problem : null,
    },
    {
      key: "npm",
      label: "npm",
      value: !r ? "…" : (r.npm.version ?? m.notFound),
      tone: !r ? "idle" : r.npm.ok ? "ok" : "bad",
      note: r?.npm.version ? r.npm.problem : null,
    },
  ]
  const ready = r?.node.ok && r.npm.ok && r.npmPrefixWritable !== false

  return (
    <>
      <ul aria-label={m.list} className={rack}>
        {items.map((i) => (
          <li key={i.key} className={row}>
            <Lamp tone={i.tone} />
            <span className="min-w-[7rem] shrink-0 font-medium">{i.label}</span>
            <span className="selectable min-w-0 flex-1 truncate font-mono text-[1.02rem] tabular-nums">{i.value}</span>
            {i.note && <span className="truncate text-[0.9rem] text-bad">{i.note}</span>}
          </li>
        ))}
      </ul>
      <NodeNotice />
      <div className="flex flex-wrap items-center gap-4">
        <p aria-live="polite" className="flex-1 text-[0.95rem] text-ink-soft">
          {!r ? m.checkingComputer : ready ? m.ready : null}
        </p>
        <Button
          size="sm"
          variant="ghost"
          disabled={refreshing}
          onClick={() => useTools.getState().refresh(true)}
          icon={<RefreshCw className={cx("size-4", refreshing && "animate-spin")} aria-hidden />}
        >
          <StableText value={refreshing ? m.checking : m.again} variants={[m.checking, m.again]} />
        </Button>
      </div>
    </>
  )
}

const installedVersion = (id: string) => useTools.getState().installs[id]?.[0]?.version ?? null

export function Choose() {
  const chosen = useOnboarding((s) => s.chosen)
  const installs = useTools((s) => s.installs)
  const toggle = useOnboarding((s) => s.toggle)
  const tm = useMessages(toolsMessages)
  const m = useMessages(onboardingMessages).choose

  return (
    <fieldset className="min-w-0">
      <legend className="sr-only">{m.legend}</legend>
      <ul className={cx(rack, "grid sm:grid-cols-2")}>
        {tools.map((t) => {
          const copies = installs[t.id]
          const installed = Boolean(copies?.length)
          const checked = chosen.includes(t.id)
          const cell = "flex h-full items-start gap-[0.8rem] px-[1.1rem] py-[1rem]"
          const body = (
            <>
              <ToolIcon id={t.id} className="size-[1.5rem] shrink-0 text-ink" />
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-baseline gap-x-[0.5rem]">
                  <span className="text-[1.02rem] font-semibold">{t.name}</span>
                  <span className="font-mono text-[0.9rem] text-ink-soft">{t.bin}</span>
                  {t.partOf && <Pill>{m.partOf(findTool(t.partOf)?.name ?? t.partOf)}</Pill>}
                  {installed && <Pill tone="brand">{m.installed}</Pill>}
                </span>
                <span className="mt-0.5 block text-[0.9rem] leading-snug text-ink-soft">{toolText(tm, t).tagline}</span>
              </span>
            </>
          )
          // An installed tool gets no checkbox: a ticked, greyed box would read as a choice made for the owner.
          return (
            <li key={t.id} className="-mr-px -mb-px border-line border-r border-b">
              {installed ? (
                <div className={cell}>
                  <span aria-hidden className="size-[1.05rem] shrink-0" />
                  {body}
                </div>
              ) : (
                <label className={cx(cell, checked ? "bg-brand-soft/50 hover:bg-brand-soft/70" : "hover:bg-app-2")}>
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggle(t.id)}
                    className="mt-[0.2rem] size-[1.05rem] shrink-0 accent-brand"
                  />
                  {body}
                </label>
              )}
            </li>
          )
        })}
      </ul>
    </fieldset>
  )
}

/** Queues the chosen tools that are not on the computer yet; the store runs them one by one. */
export function installChosen() {
  const { chosen } = useOnboarding.getState()
  const st = useTools.getState()
  for (const id of chosen) {
    if (!installedVersion(id) && !st.sessions[ownerId(id)]) st.install(id)
  }
}

function Progress({ tool }: { tool: CatalogTool }) {
  const installs = useTools((s) => s.installs[tool.id])
  const session = useTools((s) => s.sessions[ownerId(tool.id)])
  const status = toolStatus(installs, undefined, session)
  const outcome = session?.outcome
  const m = useMessages(onboardingMessages).install
  const tm = useMessages(toolsMessages).install
  const version = (v: string) => <span className="font-mono tabular-nums">{v}</span>

  let tone: LampTone = "idle"
  let text: ReactNode = m.notInstalled
  if (status.kind === "checking") text = m.checking
  else if (session && !outcome) {
    tone = session.step === "queued" ? "idle" : "busy"
    text = session.step === "queued" ? m.queued : m.step(tm.steps.install[session.step] ?? m.installing)
  } else if (outcome?.event === "failed") {
    tone = "bad"
    const message =
      outcome.reason === "cancelled"
        ? tm.cancelled.install
        : outcome.reason === "timeout"
          ? tm.timedOut.install
          : outcome.reason === "network"
            ? tm.network
            : outcome.message
    text = <span className="text-bad">{message}</span>
  } else if (outcome?.event === "done") {
    tone = "ok"
    text = m.installed(version(outcome.version))
  } else if (status.kind === "ready" || status.kind === "outdated") {
    tone = "ok"
    text = m.already(version(status.version))
  }

  return (
    <li className={row}>
      <Lamp tone={tone} {...(typeof text === "string" ? { label: text } : {})} />
      <ToolIcon id={tool.id} className="size-[1.5rem] shrink-0 text-ink" />
      <span className="w-[9rem] shrink-0 font-semibold">{tool.name}</span>
      <span aria-live="polite" className="min-w-0 flex-1 text-[0.95rem] text-ink-soft">
        {text}
      </span>
      {outcome?.event === "failed" && outcome.reason !== "cancelled" && session && (
        <ReportThis
          what={`Installing ${tool.name}`}
          tool={tool.id}
          error={[outcome.message, outcome.hint].filter(Boolean).join(" ")}
          log={session.log.slice(-200)}
        />
      )}
      {outcome?.event === "failed" && (
        <Button size="sm" onClick={() => useTools.getState().install(tool.id)}>
          {m.tryAgain}
        </Button>
      )}
    </li>
  )
}

export function Install() {
  const chosen = useOnboarding((s) => s.chosen)
  const nodeReady = useSystem((s) => s.readiness?.node.ok ?? false)
  const pending = useTools((s) => chosen.some((id) => !s.installs[id]?.length && !s.sessions[ownerId(id)]))
  const list = tools.filter((t) => chosen.includes(t.id))
  const m = useMessages(onboardingMessages).install

  if (list.length === 0) {
    return (
      <div className="flex flex-wrap items-center gap-4">
        <p className="flex-1 text-[0.95rem] text-ink-soft">{m.none}</p>
        <Button size="sm" onClick={() => useOnboarding.getState().go("choose")}>
          {m.choose}
        </Button>
      </div>
    )
  }

  return (
    <>
      <NodeNotice />
      <ul aria-label={m.list} className={rack}>
        {list.map((t) => (
          <Progress key={t.id} tool={t} />
        ))}
      </ul>
      {pending && nodeReady && (
        <div>
          <Button size="sm" onClick={installChosen}>
            {m.rest}
          </Button>
        </div>
      )}
      <p className="text-[0.95rem] text-ink-soft">{m.note}</p>
    </>
  )
}

/** The tools this setup is about: the ones chosen in this flow and the ones already on the computer. */
function useSetupTools() {
  const installs = useTools((s) => s.installs)
  const chosen = useOnboarding((s) => s.chosen)
  return tools.filter((t) => chosen.includes(t.id) || installs[t.id]?.length)
}

/**
 * `matrix` is the slot for the Agents feature's compact agents-by-skills matrix; until it is passed, the step says
 * how a skill gets added today.
 */
export function Agents({ matrix }: { matrix?: ReactNode }) {
  const list = useSetupTools().filter((t) => t.skill)
  const m = useMessages(onboardingMessages).agents
  if (matrix) return <>{matrix}</>
  return (
    <div className={cx(rack, "flex items-start gap-[0.9rem] px-[1.3rem] py-[1.1rem]")}>
      <Bot className="mt-[0.1rem] size-[1.5rem] shrink-0 text-brand" strokeWidth={1.6} aria-hidden />
      <div className="flex min-w-0 flex-col gap-[0.7rem]">
        <h3 className="text-[1.08rem] font-semibold leading-tight">{m.title}</h3>
        <p className="max-w-[65ch] text-[0.95rem] leading-relaxed text-ink-soft">{m.text}</p>
        {list.length > 0 && (
          <ul aria-label={m.list} className="flex flex-col gap-1">
            {list.map((t) => (
              <li key={t.id} className="flex items-baseline gap-3 text-[0.95rem]">
                <span className="min-w-[7.5rem] shrink-0 text-ink-soft">{t.name}</span>
                <code className="selectable font-mono text-[0.9rem] text-ink">{t.bin} skill install</code>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

/** Without `onSignIn` the tool has no sign-in of its own: a listed account is simply there. */
function ProfileState({
  profile,
  onSignIn,
  here,
}: {
  profile: Profile
  onSignIn: (() => void) | undefined
  here: boolean
}) {
  const m = useMessages(onboardingMessages).signIn
  const name = <span className="font-mono font-medium text-ink">{profile.name}</span>
  if (!onSignIn) {
    return (
      <li className="flex min-h-8 items-center gap-x-[0.6rem]">
        <Lamp size="sm" tone="ok" />
        <span className="min-w-0 flex-1 text-[0.95rem] text-ink-soft">{m.added(name)}</span>
      </li>
    )
  }
  return (
    <li className="flex min-h-8 flex-wrap items-center gap-x-[0.6rem] gap-y-1">
      <Lamp size="sm" tone={profile.signedIn ? "ok" : "idle"} />
      <span className="min-w-0 flex-1 text-[0.95rem] text-ink-soft">
        {profile.signedIn === true
          ? m.signedIn(name)
          : profile.signedIn === false
            ? m.signedOut(name)
            : m.unknown(name)}
      </span>
      {profile.signedIn !== true && (
        <Button
          size="sm"
          variant={profile.signedIn === false ? "primary" : "ghost"}
          onClick={onSignIn}
          icon={here ? <LogIn className="size-4" aria-hidden /> : <Terminal className="size-4" aria-hidden />}
        >
          {here ? m.signIn : m.inTerminal}
        </Button>
      )}
    </li>
  )
}

const signInBlock = "flex flex-col gap-[0.9rem] border-line border-b px-[1.3rem] py-[1.1rem] last:border-b-0"
const accountsArea = "flex flex-col gap-[0.9rem] sm:pl-[2.4rem]"

function SignInHeader({ tool }: { tool: CatalogTool }) {
  const m = useMessages(onboardingMessages).signIn
  return (
    <div className="flex items-start gap-[0.9rem]">
      <ToolIcon id={tool.id} className="mt-[0.05rem] size-[1.5rem] shrink-0 text-ink" />
      <div className="min-w-0">
        <h3 className="text-[1.08rem] font-semibold leading-tight">{tool.name}</h3>
        {tool.signIn && (
          <p className="mt-1 text-[0.95rem] leading-relaxed text-ink-soft">{m.gives[tool.id] ?? tool.signIn.gives}</p>
        )}
      </div>
    </div>
  )
}

/** One account line and the "Add another account" line: the usual shape once the accounts are read. */
function AccountsSkeleton({ tool }: { tool: CatalogTool }) {
  const m = useMessages(onboardingMessages).signIn
  return (
    <>
      <Skeleton className="h-8 w-full" label={m.reading(tool.name)} />
      <Skeleton className="h-8 w-[10.5rem]" />
    </>
  )
}

function PendingSignInRow({ tool }: { tool: CatalogTool }) {
  return (
    <li className={signInBlock}>
      <SignInHeader tool={tool} />
      <div className={accountsArea}>
        <AccountsSkeleton tool={tool} />
      </div>
    </li>
  )
}

function SignInRow({ tool }: { tool: CatalogTool }) {
  const { profiles, error, loading, reload } = useProfiles(tool.id)
  const [waiting, setWaiting] = useState(false)
  const [adding, setAdding] = useState(false)
  const [openError, setOpenError] = useState<string | null>(null)
  const m = useMessages(onboardingMessages).signIn
  const manual = !tool.setup
  const count = profiles?.length ?? 0
  const seen = useRef(count)

  // The form opens only on a click, so it closes by itself once the account it was for shows up.
  useEffect(() => {
    if (count > seen.current) setAdding(false)
    seen.current = count
  }, [count])

  const signInAgain = async (profile: string) => {
    if (signsInHere(tool)) return useSignIn.getState().start(tool.id, profile, reload)
    try {
      await platform.openSetup(tool.id, profile)
      setOpenError(null)
      setWaiting(true)
    } catch (e) {
      setOpenError(String(e))
    }
  }

  return (
    <li className={signInBlock}>
      <SignInHeader tool={tool} />
      <div className={accountsArea}>
        {error ? (
          <ErrorNotice
            inline
            action={<ReportThis what={`Listing ${tool.name} accounts`} tool={tool.id} error={error} />}
          >
            {m.listFailed(error)}
          </ErrorNotice>
        ) : profiles === undefined ? (
          <AccountsSkeleton tool={tool} />
        ) : (
          <ul aria-label={m.accounts(tool.name)} className="flex flex-col gap-1">
            {count > 0 ? (
              profiles?.map((p) => (
                <ProfileState
                  key={p.name}
                  profile={p}
                  here={signsInHere(tool)}
                  onSignIn={manual ? undefined : () => signInAgain(p.name)}
                />
              ))
            ) : (
              <li className="flex min-h-8 items-center gap-x-[0.6rem]">
                <Lamp size="sm" tone="idle" />
                <span className="text-[0.95rem] font-medium text-ink">{m.noAccount(tool.name)}</span>
              </li>
            )}
          </ul>
        )}
        {openError && (
          <ErrorNotice
            inline
            action={<ReportThis what="Opening a terminal to sign in" tool={tool.id} error={openError} />}
          >
            {openError}
          </ErrorNotice>
        )}
        {waiting && <FinishInTerminal onCheck={reload} checking={loading} />}
        {adding ? (
          <>
            {tool.signIn && (
              <p className="max-w-[65ch] text-[0.9rem] leading-relaxed text-ink-soft">
                <span className="font-medium text-ink">{manual ? m.needs : m.willAsk}</span>
                {m.asks[tool.id] ?? tool.signIn.asks}
                {tool.signIn.guide && !manual && (
                  <>
                    {" "}
                    <a
                      href={tool.signIn.guide}
                      onClick={(e) => {
                        e.preventDefault()
                        if (tool.signIn?.guide) platform.openUrl(tool.signIn.guide)
                      }}
                      className="font-medium text-brand hover:text-brand-hover hover:underline hover:underline-offset-4"
                    >
                      {m.guide}
                    </a>
                  </>
                )}
              </p>
            )}
            {manual ? (
              <ManualSetup tool={tool} onCheck={reload} checking={loading} />
            ) : (
              <NewProfile tool={tool} label={count ? m.nameAnother : m.nameThis} onCheck={reload} checking={loading} />
            )}
          </>
        ) : profiles === undefined && !error ? null : (
          <div>
            <Button
              size="sm"
              variant={count ? "ghost" : "primary"}
              className={count ? "-ml-3" : undefined}
              onClick={() => setAdding(true)}
            >
              {count ? m.addAnother : m.add}
            </Button>
          </div>
        )}
      </div>
    </li>
  )
}

export function SignIn() {
  const installs = useTools((s) => s.installs)
  const failed = useTools((s) => s.error !== null)
  const m = useMessages(onboardingMessages).signIn
  const list = useSetupTools()
  const detected = Object.keys(installs).length > 0
  const signsIn = (t: CatalogTool) => Boolean(t.setup || t.signIn?.command)
  const ready = list.filter((t) => signsIn(t) && installs[t.id]?.length)
  const waiting = list.filter((t) => signsIn(t) && !installs[t.id]?.length)
  const noSignIn = list.filter((t) => !signsIn(t))

  // Until the tools are found, the chosen ones stand in: they are the ones just installed.
  if (!detected && !failed) {
    const chosen = list.filter(signsIn)
    if (chosen.length === 0) return <Skeleton className="h-24 w-full" label={m.looking} />
    return (
      <ul aria-label={m.list} className={rack}>
        {chosen.map((t) => (
          <PendingSignInRow key={t.id} tool={t} />
        ))}
      </ul>
    )
  }

  return (
    <>
      {ready.length > 0 ? (
        <ul aria-label={m.list} className={rack}>
          {ready.map((t) => (
            <SignInRow key={t.id} tool={t} />
          ))}
        </ul>
      ) : (
        <p className="text-[0.95rem] text-ink-soft">{m.noneNeeded}</p>
      )}
      {waiting.length > 0 && (
        <p className="text-[0.95rem] text-ink-soft">
          {m.later(waiting.length, formatList(waiting.map((t) => t.name)))}
        </p>
      )}
      {noSignIn.length > 0 && (
        <p className="text-[0.95rem] text-ink-soft">
          {m.noSignIn(noSignIn.length, formatList(noSignIn.map((t) => t.name)))}
        </p>
      )}
    </>
  )
}

// Successful installs would otherwise each leave an open "installed and runs" panel on the Tools page.
export function leave() {
  const { sessions, dismiss } = useTools.getState()
  for (const [id, s] of Object.entries(sessions))
    if (s.outcome?.event === "done") for (const t of samePackage(id)) dismiss(t.id)
}

export function Done() {
  const chosen = useOnboarding((s) => s.chosen)
  const installs = useTools((s) => s.installs)
  const list = tools.filter((t) => chosen.includes(t.id))
  const browserReady = list.find((t) => t.mcpServer && installs[t.id]?.[0]?.version)
  const m = useMessages(onboardingMessages).done
  // Rule 9: after the goal, the next things worth doing, each one leaving the setup for the page that does it.
  const go = (then: () => void) => {
    leave()
    useOnboarding.getState().finish()
    then()
  }
  return (
    <div className="flex flex-col gap-[1.5rem]">
      {list.length > 0 && (
        <ul aria-label={m.list} className={rack}>
          {list.map((t) => {
            const version = installs[t.id]?.[0]?.version
            return (
              <li key={t.id} className={row}>
                <Lamp tone={version ? "ok" : "idle"} />
                <ToolIcon id={t.id} className="size-[1.5rem] shrink-0 text-ink" />
                <span className="flex-1 font-semibold">{t.name}</span>
                <span className={cx("font-mono text-[1.02rem] tabular-nums", version ? "text-ink" : "text-ink-soft")}>
                  {version ?? m.notInstalled}
                </span>
              </li>
            )
          })}
        </ul>
      )}
      <section aria-label={m.next} className="flex flex-col gap-2">
        <h2 className="text-[1.05rem] font-semibold">{m.next}</h2>
        <div className="flex flex-wrap gap-2">
          {browserReady && (
            <Button onClick={() => go(() => openConnect(browserReady.id))}>{m.connect(browserReady.name)}</Button>
          )}
          <Button variant="ghost" onClick={() => go(() => useNav.getState().go("agents"))}>
            {m.agents}
          </Button>
        </div>
      </section>
    </div>
  )
}
