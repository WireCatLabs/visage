import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it } from "vitest"
import { useOnboarding } from "@/features/onboarding/store"
import { App } from "./App"

describe("Storage", () => {
  beforeEach(() => useOnboarding.setState({ status: "done", open: false }))

  it("shows what the archive holds, breaks it down, and says what each folder entry is", async () => {
    const user = userEvent.setup()
    render(<App />)
    await user.click(screen.getByRole("button", { name: /Storage/ }))

    const archive = await screen.findByRole("region", { name: "In the archive" })
    expect(await within(archive).findByText("15,594")).toBeInTheDocument()
    expect(within(archive).getByText(/Asked Telegram/)).toBeInTheDocument()
    expect(within(archive).getByRole("table", { name: "By messenger" })).toHaveTextContent("WhatsApp")

    await user.click(within(archive).getByRole("button", { name: "Chat type" }))
    expect(within(archive).getByRole("table", { name: "By chat type" })).toHaveTextContent("Telegram · Groups")

    const tg = await screen.findByRole("list", { name: "What Telegram keeps" })
    expect(within(tg).getByText(/Credentials: size only/)).toBeInTheDocument()
  }, 15000)
})
