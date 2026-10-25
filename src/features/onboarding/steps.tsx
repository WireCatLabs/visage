import { Bot, HardDrive, RefreshCw, Terminal } from "lucide-react"
import { type ReactNode, useEffect, useRef, useState } from "react"
import { type CatalogTool, findTool, ownerId, tools } from "@/domain/catalog"
import { STEPS as INSTALL_STEPS, toolStatus } from "@/domain/status"
import { platform } from "@/platform/bridge"
import type { Profile } from "@/platform/schemas"
import { Button } from "@/ui/Button"
import { cx } from "@/ui/cx"
import { ErrorNotice } from "@/ui/ErrorNotice"
import { Lamp, type LampTone } from "@/ui/Lamp"
import { Pill } from "@/ui/Pill"
import { Skeleton, StableText } from "@/ui/Skeleton"
import { ReportThis } from "../report/ReportThis"
import { NodeNotice } from "../system/NodeNotice"
import { useSystem } from "../system/store"
import { FinishInTerminal, ManualSetup, NewProfile, useProfiles } from "../tools/Health"
import { useTools } from "../tools/store"
import { ToolIcon } from "../tools/ToolIcon"
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
  const icon = "size-[1.5rem]"
  return (
    <>
      <ul aria-label="What WireCat does" className={rack}>
        <Fact
          icon={<HardDrive className={icon} strokeWidth={1.6} aria-hidden />}
          title="Everything stays on this computer"
        >
          The tools keep your messages, mail, meetings and files in storage on this computer, not in a WireCat cloud.
        </Fact>
        <Fact
          icon={<Terminal className={icon} strokeWidth={1.6} aria-hidden />}
          title="Open tools you could run yourself"
        >
          Each integration is a WireCat command-line tool from npm. This app installs them and runs their own commands.
        </Fact>
        <Fact icon={<Bot className={icon} strokeWidth={1.6} aria-hidden />} title="Your agent does the rest">
          Claude Code, Codex and other agents use the tools to search and act on your data when you ask them to.
        </Fact>
      </ul>
      <p className="text-[0.95rem] text-ink-soft">Setup takes a few minutes. You can skip any step.</p>
    </>
  )
}

export function Computer() {
  const r = useSystem((s) => s.readiness)
  const refreshing = useTools((s) => s.refreshing)
  const items: { label: string; value: string; tone: LampTone; note?: string | null | undefined }[] = [
    { label: "System", value: r ? r.os : "…", tone: r ? "ok" : "idle" },
    {
      label: "Node.js",
      value: !r ? "…" : (r.node.version ?? "Not found"),
      tone: !r ? "idle" : r.node.ok ? "ok" : "bad",
      note: r?.node.version ? r.node.problem : null,
    },
    {
      label: "npm",
      value: !r ? "…" : (r.npm.version ?? "Not found"),
      tone: !r ? "idle" : r.npm.ok ? "ok" : "bad",
      note: r?.npm.version ? r.npm.problem : null,
    },
  ]
  const ready = r?.node.ok && r.npm.ok && r.npmPrefixWritable !== false

  return (
    <>
      <ul aria-label="Your computer" className={rack}>
        {items.map((i) => (
          <li key={i.label} className={row}>
            <Lamp tone={i.tone} />
            <span className="w-[7rem] shrink-0 font-medium">{i.label}</span>
            <span className="selectable min-w-0 flex-1 truncate font-mono text-[1.02rem] tabular-nums">{i.value}</span>
            {i.note && <span className="truncate text-[0.9rem] text-bad">{i.note}</span>}
          </li>
        ))}
      </ul>
      <NodeNotice />
      <div className="flex flex-wrap items-center gap-4">
        <p aria-live="polite" className="flex-1 text-[0.95rem] text-ink-soft">
          {!r ? "Checking this computer…" : ready ? "Ready to install WireCat tools." : null}
        </p>
        <Button
          size="sm"
          variant="ghost"
          disabled={refreshing}
          onClick={() => useTools.getState().refresh(true)}
          icon={<RefreshCw className={cx("size-4", refreshing && "animate-spin")} aria-hidden />}
        >
          <StableText value={refreshing ? "Checking…" : "Check again"} variants={["Checking…", "Check again"]} />
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

  return (
    <fieldset className="min-w-0">
      <legend className="sr-only">Tools to install</legend>
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
                  {t.partOf && <Pill>Part of {findTool(t.partOf)?.name ?? t.partOf}</Pill>}
                  {installed && <Pill tone="brand">installed</Pill>}
                </span>
                <span className="mt-0.5 block text-[0.9rem] leading-snug text-ink-soft">{t.tagline}</span>
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

  let tone: LampTone = "idle"
  let text: ReactNode = "Not installed"
  if (status.kind === "checking") text = "Checking…"
  else if (session && !outcome) {
    tone = session.step === "queued" ? "idle" : "busy"
    text =
      session.step === "queued"
        ? "Waiting for its turn"
        : `${INSTALL_STEPS.install.find((s) => s.step === session.step)?.label ?? "Installing"}…`
  } else if (outcome?.event === "failed") {
    tone = "bad"
    text = <span className="text-bad">{outcome.message}</span>
  } else if (outcome?.event === "done") {
    tone = "ok"
    text = (
      <>
        Installed <span className="font-mono tabular-nums">{outcome.version}</span>
      </>
    )
  } else if (status.kind === "ready" || status.kind === "outdated") {
    tone = "ok"
    text = (
      <>
        Already installed <span className="font-mono tabular-nums">{status.version}</span>
      </>
    )
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
          Try again
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

  if (list.length === 0) {
    return (
      <div className="flex flex-wrap items-center gap-4">
        <p className="flex-1 text-[0.95rem] text-ink-soft">No tools are chosen, so there is nothing to install.</p>
        <Button size="sm" onClick={() => useOnboarding.getState().go("choose")}>
          Choose tools
        </Button>
      </div>
    )
  }

  return (
    <>
      <NodeNotice />
      <ul aria-label="Installing" className={rack}>
        {list.map((t) => (
          <Progress key={t.id} tool={t} />
        ))}
      </ul>
      {pending && nodeReady && (
        <div>
          <Button size="sm" onClick={installChosen}>
            Install the rest
          </Button>
        </div>
      )}
      <p className="text-[0.95rem] text-ink-soft">
        Installs keep going if you move on. Each one is also shown on the Tools page, with its full log.
      </p>
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
  if (matrix) return <>{matrix}</>
  return (
    <div className={cx(rack, "flex items-start gap-[0.9rem] px-[1.3rem] py-[1.1rem]")}>
      <Bot className="mt-[0.1rem] size-[1.5rem] shrink-0 text-brand" strokeWidth={1.6} aria-hidden />
      <div className="flex min-w-0 flex-col gap-[0.7rem]">
        <h3 className="text-[1.08rem] font-semibold leading-tight">How a tool adds its skill</h3>
        <p className="max-w-[65ch] text-[0.95rem] leading-relaxed text-ink-soft">
          Some tools offer to add their skill while you sign in, in the next step: the terminal asks which agent should
          get it. Any tool can also add its own skill from a terminal, for Claude Code, Codex and Gemini CLI.
        </p>
        {list.length > 0 && (
          <ul aria-label="Skill commands" className="flex flex-col gap-1">
            {list.map((t) => (
              <li key={t.id} className="flex items-baseline gap-3 text-[0.95rem]">
                <span className="w-[7.5rem] shrink-0 text-ink-soft">{t.name}</span>
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
function ProfileState({ profile, onSignIn }: { profile: Profile; onSignIn: (() => void) | undefined }) {
  const name = <span className="font-mono font-medium text-ink">{profile.name}</span>
  if (!onSignIn) {
    return (
      <li className="flex min-h-8 items-center gap-x-[0.6rem]">
        <Lamp size="sm" tone="ok" />
        <span className="min-w-0 flex-1 text-[0.95rem] text-ink-soft">Account {name} is added</span>
      </li>
    )
  }
  return (
    <li className="flex min-h-8 flex-wrap items-center gap-x-[0.6rem] gap-y-1">
      <Lamp size="sm" tone={profile.signedIn ? "ok" : "idle"} />
      <span className="min-w-0 flex-1 text-[0.95rem] text-ink-soft">
        {profile.signedIn === true ? (
          <>Signed in as profile {name}</>
        ) : profile.signedIn === false ? (
          <>Profile {name} is not signed in</>
        ) : (
          <>Profile {name}: sign-in not reported</>
        )}
      </span>
      {profile.signedIn !== true && (
        <Button
          size="sm"
          variant={profile.signedIn === false ? "secondary" : "ghost"}
          onClick={onSignIn}
          icon={<Terminal className="size-4" aria-hidden />}
        >
          Open terminal to sign in
        </Button>
      )}
    </li>
  )
}

const signInBlock = "flex flex-col gap-[0.9rem] border-line border-b px-[1.3rem] py-[1.1rem] last:border-b-0"
const accountsArea = "flex flex-col gap-[0.9rem] sm:pl-[2.4rem]"

function SignInHeader({ tool }: { tool: CatalogTool }) {
  return (
    <div className="flex items-start gap-[0.9rem]">
      <ToolIcon id={tool.id} className="mt-[0.05rem] size-[1.5rem] shrink-0 text-ink" />
      <div className="min-w-0">
        <h3 className="text-[1.08rem] font-semibold leading-tight">{tool.name}</h3>
        {tool.signIn && <p className="mt-1 text-[0.95rem] leading-relaxed text-ink-soft">{tool.signIn.gives}</p>}
      </div>
    </div>
  )
}

/** One account line and the "Add another account" line: the usual shape once the accounts are read. */
function AccountsSkeleton({ tool }: { tool: CatalogTool }) {
  return (
    <>
      <Skeleton className="h-8 w-full" label={`Reading ${tool.name} accounts`} />
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
  const manual = !tool.setup
  const count = profiles?.length ?? 0
  const seen = useRef(count)

  // The form opens only on a click, so it closes by itself once the account it was for shows up.
  useEffect(() => {
    if (count > seen.current) setAdding(false)
    seen.current = count
  }, [count])

  const signInAgain = async (profile: string) => {
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
            Could not list the accounts: {error}
          </ErrorNotice>
        ) : profiles === undefined ? (
          <AccountsSkeleton tool={tool} />
        ) : (
          <ul aria-label={`${tool.name} accounts`} className="flex flex-col gap-1">
            {count > 0 ? (
              profiles?.map((p) => (
                <ProfileState key={p.name} profile={p} onSignIn={manual ? undefined : () => signInAgain(p.name)} />
              ))
            ) : (
              <li className="flex min-h-8 items-center gap-x-[0.6rem]">
                <Lamp size="sm" tone="idle" />
                <span className="text-[0.95rem] text-ink-soft">No account yet</span>
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
                <span className="font-medium text-ink">{manual ? "What it needs: " : "It will ask for: "}</span>
                {tool.signIn.asks}
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
                      How to make it
                    </a>
                  </>
                )}
              </p>
            )}
            {manual ? (
              <ManualSetup tool={tool} onCheck={reload} checking={loading} />
            ) : (
              <NewProfile
                tool={tool}
                label={count ? "Name for another account" : "Name for this account"}
                onCheck={reload}
                checking={loading}
              />
            )}
          </>
        ) : profiles === undefined && !error ? null : (
          <div>
            <Button size="sm" variant="ghost" className="-ml-3" onClick={() => setAdding(true)}>
              {count ? "Add another account" : "Add an account"}
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
  const list = useSetupTools()
  const detected = Object.keys(installs).length > 0
  const signsIn = (t: CatalogTool) => Boolean(t.setup || t.signIn?.command)
  const ready = list.filter((t) => signsIn(t) && installs[t.id]?.length)
  const waiting = list.filter((t) => signsIn(t) && !installs[t.id]?.length)
  const noSignIn = list.filter((t) => !signsIn(t))

  // Until the tools are found, the chosen ones stand in: they are the ones just installed.
  if (!detected && !failed) {
    const chosen = list.filter(signsIn)
    if (chosen.length === 0) return <Skeleton className="h-24 w-full" label="Looking for installed tools" />
    return (
      <ul aria-label="Tools to sign in to" className={rack}>
        {chosen.map((t) => (
          <PendingSignInRow key={t.id} tool={t} />
        ))}
      </ul>
    )
  }

  return (
    <>
      {ready.length > 0 ? (
        <ul aria-label="Tools to sign in to" className={rack}>
          {ready.map((t) => (
            <SignInRow key={t.id} tool={t} />
          ))}
        </ul>
      ) : (
        <p className="text-[0.95rem] text-ink-soft">No installed tool needs a sign-in yet.</p>
      )}
      {waiting.length > 0 && (
        <p className="text-[0.95rem] text-ink-soft">
          {waiting.map((t) => t.name).join(", ")} can sign in once installed: open it on the Tools page and choose
          Manage.
        </p>
      )}
      {noSignIn.length > 0 && (
        <p className="text-[0.95rem] text-ink-soft">{noSignIn.map((t) => t.name).join(", ")} needs no sign-in.</p>
      )}
    </>
  )
}

export function Done() {
  const chosen = useOnboarding((s) => s.chosen)
  const installs = useTools((s) => s.installs)
  const list = tools.filter((t) => chosen.includes(t.id))
  if (list.length === 0) return null
  return (
    <ul aria-label="Your tools" className={rack}>
      {list.map((t) => {
        const version = installs[t.id]?.[0]?.version
        return (
          <li key={t.id} className={row}>
            <Lamp tone={version ? "ok" : "idle"} />
            <ToolIcon id={t.id} className="size-[1.5rem] shrink-0 text-ink" />
            <span className="flex-1 font-semibold">{t.name}</span>
            <span className={cx("font-mono text-[1.02rem] tabular-nums", version ? "text-ink" : "text-ink-soft")}>
              {version ?? "Not installed"}
            </span>
          </li>
        )
      })}
    </ul>
  )
}
