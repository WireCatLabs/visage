import type { HTMLAttributes, KeyboardEvent, MouseEvent } from "react"
import { selectsTextIn } from "./selection"

type Props = Omit<HTMLAttributes<HTMLElement>, "onClick" | "onKeyDown" | "role" | "tabIndex"> & {
  as?: "div" | "span"
  onClick: (e: MouseEvent<HTMLElement> | KeyboardEvent<HTMLElement>) => void
}

/**
 * A button whose text the owner can select and copy. WebKit never starts a selection inside a <button>, so this is
 * an element with role=button; the click that ends a drag over its text does not press it.
 */
export function TextButton({ as: Tag = "span", onClick, ...rest }: Props) {
  return (
    <Tag
      role="button"
      tabIndex={0}
      {...rest}
      onClick={(e) => {
        if (!selectsTextIn(e.currentTarget)) onClick(e)
      }}
      onKeyDown={(e) => {
        if (e.key !== "Enter" && e.key !== " ") return
        e.preventDefault()
        onClick(e)
      }}
    />
  )
}
