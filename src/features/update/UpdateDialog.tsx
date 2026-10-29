import { Download, ExternalLink } from "lucide-react"
import { formatBytes } from "@/domain/format"
import { platform } from "@/platform/bridge"
import { AutoHeight } from "@/ui/AutoHeight"
import { Button } from "@/ui/Button"
import { Dialog } from "@/ui/Dialog"
import { ErrorNotice } from "@/ui/ErrorNotice"
import { RELEASES_URL, useUpdate } from "./store"

/** Shown only once an update is found; it sits left of "Report a problem", so nothing already there moves. */
export function UpdateButton() {
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
      {phase === "downloading" ? "Updating…" : `Update to ${update.version}`}
    </Button>
  )
}

function Progress() {
  const progress = useUpdate((s) => s.progress)
  const share = progress?.total ? Math.min(1, progress.downloaded / progress.total) : null
  return (
    <div className="flex flex-col gap-2">
      <span
        role="progressbar"
        aria-label="Downloading the update"
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
        {progress?.total
          ? `${formatBytes(progress.downloaded)} of ${formatBytes(progress.total)}`
          : "Downloading the update…"}
      </p>
    </div>
  )
}

export function UpdateDialog() {
  const { update, open, phase, error } = useUpdate()
  if (!update) return null
  const busy = phase === "downloading" || phase === "restarting"
  const download = () => platform.openUrl(RELEASES_URL)

  const actions = update.manual ? (
    <>
      <Button variant="ghost" onClick={() => useUpdate.getState().close()}>
        Later
      </Button>
      <Button
        variant="primary"
        data-autofocus
        icon={<ExternalLink className="size-4" aria-hidden />}
        onClick={download}
      >
        Download from GitHub
      </Button>
    </>
  ) : (
    <>
      <Button variant="ghost" onClick={() => useUpdate.getState().close()}>
        {busy ? "Hide" : "Later"}
      </Button>
      <Button variant="primary" data-autofocus disabled={busy} onClick={() => useUpdate.getState().install()}>
        {phase === "failed" ? "Try again" : "Install and restart"}
      </Button>
    </>
  )

  return (
    <Dialog
      open={open}
      title={`WireCat ${update.version} is available`}
      onClose={() => useUpdate.getState().close()}
      actions={actions}
    >
      <div className="flex flex-col gap-4">
        <p className="text-ink-soft">
          {update.manual
            ? "This copy was installed from a Linux package, so it cannot update itself. Download the new package from GitHub and install it the same way."
            : "WireCat downloads the update, installs it and opens again. Your tools, profiles and data stay as they are."}
        </p>
        {update.notes && (
          <div className="selectable max-h-[12rem] overflow-y-auto whitespace-pre-line rounded-[0.2rem] border border-line bg-app-2 px-4 py-3 text-[0.9rem]">
            {update.notes}
          </div>
        )}
        <AutoHeight swap={update.manual ? "manual" : phase}>
          {phase === "downloading" && <Progress />}
          {phase === "restarting" && <p className="text-[0.9rem] text-ink-soft">Installed. WireCat is restarting…</p>}
          {phase === "failed" && (
            <ErrorNotice
              detail="Try again, or download the installer from GitHub."
              action={
                <Button size="sm" onClick={download}>
                  Open GitHub
                </Button>
              }
            >
              {error ?? "The update could not be installed."}
            </ErrorNotice>
          )}
        </AutoHeight>
      </div>
    </Dialog>
  )
}
