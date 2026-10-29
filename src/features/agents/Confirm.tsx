import { type ReactNode, useState } from "react"
import { create } from "zustand"
import { useMessages } from "@/i18n"
import { Button } from "@/ui/Button"
import { Dialog } from "@/ui/Dialog"
import { ErrorNotice } from "@/ui/ErrorNotice"
import { ReportThis } from "../report/ReportThis"
import { type AgentsMessages, agentsMessages } from "./messages"

/** A change to the owner's agents or tasks, shown with the exact command before it runs. */
export type Pending = {
  /** Words for a language: the dialog shows the chosen one, a bug report names it in English. */
  text: (m: AgentsMessages) => { title: string; body: ReactNode; action: string }
  command: string
  /** The catalog tool the command belongs to, so a report about it is filed with that tool. */
  tool?: string
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
  const m = useMessages(agentsMessages)
  const text = pending?.text(m)

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
    else setError(pending.failure() ?? m.noReason)
  }

  return (
    <Dialog
      open={pending !== null}
      title={text?.title ?? ""}
      onClose={() => !running && done()}
      actions={
        <>
          <Button variant="ghost" data-autofocus disabled={running} onClick={done}>
            {error ? m.close : m.cancel}
          </Button>
          <Button variant={pending?.danger ? "danger" : "secondary"} disabled={running} onClick={run}>
            {running ? m.running : error ? m.tryAgain : text?.action}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        {text?.body}
        <div>
          <span className="text-[0.9rem] font-medium text-ink-dim">{m.appRuns}</span>
          <code className="selectable mt-1 block rounded-[0.4rem] border border-line bg-app-2 px-3 py-2 font-mono text-[0.9rem] break-all text-ink">
            {pending?.command}
          </code>
        </div>
        {error && pending && (
          <ErrorNotice
            inline
            action={
              <ReportThis
                what={pending.text(agentsMessages.en).title.replace(/\?$/, "")}
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
