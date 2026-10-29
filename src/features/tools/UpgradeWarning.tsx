import { findTool } from "@/domain/catalog"
import { useMessages } from "@/i18n"
import { Button } from "@/ui/Button"
import { Dialog } from "@/ui/Dialog"
import { useCompat } from "./compat-store"
import { toolsMessages } from "./messages"
import { namesOf, useUpdatable } from "./StorageFit"
import { useTools } from "./store"

/** After an install that will move storage past what other installed tools read, before that tool next runs. */
export function UpgradeWarning() {
  const warning = useCompat((s) => s.warning)
  const version = useTools((s) => (warning ? s.installs[warning.id]?.[0]?.version : null))
  const updatable = useUpdatable(warning?.locksOut ?? [])
  const stuck = (warning?.locksOut ?? []).filter((id) => !updatable.includes(id))
  const close = () => useCompat.getState().dismiss()
  const m = useMessages(toolsMessages).upgrade
  if (!warning) return null
  const name = findTool(warning.id)?.name ?? warning.id

  return (
    <Dialog
      open
      title={m.title(version ? `${name} ${version}` : name, warning.to)}
      onClose={close}
      actions={
        <>
          <Button variant="ghost" data-autofocus onClick={close}>
            {m.notNow}
          </Button>
          {updatable.length > 0 && (
            <Button
              onClick={() => {
                for (const id of updatable) useTools.getState().install(id)
                close()
              }}
            >
              {m.updateToo(namesOf(updatable))}
            </Button>
          )}
        </>
      }
    >
      <p>{m.locksOut(warning.locksOut.length, namesOf(warning.locksOut), warning.to, name)}</p>
      {warning.mayLockOut.length > 0 && (
        <p className="mt-2">{m.mayLockOut(warning.mayLockOut.length, namesOf(warning.mayLockOut))}</p>
      )}
      {stuck.length > 0 && <p className="mt-2">{m.stuck(stuck.length, namesOf(stuck))}</p>}
    </Dialog>
  )
}
