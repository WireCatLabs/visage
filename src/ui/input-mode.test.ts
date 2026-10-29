import { fireEvent } from "@testing-library/react"
import { afterEach, expect, it } from "vitest"
import { trackInputMode } from "./input-mode"

let stop: () => void = () => undefined
afterEach(() => {
  stop()
  delete document.documentElement.dataset.input
})

it("hides rings after a click and brings them back on a navigation key, not on typing", () => {
  stop = trackInputMode()
  const root = document.documentElement

  fireEvent.pointerDown(document.body)
  expect(root.dataset.input).toBe("pointer")

  fireEvent.keyDown(document.body, { key: "a" })
  expect(root.dataset.input).toBe("pointer")

  fireEvent.keyDown(document.body, { key: "Tab" })
  expect(root.dataset.input).toBe("keyboard")

  fireEvent.keyDown(document.body, { key: "ArrowDown" })
  fireEvent.pointerDown(document.body)
  expect(root.dataset.input).toBe("pointer")
})
