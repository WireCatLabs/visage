import { findTool } from "@/domain/catalog"
import { Button } from "@/ui/Button"
import { Dialog } from "@/ui/Dialog"
import { useCompat } from "./compat-store"
import { namesOf, useUpdatable } from "./StorageFit"
import { useTools } from "./store"

/** After an install that will move storage past what other installed tools read, before that tool next runs. */
export function UpgradeWarning() {
  const warning = useCompat((s) => s.warning)
  const version = useTools((s) => (warning ? s.installs[warning.id]?.[0]?.version : null))
  const updatable = useUpdatable(warning?.locksOut ?? [])
  const stuck = (warning?.locksOut ?? []).filter((id) => !updatable.includes(id))
  const close = () => useCompat.getState().dismiss()
  if (!warning) return null
  const name = findTool(warning.id)?.name ?? warning.id

  return (
    <Dialog
      open
      title={`${version ? `${name} ${version}` : name} will move storage to schema ${warning.to}`}
      onClose={close}
      actions={
        <>
          <Button variant="ghost" data-autofocus onClick={close}>
            Not now
          </Button>
          {updatable.length > 0 && (
            <Button
              onClick={() => {
                for (const id of updatable) useTools.getState().install(id)
                close()
              }}
            >
              Update {namesOf(updatable)} too
            </Button>
          )}
        </>
      }
    >
      <p>
        {namesOf(warning.locksOut)} can't read schema {warning.to}. They stop working with storage the next time {name}{" "}
        runs, which may be soon if it runs in the background.
      </p>
      {warning.mayLockOut.length > 0 && (
        <p className="mt-2">
          {namesOf(warning.mayLockOut)} can't say which schema{" "}
          {warning.mayLockOut.length === 1 ? "it reads" : "they read"}, so{" "}
          {warning.mayLockOut.length === 1 ? "it" : "they"} may stop too.
        </p>
      )}
      {stuck.length > 0 && (
        <p className="mt-2">
          No newer {namesOf(stuck)} is out yet, so updating can't fix {stuck.length === 1 ? "it" : "them"} today.
        </p>
      )}
    </Dialog>
  )
}
