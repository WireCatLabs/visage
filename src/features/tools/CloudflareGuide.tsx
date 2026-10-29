import type { ReactNode } from "react"
import { useCallback, useEffect, useId, useRef, useState } from "react"
import { useMessages } from "@/i18n"
import { platform } from "@/platform/bridge"
import type { CloudflareStatus } from "@/platform/cloudflare-schemas"
import { Button } from "@/ui/Button"
import { Collapse } from "@/ui/Collapse"
import { ErrorNotice } from "@/ui/ErrorNotice"
import { Skeleton } from "@/ui/Skeleton"
import { type CloudflareStepId, cloudflareSteps } from "./cloudflare-steps"
import { tunnelMessages } from "./messages-tunnel"
import { StepHead } from "./TailscaleGuide"

type Words = (typeof tunnelMessages)["en"]["cloudflare"]

const message = (e: unknown) => (e instanceof Error ? e.message : String(e))

const EXAMPLE_HOST = "wirecat.example.com"

const PAGES = {
  downloads: "https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/downloads/",
  addDomain: "https://developers.cloudflare.com/fundamentals/manage-domains/add-site/",
  signUp: "https://dash.cloudflare.com/sign-up",
}

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

function InstallStep({ s, m, check }: { s: CloudflareStatus; m: Words; check(): Promise<void> }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  if (!s.supported) return <Para>{m.unsupported(<Link href={PAGES.downloads}>{m.downloads}</Link>)}</Para>
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
      <Para>{m.install}</Para>
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" variant="primary" onClick={download} disabled={busy}>
          {busy ? m.downloading : m.download}
        </Button>
        {busy ? (
          <Button size="sm" variant="ghost" onClick={() => platform.cloudflareStop()}>
            {m.stop}
          </Button>
        ) : (
          <span className="text-[0.9rem] text-ink-dim">{m.checksum}</span>
        )}
      </div>
      {error && <ErrorNotice inline>{error}</ErrorNotice>}
    </>
  )
}

function AccountStep({ again, m, check }: { again: boolean; m: Words; check(): Promise<void> }) {
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
      {!again && <Para>{m.account}</Para>}
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
            <Button size="sm" variant="ghost" onClick={() => platform.cloudflareStop()}>
              {m.stop}
            </Button>
          </>
        ) : (
          <Button size="sm" variant={again ? "secondary" : "primary"} onClick={login}>
            {again ? m.again : m.connect}
          </Button>
        )}
      </div>
      {error && <ErrorNotice inline>{error}</ErrorNotice>}
      {!again && (
        <Note>
          {m.noAccount(<Link href={PAGES.signUp}>{m.signUp}</Link>, <Link href={PAGES.addDomain}>{m.addDomain}</Link>)}
        </Note>
      )}
    </>
  )
}

function AddressStep({ s, m, check }: { s: CloudflareStatus; m: Words; check(): Promise<void> }) {
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
      <Para>{m.name}</Para>
      <label className="flex flex-col gap-1" htmlFor={id}>
        <span className="text-[0.9rem] font-medium text-ink-dim">{m.nameLabel}</span>
        <input
          id={id}
          className="h-8 w-full max-w-[24rem] rounded-[0.35rem] border border-line-strong bg-app px-2.5 font-mono text-[0.85rem] text-ink placeholder:font-sans placeholder:text-ink-dim"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && name.trim() && !busy && create()}
          placeholder={EXAMPLE_HOST}
          autoComplete="off"
          spellCheck={false}
        />
      </label>
      {s.hostname && <Note>{m.stays(<span className="selectable font-mono">{s.hostname}</span>)}</Note>}
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" variant="primary" onClick={create} disabled={busy || !name.trim()}>
          {busy ? m.making : m.make}
        </Button>
      </div>
      {error && <ErrorNotice inline>{error}</ErrorNotice>}
    </>
  )
}

/** The three steps from nothing to a tunnel on the owner's domain; each says what happens before it runs. */
export function CloudflareGuide({ cloudflare }: { cloudflare: ReturnType<typeof useCloudflare> }) {
  const { status, error, checking, check } = cloudflare
  const m = useMessages(tunnelMessages).cloudflare
  const [checked, setChecked] = useState<CloudflareStepId | null>(null)

  if (!status)
    return error ? (
      <ErrorNotice inline>{m.unreadable(error)}</ErrorNotice>
    ) : (
      <Skeleton className="h-[12rem] w-full" label={m.reading} />
    )

  const steps = cloudflareSteps(status)
  const current = steps.find((s) => !s.done)?.id ?? null
  const body: Record<CloudflareStepId, ReactNode> = {
    install: <InstallStep s={status} m={m} check={check} />,
    account: <AccountStep again={false} m={m} check={check} />,
    address: <AddressStep s={status} m={m} check={check} />,
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
              {body[step.id]}
            </Collapse>
            {step.id === "address" && step.done && status.hostname && (
              <div className="flex flex-col gap-2 pt-2.5 pl-9 text-[0.9rem]">
                <p>{m.yours(<span className="selectable font-mono text-ink">{status.hostname}</span>)}</p>
                <AccountStep again m={m} check={check} />
              </div>
            )}
          </li>
        )
      })}
    </ol>
  )
}
