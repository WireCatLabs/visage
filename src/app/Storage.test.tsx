import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it } from "vitest"
import { useOnboarding } from "@/features/onboarding/store"
import { App } from "./App"

describe("Storage", () => {
  beforeEach(() => useOnboarding.setState({ status: "done", open: false }))

  it("shows what is in storage, breaks it down, and says what each folder entry is", async () => {
    const user = userEvent.setup()
    render(<App />)
    await user.click(screen.getByRole("button", { name: /Storage/ }))

    const archive = await screen.findByRole("region", { name: "In storage" })
    expect(await within(archive).findByText("15,594", {}, { timeout: 4000 })).toBeInTheDocument()
    expect(within(archive).getByText("tg store info")).toBeInTheDocument()
    expect(within(archive).getByRole("table", { name: "By source" })).toHaveTextContent("via tg")
    expect(within(archive).getByRole("table", { name: "By source" })).toHaveTextContent("WhatsApp")

    await user.click(within(archive).getByRole("button", { name: "Chat type" }))
    expect(within(archive).getByRole("table", { name: "By chat type" })).toHaveTextContent("Telegram · Groups")

    const tg = await screen.findByRole("list", { name: "What Telegram keeps" }, { timeout: 4000 })
    expect(within(tg).getByText(/Credentials: size only/)).toBeInTheDocument()
  }, 15000)

  it("lists the database's tables, measures their sizes and checks its health", async () => {
    const user = userEvent.setup()
    render(<App />)
    await user.click(screen.getByRole("button", { name: /Storage/ }))

    const tables = await screen.findByRole("table", { name: "Tables" }, { timeout: 4000 })
    expect(within(tables).getByRole("rowheader", { name: "messages" })).toBeInTheDocument()
    expect(screen.getByText(/Search index tables \(30\)/)).toBeInTheDocument()
    expect(screen.getByText(/The backup job has not finished since/)).toBeInTheDocument()

    await user.type(screen.getByRole("searchbox", { name: "Find a table" }), "email")
    expect(within(screen.getByRole("table", { name: "Tables" })).getAllByRole("row")).toHaveLength(4)

    await user.click(screen.getByRole("button", { name: "Measure sizes" }))
    expect(await screen.findByText(/Measured in/, {}, { timeout: 5000 })).toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: "Check health" }))
    expect(await screen.findByText("No problems found", {}, { timeout: 6000 })).toBeInTheDocument()
  }, 20000)
})
