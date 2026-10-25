import { Bot, HardDrive, RefreshCw, Terminal } from "lucide-react"
import type { ReactNode } from "react"
import { type CatalogTool, tools } from "@/domain/catalog"
import { STEPS as INSTALL_STEPS, toolStatus } from "@/domain/status"
import { Button } from "@/ui/Button"
import { cx } from "@/ui/cx"
import { Lamp, type LampTone } from "@/ui/Lamp"
import { Pill } from "@/ui/Pill"
import { NodeNotice } from "../system/NodeNotice"
import { useSystem } from "../system/store"
import { NewProfile } from "../tools/Health"
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
          The tools keep your messages, mail, meetings and files in an archive on this computer, not in a WireCat cloud.
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
      note: r?.node.problem,
    },
    {
      label: "npm",
      value: !r ? "…" : (r.npm.version ?? "Not found"),
      tone: !r ? "idle" : r.npm.ok ? "ok" : "bad",
      note: r?.npm.problem,
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
          onClick={() => useTools.getState().refresh()}
          icon={<RefreshCw className={cx("size-4", refreshing && "animate-spin")} aria-hidden />}
        >
          {refreshing ? "Checking…" : "Check again"}
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
          return (
            <li key={t.id} className="-mr-px -mb-px border-line border-r border-b">
              <label
                className={cx(
                  "flex h-full items-start gap-[0.8rem] px-[1.1rem] py-[1rem]",
                  !installed && "hover:bg-app-2",
                  checked && "bg-brand-soft/50 hover:bg-brand-soft/70",
                )}
              >
                <input
                  type="checkbox"
                  checked={installed || checked}
                  disabled={installed}
                  onChange={() => toggle(t.id)}
                  className="mt-[0.2rem] size-[1.05rem] shrink-0 accent-brand disabled:opacity-60"
                />
                <ToolIcon id={t.id} className="size-[1.5rem] shrink-0 text-ink" />
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-baseline gap-x-[0.5rem]">
                    <span className="text-[1.02rem] font-semibold">{t.name}</span>
                    <span className="font-mono text-[0.9rem] text-ink-soft">{t.bin}</span>
                    {installed && <Pill tone="brand">installed</Pill>}
                  </span>
                  <span className="mt-0.5 block text-[0.9rem] leading-snug text-ink-soft">{t.tagline}</span>
                </span>
              </label>
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
    if (!installedVersion(id) && !st.sessions[id]) st.install(id)
  }
}

function Progress({ tool }: { tool: CatalogTool }) {
  const installs = useTools((s) => s.installs[tool.id])
  const session = useTools((s) => s.sessions[tool.id])
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
  const pending = useTools((s) => chosen.some((id) => !s.installs[id]?.length && !s.sessions[id]))
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

export function Agents() {
  return (
    <div className={cx(rack, "flex items-start gap-[0.9rem] px-[1.3rem] py-[1.1rem]")}>
      <Bot className="mt-[0.1rem] size-[1.5rem] shrink-0 text-brand" strokeWidth={1.6} aria-hidden />
      <div className="min-w-0">
        <h3 className="flex items-center gap-2 text-[1.08rem] font-semibold leading-tight">
          Skills for agents <Pill>Soon</Pill>
        </h3>
        <p className="mt-1 max-w-[70ch] text-[0.95rem] leading-relaxed text-ink-soft">
          A skill is a short guide that tells Claude Code, Codex or another agent which commands a tool has and when to
          use them. The Agents section will add each tool's skill to the agents on this computer. Until then, every tool
          you installed can add its own skill later.
        </p>
      </div>
    </div>
  )
}

export function SignIn() {
  const installs = useTools((s) => s.installs)
  const chosen = useOnboarding((s) => s.chosen)
  const ready = tools.filter((t) => t.setup && installs[t.id]?.length)
  const waiting = tools.filter((t) => t.setup && chosen.includes(t.id) && !installs[t.id]?.length)
  const noSignIn = tools.filter((t) => !t.setup && (chosen.includes(t.id) || installs[t.id]?.length))

  return (
    <>
      {ready.length > 0 ? (
        <ul aria-label="Tools to sign in to" className={rack}>
          {ready.map((t) => (
            <li key={t.id} className={cx(row, "flex-wrap gap-y-3")}>
              <ToolIcon id={t.id} className="size-[1.5rem] shrink-0 text-ink" />
              <span className="w-[9rem] shrink-0 font-semibold">{t.name}</span>
              <div className="min-w-[16rem] flex-1">
                <NewProfile tool={t} />
              </div>
            </li>
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
