import { act, render, screen } from "@testing-library/react"
import { useEffect } from "react"
import { afterEach, beforeEach, expect, it, vi } from "vitest"
import { Crossfade, FADE_MS } from "./Crossfade"

const reduce = (on: boolean) => {
  vi.spyOn(window, "matchMedia").mockImplementation(
    (query: string) => ({ matches: on && query.includes("reduce"), media: query }) as MediaQueryList,
  )
}

const mounts: string[] = []
function Pane({ name }: { name: string }) {
  useEffect(() => {
    mounts.push(name)
  }, [name])
  return <h2>{name}</h2>
}

beforeEach(() => {
  vi.useFakeTimers()
  mounts.length = 0
})
afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

it("keeps the old view mounted and inert beside the new one until it has faded, never rebuilding it", () => {
  reduce(false)
  const { rerender } = render(<Crossfade swap="claude">{<Pane name="Claude" />}</Crossfade>)
  rerender(<Crossfade swap="codex">{<Pane name="Codex" />}</Crossfade>)

  expect(screen.getByText("Claude").closest("[inert]")).not.toBeNull()
  expect(screen.getByText("Codex").closest("[inert]")).toBeNull()
  expect(mounts).toEqual(["Claude", "Codex"])

  act(() => vi.advanceTimersByTime(FADE_MS))
  expect(screen.queryByText("Claude")).not.toBeInTheDocument()
  expect(screen.getByText("Codex")).toBeInTheDocument()
  expect(mounts).toEqual(["Claude", "Codex"])
})

it("swaps at once under reduced motion", () => {
  reduce(true)
  const { rerender } = render(<Crossfade swap="claude">{<Pane name="Claude" />}</Crossfade>)
  rerender(<Crossfade swap="codex">{<Pane name="Codex" />}</Crossfade>)
  expect(screen.queryByText("Claude")).not.toBeInTheDocument()
})
