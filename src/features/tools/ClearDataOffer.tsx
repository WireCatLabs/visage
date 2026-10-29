import { useEffect } from "react"
import { formatBytes } from "@/domain/format"
import { useMessages } from "@/i18n"
import { Button } from "@/ui/Button"
import { Dialog } from "@/ui/Dialog"
import { areaBytes, useStorage } from "../storage/store"
import { toolsMessages } from "./messages"
import { useTools } from "./store"

// Shown once, after the last WireCat tool is uninstalled: the one moment deleting everything is both safe and likely wanted.
export function ClearDataOffer() {
  const open = useTools((s) => s.offerClear)
  const { areas, load, clearAll } = useStorage()
  const m = useMessages(toolsMessages).clear

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
      title={m.title}
      onClose={close}
      actions={
        <>
          <Button variant="ghost" onClick={close} autoFocus>
            {m.keep}
          </Button>
          <Button
            variant="danger"
            onClick={() => {
              close()
              clearAll()
            }}
          >
            {m.delete(formatBytes(bytes))}
          </Button>
        </>
      }
    >
      <p>{m.text(formatBytes(bytes))}</p>
    </Dialog>
  )
}
