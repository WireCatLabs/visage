import { Check } from "lucide-react"
import { type ReactNode, useCallback, useEffect, useRef, useState } from "react"
import { platform } from "@/platform/bridge"
import type { TailscaleDownload, TailscaleLinux, TailscaleStatus } from "@/platform/tailscale-schemas"
import { Button } from "@/ui/Button"
import { CopyField } from "@/ui/CopyField"
import { cx } from "@/ui/cx"
import { Disclosure } from "@/ui/Disclosure"
import { ErrorNotice } from "@/ui/ErrorNotice"
import { Skeleton } from "@/ui/Skeleton"
import { addressOf, type Step, type StepId, stepsOf } from "./tailscale-steps"

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
    install: s.os === "linux" ? INSTALL_SECTION[s.linux?.family ?? "other"] : s.os,
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
  return <p className="max-w-[62ch] text-[0.85rem] text-ink-dim">{children}</p>
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
function Commands({ linux, label }: { linux: TailscaleLinux; label: string }) {
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
            {busy ? "Opening…" : linux.commands.length > 1 ? "Open a terminal with them" : "Open a terminal with it"}
          </Button>
        </div>
      )}
      {error && <ErrorNotice inline>{error}</ErrorNotice>}
    </>
  )
}

const UPDATES: Record<TailscaleLinux["method"], string> = {
  repo: "They add Tailscale's own update source, so your system's updates keep Tailscale current.",
  package: "This is your distribution's own Tailscale package, so your system's updates keep it current.",
  config: "",
  script: "",
}

function LinuxInstall({ s, downloaded }: { s: TailscaleStatus; downloaded: boolean }) {
  const linux = s.linux
  if (!linux) return null
  const source = (
    <Note>
      {linux.method === "script" ? (
        <>
          Tailscale lists no commands for {linux.name}. See its <Link href={PAGES.linux}>Linux install page</Link> or
          the <Link href={PAGES.staticBinaries}>static binaries</Link> that run on any Linux.
        </>
      ) : (
        <>
          {UPDATES[linux.method]} {linux.method !== "config" && "They ask for your computer password. "}
          <Link href={linux.source}>Tailscale's instructions</Link>
          {linux.method === "config" && (
            <>
              {" "}
              and the <Link href={PAGES.nixosWiki}>NixOS wiki</Link>
            </>
          )}
          .
        </>
      )}
    </Note>
  )
  if (linux.method === "config")
    return (
      <>
        <Para>On NixOS, Tailscale is part of your system configuration. Add this line to it, then rebuild:</Para>
        <Commands linux={linux} label="Copy the line" />
        {source}
      </>
    )
  if (linux.method === "script")
    return (
      <>
        <h4 className="pt-1 text-[0.85rem] font-medium text-ink-dim">Install with Tailscale's install script</h4>
        <Commands linux={linux} label="Copy the install command" />
        <Note>It asks for your computer password, because it installs a system service.</Note>
        {source}
      </>
    )
  const heading = downloaded
    ? `Then add Tailscale's update source for ${linux.name}`
    : s.package
      ? `Or install with Tailscale's commands for ${linux.name}`
      : `Install with Tailscale's commands for ${linux.name}`
  return (
    <>
      {s.package && !downloaded && (
        <Note>A package installed by double-click does not update itself. The commands below do.</Note>
      )}
      <h4 className="pt-1 text-[0.85rem] font-medium text-ink-dim">{heading}</h4>
      <Commands linux={linux} label="Copy the commands" />
      {source}
    </>
  )
}

/** Installed from a package without Tailscale's update source: it works, but will not update with the system. */
function UpdateSource({ linux }: { linux: TailscaleLinux }) {
  return (
    <div className="flex flex-col gap-2 pl-9 text-[0.9rem]">
      <Note>Installed without Tailscale's update source: system updates will not update it.</Note>
      <Disclosure summary="Add the update source">
        <div className="flex flex-col gap-2.5">
          <Commands linux={linux} label="Copy the commands" />
          <Note>
            {UPDATES.repo} <Link href={linux.source}>Tailscale's instructions</Link>.
          </Note>
        </div>
      </Disclosure>
    </div>
  )
}

function InstallStep({ s }: { s: TailscaleStatus }) {
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
        <Para>
          On Linux, Tailscale takes orders only from the administrator unless you name your user as its operator. Do
          this once: it lets WireCat log in and turn Funnel on without asking for your password each time.
        </Para>
        <CopyField value={line} label="Copy the command" />
        <Note>
          Paste it in a terminal; it asks for your computer password. WireCat does not run it for you, because it
          changes who controls Tailscale. Then come back here; the step checks itself.
        </Note>
      </>
    )
  }

  const desktop = s.os !== "linux"
  const app = s.os === "macos" ? "The macOS Installer" : "Windows"
  return (
    <>
      <Para>
        Tailscale gives this computer a fixed https address on the internet, so ChatGPT or Claude in the browser can
        reach the server.
      </Para>
      {s.package && !done && (
        <Para>
          {desktop
            ? `WireCat downloads Tailscale's official installer into Downloads and opens it. ${app} then asks for your computer password, because Tailscale installs a system service.`
            : "WireCat downloads Tailscale's official package into Downloads and shows it in your file manager. Double-click it: your Software app installs it and asks for your computer password."}
        </Para>
      )}
      {s.package && !done && (
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" variant="primary" onClick={download} disabled={busy}>
            {busy ? "Downloading…" : desktop ? "Download and open the installer" : `Download Tailscale (.${s.package})`}
          </Button>
          <span className="text-[0.85rem] text-ink-dim">
            From pkgs.tailscale.com, checked against Tailscale's checksum.
          </span>
        </div>
      )}
      {done && (
        <div className="rounded-[0.4rem] border border-line bg-app-2 px-3 py-2 text-[0.9rem]">
          <p>
            Saved to <span className="selectable font-mono text-ink">{done.path}</span>.
          </p>
          {done.opened ? (
            <p>
              {app} opened it. Follow its steps; it asks for your computer password itself. Then open Tailscale
              {s.os === "macos" ? " from Applications" : " from the Start menu"}.
            </p>
          ) : (
            <p>
              Your file manager shows it. Double-click it: your Software app installs it and asks for your password. If
              nothing opens it, run the commands below instead.
            </p>
          )}
        </div>
      )}
      {desktop ? (
        <Note>
          Or get it yourself from <Link href={PAGES.download[s.os]}>Tailscale's download page</Link>.
        </Note>
      ) : (
        <LinuxInstall s={s} downloaded={done !== null} />
      )}
      {error && <ErrorNotice inline>{error}</ErrorNotice>}
    </>
  )
}

function LoginStep({ s, check }: { s: TailscaleStatus; check(): Promise<void> }) {
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
        <Para>Tailscale is installed but not running.</Para>
        {s.os === "linux" ? (
          <>
            <Para>Start its service once; it then starts with the computer:</Para>
            <CopyField value="sudo systemctl enable --now tailscaled" label="Copy the command" />
          </>
        ) : (
          <Para>
            Open the Tailscale app{s.os === "macos" ? " from Applications" : " from the Start menu"}, then come back.
          </Para>
        )}
      </>
    )
  if (s.backend === "needsApproval")
    return (
      <>
        <Para>
          You are logged in, but your Tailscale network asks its admin to approve each new computer. If that is you,
          approve this one on the Machines page.
        </Para>
        <div>
          <Button size="sm" onClick={() => platform.openUrl(PAGES.machines)}>
            Open the Machines page
          </Button>
        </div>
      </>
    )
  if (s.backend === "stopped")
    return (
      <>
        <Para>
          Tailscale is turned off on this computer. Turn it on from the Tailscale icon
          {s.os === "macos" ? " in the menu bar" : s.os === "windows" ? " next to the clock" : ""}
          {s.os === "linux" ? ", or with this command" : ""}.
        </Para>
        {s.os === "linux" && <CopyField value="tailscale up" label="Copy the command" />}
      </>
    )
  return (
    <>
      <Para>
        Press Log in. Your browser opens a tailscale.com page that asks you to sign in with Google, Microsoft, GitHub,
        Apple or a passkey. New to Tailscale? The same page creates an account. This step finishes by itself when you
        are done there.
      </Para>
      <div className="flex flex-wrap items-center gap-2">
        {waiting ? (
          <>
            <span className="text-[0.9rem] text-ink" role="status">
              Waiting for you in the browser…
            </span>
            {page && (
              <Button size="sm" onClick={() => platform.openUrl(page)}>
                Open the page again
              </Button>
            )}
            <Button size="sm" variant="ghost" onClick={() => platform.tailscaleStop()}>
              Stop
            </Button>
          </>
        ) : (
          <Button size="sm" variant="primary" onClick={login} disabled={s.backend !== "needsLogin"}>
            Log in
          </Button>
        )}
      </div>
      {error && <ErrorNotice inline>{error}</ErrorNotice>}
    </>
  )
}

function FunnelStep({ s }: { s: TailscaleStatus }) {
  if (!s.https || !s.host)
    return (
      <>
        <Para>
          Funnel needs secure (https) addresses in your Tailscale network. On the DNS page, turn on MagicDNS if it is
          off, then under HTTPS Certificates choose Enable HTTPS.
        </Para>
        <div>
          <Button size="sm" onClick={() => platform.openUrl(PAGES.dns)}>
            Open the DNS page
          </Button>
        </div>
        <Note>Tailscale says the computer names then appear in a public certificate log.</Note>
      </>
    )
  return (
    <>
      <Para>
        Funnel is what lets the internet reach one address on this computer. Your network's access rules must allow it:
        on the Access controls page, open the Funnel section and add Funnel to the policy.
      </Para>
      <div>
        <Button size="sm" onClick={() => platform.openUrl(PAGES.acls)}>
          Open the Access controls page
        </Button>
      </div>
    </>
  )
}

function ConnectStep({ s }: { s: TailscaleStatus }) {
  const address = addressOf(s)
  return (
    <>
      <Para>
        Press Start below. WireCat turns Funnel on from{" "}
        {address ? <span className="selectable font-mono text-ink">{address}</span> : "a public address"} to this
        server, then starts the server with that address.
      </Para>
      <Note>
        The address stays the same next time, so browser apps stay logged in. Funnel opens only this address, and the
        server still asks every app for its login code. Stopping the server turns this Funnel off.
      </Note>
    </>
  )
}

function StepHead({
  step,
  index,
  open,
  checking,
  checked,
  onCheck,
}: {
  step: Step
  index: number
  open: boolean
  checking: boolean
  checked: boolean
  onCheck(): void
}) {
  // The last step is the Start button itself: it is ready, never already done.
  const finished = step.done && step.id !== "connect"
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
      <span
        aria-hidden
        className={cx(
          "grid size-6 shrink-0 place-items-center rounded-full text-[0.8rem] font-semibold tabular-nums",
          finished ? "bg-ok text-app" : open ? "bg-brand text-brand-ink" : "bg-app-3 text-ink-dim",
        )}
      >
        {finished ? <Check className="size-3.5" strokeWidth={3} /> : index + 1}
      </span>
      <h3 className={cx("text-[0.98rem] font-semibold", open || step.done ? "text-ink" : "text-ink-dim")}>
        <span className="sr-only">Step {index + 1}: </span>
        {step.title}
        <span className="sr-only">{finished ? ", done" : open ? ", current step" : ", not done yet"}</span>
      </h3>
      {(open || checked) && step.id !== "connect" && (
        <span className="ml-auto flex items-center gap-2">
          {checked && !checking && (
            <span className={cx("text-[0.85rem]", step.done ? "text-ok" : "text-ink-soft")} role="status">
              {step.done ? "Done" : "Not yet"}
            </span>
          )}
          <Button size="sm" variant="ghost" onClick={onCheck} disabled={checking} aria-label={`Check: ${step.title}`}>
            {checking ? "Checking…" : "Check"}
          </Button>
        </span>
      )}
    </div>
  )
}

/** The four steps from nothing to a public address: each says what it is, why, and what the person will see. */
export function TailscaleGuide({ tailscale }: { tailscale: ReturnType<typeof useTailscale> }) {
  const { status, error, checking, check } = tailscale
  const [checked, setChecked] = useState<StepId | null>(null)

  if (!status)
    return error ? (
      <ErrorNotice inline>Could not read Tailscale's state: {error}</ErrorNotice>
    ) : (
      <Skeleton className="h-[14rem] w-full" label="Reading Tailscale's state" />
    )

  const steps = stepsOf(status)
  const current = steps.find((s) => !s.done)?.id ?? "connect"
  const body: Record<StepId, ReactNode> = {
    install: <InstallStep s={status} />,
    login: <LoginStep s={status} check={check} />,
    funnel: <FunnelStep s={status} />,
    connect: <ConnectStep s={status} />,
  }

  return (
    <ol
      className="flex flex-col divide-y divide-line rounded-[0.45rem] border border-line"
      aria-label="Set up Tailscale Funnel"
    >
      {steps.map((step, i) => {
        const open = step.id === current
        return (
          <li key={step.id} className="flex flex-col gap-2.5 px-4 py-3" aria-current={open ? "step" : undefined}>
            <StepHead
              step={step}
              index={i}
              open={open}
              checking={checking}
              checked={checked === step.id}
              onCheck={async () => {
                await check()
                setChecked(step.id)
              }}
            />
            {open && (
              <div className="flex flex-col gap-2.5 pl-9 text-[0.9rem]">
                {step.missing && step.id !== "connect" && checked === step.id && (
                  <p className="text-warn-ink">{step.missing}</p>
                )}
                {step.id === "connect" && step.missing && <p className="text-warn-ink">{step.missing}</p>}
                {body[step.id]}
                <Note>
                  <Link href={guideUrl(step.id, status)}>Full guide</Link> for this step on wirecat.dev.
                </Note>
              </div>
            )}
            {step.id === "install" && step.done && status.linux?.updates === false && (
              <UpdateSource linux={status.linux} />
            )}
          </li>
        )
      })}
    </ol>
  )
}
