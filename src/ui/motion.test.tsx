import { act, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { Collapse } from "./Collapse"
import { focusInPlace, PANEL_MS } from "./motion"

const reduce = (on: boolean) => {
  vi.spyOn(window, "matchMedia").mockImplementation(
    (query: string) => ({ matches: on && query.includes("reduce"), media: query }) as MediaQueryList,
  )
}

describe("Collapse", () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it("keeps closing content on screen until it has folded away, then unmounts it", () => {
    reduce(false)
    const { rerender } = render(<Collapse open>{<p>Details</p>}</Collapse>)
    rerender(<Collapse open={false}>{<p>Details</p>}</Collapse>)
    expect(screen.getByText("Details")).toBeInTheDocument()
    expect(screen.getByText("Details").closest("[data-state]")).toHaveAttribute("inert")
    act(() => vi.advanceTimersByTime(PANEL_MS))
    expect(screen.queryByText("Details")).not.toBeInTheDocument()
  })

  it("mounts new content at once when it opens", () => {
    reduce(false)
    const { rerender } = render(<Collapse open={false}>{<p>Details</p>}</Collapse>)
    expect(screen.queryByText("Details")).not.toBeInTheDocument()
    rerender(<Collapse open>{<p>Details</p>}</Collapse>)
    expect(screen.getByText("Details").closest("[data-state]")).toHaveAttribute("data-state", "open")
    expect(screen.getByText("Details").closest("[data-state]")).not.toHaveAttribute("inert")
  })

  it("closes at once under reduced motion", () => {
    reduce(true)
    const { rerender } = render(<Collapse open>{<p>Details</p>}</Collapse>)
    rerender(<Collapse open={false}>{<p>Details</p>}</Collapse>)
    act(() => vi.advanceTimersByTime(0))
    expect(screen.queryByText("Details")).not.toBeInTheDocument()
  })
})

describe("focusInPlace", () => {
  afterEach(() => vi.restoreAllMocks())

  const target = (top: number) => {
    const el = document.createElement("h5")
    el.tabIndex = -1
    document.body.append(el)
    el.getBoundingClientRect = () => ({ top, bottom: top + 20 }) as DOMRect
    el.scrollIntoView = vi.fn()
    return el
  }

  it("focuses without scrolling when the target is already in sight", () => {
    reduce(false)
    const el = target(100)
    const focus = vi.spyOn(el, "focus")
    focusInPlace(el)
    expect(focus).toHaveBeenCalledWith({ preventScroll: true })
    expect(el.scrollIntoView).not.toHaveBeenCalled()
  })

  it("brings an off-screen target into view smoothly, or at once under reduced motion", () => {
    reduce(false)
    const below = target(window.innerHeight + 50)
    focusInPlace(below)
    expect(below.scrollIntoView).toHaveBeenCalledWith({ block: "nearest", behavior: "smooth" })
    reduce(true)
    const again = target(-80)
    focusInPlace(again)
    expect(again.scrollIntoView).toHaveBeenCalledWith({ block: "nearest", behavior: "auto" })
  })
})
