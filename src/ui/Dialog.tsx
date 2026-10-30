import { type ReactNode, useEffect, useId, useRef, useState } from "react"
import { reducedMotion } from "./motion"

const CLOSE_MS = 150

type Props = {
  open: boolean
  title: string
  children: ReactNode
  actions: ReactNode
  onClose: () => void
  wide?: boolean
  /** Long forms: the body scrolls between a fixed title and fixed actions, so nothing is cut off. */
  scroll?: boolean
  /** Quiet links under the actions, for what the reader rarely needs. */
  footer?: ReactNode
}

/** The platform's modal <dialog>: focus is trapped, Escape closes, and the page behind is inert. */
export function Dialog({ open, title, children, actions, onClose, wide = false, scroll = false, footer }: Props) {
  const ref = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  // The content stays while the dialog fades out, so it does not go blank before it goes away.
  const [closing, setClosing] = useState(false)
  const last = useRef({ title, children, actions, footer })
  if (open) last.current = { title, children, actions, footer }

  useEffect(() => {
    const d = ref.current
    if (!d) return
    if (open) {
      setClosing(false)
      if (!d.open) {
        d.showModal?.()
        // showModal focuses the first focusable thing, which can be a scrolling area rather than the first field.
        d.querySelector<HTMLElement>("[data-autofocus]")?.focus()
      }
      return
    }
    if (!d.open) return
    if (reducedMotion()) {
      d.close()
      return
    }
    setClosing(true)
    const t = setTimeout(() => {
      d.close()
      setClosing(false)
    }, CLOSE_MS)
    return () => clearTimeout(t)
  }, [open])

  const shown = open ? { title, children, actions, footer } : last.current

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      data-closing={closing || undefined}
      aria-hidden={closing || undefined}
      inert={closing || undefined}
      onClose={onClose}
      onCancel={(e) => {
        e.preventDefault()
        onClose()
      }}
      className={`m-auto ${wide ? "w-[min(46rem,calc(100vw-2rem))]" : "w-[min(32rem,calc(100vw-2rem))]"} ${scroll ? "max-h-[calc(100vh-2rem)]" : ""} rounded-[0.6rem] border border-line bg-app p-0 text-ink shadow-panel backdrop:bg-black/40 backdrop:backdrop-blur-[1px]`}
    >
      {(open || closing) &&
        (scroll ? (
          <div className="flex max-h-[calc(100vh-2rem)] flex-col">
            <h2 id={titleId} className="shrink-0 px-6 pt-6 pb-3 text-[1.2rem] font-semibold">
              {shown.title}
            </h2>
            <div className="min-h-0 flex-1 overflow-y-auto px-6 py-1 text-[0.95rem] leading-relaxed text-ink-soft">
              {shown.children}
            </div>
            <div className="flex shrink-0 justify-end gap-2 border-line border-t px-6 pt-4 pb-5">{shown.actions}</div>
            {shown.footer && <div className="shrink-0 px-6 pb-5">{shown.footer}</div>}
          </div>
        ) : (
          <div className="flex flex-col gap-4 p-6">
            <h2 id={titleId} className="text-[1.2rem] font-semibold">
              {shown.title}
            </h2>
            <div className="text-[0.95rem] leading-relaxed text-ink-soft">{shown.children}</div>
            <div className="mt-2 flex justify-end gap-2">{shown.actions}</div>
            {shown.footer}
          </div>
        ))}
    </dialog>
  )
}
