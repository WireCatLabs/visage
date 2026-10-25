import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { Skeleton, StableText } from "./Skeleton"

describe("Skeleton", () => {
  it("announces only the placeholder that carries a label", () => {
    render(
      <p>
        <Skeleton chars={7} label="Checking this computer" />
        <Skeleton chars={5} />
      </p>,
    )
    expect(screen.getAllByRole("status")).toHaveLength(1)
    expect(screen.getByRole("status")).toHaveTextContent("Checking this computer")
  })
})

describe("StableText", () => {
  it("shows one label while keeping room for the others", () => {
    const { container } = render(<StableText value="Checking…" variants={["Check again", "Checking…"]} />)
    expect(screen.getByText("Checking…")).toBeInTheDocument()
    expect(screen.queryByText("Check again")).not.toBeInTheDocument()
    expect(container.querySelector('[data-text="Check again"]')).toHaveAttribute("aria-hidden", "true")
    expect(container.querySelectorAll("[data-text]")).toHaveLength(1)
  })
})
