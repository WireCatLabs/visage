import { type ReactNode, useEffect, useId, useRef } from "react"

type Props = {
  open: boolean
  title: string
  children: ReactNode
  actions: ReactNode
  onClose: () => void
  wide?: boolean
  /** Long forms: the body scrolls between a fixed title and fixed actions, so nothing is cut off. */
  scroll?: boolean
}

/** The platform's modal <dialog>: focus is trapped, Escape closes, and the page behind is inert. */
export function Dialog({ open, title, children, actions, onClose, wide = false, scroll = false }: Props) {
  const ref = useRef<HTMLDialogElement>(null)
  const titleId = useId()

  useEffect(() => {
    const d = ref.current
    if (!d) return
    if (open && !d.open) {
      d.showModal?.()
      // showModal focuses the first focusable thing, which can be a scrolling area rather than the first field.
      d.querySelector<HTMLElement>("[data-autofocus]")?.focus()
    }
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
      className={`m-auto ${wide ? "w-[min(46rem,calc(100vw-2rem))]" : "w-[min(32rem,calc(100vw-2rem))]"} ${scroll ? "max-h-[calc(100vh-2rem)]" : ""} rounded-[0.6rem] border border-line bg-app p-0 text-ink shadow-panel backdrop:bg-black/40 backdrop:backdrop-blur-[1px]`}
    >
      {open &&
        (scroll ? (
          <div className="flex max-h-[calc(100vh-2rem)] flex-col">
            <h2 id={titleId} className="shrink-0 px-6 pt-6 pb-3 text-[1.2rem] font-semibold">
              {title}
            </h2>
            <div className="min-h-0 flex-1 overflow-y-auto px-6 py-1 text-[0.95rem] leading-relaxed text-ink-soft">
              {children}
            </div>
            <div className="flex shrink-0 justify-end gap-2 border-line border-t px-6 pt-4 pb-5">{actions}</div>
          </div>
        ) : (
          <div className="flex flex-col gap-4 p-6">
            <h2 id={titleId} className="text-[1.2rem] font-semibold">
              {title}
            </h2>
            <div className="text-[0.95rem] leading-relaxed text-ink-soft">{children}</div>
            <div className="mt-2 flex justify-end gap-2">{actions}</div>
          </div>
        ))}
    </dialog>
  )
}
