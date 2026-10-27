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
  connectorUrl: "https://x.ts.net/tg/mcp",
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
const row = () => screen.getByRole("list", { name: /MCP server$/ })

describe("MCP server", () => {
  it("stays closed with a summary, then shows one server for every profile, with no profile asked", async () => {
    const user = userEvent.setup()
    const status = vi.spyOn(platform, "mcpServerStatus").mockResolvedValue(OFF)
    render(<McpServer tool={tool("tg")} />)

    expect(heading()).toHaveAttribute("aria-expanded", "false")
    await waitFor(() => expect(heading()).toHaveTextContent(/Off$/))
    expect(status).toHaveBeenCalledExactlyOnceWith("tg")

    await user.click(heading())
    expect(within(row()).getAllByRole("listitem")).toHaveLength(1)
    expect(within(row()).getByRole("button", { name: "Start the MCP server for tg" })).toBeVisible()
    expect(screen.getByText(/reaches every profile, each with its own permissions/)).toBeVisible()
  })

  it("starts the server with the typed address and port, and shows its code and address", async () => {
    const user = userEvent.setup()
    vi.spyOn(platform, "mcpServerStatus").mockResolvedValue(OFF)
    const start = vi.spyOn(platform, "mcpServerStart").mockResolvedValue(RUNNING)
    render(<McpServer tool={tool("tg")} />)
    await user.click(heading())
    await user.click(await screen.findByRole("button", { name: "Start the MCP server for tg" }))

    const dialog = screen.getByRole("dialog", { name: "Start the MCP server for tg" })
    await user.click(within(dialog).getByRole("radio", { name: /A tunnel I run myself/ }))
    await user.type(within(dialog).getByLabelText(/The tunnel's address/), "https://x.ts.net/tg/")
    await user.clear(within(dialog).getByLabelText("Port on this computer"))
    await user.type(within(dialog).getByLabelText("Port on this computer"), "9001")
    await user.click(within(dialog).getByRole("button", { name: "Start" }))

    expect(start).toHaveBeenCalledExactlyOnceWith("tg", 9001, "https://x.ts.net/tg")
    await waitFor(() => expect(within(row()).getByText("ABCD-EF23")).toBeInTheDocument())
    expect(within(row()).getByText("https://x.ts.net/tg/mcp")).toBeInTheDocument()
    expect(within(row()).getByText(/Calls itself/)).toHaveTextContent("Calls itself “Claude”")
  })

  it("says calmly that a tool too old for it gets it with an update, and offers nothing to press", async () => {
    vi.spyOn(platform, "mcpServerStatus").mockResolvedValue({ ...OFF, available: false })
    render(<McpServer tool={tool("tg")} />)

    await waitFor(() => expect(heading()).toHaveTextContent(/Arrives with the next update$/))
    await userEvent.setup().click(heading())
    expect(within(row()).getByText("Arrives with the next update of Telegram")).toBeVisible()
    expect(within(row()).queryByRole("button")).not.toBeInTheDocument()
    expect(screen.queryByRole("alert")).not.toBeInTheDocument()
  })

  it("says why a start failed and keeps the dialog open", async () => {
    const user = userEvent.setup()
    vi.spyOn(platform, "mcpServerStatus").mockResolvedValue(OFF)
    vi.spyOn(platform, "mcpServerStart").mockRejectedValue(new Error("port 8765 is in use — pass another with --port"))
    render(<McpServer tool={tool("tg")} />)
    await user.click(heading())
    await user.click(await screen.findByRole("button", { name: "Start the MCP server for tg" }))
    const dialog = screen.getByRole("dialog")
    await user.click(within(dialog).getByRole("radio", { name: /A tunnel I run myself/ }))
    await user.type(within(dialog).getByLabelText(/The tunnel's address/), "https://x.ts.net")
    await user.click(within(dialog).getByRole("button", { name: "Start" }))

    expect(await within(dialog).findByRole("alert")).toHaveTextContent("port 8765 is in use")
  })

  it("does not offer Stop for a server started in a terminal", async () => {
    vi.spyOn(platform, "mcpServerStatus").mockResolvedValue({ ...RUNNING, startedHere: false })
    render(<McpServer tool={tool("tg")} />)
    await userEvent.setup().click(heading())

    await waitFor(() => expect(within(row()).getByText(/stop it there/)).toBeInTheDocument())
    expect(within(row()).queryByRole("button", { name: /Stop/ })).not.toBeInTheDocument()
  })

  it("stops the server it started, and forgets logins after a confirmation", async () => {
    const user = userEvent.setup()
    vi.spyOn(platform, "mcpServerStatus").mockResolvedValue(RUNNING)
    const stop = vi.spyOn(platform, "mcpServerStop").mockResolvedValue()
    const revoke = vi.spyOn(platform, "mcpServerRevoke").mockResolvedValue()
    render(<McpServer tool={tool("tg")} />)
    await user.click(heading())

    await user.click(await within(row()).findByRole("button", { name: "Stop the MCP server for tg" }))
    expect(stop).toHaveBeenCalledExactlyOnceWith("tg")

    await user.click(within(row()).getByRole("button", { name: "Forget all logins" }))
    const dialog = screen.getByRole("dialog", { name: "Forget every login to tg?" })
    expect(revoke).not.toHaveBeenCalled()
    await user.click(within(dialog).getByRole("button", { name: "Forget all logins" }))
    expect(revoke).toHaveBeenCalledExactlyOnceWith("tg")
  })
})

describe("the start form", () => {
  it("takes a tunnel's https address, with one plain path at most, and a port above 1023", () => {
    expect(formProblem("https://laptop.tail1234.ts.net", "8765")).toBeNull()
    expect(formProblem("https://laptop.tail1234.ts.net/tg", "8765")).toBeNull()
    expect(formProblem("http://127.0.0.1:8765", "8765")).toBeNull()
    expect(formProblem("http://laptop.ts.net", "8765")).toMatch(/https/)
    expect(formProblem("https://x.ts.net/tg/mcp", "8765")).toMatch(/path of its own/)
    expect(formProblem("https://x.ts.net/.well-known", "8765")).toMatch(/path of its own/)
    expect(formProblem("https://x.ts.net", "80")).toMatch(/1024/)
  })

  it("turns Funnel on first and starts the server with the tool's path of the address Funnel got", async () => {
    const user = userEvent.setup()
    vi.spyOn(platform, "mcpServerStatus").mockResolvedValue(OFF)
    vi.spyOn(platform, "tailscaleStatus").mockResolvedValue(READY)
    const open = vi.spyOn(platform, "tailscaleFunnelOpen").mockResolvedValue("https://h.ts.net/tg")
    const start = vi.spyOn(platform, "mcpServerStart").mockResolvedValue(RUNNING)
    render(<McpServer tool={tool("tg")} />)
    await user.click(heading())
    await user.click(await screen.findByRole("button", { name: "Start the MCP server for tg" }))
    const dialog = screen.getByRole("dialog")

    expect(await within(dialog).findByText(/turns Funnel on from/)).toHaveTextContent("https://h.ts.net/tg")
    await user.click(within(dialog).getByRole("button", { name: "Start" }))

    expect(open).toHaveBeenCalledWith("tg", 8765, expect.any(Function))
    await waitFor(() => expect(start).toHaveBeenCalledExactlyOnceWith("tg", 8765, "https://h.ts.net/tg"))
  })

  it("takes the Funnel down again when the server then fails to start", async () => {
    const user = userEvent.setup()
    vi.spyOn(platform, "mcpServerStatus").mockResolvedValue(OFF)
    vi.spyOn(platform, "tailscaleStatus").mockResolvedValue(READY)
    vi.spyOn(platform, "tailscaleFunnelOpen").mockResolvedValue("https://h.ts.net/tg")
    vi.spyOn(platform, "mcpServerStart").mockRejectedValue(new Error("port 8765 is in use"))
    const close = vi.spyOn(platform, "tailscaleFunnelClose").mockResolvedValue()
    render(<McpServer tool={tool("tg")} />)
    await user.click(heading())
    await user.click(await screen.findByRole("button", { name: "Start the MCP server for tg" }))
    const dialog = screen.getByRole("dialog")
    await within(dialog).findByText(/turns Funnel on from/)
    await user.click(within(dialog).getByRole("button", { name: "Start" }))

    expect(await within(dialog).findByRole("alert")).toHaveTextContent("port 8765 is in use")
    expect(close).toHaveBeenCalledExactlyOnceWith("tg")
  })

  it("keeps Start off until every Tailscale step is done, and Check says what is missing", async () => {
    const user = userEvent.setup()
    vi.spyOn(platform, "mcpServerStatus").mockResolvedValue(OFF)
    const status = vi.spyOn(platform, "tailscaleStatus").mockResolvedValue({ ...READY, backend: "needsLogin" })
    render(<McpServer tool={tool("tg")} />)
    await user.click(heading())
    await user.click(await screen.findByRole("button", { name: "Start the MCP server for tg" }))
    const dialog = screen.getByRole("dialog")

    expect(await within(dialog).findByRole("button", { name: "Log in" })).toBeVisible()
    expect(within(dialog).getByRole("button", { name: "Start" })).toBeDisabled()
    await user.click(within(dialog).getByRole("button", { name: "Check: Log in to Tailscale" }))
    expect(await within(dialog).findByText("This computer is not logged in to Tailscale.")).toBeVisible()
    expect(status.mock.calls.length).toBeGreaterThanOrEqual(2)
  })

  it("turns off on Stop the Funnel the app set up that still points here", async () => {
    const user = userEvent.setup()
    vi.spyOn(platform, "mcpServerStatus").mockResolvedValue({ ...RUNNING, connectorUrl: "https://h.ts.net/tg/mcp" })
    vi.spyOn(platform, "tailscaleFunnels").mockResolvedValue([
      { tool: "tg", profile: null, url: "https://h.ts.net/tg", port: 9001, live: true, shared: true },
    ])
    vi.spyOn(platform, "mcpServerStop").mockResolvedValue()
    const close = vi.spyOn(platform, "tailscaleFunnelClose").mockResolvedValue()
    render(<McpServer tool={tool("tg")} />)
    await user.click(heading())

    expect(await within(row()).findByText(/through Tailscale Funnel/)).toBeVisible()
    await user.click(within(row()).getByRole("button", { name: "Stop the MCP server for tg" }))
    await waitFor(() => expect(close).toHaveBeenCalledExactlyOnceWith("tg"))
  })

  it("offers to turn off a whole-port Funnel left from a server of one profile", async () => {
    const user = userEvent.setup()
    vi.spyOn(platform, "mcpServerStatus").mockResolvedValue(OFF)
    vi.spyOn(platform, "tailscaleFunnels").mockResolvedValue([
      { tool: "tg", profile: "work", url: "https://h.ts.net:8443", port: 9002, live: true, shared: false },
    ])
    const close = vi.spyOn(platform, "tailscaleFunnelClose").mockResolvedValue()
    render(<McpServer tool={tool("tg")} />)
    await user.click(heading())

    expect(await within(row()).findByText(/older Tailscale Funnel for profile work/)).toHaveTextContent(
      "https://h.ts.net:8443",
    )
    await user.click(within(row()).getByRole("button", { name: "Turn it off" }))
    expect(close).toHaveBeenCalledExactlyOnceWith("tg")
  })
})
