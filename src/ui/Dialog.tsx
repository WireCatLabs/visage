import { type ReactNode, useEffect, useId, useRef } from "react"

type Props = {
  open: boolean
  title: string
  children: ReactNode
  actions: ReactNode
  onClose: () => void
}

/** The platform's modal <dialog>: focus is trapped, Escape closes, and the page behind is inert. */
export function Dialog({ open, title, children, actions, onClose }: Props) {
  const ref = useRef<HTMLDialogElement>(null)
  const titleId = useId()

  useEffect(() => {
    const d = ref.current
    if (!d) return
    if (open && !d.open) d.showModal?.()
    if (!open && d.open) d.close()
  }, [open])

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onClose={onClose}
      onCancel={(e) => {
        e.preventDefault()
        onClose()
      }}
      className="m-auto w-[min(32rem,calc(100vw-2rem))] rounded-[0.6rem] border border-line bg-app p-0 text-ink shadow-panel backdrop:bg-black/40 backdrop:backdrop-blur-[1px]"
    >
      {open && (
        <div className="flex flex-col gap-4 p-6">
          <h2 id={titleId} className="text-[1.2rem] font-semibold">
            {title}
          </h2>
          <div className="text-[0.95rem] leading-relaxed text-ink-soft">{children}</div>
          <div className="mt-2 flex justify-end gap-2">{actions}</div>
        </div>
      )}
    </dialog>
  )
}
