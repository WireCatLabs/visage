import { Download, ExternalLink } from "lucide-react"
import { formatBytes } from "@/domain/format"
import { useMessages } from "@/i18n"
import { platform } from "@/platform/bridge"
import { AutoHeight } from "@/ui/AutoHeight"
import { Button } from "@/ui/Button"
import { Dialog } from "@/ui/Dialog"
import { ErrorNotice } from "@/ui/ErrorNotice"
import { updateMessages } from "./messages"
import { RELEASES_URL, useUpdate } from "./store"

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

export function UpdateDialog() {
  const m = useMessages(updateMessages)
  const { update, open, phase, error } = useUpdate()
  if (!update) return null
  const busy = phase === "downloading" || phase === "restarting"
  const download = () => platform.openUrl(RELEASES_URL)

  const actions = update.manual ? (
    <>
      <Button variant="ghost" onClick={() => useUpdate.getState().close()}>
        {m.later}
      </Button>
      <Button
        variant="primary"
        data-autofocus
        icon={<ExternalLink className="size-4" aria-hidden />}
        onClick={download}
      >
        {m.downloadFromGitHub}
      </Button>
    </>
  ) : (
    <>
      <Button variant="ghost" onClick={() => useUpdate.getState().close()}>
        {busy ? m.hide : m.later}
      </Button>
      <Button variant="primary" data-autofocus disabled={busy} onClick={() => useUpdate.getState().install()}>
        {phase === "failed" ? m.tryAgain : m.install}
      </Button>
    </>
  )

  return (
    <Dialog
      open={open}
      title={m.available(update.version)}
      onClose={() => useUpdate.getState().close()}
      actions={actions}
    >
      <div className="flex flex-col gap-4">
        <p className="text-ink-soft">{update.manual ? m.manual : m.auto}</p>
        {update.notes && (
          <div className="selectable max-h-[12rem] overflow-y-auto whitespace-pre-line rounded-[0.2rem] border border-line bg-app-2 px-4 py-3 text-[0.9rem]">
            {update.notes}
          </div>
        )}
        <AutoHeight swap={update.manual ? "manual" : phase}>
          {phase === "downloading" && <Progress />}
          {phase === "restarting" && <p className="text-[0.9rem] text-ink-soft">{m.restarting}</p>}
          {phase === "failed" && (
            <ErrorNotice
              detail={m.failedDetail}
              action={
                <Button size="sm" onClick={download}>
                  {m.openGitHub}
                </Button>
              }
            >
              {error ?? m.failed}
            </ErrorNotice>
          )}
        </AutoHeight>
      </div>
    </Dialog>
  )
}
