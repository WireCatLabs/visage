import { Check, Copy, ExternalLink } from "lucide-react"
import { Fragment, useEffect, useState } from "react"
import { tools } from "@/domain/catalog"
import { useMessages } from "@/i18n"
import { platform } from "@/platform/bridge"
import { Button } from "@/ui/Button"
import { Dialog } from "@/ui/Dialog"
import { Monogram } from "@/ui/Logo"
import { useReport } from "../report/store"
import { useSystem } from "../system/store"
import { useTools } from "../tools/store"
import { aboutMessages } from "./messages"

const AUTHOR = "Viacheslav Ptsarev"
const COPYRIGHT_YEAR = 2026
const REPO = "https://github.com/WireCatLabs/wirecat-desktop"
const PRODUCT = "WireCat Desktop"
const LICENSE = "Apache License 2.0"

const links = [
  { label: "website", href: "https://wirecat.dev" },
  { label: "docs", href: "https://wirecat.dev/en/docs" },
  { label: "source", href: REPO },
  { label: "privacy", href: "https://wirecat.dev/en/privacy" },
] as const

type System = { os: string; arch: string } | null

const build = [__BUILD_COMMIT__, __BUILD_DATE__].filter(Boolean).join(", ")

function versionLine(system: System) {
  const parts = [`WireCat ${__APP_VERSION__}${build ? ` (${build})` : ""}`]
  if (system) parts.push(`${system.os} ${system.arch}`)
  return parts.join(" · ")
}

export function AboutDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const m = useMessages(aboutMessages)
  const readiness = useSystem((s) => s.readiness)
  const installs = useTools((s) => s.installs)
  const installed = tools.flatMap((t) => {
    const version = t.partOf ? null : installs[t.id]?.[0]?.version
    return version ? [{ id: t.id, name: t.name, version }] : []
  })

  const report = () => {
    onClose()
    useReport.getState().start()
  }

  return (
    <Dialog
      open={open}
      title={m.title}
      onClose={onClose}
      actions={
        <Button variant="ghost" data-autofocus onClick={onClose}>
          {m.close}
        </Button>
      }
    >
      <div className="flex flex-col gap-5">
        <div className="flex items-start gap-4">
          <Monogram className="size-[3rem] shrink-0" />
          <div className="flex flex-col gap-1">
            <p className="text-[1.05rem] font-semibold text-ink">{PRODUCT}</p>
            <p>{m.summary}</p>
          </div>
        </div>

        <section aria-label={m.version} className="rounded-[0.45rem] border border-line bg-app-2 px-4 py-3">
          <div className="flex items-start gap-3">
            <dl className="grid min-w-0 flex-1 grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-[0.875rem]">
              <Fact term={m.version}>{__APP_VERSION__}</Fact>
              {build && <Fact term={m.build}>{build}</Fact>}
              {readiness && <Fact term={m.system}>{`${readiness.os} ${readiness.arch}`}</Fact>}
            </dl>
            <CopyButton text={versionLine(readiness)} />
          </div>
          {installed.length > 0 && (
            <p className="mt-2 border-line border-t pt-2 text-[0.9rem] text-ink-dim">
              {installed.map((t, i) => (
                <Fragment key={t.id}>
                  {i > 0 && " · "}
                  <span className="whitespace-nowrap">
                    {t.name} <span className="font-mono tabular-nums">{t.version}</span>
                  </span>
                </Fragment>
              ))}
            </p>
          )}
        </section>

        <nav aria-label={m.links}>
          <ul className="grid grid-cols-2 gap-x-6 gap-y-1.5">
            {links.map((l) => (
              <li key={l.href}>
                <LinkButton href={l.href}>{m[l.label]}</LinkButton>
              </li>
            ))}
            <li>
              <button
                type="button"
                onClick={report}
                className="font-medium text-brand hover:text-brand-hover hover:underline hover:underline-offset-4"
              >
                {m.report}
              </button>
            </li>
          </ul>
        </nav>

        <p className="border-line border-t pt-4 text-[0.875rem] text-ink-dim">
          {m.madeBy(AUTHOR, COPYRIGHT_YEAR)}
          <br />
          {m.license(<LinkButton href={`${REPO}/blob/main/LICENSE`}>{LICENSE}</LinkButton>)}
        </p>
      </div>
    </Dialog>
  )
}

function Fact({ term, children }: { term: string; children: string }) {
  return (
    <>
      <dt className="text-ink-dim">{term}</dt>
      <dd className="selectable min-w-0 font-mono text-ink tabular-nums">{children}</dd>
    </>
  )
}

function CopyButton({ text }: { text: string }) {
  const m = useMessages(aboutMessages)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!copied) return
    const t = setTimeout(() => setCopied(false), 1600)
    return () => clearTimeout(t)
  }, [copied])

  const label = copied ? m.copied : m.copy
  return (
    <button
      type="button"
      aria-label={label}
      title={m.copyTitle(text)}
      onClick={async () => {
        await navigator.clipboard.writeText(text)
        setCopied(true)
      }}
      className="grid size-8 shrink-0 place-items-center rounded-[0.3rem] text-ink-dim transition-colors hover:bg-app-3 hover:text-ink"
    >
      {copied ? <Check className="size-4 text-ok" aria-hidden /> : <Copy className="size-4" aria-hidden />}
      <span className="sr-only" aria-live="polite">
        {copied ? m.copiedAnnounce : ""}
      </span>
    </button>
  )
}

function LinkButton({ href, children }: { href: string; children: string }) {
  return (
    <button
      type="button"
      title={href}
      onClick={() => platform.openUrl(href)}
      className="inline-flex items-center gap-1 font-medium text-brand hover:text-brand-hover hover:underline hover:underline-offset-4"
    >
      {children}
      <ExternalLink className="size-[0.85em] shrink-0" strokeWidth={1.8} aria-hidden />
    </button>
  )
}
