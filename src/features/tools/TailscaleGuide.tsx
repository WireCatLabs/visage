import { Check } from "lucide-react"
import { type ReactNode, useCallback, useEffect, useRef, useState } from "react"
import { useMessages } from "@/i18n"
import { platform } from "@/platform/bridge"
import type { TailscaleDownload, TailscaleLinux, TailscaleStatus } from "@/platform/tailscale-schemas"
import { Button } from "@/ui/Button"
import { Collapse } from "@/ui/Collapse"
import { CopyField } from "@/ui/CopyField"
import { cx } from "@/ui/cx"
import { Disclosure } from "@/ui/Disclosure"
import { ErrorNotice } from "@/ui/ErrorNotice"
import { Skeleton } from "@/ui/Skeleton"
import { connectMessages } from "./messages-connect"
import { tunnelMessages } from "./messages-tunnel"
import { type StepId, stepsOf } from "./tailscale-steps"

type Words = (typeof tunnelMessages)["en"]["tailscale"]

const message = (e: unknown) => (e instanceof Error ? e.message : String(e))

const PAGES = {
  download: {
    macos: "https://tailscale.com/download/mac",
    windows: "https://tailscale.com/download/windows",
    linux: "https://tailscale.com/download/linux",
  },
  linux: "https://tailscale.com/docs/install/linux",
  staticBinaries: "https://pkgs.tailscale.com/stable/#static",
  nixosWiki: "https://wiki.nixos.org/wiki/Tailscale",
  dns: "https://console.tailscale.com/admin/dns",
  acls: "https://console.tailscale.com/admin/acls",
  machines: "https://console.tailscale.com/admin/machines",
}

/** The website's guide; each step links the section that covers it on this system. */
const GUIDE = "https://wirecat.dev/en/docs/desktop/tailscale-funnel"
const INSTALL_SECTION: Record<TailscaleLinux["family"], string> = {
  debian: "debian-and-ubuntu",
  fedora: "fedora-and-red-hat",
  opensuse: "opensuse",
  arch: "arch-linux",
  nixos: "nixos",
  other: "other-linux",
}

export function guideUrl(step: StepId, s: TailscaleStatus): string {
  const section = {
    install:
      s.os !== "linux"
        ? s.os
        : s.installed && s.operator === false
          ? "let-your-user-control-tailscale-on-linux"
          : INSTALL_SECTION[s.linux?.family ?? "other"],
    login: "log-in-to-tailscale",
    funnel: "allow-funnel",
    connect: "connect-the-server",
  }[step]
  return `${GUIDE}#${section}`
}

/** Tailscale's state for the guide, read again on Check and whenever the window comes back into focus. */
export function useTailscale(active: boolean) {
  const [status, setStatus] = useState<TailscaleStatus | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [checking, setChecking] = useState(false)
  const call = useRef(0)

  const check = useCallback(async () => {
    const mine = ++call.current
    setChecking(true)
    try {
      const s = await platform.tailscaleStatus()
      if (call.current === mine) {
        setStatus(s)
        setError(null)
      }
    } catch (e) {
      if (call.current === mine) setError(message(e))
    }
    if (call.current === mine) setChecking(false)
  }, [])

  useEffect(() => {
    if (!active) return
    check()
    // The owner installs, logs in or approves in another window; coming back is when the answer changes.
    const onFocus = () => check()
    const onVisible = () => document.visibilityState === "visible" && check()
    window.addEventListener("focus", onFocus)
    document.addEventListener("visibilitychange", onVisible)
    return () => {
      window.removeEventListener("focus", onFocus)
      document.removeEventListener("visibilitychange", onVisible)
    }
  }, [active, check])

  return { status, error, checking, check }
}

function Para({ children }: { children: ReactNode }) {
  return <p className="max-w-[62ch]">{children}</p>
}

function Note({ children }: { children: ReactNode }) {
  return <p className="max-w-[62ch] text-[0.9rem] text-ink-dim">{children}</p>
}

function Link({ href, children }: { href: string; children: ReactNode }) {
  return (
    <button
      type="button"
      className="text-brand underline hover:text-brand-hover"
      onClick={() => platform.openUrl(href)}
    >
      {children}
    </button>
  )
}

/** This Linux's commands from Tailscale, to copy or run in a terminal; the terminal gets them from Rust, not from here. */
function Commands({ linux, label, m }: { linux: TailscaleLinux; label: string; m: Words }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const open = async () => {
    setBusy(true)
    setError(null)
    try {
      await platform.tailscaleTerminal("install")
    } catch (e) {
      setError(message(e))
    }
    setBusy(false)
  }
  return (
    <>
      <CopyField value={linux.commands.join("\n")} label={label} />
      {linux.method !== "config" && (
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" onClick={open} disabled={busy}>
            {busy ? m.opening : linux.commands.length > 1 ? m.openTerminalMany : m.openTerminalOne}
          </Button>
        </div>
      )}
      {error && <ErrorNotice inline>{error}</ErrorNotice>}
    </>
  )
}

function LinuxInstall({ s, downloaded, m }: { s: TailscaleStatus; downloaded: boolean; m: Words }) {
  const linux = s.linux
  if (!linux) return null
  const instructions = <Link href={linux.source}>{m.instructions}</Link>
  const source = (
    <Note>
      {linux.method === "script" ? (
        m.noCommands(
          linux.name,
          <Link href={PAGES.linux}>{m.linuxPage}</Link>,
          <Link href={PAGES.staticBinaries}>{m.staticBinaries}</Link>,
        )
      ) : linux.method === "config" ? (
        m.instructionsAndWiki(instructions, <Link href={PAGES.nixosWiki}>{m.nixosWiki}</Link>)
      ) : (
        <>
          {linux.method === "repo" ? m.updatesRepo : m.updatesPackage} {m.password} {m.instructionsLink(instructions)}
        </>
      )}
    </Note>
  )
  if (linux.method === "config")
    return (
      <>
        <Para>{m.nixos}</Para>
        <Commands linux={linux} label={m.copyLine} m={m} />
        {source}
      </>
    )
  if (linux.method === "script")
    return (
      <>
        <h4 className="pt-1 text-[0.9rem] font-medium text-ink-dim">{m.scriptTitle}</h4>
        <Commands linux={linux} label={m.copyInstall} m={m} />
        <Note>{m.scriptPassword}</Note>
        {source}
      </>
    )
  const heading = downloaded ? m.thenSource(linux.name) : s.package ? m.orCommands(linux.name) : m.commands(linux.name)
  return (
    <>
      {s.package && !downloaded && <Note>{m.noAutoUpdate}</Note>}
      <h4 className="pt-1 text-[0.9rem] font-medium text-ink-dim">{heading}</h4>
      <Commands linux={linux} label={m.copyCommands} m={m} />
      {source}
    </>
  )
}

/** Installed from a .deb without Tailscale's update source: it works, but will not update with the system. Debian and
 * Ubuntu carry no tailscale package of their own; Fedora and openSUSE do, so the missing file says nothing there. */
function UpdateSource({ linux, m }: { linux: TailscaleLinux; m: Words }) {
  return (
    <div className="flex flex-col gap-2 pl-9 text-[0.9rem]">
      <Note>{m.noSource}</Note>
      <Disclosure summary={m.addSource}>
        <div className="flex flex-col gap-2.5">
          <Commands linux={linux} label={m.copyCommands} m={m} />
          <Note>
            {m.updatesRepo} {m.instructionsLink(<Link href={linux.source}>{m.instructions}</Link>)}
          </Note>
        </div>
      </Disclosure>
    </div>
  )
}

function InstallStep({ s, m }: { s: TailscaleStatus; m: Words }) {
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState<TailscaleDownload | null>(null)
  const [error, setError] = useState<string | null>(null)
  const download = async () => {
    if (!s.package) return
    setBusy(true)
    setError(null)
    try {
      setDone(await platform.tailscaleDownload(s.package))
    } catch (e) {
      setError(message(e))
    }
    setBusy(false)
  }

  if (s.installed && s.operator === false) {
    const line = `sudo tailscale set --operator=${s.user ?? "$USER"}`
    return (
      <>
        <Para>{m.operator}</Para>
        <CopyField value={line} label={m.copyCommand} />
        <Note>{m.operatorHow}</Note>
      </>
    )
  }

  const desktop = s.os !== "linux"
  return (
    <>
      <Para>{m.why}</Para>
      {s.package && !done && (
        <Para>{s.os === "macos" ? m.downloadMacos : s.os === "windows" ? m.downloadWindows : m.downloadLinux}</Para>
      )}
      {s.package && !done && (
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" variant="primary" onClick={download} disabled={busy}>
            {busy ? m.downloading : desktop ? m.downloadInstaller : m.downloadPackage(s.package)}
          </Button>
          <span className="text-[0.9rem] text-ink-dim">{m.checksum}</span>
        </div>
      )}
      {done && (
        <div className="rounded-[0.4rem] border border-line bg-app-2 px-3 py-2 text-[0.9rem]">
          <p>{m.saved(<span className="selectable font-mono text-ink">{done.path}</span>)}</p>
          <p>{done.opened ? (s.os === "macos" ? m.openedMacos : m.openedWindows) : m.shown}</p>
        </div>
      )}
      {desktop ? (
        <Note>{m.yourself(<Link href={PAGES.download[s.os]}>{m.downloadPage}</Link>)}</Note>
      ) : (
        <LinuxInstall s={s} downloaded={done !== null} m={m} />
      )}
      {error && <ErrorNotice inline>{error}</ErrorNotice>}
    </>
  )
}

function LoginStep({ s, m, check }: { s: TailscaleStatus; m: Words; check(): Promise<void> }) {
  const [page, setPage] = useState<string | null>(null)
  const [waiting, setWaiting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!waiting) return
    const t = setInterval(check, 2500)
    return () => clearInterval(t)
  }, [waiting, check])

  const live = useRef(false)
  live.current = waiting
  useEffect(
    () => () => {
      if (live.current) platform.tailscaleStop()
    },
    [],
  )

  const login = async () => {
    setWaiting(true)
    setError(null)
    setPage(null)
    try {
      await platform.tailscaleLogin(setPage)
    } catch (e) {
      if (message(e) !== "Stopped.") setError(message(e))
    }
    setWaiting(false)
    check()
  }

  if (!s.daemon)
    return (
      <>
        <Para>{m.notRunning}</Para>
        {s.os === "linux" ? (
          <>
            <Para>{m.startService}</Para>
            <CopyField value="sudo systemctl enable --now tailscaled" label={m.copyCommand} />
          </>
        ) : (
          <Para>{s.os === "macos" ? m.openAppMacos : m.openAppWindows}</Para>
        )}
      </>
    )
  if (s.backend === "needsApproval")
    return (
      <>
        <Para>{m.approval}</Para>
        <div>
          <Button size="sm" onClick={() => platform.openUrl(PAGES.machines)}>
            {m.machines}
          </Button>
        </div>
      </>
    )
  if (s.backend === "stopped")
    return (
      <>
        <Para>{s.os === "macos" ? m.stoppedMacos : s.os === "windows" ? m.stoppedWindows : m.stoppedLinux}</Para>
        {s.os === "linux" && <CopyField value="tailscale up" label={m.copyCommand} />}
      </>
    )
  return (
    <>
      <Para>{m.login}</Para>
      <div className="flex flex-wrap items-center gap-2">
        {waiting ? (
          <>
            <span className="text-[0.9rem] text-ink" role="status">
              {m.waiting}
            </span>
            {page && (
              <Button size="sm" onClick={() => platform.openUrl(page)}>
                {m.pageAgain}
              </Button>
            )}
            <Button size="sm" variant="ghost" onClick={() => platform.tailscaleStop()}>
              {m.stop}
            </Button>
          </>
        ) : (
          <Button size="sm" variant="primary" onClick={login} disabled={s.backend !== "needsLogin"}>
            {m.logIn}
          </Button>
        )}
      </div>
      {error && <ErrorNotice inline>{error}</ErrorNotice>}
    </>
  )
}

function FunnelStep({ s, m }: { s: TailscaleStatus; m: Words }) {
  if (!s.https || !s.host)
    return (
      <>
        <Para>{m.https}</Para>
        <div>
          <Button size="sm" onClick={() => platform.openUrl(PAGES.dns)}>
            {m.dns}
          </Button>
        </div>
        <Note>{m.certLog}</Note>
      </>
    )
  return (
    <>
      <Para>{m.funnel}</Para>
      <div>
        <Button size="sm" onClick={() => platform.openUrl(PAGES.acls)}>
          {m.acls}
        </Button>
      </div>
    </>
  )
}

export function StepHead({
  title,
  done,
  index,
  open,
  checking,
  checked,
  onCheck,
}: {
  title: string
  done: boolean
  index: number
  open: boolean
  checking: boolean
  checked: boolean
  onCheck(): void
}) {
  const rail = useMessages(connectMessages).rail
  const m = useMessages(tunnelMessages).tailscale
  const finished = done
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
      <span
        aria-hidden
        className={cx(
          "grid size-6 shrink-0 place-items-center rounded-full text-[0.85rem] font-semibold tabular-nums",
          finished ? "bg-ok text-app" : open ? "bg-brand text-brand-ink" : "bg-app-3 text-ink-dim",
        )}
      >
        {finished ? <Check className="size-3.5" strokeWidth={3} /> : index + 1}
      </span>
      <h3 className={cx("text-[0.98rem] font-semibold", open || done ? "text-ink" : "text-ink-dim")}>
        <span className="sr-only">{rail.step(index + 1)}</span>
        {title}
        <span className="sr-only">{finished ? rail.done : open ? rail.current : rail.notDone}</span>
      </h3>
      {(open || checked) && (
        <span className="ml-auto flex items-center gap-2">
          {checked && !checking && (
            <span className={cx("text-[0.9rem]", done ? "text-ok" : "text-ink-soft")} role="status">
              {done ? m.stepDone : m.stepNotYet}
            </span>
          )}
          <Button size="sm" variant="ghost" onClick={onCheck} disabled={checking} aria-label={m.checkStep(title)}>
            {checking ? m.checking : m.check}
          </Button>
        </span>
      )}
    </div>
  )
}

/** The four steps from nothing to a public address: each says what it is, why, and what the person will see. */
export function TailscaleGuide({ tailscale }: { tailscale: ReturnType<typeof useTailscale> }) {
  const { status, error, checking, check } = tailscale
  const m = useMessages(tunnelMessages).tailscale
  const [checked, setChecked] = useState<StepId | null>(null)

  if (!status)
    return error ? (
      <ErrorNotice inline>{m.unreadable(error)}</ErrorNotice>
    ) : (
      <Skeleton className="h-[14rem] w-full" label={m.reading} />
    )

  // Its last step, a free public port, is not a task for the owner: the guide's own Start step says when none is left.
  const steps = stepsOf(status).filter((s) => s.id !== "connect")
  const current = steps.find((s) => !s.done)?.id ?? null
  const body: Record<Exclude<StepId, "connect">, ReactNode> = {
    install: <InstallStep s={status} m={m} />,
    login: <LoginStep s={status} m={m} check={check} />,
    funnel: <FunnelStep s={status} m={m} />,
  }

  return (
    <ol className="flex flex-col divide-y divide-line rounded-[0.45rem] border border-line" aria-label={m.list}>
      {steps.map((step, i) => {
        const open = step.id === current
        return (
          <li key={step.id} className="flex flex-col px-4 py-3" aria-current={open ? "step" : undefined}>
            <StepHead
              title={m.titles[step.id]}
              done={step.done}
              index={i}
              open={open}
              checking={checking}
              checked={checked === step.id}
              onCheck={async () => {
                await check()
                setChecked(step.id)
              }}
            />
            <Collapse open={open} className="flex flex-col gap-2.5 pt-2.5 pl-9 text-[0.9rem]">
              {step.missing && checked === step.id && <p className="text-warn-ink">{m.missing[step.missing]}</p>}
              {step.id !== "connect" && body[step.id]}
              <Note>{m.fullGuide(<Link href={guideUrl(step.id, status)}>{m.fullGuideLink}</Link>)}</Note>
            </Collapse>
            {step.id === "install" && step.done && status.package === "deb" && status.linux?.updates === false && (
              <div className="pt-2.5">
                <UpdateSource linux={status.linux} m={m} />
              </div>
            )}
          </li>
        )
      })}
    </ol>
  )
}
