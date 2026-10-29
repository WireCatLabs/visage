import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { useState } from "react"
import { describe, expect, it } from "vitest"
import { Select } from "./Select"

function Picker() {
  const [value, setValue] = useState("")
  return (
    <>
      <label htmlFor="pick">Tool</label>
      <Select
        id="pick"
        value={value}
        onChange={setValue}
        options={[
          { label: "The app", options: [{ value: "app", label: "WireCat Desktop" }] },
          {
            label: "A tool",
            options: [
              { value: "tg", label: "Telegram" },
              { value: "old", label: "Teletype", disabled: true },
              { value: "max", label: "MAX" },
            ],
          },
        ]}
      />
    </>
  )
}

describe("Select", () => {
  it("is driven by the keyboard: arrows skip disabled options, type-ahead jumps, Escape keeps the value", async () => {
    const user = userEvent.setup()
    render(<Picker />)
    const box = screen.getByRole("combobox", { name: "Tool" })
    expect(box).toHaveTextContent("Choose…")

    box.focus()
    await user.keyboard("{ArrowDown}")
    expect(box).toHaveAttribute("aria-expanded", "true")
    expect(screen.getByRole("group", { name: "A tool" })).toBeInTheDocument()
    await user.keyboard("{ArrowDown}{ArrowDown}")
    expect(box).toHaveAttribute("aria-activedescendant", screen.getByRole("option", { name: "MAX" }).id)
    await user.keyboard("{Enter}")
    expect(box).toHaveTextContent("MAX")
    expect(box).toHaveAttribute("aria-expanded", "false")
    expect(box).toHaveFocus()

    await user.keyboard("{Enter}w")
    expect(box).toHaveAttribute("aria-activedescendant", screen.getByRole("option", { name: "WireCat Desktop" }).id)
    await user.keyboard("{Escape}")
    expect(box).toHaveTextContent("MAX")
    expect(box).toHaveFocus()
  })
})
