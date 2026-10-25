import { useEffect } from "react"
import { formatBytes } from "@/domain/format"
import { Button } from "@/ui/Button"
import { Dialog } from "@/ui/Dialog"
import { areaBytes, useStorage } from "../storage/store"
import { useTools } from "./store"

// Shown once, after the last WireCat tool is uninstalled: the one moment deleting everything is both safe and likely wanted.
export function ClearDataOffer() {
  const open = useTools((s) => s.offerClear)
  const { areas, load, clearAll } = useStorage()

  useEffect(() => {
    if (open) load()
  }, [open, load])

  const leftovers = (areas ?? []).filter((a) => a.folders.length > 0 && a.usedBy.length === 0)
  const bytes = leftovers.reduce((sum, a) => sum + areaBytes(a), 0)
  const close = () => useTools.getState().closeOffer()
  const nothingLeft = areas !== null && leftovers.length === 0

  useEffect(() => {
    if (open && nothingLeft) useTools.getState().closeOffer()
  }, [open, nothingLeft])

  return (
    <Dialog
      open={open && leftovers.length > 0}
      title="No WireCat tools are installed. Delete their data too?"
      onClose={close}
      actions={
        <>
          <Button variant="ghost" onClick={close} autoFocus>
            Keep data
          </Button>
          <Button
            variant="danger"
            onClick={() => {
              close()
              clearAll()
            }}
          >
            Delete {formatBytes(bytes)}
          </Button>
        </>
      }
    >
      <p>
        The tools left {formatBytes(bytes)} on this computer: shared storage, sessions, settings and caches. Keep it if
        you may install them again; delete it to remove everything. Sign-in tokens in your system keyring are not
        touched.
      </p>
    </Dialog>
  )
}
