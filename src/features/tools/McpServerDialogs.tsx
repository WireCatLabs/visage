import { useEffect, useState } from "react"
import type { CatalogTool } from "@/domain/catalog"
import { useMessages } from "@/i18n"
import { platform } from "@/platform/bridge"
import { Button } from "@/ui/Button"
import { Dialog } from "@/ui/Dialog"
import { ErrorNotice } from "@/ui/ErrorNotice"
import { mcpMessages } from "./messages-mcp"

const message = (e: unknown) => (e instanceof Error ? e.message : String(e))

/** Rust checks both again; this only keeps an obvious typo from a round trip. One plain path is the tool's share. */
export function formProblem(url: string, port: string): "url" | "port" | null {
  const path = "(/[a-z0-9_][a-z0-9._-]{0,39})?/?"
  const local = new RegExp(`^http://(localhost|127\\.0\\.0\\.1)(:\\d+)?${path}$`, "i").test(url)
  if (!local && !new RegExp(`^https://[a-z0-9.-]+(:\\d+)?${path}$`, "i").test(url)) return "url"
  const n = Number(port)
  if (!Number.isInteger(n) || n < 1024 || n > 65535) return "port"
  return null
}

export function ForgetLogins(props: { tool: CatalogTool; open: boolean; onClose(): void; onDone(): void }) {
  const { tool, open, onClose, onDone } = props
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const name = tool.bin
  const m = useMessages(mcpMessages).forget

  useEffect(() => {
    if (open) setError(null)
  }, [open])

  const forget = async () => {
    setBusy(true)
    try {
      await platform.mcpServerRevoke(tool.id)
      onDone()
    } catch (e) {
      setError(message(e))
    }
    setBusy(false)
  }

  return (
    <Dialog
      open={open}
      title={m.title(name)}
      onClose={busy ? () => {} : onClose}
      actions={
        <>
          <Button variant="ghost" onClick={onClose} disabled={busy} autoFocus>
            {m.keep}
          </Button>
          <Button variant="danger" onClick={forget} disabled={busy}>
            {busy ? m.forgetting : m.forget}
          </Button>
        </>
      }
    >
      <p>{m.body}</p>
      {error && (
        <div className="mt-3">
          <ErrorNotice inline>{error}</ErrorNotice>
        </div>
      )}
    </Dialog>
  )
}
