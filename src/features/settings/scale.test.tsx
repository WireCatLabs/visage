import { fireEvent, render, renderHook, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it } from "vitest"
import { AppPreferences } from "./AppPreferences"
import { clampScale, scaleKey, useApplyScale, useScale, useScaleKeys } from "./scale"

const key = (init: KeyboardEventInit) => new KeyboardEvent("keydown", { cancelable: true, ...init })
const cssScale = () => document.documentElement.style.getPropertyValue("--ui-scale")

beforeEach(() => {
  localStorage.clear()
  useScale.setState({ percent: 100 })
  document.documentElement.style.removeProperty("--ui-scale")
})

describe("interface scale", () => {
  it("keeps a saved or asked size on a 10% step between 80% and 150%", () => {
    expect([clampScale(73), clampScale(114), clampScale(160), clampScale(Number.NaN)]).toEqual([80, 110, 150, 100])
    useScale.getState().set(200)
    expect(useScale.getState().percent).toBe(150)
  })

  it("reads Ctrl + = / - / 0, Cmd on macOS, by key position too, so a Spanish keyboard works", () => {
    expect(scaleKey(key({ ctrlKey: true, key: "=", code: "Equal" }), false)).toBe("bigger")
    expect(scaleKey(key({ ctrlKey: true, key: "¡", code: "Equal" }), false)).toBe("bigger")
    expect(scaleKey(key({ ctrlKey: true, key: "+", code: "NumpadAdd" }), false)).toBe("bigger")
    expect(scaleKey(key({ ctrlKey: true, key: "-", code: "Minus" }), false)).toBe("smaller")
    expect(scaleKey(key({ ctrlKey: true, key: "0", code: "Digit0" }), false)).toBe("reset")
    expect(scaleKey(key({ metaKey: true, key: "=", code: "Equal" }), true)).toBe("bigger")
    expect(scaleKey(key({ ctrlKey: true, key: "=", code: "Equal" }), true)).toBeNull()
    expect(scaleKey(key({ key: "=", code: "Equal" }), false)).toBeNull()
  })

  it("changes the size from the keyboard anywhere and stops at the ends", () => {
    renderHook(() => useScaleKeys())
    const press = (k: string, code: string) => {
      const e = key({ ctrlKey: true, key: k, code })
      window.dispatchEvent(e)
      return e
    }
    expect(press("=", "Equal").defaultPrevented).toBe(true)
    expect(useScale.getState().percent).toBe(110)
    for (let i = 0; i < 10; i++) press("=", "Equal")
    expect(useScale.getState().percent).toBe(150)
    press("0", "Digit0")
    expect(useScale.getState().percent).toBe(100)
    for (let i = 0; i < 10; i++) press("-", "Minus")
    expect(useScale.getState().percent).toBe(80)
  })

  it("applies a slider position on release, not while it is dragged, and resets to the default", async () => {
    const user = userEvent.setup()
    renderHook(() => useApplyScale())
    render(<AppPreferences />)
    const slider = screen.getByRole("slider", { name: "Interface size" })
    const reset = screen.getByRole("button", { name: "Reset to default" })
    expect(reset).toBeDisabled()

    fireEvent.input(slider, { target: { value: "130" } })
    expect(screen.getByText("130%")).toBeInTheDocument()
    expect(useScale.getState().percent).toBe(100)

    fireEvent.change(slider, { target: { value: "130" } })
    expect(useScale.getState().percent).toBe(130)
    await waitFor(() => expect(cssScale()).toBe("1.3"))
    expect(JSON.parse(localStorage.getItem("wirecat.scale") ?? "{}").state.percent).toBe(130)

    await user.click(reset)
    expect(useScale.getState().percent).toBe(100)
    expect(slider).toHaveValue("100")
    await waitFor(() => expect(cssScale()).toBe("1"))
  })
})
