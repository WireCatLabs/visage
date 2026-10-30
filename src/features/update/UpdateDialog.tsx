import { Download, ExternalLink } from "lucide-react"
import { type ReactNode, useEffect } from "react"
import { formatBytes } from "@/domain/format"
import { useLang, useMessages } from "@/i18n"
import { platform } from "@/platform/bridge"
import { AutoHeight } from "@/ui/AutoHeight"
import { Button } from "@/ui/Button"
import { CopyField } from "@/ui/CopyField"
import { Dialog } from "@/ui/Dialog"
import { ErrorNotice } from "@/ui/ErrorNotice"
import { updateMessages } from "./messages"
import { downloadPage, updatesSection, useUpdate } from "./store"

const RELEASES = "https://github.com/WireCatLabs/wirecat-desktop/releases"

/** Shown only once an update is found; it sits left of "Report a problem", so nothing already there moves. */
export function UpdateButton() {
  const m = useMessages(updateMessages)
  const update = useUpdate((s) => s.update)
  const phase = useUpdate((s) => s.phase)
  if (!update) return null
  return (
    <Button
      variant="ghost"
      size="sm"
      className="reveal text-brand"
      icon={<Download className="size-4" strokeWidth={1.8} aria-hidden />}
      onClick={() => useUpdate.getState().show()}
    >
      {phase === "downloading" ? m.updating : m.updateTo(update.version)}
    </Button>
  )
}

function Link({ href, children, quiet = false }: { href: string; children: ReactNode; quiet?: boolean }) {
  return (
    <button
      type="button"
      className={quiet ? "text-ink-dim underline hover:text-ink" : "text-brand underline hover:text-brand-hover"}
      onClick={() => platform.openUrl(href)}
    >
      {children}
    </button>
  )
}

function Progress() {
  const m = useMessages(updateMessages)
  const progress = useUpdate((s) => s.progress)
  const share = progress?.total ? Math.min(1, progress.downloaded / progress.total) : null
  return (
    <div className="flex flex-col gap-2">
      <span
        role="progressbar"
        aria-label={m.downloadingLabel}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={share === null ? undefined : Math.round(share * 100)}
        className="h-[0.3rem] w-full overflow-hidden rounded-full bg-app-3"
      >
        <span
          className="block h-full rounded-full bg-brand transition-[width] duration-300 ease-out-quart"
          style={{ width: `${Math.max(4, (share ?? 0) * 100)}%` }}
        />
      </span>
      <p className="text-[0.9rem] text-ink-soft">
        {progress?.total ? m.downloaded(formatBytes(progress.downloaded), formatBytes(progress.total)) : m.downloading}
      </p>
    </div>
  )
}

function Saved() {
  const m = useMessages(updateMessages)
  const saved = useUpdate((s) => s.saved)
  if (!saved) return null
  return (
    <div className="flex flex-col gap-3">
      <p className="text-ink">{saved.opened ? m.opened(saved.file) : m.revealed(saved.file)}</p>
      <p className="text-[0.9rem] text-ink-soft">{m.terminal}</p>
      <CopyField value={saved.command} label={m.copyCommand} wrap />
    </div>
  )
}

export function UpdateDialog() {
  const m = useMessages(updateMessages)
  const lang = useLang()
  const { update, open, phase, error } = useUpdate()
  // The pressed button went away with the download; the step's own button takes the focus, not the page behind.
  useEffect(() => {
    if (phase === "saved") document.querySelector<HTMLElement>("[data-update-done]")?.focus()
  }, [phase])
  if (!update) return null
  const busy = phase === "downloading" || phase === "restarting"
  const close = () => useUpdate.getState().close()
  const toDownloadPage = () => platform.openUrl(downloadPage(lang))
  const pageButton = (
    <Button size="sm" onClick={toDownloadPage}>
      {m.openDownloadPage}
    </Button>
  )

  const intro = update.kind === "self" ? m.auto : update.kind === "other" ? m.other : m.package[update.kind]

  let actions: ReactNode
  if (update.kind === "other") {
    actions = (
      <>
        <Button variant="ghost" onClick={close}>
          {m.later}
        </Button>
        <Button
          variant="primary"
          data-autofocus
          icon={<ExternalLink className="size-4" aria-hidden />}
          onClick={toDownloadPage}
        >
          {m.openDownloadPage}
        </Button>
      </>
    )
  } else if (phase === "saved") {
    actions = (
      <Button variant="primary" data-update-done onClick={close}>
        {m.close}
      </Button>
    )
  } else {
    const label = update.kind === "self" ? m.install : m.downloadAndInstall
    actions = (
      <>
        <Button variant="ghost" onClick={close}>
          {busy ? m.hide : m.later}
        </Button>
        <Button variant="primary" data-autofocus disabled={busy} onClick={() => useUpdate.getState().install()}>
          {phase === "failed" || phase === "rejected" ? m.tryAgain : label}
        </Button>
      </>
    )
  }

  const footer = (
    <p className="flex flex-wrap justify-end gap-x-4 gap-y-1 text-[0.8rem]">
      <Link quiet href={`${RELEASES}/tag/v${update.version}`}>
        {m.whatsNew(update.version)}
      </Link>
      <Link quiet href={RELEASES}>
        {m.allReleases}
      </Link>
    </p>
  )

  return (
    <Dialog open={open} title={m.available(update.version)} onClose={close} actions={actions} footer={footer}>
      <div className="flex flex-col gap-4">
        <p className="text-ink-soft">
          {intro} <Link href={updatesSection(lang)}>{m.howUpdates}</Link>
        </p>
        {update.notes && (
          <div className="selectable max-h-[12rem] overflow-y-auto whitespace-pre-line rounded-[0.2rem] border border-line bg-app-2 px-4 py-3 text-[0.9rem]">
            {update.notes}
          </div>
        )}
        <AutoHeight swap={phase}>
          <div key={phase} className={phase === "available" ? undefined : "step-in"}>
            {phase === "downloading" && <Progress />}
            {phase === "restarting" && <p className="text-[0.9rem] text-ink-soft">{m.restarting}</p>}
            {phase === "saved" && <Saved />}
            {phase === "rejected" && (
              <ErrorNotice detail={m.rejectedDetail} action={pageButton}>
                {m.rejected}
              </ErrorNotice>
            )}
            {phase === "failed" && (
              <ErrorNotice detail={m.failedDetail} action={pageButton}>
                {error ?? m.failed}
              </ErrorNotice>
            )}
          </div>
        </AutoHeight>
      </div>
    </Dialog>
  )
}
