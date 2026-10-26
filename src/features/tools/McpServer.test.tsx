import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, describe, expect, it, vi } from "vitest"
import { findTool } from "@/domain/catalog"
import { platform } from "@/platform/bridge"
import type { McpServerStatus } from "@/platform/mcp-server-schemas"
import type { TailscaleStatus } from "@/platform/tailscale-schemas"
import { McpServer } from "./McpServer"
import { formProblem } from "./McpServerDialogs"

afterEach(() => vi.restoreAllMocks())

const tool = (id: string) => {
  const found = findTool(id)
  if (!found) throw new Error(`${id} is in the catalog`)
  return found
}

const OFF: McpServerStatus = {
  available: true,
  running: false,
  listening: false,
  startedHere: false,
  startedAt: null,
  port: null,
  connectorUrl: null,
  loginCode: null,
  outdated: false,
  clients: [],
}

const RUNNING: McpServerStatus = {
  available: true,
  running: true,
  listening: true,
  startedHere: true,
  startedAt: new Date().toISOString(),
  port: 9001,
  connectorUrl: "https://x.ts.net/mcp",
  loginCode: { code: "ABCD-EF23", expiresAt: new Date(Date.now() + 600_000).toISOString() },
  outdated: false,
  clients: [{ claimedName: "Claude", lastLoginAt: new Date().toISOString() }],
}

const READY: TailscaleStatus = {
  os: "linux",
  installed: true,
  package: "deb",
  linux: null,
  operator: true,
  user: "alex",
  daemon: true,
  backend: "running",
  https: true,
  funnel: true,
  host: "h.ts.net",
  freePorts: [443, 8443, 10000],
}

const heading = () => screen.getByRole("button", { name: /^MCP server — for chat apps in the browser/ })
const rowOf = (name: string) => screen.getByText(name, { selector: "span" }).closest("li") as HTMLElement

describe("MCP server", () => {
  it("stays closed with a summary, then lists every profile with no profile chosen for the owner", async () => {
    const user = userEvent.setup()
    const status = vi.spyOn(platform, "mcpServerStatus").mockResolvedValue(OFF)
    render(<McpServer tool={tool("tg")} />)

    expect(heading()).toHaveAttribute("aria-expanded", "false")
    await waitFor(() => expect(heading()).toHaveTextContent(/Off$/))
    expect(status.mock.calls.map(([, profile]) => profile).sort()).toEqual(["personal", "work"])

    await user.click(heading())
    expect(within(rowOf("personal")).getByRole("button", { name: "Start the MCP server for personal" })).toBeVisible()
    expect(within(rowOf("work")).getByRole("button", { name: "Start the MCP server for work" })).toBeVisible()
  })

  it("asks a tool without profiles once, with no profile", async () => {
    const status = vi.spyOn(platform, "mcpServerStatus").mockResolvedValue(RUNNING)
    render(<McpServer tool={tool("memo")} />)

    await waitFor(() => expect(heading()).toHaveTextContent(/Running$/))
    expect(status).toHaveBeenCalledExactlyOnceWith("memo", null)
  })

  it("starts the chosen profile's server with the typed address and port, and shows its code and address", async () => {
    const user = userEvent.setup()
    vi.spyOn(platform, "mcpServerStatus").mockResolvedValue(OFF)
    const start = vi.spyOn(platform, "mcpServerStart").mockResolvedValue(RUNNING)
    render(<McpServer tool={tool("tg")} />)
    await user.click(heading())
    await user.click(await screen.findByRole("button", { name: "Start the MCP server for work" }))

    const dialog = screen.getByRole("dialog", { name: "Start the MCP server for tg work" })
    await user.click(within(dialog).getByRole("radio", { name: /A tunnel I run myself/ }))
    await user.type(within(dialog).getByLabelText("The tunnel's address"), "https://x.ts.net/")
    await user.clear(within(dialog).getByLabelText("Port on this computer"))
    await user.type(within(dialog).getByLabelText("Port on this computer"), "9001")
    await user.click(within(dialog).getByRole("button", { name: "Start" }))

    expect(start).toHaveBeenCalledExactlyOnceWith("tg", "work", 9001, "https://x.ts.net")
    const row = rowOf("work")
    await waitFor(() => expect(within(row).getByText("ABCD-EF23")).toBeInTheDocument())
    expect(within(row).getByText("https://x.ts.net/mcp")).toBeInTheDocument()
    expect(within(row).getByText(/Calls itself/)).toHaveTextContent("Calls itself “Claude”")
    expect(within(rowOf("personal")).queryByText("ABCD-EF23")).not.toBeInTheDocument()
  })

  it("says calmly that a tool too old for it gets it with an update, and offers nothing to press", async () => {
    vi.spyOn(platform, "mcpServerStatus").mockResolvedValue({ ...OFF, available: false })
    render(<McpServer tool={tool("tg")} />)

    await waitFor(() => expect(heading()).toHaveTextContent(/Arrives with the next update$/))
    await userEvent.setup().click(heading())
    expect(within(rowOf("personal")).getByText("Arrives with the next update of Telegram")).toBeVisible()
    expect(within(rowOf("personal")).queryByRole("button")).not.toBeInTheDocument()
    expect(screen.queryByRole("alert")).not.toBeInTheDocument()
  })

  it("says why a start failed and keeps the dialog open", async () => {
    const user = userEvent.setup()
    vi.spyOn(platform, "mcpServerStatus").mockResolvedValue(OFF)
    vi.spyOn(platform, "mcpServerStart").mockRejectedValue(new Error("port 8765 is in use — pass another with --port"))
    render(<McpServer tool={tool("tg")} />)
    await user.click(heading())
    await user.click(await screen.findByRole("button", { name: "Start the MCP server for personal" }))
    const dialog = screen.getByRole("dialog")
    await user.click(within(dialog).getByRole("radio", { name: /A tunnel I run myself/ }))
    await user.type(within(dialog).getByLabelText("The tunnel's address"), "https://x.ts.net")
    await user.click(within(dialog).getByRole("button", { name: "Start" }))

    expect(await within(dialog).findByRole("alert")).toHaveTextContent("port 8765 is in use")
  })

  it("stops only a server it started, and forgets logins after a confirmation", async () => {
    const user = userEvent.setup()
    vi.spyOn(platform, "mcpServerStatus").mockImplementation(async (_, profile) =>
      profile === "work" ? { ...RUNNING, startedHere: false } : RUNNING,
    )
    const stop = vi.spyOn(platform, "mcpServerStop").mockResolvedValue()
    const revoke = vi.spyOn(platform, "mcpServerRevoke").mockResolvedValue()
    render(<McpServer tool={tool("tg")} />)
    await user.click(heading())

    await waitFor(() => expect(within(rowOf("work")).getByText(/stop it there/)).toBeInTheDocument())
    expect(within(rowOf("work")).queryByRole("button", { name: /Stop/ })).not.toBeInTheDocument()

    await user.click(within(rowOf("personal")).getByRole("button", { name: "Stop the MCP server for personal" }))
    expect(stop).toHaveBeenCalledExactlyOnceWith("tg", "personal")

    await user.click(within(rowOf("personal")).getByRole("button", { name: "Forget all logins" }))
    const dialog = screen.getByRole("dialog", { name: "Forget every login to tg personal?" })
    expect(revoke).not.toHaveBeenCalled()
    await user.click(within(dialog).getByRole("button", { name: "Forget all logins" }))
    expect(revoke).toHaveBeenCalledExactlyOnceWith("tg", "personal")
  })
})

describe("the start form", () => {
  it("takes a tunnel's https address and a port above 1023", () => {
    expect(formProblem("https://laptop.tail1234.ts.net", "8765")).toBeNull()
    expect(formProblem("http://127.0.0.1:8765", "8765")).toBeNull()
    expect(formProblem("http://laptop.ts.net", "8765")).toMatch(/https/)
    expect(formProblem("https://x.ts.net/mcp", "8765")).toMatch(/alone/)
    expect(formProblem("https://x.ts.net", "80")).toMatch(/1024/)
  })

  it("turns Funnel on first and starts the server with the address Funnel got", async () => {
    const user = userEvent.setup()
    vi.spyOn(platform, "mcpServerStatus").mockResolvedValue(OFF)
    vi.spyOn(platform, "tailscaleStatus").mockResolvedValue(READY)
    const open = vi.spyOn(platform, "tailscaleFunnelOpen").mockResolvedValue("https://h.ts.net:8443")
    const start = vi.spyOn(platform, "mcpServerStart").mockResolvedValue(RUNNING)
    render(<McpServer tool={tool("tg")} />)
    await user.click(heading())
    await user.click(await screen.findByRole("button", { name: "Start the MCP server for work" }))
    const dialog = screen.getByRole("dialog")

    expect(await within(dialog).findByText(/turns Funnel on from/)).toHaveTextContent("https://h.ts.net")
    await user.click(within(dialog).getByRole("button", { name: "Start" }))

    expect(open).toHaveBeenCalledWith("tg", "work", 8765, expect.any(Function))
    await waitFor(() => expect(start).toHaveBeenCalledExactlyOnceWith("tg", "work", 8765, "https://h.ts.net:8443"))
  })

  it("takes the Funnel down again when the server then fails to start", async () => {
    const user = userEvent.setup()
    vi.spyOn(platform, "mcpServerStatus").mockResolvedValue(OFF)
    vi.spyOn(platform, "tailscaleStatus").mockResolvedValue(READY)
    vi.spyOn(platform, "tailscaleFunnelOpen").mockResolvedValue("https://h.ts.net")
    vi.spyOn(platform, "mcpServerStart").mockRejectedValue(new Error("port 8765 is in use"))
    const close = vi.spyOn(platform, "tailscaleFunnelClose").mockResolvedValue()
    render(<McpServer tool={tool("tg")} />)
    await user.click(heading())
    await user.click(await screen.findByRole("button", { name: "Start the MCP server for personal" }))
    const dialog = screen.getByRole("dialog")
    await within(dialog).findByText(/turns Funnel on from/)
    await user.click(within(dialog).getByRole("button", { name: "Start" }))

    expect(await within(dialog).findByRole("alert")).toHaveTextContent("port 8765 is in use")
    expect(close).toHaveBeenCalledExactlyOnceWith("tg", "personal")
  })

  it("keeps Start off until every Tailscale step is done, and Check says what is missing", async () => {
    const user = userEvent.setup()
    vi.spyOn(platform, "mcpServerStatus").mockResolvedValue(OFF)
    const status = vi.spyOn(platform, "tailscaleStatus").mockResolvedValue({ ...READY, backend: "needsLogin" })
    render(<McpServer tool={tool("tg")} />)
    await user.click(heading())
    await user.click(await screen.findByRole("button", { name: "Start the MCP server for personal" }))
    const dialog = screen.getByRole("dialog")

    expect(await within(dialog).findByRole("button", { name: "Log in" })).toBeVisible()
    expect(within(dialog).getByRole("button", { name: "Start" })).toBeDisabled()
    await user.click(within(dialog).getByRole("button", { name: "Check: Log in to Tailscale" }))
    expect(await within(dialog).findByText("This computer is not logged in to Tailscale.")).toBeVisible()
    expect(status.mock.calls.length).toBeGreaterThanOrEqual(2)
  })

  it("turns off on Stop only a Funnel the app set up that still points here", async () => {
    const user = userEvent.setup()
    vi.spyOn(platform, "mcpServerStatus").mockResolvedValue({ ...RUNNING, connectorUrl: "https://h.ts.net/mcp" })
    vi.spyOn(platform, "tailscaleFunnels").mockResolvedValue([
      { tool: "tg", profile: "personal", url: "https://h.ts.net", port: 9001, live: true },
      { tool: "tg", profile: "work", url: "https://h.ts.net:8443", port: 9002, live: false },
    ])
    vi.spyOn(platform, "mcpServerStop").mockResolvedValue()
    const close = vi.spyOn(platform, "tailscaleFunnelClose").mockResolvedValue()
    render(<McpServer tool={tool("tg")} />)
    await user.click(heading())
    await screen.findByText("personal", { selector: "span" })

    expect(await within(rowOf("personal")).findByText(/through Tailscale Funnel/)).toBeVisible()
    await user.click(within(rowOf("work")).getByRole("button", { name: "Stop the MCP server for work" }))
    expect(close).not.toHaveBeenCalled()
    await user.click(within(rowOf("personal")).getByRole("button", { name: "Stop the MCP server for personal" }))
    await waitFor(() => expect(close).toHaveBeenCalledExactlyOnceWith("tg", "personal"))
  })
})
