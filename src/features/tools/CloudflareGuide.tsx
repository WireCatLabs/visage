import type { ReactNode } from "react"
import { useCallback, useEffect, useId, useRef, useState } from "react"
import { platform } from "@/platform/bridge"
import type { CloudflareStatus } from "@/platform/cloudflare-schemas"
import { Button } from "@/ui/Button"
import { ErrorNotice } from "@/ui/ErrorNotice"
import { Skeleton } from "@/ui/Skeleton"
import { type CloudflareStepId, cloudflareSteps } from "./cloudflare-steps"
import { StepHead } from "./TailscaleGuide"

const message = (e: unknown) => (e instanceof Error ? e.message : String(e))

const PAGES = {
  downloads: "https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/downloads/",
  addDomain: "https://developers.cloudflare.com/fundamentals/manage-domains/add-site/",
  signUp: "https://dash.cloudflare.com/sign-up",
}

/** NEED-102: said before the owner picks Cloudflare, and again at the top of its steps. */
export const PRIVACY =
  "Cloudflare decrypts the traffic on its servers, so Cloudflare can read what the tools send back, your messages included. Tailscale Funnel cannot: there the encryption ends on this computer."

/** cloudflared's state for the guide, read again on Check and whenever the window comes back into focus. */
export function useCloudflare(active: boolean) {
  const [status, setStatus] = useState<CloudflareStatus | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [checking, setChecking] = useState(false)
  const call = useRef(0)

  const check = useCallback(async () => {
    const mine = ++call.current
    setChecking(true)
    try {
      const s = await platform.cloudflareStatus()
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
    const onFocus = () => check()
    window.addEventListener("focus", onFocus)
    return () => window.removeEventListener("focus", onFocus)
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

function InstallStep({ s, check }: { s: CloudflareStatus; check(): Promise<void> }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  if (!s.supported)
    return (
      <Para>
        Cloudflare publishes no cloudflared for this computer's processor, so this way does not work here. Use Tailscale
        Funnel, or see <Link href={PAGES.downloads}>Cloudflare's downloads</Link>.
      </Para>
    )
  const download = async () => {
    setBusy(true)
    setError(null)
    try {
      await platform.cloudflareInstall()
      await check()
    } catch (e) {
      if (message(e) !== "Stopped.") setError(message(e))
    }
    setBusy(false)
  }
  return (
    <>
      <Para>
        cloudflared is Cloudflare's own program that holds the tunnel open. WireCat downloads it from Cloudflare's
        releases on GitHub into its own folder. Nothing is installed in the system, and no password is asked.
      </Para>
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" variant="primary" onClick={download} disabled={busy}>
          {busy ? "Downloading…" : "Download cloudflared"}
        </Button>
        {busy ? (
          <Button size="sm" variant="ghost" onClick={() => platform.cloudflareStop()}>
            Stop
          </Button>
        ) : (
          <span className="text-[0.85rem] text-ink-dim">Checked against GitHub's checksum.</span>
        )}
      </div>
      {error && <ErrorNotice inline>{error}</ErrorNotice>}
    </>
  )
}

function AccountStep({ again, check }: { again: boolean; check(): Promise<void> }) {
  const [page, setPage] = useState<string | null>(null)
  const [waiting, setWaiting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const live = useRef(false)
  live.current = waiting
  useEffect(
    () => () => {
      if (live.current) platform.cloudflareStop()
    },
    [],
  )

  const login = async () => {
    setWaiting(true)
    setError(null)
    setPage(null)
    try {
      await platform.cloudflareLogin(setPage)
    } catch (e) {
      if (message(e) !== "Stopped.") setError(message(e))
    }
    setWaiting(false)
    check()
  }

  return (
    <>
      {!again && (
        <Para>
          You need a Cloudflare account with your own domain on it, that is, Cloudflare runs the domain's DNS. Press
          Connect: your browser opens Cloudflare, you log in, choose the domain for the address and press Authorize.
        </Para>
      )}
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
            <Button size="sm" variant="ghost" onClick={() => platform.cloudflareStop()}>
              Stop
            </Button>
          </>
        ) : (
          <Button size="sm" variant={again ? "secondary" : "primary"} onClick={login}>
            {again ? "Connect again to choose another name" : "Connect Cloudflare"}
          </Button>
        )}
      </div>
      {error && <ErrorNotice inline>{error}</ErrorNotice>}
      {!again && (
        <Note>
          No account or no domain there yet? <Link href={PAGES.signUp}>Create an account</Link>, then{" "}
          <Link href={PAGES.addDomain}>add your domain</Link>; Cloudflare's own steps include changing the domain's
          nameservers where you bought it.
        </Note>
      )}
    </>
  )
}

function AddressStep({ s, check }: { s: CloudflareStatus; check(): Promise<void> }) {
  const id = useId()
  const [name, setName] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const create = async () => {
    setBusy(true)
    setError(null)
    try {
      await platform.cloudflareCreate(name)
      await check()
    } catch (e) {
      setError(message(e))
    }
    setBusy(false)
  }
  return (
    <>
      <Para>
        Type a new name under the domain you chose in Cloudflare. WireCat makes one tunnel and this one DNS record in
        your account; nothing else there changes.
      </Para>
      <label className="flex flex-col gap-1" htmlFor={id}>
        <span className="text-[0.85rem] font-medium text-ink-dim">Address on your domain</span>
        <input
          id={id}
          className="h-8 w-full max-w-[24rem] rounded-[0.35rem] border border-line-strong bg-app px-2.5 font-mono text-[0.8rem] text-ink placeholder:font-sans placeholder:text-ink-dim"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && name.trim() && !busy && create()}
          placeholder="wirecat.example.com"
          autoComplete="off"
          spellCheck={false}
        />
      </label>
      {s.hostname && (
        <Note>
          The tunnel for <span className="selectable font-mono">{s.hostname}</span> stays in your Cloudflare account
          until you delete it there.
        </Note>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" variant="primary" onClick={create} disabled={busy || !name.trim()}>
          {busy ? "Making the address…" : "Make the address"}
        </Button>
      </div>
      {error && <ErrorNotice inline>{error}</ErrorNotice>}
    </>
  )
}

/** The three steps from nothing to a tunnel on the owner's domain; each says what happens before it runs. */
export function CloudflareGuide({ cloudflare }: { cloudflare: ReturnType<typeof useCloudflare> }) {
  const { status, error, checking, check } = cloudflare
  const [checked, setChecked] = useState<CloudflareStepId | null>(null)

  if (!status)
    return error ? (
      <ErrorNotice inline>Could not read cloudflared's state: {error}</ErrorNotice>
    ) : (
      <Skeleton className="h-[12rem] w-full" label="Reading cloudflared's state" />
    )

  const steps = cloudflareSteps(status)
  const current = steps.find((s) => !s.done)?.id ?? null
  const body: Record<CloudflareStepId, ReactNode> = {
    install: <InstallStep s={status} check={check} />,
    account: <AccountStep again={false} check={check} />,
    address: <AddressStep s={status} check={check} />,
  }

  return (
    <ol
      className="flex flex-col divide-y divide-line rounded-[0.45rem] border border-line"
      aria-label="Set up a Cloudflare tunnel"
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
                {step.missing && checked === step.id && <p className="text-warn-ink">{step.missing}</p>}
                {body[step.id]}
              </div>
            )}
            {step.id === "address" && step.done && status.hostname && (
              <div className="flex flex-col gap-2 pl-9 text-[0.9rem]">
                <p>
                  <span className="selectable font-mono text-ink">{status.hostname}</span> is yours on Cloudflare.
                </p>
                <AccountStep again check={check} />
              </div>
            )}
          </li>
        )
      })}
    </ol>
  )
}
