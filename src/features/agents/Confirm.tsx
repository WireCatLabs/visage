import { type ReactNode, useState } from "react"
import { create } from "zustand"
import { Button } from "@/ui/Button"
import { Dialog } from "@/ui/Dialog"
import { ErrorNotice } from "@/ui/ErrorNotice"
import { ReportThis } from "../report/ReportThis"

/** A change to the owner's agents or tasks, shown with the exact command before it runs. */
export type Pending = {
  title: string
  body: ReactNode
  command: string
  /** The catalog tool the command belongs to, so a report about it is filed with that tool. */
  tool?: string
  action: string
  danger?: boolean
  /** Where focus goes after closing when the button that opened the dialog is gone. */
  focusAfter?: () => HTMLElement | null
  /** Resolves false when it failed; the reason is in `failure`. */
  run: () => Promise<boolean>
  failure: () => string | undefined
}

export const useConfirm = create<{ pending: Pending | null; ask(p: Pending): void; close(): void }>((set) => ({
  pending: null,
  ask: (pending) => set({ pending }),
  close: () => set({ pending: null }),
}))

export function ConfirmCommand() {
  const pending = useConfirm((s) => s.pending)
  const close = useConfirm((s) => s.close)
  const [running, setRunning] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const done = () => {
    const after = pending?.focusAfter
    setError(null)
    close()
    if (after)
      requestAnimationFrame(() => {
        const active = document.activeElement
        if (!active || active === document.body) after()?.focus()
      })
  }
  const run = async () => {
    if (!pending) return
    setRunning(true)
    setError(null)
    const ok = await pending.run()
    setRunning(false)
    if (ok) done()
    else setError(pending.failure() ?? "It did not work, and the tool gave no reason.")
  }

  return (
    <Dialog
      open={pending !== null}
      title={pending?.title ?? ""}
      onClose={() => !running && done()}
      actions={
        <>
          <Button variant="ghost" data-autofocus disabled={running} onClick={done}>
            {error ? "Close" : "Cancel"}
          </Button>
          <Button variant={pending?.danger ? "danger" : "secondary"} disabled={running} onClick={run}>
            {running ? "Running…" : error ? "Try again" : pending?.action}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        {pending?.body}
        <div>
          <span className="text-[0.85rem] font-medium text-ink-dim">The app runs</span>
          <code className="selectable mt-1 block rounded-[0.4rem] border border-line bg-app-2 px-3 py-2 font-mono text-[0.85rem] break-all text-ink">
            {pending?.command}
          </code>
        </div>
        {error && pending && (
          <ErrorNotice
            inline
            action={
              <ReportThis
                what={pending.title.replace(/\?$/, "")}
                tool={pending.tool ?? null}
                command={pending.command}
                error={error}
                onOpen={done}
              />
            }
          >
            {error}
          </ErrorNotice>
        )}
      </div>
    </Dialog>
  )
}
