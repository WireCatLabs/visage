import { cleanup, render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { findTool } from "@/domain/catalog"
import { platform } from "@/platform/bridge"
import type { CloudflareStatus } from "@/platform/cloudflare-schemas"
import type { McpClient, McpServerStatus } from "@/platform/mcp-server-schemas"
import type { TailscaleStatus } from "@/platform/tailscale-schemas"
import { PRIVACY } from "./CloudflareGuide"
import { McpServer } from "./McpServer"
import { formProblem } from "./McpServerDialogs"

beforeEach(() => {
  vi.spyOn(platform, "mcpServerPublic").mockResolvedValue({ host: "x.ts.net", dns: "live", answer: { kind: "ok" } })
})

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

const tool = (id: string) => {
  const found = findTool(id)
  if (!found) throw new Error(`${id} is in the catalog`)
  return found
}

function client(claimedName: string, lastLoginAt: string, more: Partial<McpClient> = {}): McpClient {
  return { claimedName, lastLoginAt, lastRequestAt: null, lastTool: null, lastToolAt: null, toolCallsToday: 0, ...more }
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
  clients: [client("Claude", new Date(Date.now() - 3 * 86_400_000).toISOString())],
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

const heading = () => screen.getByRole("button", { name: /^Connect an AI app/ })
const row = () => screen.getByRole("list", { name: /MCP server$/ })
const openDetails = async (user: ReturnType<typeof userEvent.setup>) =>
  user.click(screen.getByRole("button", { name: "Server details" }))

async function guideAtAddress(user: ReturnType<typeof userEvent.setup>, app = "ChatGPT") {
  render(<McpServer tool={tool("tg")} />)
  await user.click(heading())
  await user.click(await screen.findByRole("button", { name: new RegExp(`^${app}`) }))
}

describe("Connect an AI app", () => {
  it("stays closed with a summary, and says what will happen before anything starts", async () => {
    const user = userEvent.setup()
    const status = vi.spyOn(platform, "mcpServerStatus").mockResolvedValue(OFF)
    const start = vi.spyOn(platform, "mcpServerStart")
    render(<McpServer tool={tool("tg")} />)

    expect(heading()).toHaveAttribute("aria-expanded", "false")
    await waitFor(() => expect(heading()).toHaveTextContent(/No app connected$/))
    expect(status).toHaveBeenCalledExactlyOnceWith("tg")

    await user.click(heading())
    expect(screen.getByText(/Nothing starts until you press Start the server/)).toBeVisible()
    expect(await screen.findByRole("button", { name: /^ChatGPT/ })).toBeVisible()
    expect(screen.getByRole("button", { name: /^Claude/ })).toBeVisible()
    expect(start).not.toHaveBeenCalled()
  })

  it("comes back at the same step after the owner leaves the page mid-guide", async () => {
    const user = userEvent.setup()
    vi.spyOn(platform, "mcpServerStatus").mockResolvedValue(OFF)
    vi.spyOn(platform, "tailscaleStatus").mockResolvedValue(READY)
    await guideAtAddress(user, "Claude")
    expect(await screen.findByRole("heading", { name: "Public address" })).toBeVisible()

    cleanup()
    render(<McpServer tool={tool("tg")} />)

    expect(heading()).toHaveAttribute("aria-expanded", "true")
    expect(await screen.findByRole("heading", { name: "Public address" })).toBeVisible()
    expect(screen.getByText("Claude")).toBeVisible()
  })

  it("turns Funnel on, then starts the server with the address Funnel got, once, after Start the server", async () => {
    const user = userEvent.setup()
    vi.spyOn(platform, "mcpServerStatus").mockResolvedValue(OFF)
    vi.spyOn(platform, "tailscaleStatus").mockResolvedValue(READY)
    const open = vi.spyOn(platform, "tailscaleFunnelOpen").mockResolvedValue("https://h.ts.net/tg")
    const start = vi.spyOn(platform, "mcpServerStart").mockResolvedValue(RUNNING)
    await guideAtAddress(user)

    expect(await screen.findByText(/The address will be/)).toHaveTextContent("https://h.ts.net/tg/mcp")
    expect(open).not.toHaveBeenCalled()
    await user.click(screen.getByRole("button", { name: "Start the server" }))

    await waitFor(() => expect(start).toHaveBeenCalledExactlyOnceWith("tg", 8765, "https://h.ts.net/tg"))
    expect(open).toHaveBeenCalledExactlyOnceWith("tg", 8765, expect.any(Function))
    expect(await screen.findByRole("heading", { name: "Add it in the app" })).toHaveFocus()
    expect(screen.getAllByText("https://x.ts.net/tg/mcp")[0]).toBeVisible()
    expect(screen.getAllByText("ABCD-EF23")[0]).toBeVisible()
    expect(screen.getByText(/Add custom MCP server/)).toBeVisible()
  })

  it("starts with the address of a tunnel the owner runs", async () => {
    const user = userEvent.setup()
    vi.spyOn(platform, "mcpServerStatus").mockResolvedValue(OFF)
    vi.spyOn(platform, "tailscaleStatus").mockResolvedValue(READY)
    const start = vi.spyOn(platform, "mcpServerStart").mockResolvedValue(RUNNING)
    await guideAtAddress(user, "Claude")
    await user.click(await screen.findByRole("radio", { name: "A tunnel I run myself" }))
    await user.clear(screen.getByLabelText("Port on this computer"))
    await user.type(screen.getByLabelText("Port on this computer"), "9001")
    await user.type(screen.getByLabelText("The tunnel's address"), "https://x.ts.net/tg/")
    await user.click(screen.getByRole("button", { name: "Start the server" }))

    await waitFor(() => expect(start).toHaveBeenCalledExactlyOnceWith("tg", 9001, "https://x.ts.net/tg"))
    expect(await screen.findByText(/Register automatically/)).toBeVisible()
  })

  it("says why a start failed, leaves Funnel on so a retry does not toggle it, and offers to try again", async () => {
    const user = userEvent.setup()
    vi.spyOn(platform, "mcpServerStatus").mockResolvedValue(OFF)
    vi.spyOn(platform, "tailscaleStatus").mockResolvedValue(READY)
    vi.spyOn(platform, "tailscaleFunnelOpen").mockResolvedValue("https://h.ts.net/tg")
    const start = vi.spyOn(platform, "mcpServerStart").mockRejectedValue(new Error("port 8765 is in use"))
    const close = vi.spyOn(platform, "tailscaleFunnelClose").mockResolvedValue()
    await guideAtAddress(user)
    await user.click(await screen.findByRole("button", { name: "Start the server" }))

    expect(await screen.findByRole("alert")).toHaveTextContent("port 8765 is in use")
    expect(screen.getByText(/Another program uses this port/)).toBeVisible()
    expect(close).not.toHaveBeenCalled()
    await user.click(screen.getByRole("button", { name: "Try again" }))
    await waitFor(() => expect(start).toHaveBeenCalledTimes(2))
  })

  it("shows Tailscale's next step, not a Start button, while Tailscale is not ready", async () => {
    const user = userEvent.setup()
    vi.spyOn(platform, "mcpServerStatus").mockResolvedValue(OFF)
    vi.spyOn(platform, "tailscaleStatus").mockResolvedValue({ ...READY, backend: "needsLogin" })
    await guideAtAddress(user)

    expect(await screen.findByRole("button", { name: "Log in" })).toBeVisible()
    expect(screen.queryByRole("button", { name: "Start the server" })).not.toBeInTheDocument()
    expect(screen.queryByText(/Connect this server/)).not.toBeInTheDocument()
  })

  it("moves on by itself when an app logs in, then shows its first call and a Finish", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    const status = vi.spyOn(platform, "mcpServerStatus").mockResolvedValue(RUNNING)
    render(<McpServer tool={tool("tg")} />)
    await user.click(heading())
    await user.click(await screen.findByRole("button", { name: "Connect another app" }))
    await user.click(screen.getByRole("button", { name: /^ChatGPT/ }))
    await user.click(await screen.findByRole("button", { name: "I added it, test the connection" }))
    expect(await screen.findByText("Waiting for ChatGPT to log in…")).toBeVisible()

    const now = new Date().toISOString()
    const joined = client("ChatGPT", now, { lastRequestAt: now })
    status.mockResolvedValue({ ...RUNNING, clients: [joined, ...RUNNING.clients] })
    await user.click(screen.getByRole("button", { name: /Back to the steps/ }))
    await user.click(await screen.findByRole("button", { name: "I added it, test the connection" }))
    await vi.advanceTimersByTimeAsync(4100)
    expect(await screen.findByText(/“ChatGPT” logged in/)).toBeVisible()
    expect(screen.getByText("List my last 3 Telegram chats.")).toBeInTheDocument()

    status.mockResolvedValue({
      ...RUNNING,
      clients: [{ ...joined, lastTool: "tg_read", lastToolAt: new Date().toISOString(), toolCallsToday: 1 }],
    })
    await vi.advanceTimersByTimeAsync(4100)
    expect(await screen.findByRole("heading", { name: "ChatGPT can use Telegram" })).toBeVisible()
    expect(screen.getByText("tg_read")).toBeVisible()
    await user.click(screen.getByRole("button", { name: "Finish" }))
    expect((await screen.findAllByText(/last call just now · tg_read · 1 today/))[0]).toBeVisible()
  })

  it("does not take an app that logged in before the guide opened for this one", async () => {
    const user = userEvent.setup()
    vi.spyOn(platform, "mcpServerStatus").mockResolvedValue(RUNNING)
    render(<McpServer tool={tool("tg")} />)
    await user.click(heading())
    await user.click(await screen.findByRole("button", { name: "Connect another app" }))
    await user.click(screen.getByRole("button", { name: /^Claude/ }))

    expect(await screen.findByRole("button", { name: "I added it, test the connection" })).toBeVisible()
  })

  it("says to check the answer in the app when the tool is too old to report calls", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    const status = vi.spyOn(platform, "mcpServerStatus").mockResolvedValue({ ...RUNNING, clients: [] })
    render(<McpServer tool={tool("tg")} />)
    await user.click(heading())
    await user.click(await screen.findByRole("button", { name: /^ChatGPT/ }))
    status.mockResolvedValue({
      ...RUNNING,
      clients: [client("ChatGPT", new Date(Date.now() + 1000).toISOString(), { toolCallsToday: null })],
    })
    await user.click(await screen.findByRole("button", { name: "I added it, test the connection" }))
    await vi.advanceTimersByTimeAsync(4100)
    vi.useRealTimers()

    expect(await screen.findByText(/does not report calls, so check the answer in ChatGPT/)).toBeVisible()
    expect(screen.getByRole("button", { name: "Finish" })).toBeVisible()
  })

  it("reads the login settings from the server for an app that cannot find them", async () => {
    const user = userEvent.setup()
    vi.spyOn(platform, "mcpServerStatus").mockResolvedValue({ ...RUNNING, clients: [] })
    const oauth = vi.spyOn(platform, "mcpServerOAuth").mockResolvedValue({
      issuer: "https://x.ts.net/tg",
      authorizationEndpoint: "https://x.ts.net/tg/authorize",
      tokenEndpoint: "https://x.ts.net/tg/token",
      registrationEndpoint: "https://x.ts.net/tg/register",
    })
    render(<McpServer tool={tool("tg")} />)
    await user.click(heading())
    await user.click(await screen.findByRole("button", { name: /^ChatGPT/ }))
    await user.click(await screen.findByText("If ChatGPT says it couldn't discover OAuth settings"))

    expect(await screen.findByText("https://x.ts.net/tg/authorize")).toBeInTheDocument()
    expect(screen.getByText("https://x.ts.net/tg/register")).toBeInTheDocument()
    expect(oauth).toHaveBeenCalledExactlyOnceWith("tg")
  })

  it("says Funnel is off and turns it on again on the same port", async () => {
    const user = userEvent.setup()
    vi.spyOn(platform, "mcpServerStatus").mockResolvedValue({ ...RUNNING, clients: [] })
    vi.spyOn(platform, "tailscaleFunnels").mockResolvedValue([
      { tool: "tg", profile: null, url: "https://x.ts.net/tg", port: 9001, live: false, shared: true },
    ])
    const open = vi.spyOn(platform, "tailscaleFunnelOpen").mockResolvedValue("https://x.ts.net/tg")
    render(<McpServer tool={tool("tg")} />)
    await user.click(heading())
    await user.click(await screen.findByRole("button", { name: /^ChatGPT/ }))

    expect(await screen.findByText(/Tailscale Funnel is off for this server/)).toBeVisible()
    await user.click(screen.getByRole("button", { name: "Turn Funnel on" }))
    expect(open).toHaveBeenCalledExactlyOnceWith("tg", 9001, expect.any(Function))
  })

  it("waits on the address check while Tailscale publishes the name, then moves on by itself", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    vi.spyOn(platform, "mcpServerStatus").mockResolvedValue({ ...RUNNING, clients: [] })
    const pub = vi
      .spyOn(platform, "mcpServerPublic")
      .mockResolvedValue({ host: "x.ts.net", dns: "missing", answer: { kind: "notTried" } })
    render(<McpServer tool={tool("tg")} />)
    await user.click(heading())
    await user.click(await screen.findByRole("button", { name: /^ChatGPT/ }))

    expect(await screen.findByText("Tailscale is publishing your address…")).toBeVisible()
    expect(screen.getByRole("progressbar")).toBeVisible()
    expect(screen.queryByRole("button", { name: "I added it, test the connection" })).not.toBeInTheDocument()

    pub.mockResolvedValue({ host: "x.ts.net", dns: "live", answer: { kind: "unreached", reason: "refused" } })
    await vi.advanceTimersByTimeAsync(15_100)
    expect(await screen.findByRole("heading", { name: "Add it in the app" })).toHaveFocus()
  })

  it("lets the owner go on, warned, when no public DNS service answers", async () => {
    const user = userEvent.setup()
    vi.spyOn(platform, "mcpServerStatus").mockResolvedValue({ ...RUNNING, clients: [] })
    vi.spyOn(platform, "mcpServerPublic").mockResolvedValue({
      host: "x.ts.net",
      dns: "unknown",
      answer: { kind: "notTried" },
    })
    render(<McpServer tool={tool("tg")} />)
    await user.click(heading())
    await user.click(await screen.findByRole("button", { name: /^Claude/ }))

    expect(await screen.findByText(/No public DNS service answered from this computer/)).toBeVisible()
    await user.click(screen.getByRole("button", { name: "Go on without the check" }))
    expect(await screen.findByRole("heading", { name: "Add it in the app" })).toBeVisible()
  })

  it("says calmly that a tool too old for it gets it with an update, and offers nothing to press", async () => {
    vi.spyOn(platform, "mcpServerStatus").mockResolvedValue({ ...OFF, available: false })
    render(<McpServer tool={tool("tg")} />)

    await waitFor(() => expect(heading()).toHaveTextContent(/Arrives with the next update$/))
    await userEvent.setup().click(heading())
    expect(screen.getByText(/It arrives with the next update of tg/)).toBeVisible()
    expect(screen.queryByRole("button", { name: /^ChatGPT/ })).not.toBeInTheDocument()
    expect(screen.queryByRole("alert")).not.toBeInTheDocument()
  })
})

const CLOUDFLARE: CloudflareStatus = {
  os: "linux",
  supported: true,
  installed: true,
  version: "2026.10.5",
  signedIn: false,
  hostname: "wirecat.example.com",
  running: false,
}

describe("Connect an AI app through a Cloudflare tunnel", () => {
  it("says Cloudflare can read the messages before it is picked, and keeps Funnel the first choice", async () => {
    const user = userEvent.setup()
    vi.spyOn(platform, "mcpServerStatus").mockResolvedValue(OFF)
    vi.spyOn(platform, "tailscaleStatus").mockResolvedValue(READY)
    const status = vi.spyOn(platform, "cloudflareStatus").mockResolvedValue(CLOUDFLARE)
    await guideAtAddress(user)

    expect(await screen.findByRole("radio", { name: /Tailscale Funnel/ })).toBeChecked()
    expect(screen.getByText(PRIVACY)).toBeVisible()
    expect(status).not.toHaveBeenCalled()
  })

  it("starts the tunnel with the tool's paths, then the server with the tunnel's address", async () => {
    const user = userEvent.setup()
    vi.spyOn(platform, "mcpServerStatus").mockResolvedValue(OFF)
    vi.spyOn(platform, "tailscaleStatus").mockResolvedValue(READY)
    vi.spyOn(platform, "cloudflareStatus").mockResolvedValue(CLOUDFLARE)
    const funnel = vi.spyOn(platform, "tailscaleFunnelOpen")
    const open = vi.spyOn(platform, "cloudflareTunnelOpen").mockResolvedValue("https://wirecat.example.com/tg")
    const start = vi
      .spyOn(platform, "mcpServerStart")
      .mockResolvedValue({ ...RUNNING, connectorUrl: "https://wirecat.example.com/tg/mcp" })
    await guideAtAddress(user)
    await user.click(await screen.findByRole("radio", { name: /Cloudflare tunnel/ }))

    expect(await screen.findByText(/The address will be/)).toHaveTextContent("https://wirecat.example.com/tg/mcp")
    await user.click(screen.getByRole("button", { name: "Start the server" }))

    await waitFor(() => expect(start).toHaveBeenCalledExactlyOnceWith("tg", 8765, "https://wirecat.example.com/tg"))
    expect(open).toHaveBeenCalledExactlyOnceWith("tg", 8765)
    expect(funnel).not.toHaveBeenCalled()
  })

  it("asks for the account, then a name on the domain, before it offers to start", async () => {
    const user = userEvent.setup()
    vi.spyOn(platform, "mcpServerStatus").mockResolvedValue(OFF)
    vi.spyOn(platform, "tailscaleStatus").mockResolvedValue(READY)
    const status = vi.spyOn(platform, "cloudflareStatus").mockResolvedValue({ ...CLOUDFLARE, hostname: null })
    const login = vi.spyOn(platform, "cloudflareLogin").mockImplementation(async () => {
      status.mockResolvedValue({ ...CLOUDFLARE, hostname: null, signedIn: true })
    })
    const create = vi.spyOn(platform, "cloudflareCreate").mockImplementation(async (name) => {
      status.mockResolvedValue(CLOUDFLARE)
      return name
    })
    await guideAtAddress(user)
    await user.click(await screen.findByRole("radio", { name: /Cloudflare tunnel/ }))

    await user.click(await screen.findByRole("button", { name: "Connect Cloudflare" }))
    expect(login).toHaveBeenCalledOnce()
    expect(screen.queryByRole("button", { name: "Start the server" })).not.toBeInTheDocument()
    await user.type(await screen.findByLabelText("Address on your domain"), "wirecat.example.com")
    await user.click(screen.getByRole("button", { name: "Make the address" }))

    expect(create).toHaveBeenCalledExactlyOnceWith("wirecat.example.com")
    expect(await screen.findByRole("button", { name: "Start the server" })).toBeVisible()
  })

  it("says the tunnel is not running and starts it again on the same port", async () => {
    const user = userEvent.setup()
    vi.spyOn(platform, "mcpServerStatus").mockResolvedValue({
      ...RUNNING,
      clients: [],
      connectorUrl: "https://wirecat.example.com/tg/mcp",
    })
    vi.spyOn(platform, "cloudflareRoutes").mockResolvedValue([
      { tool: "tg", url: "https://wirecat.example.com/tg", port: 9001, live: false },
    ])
    const open = vi.spyOn(platform, "cloudflareTunnelOpen").mockResolvedValue("https://wirecat.example.com/tg")
    render(<McpServer tool={tool("tg")} />)
    await user.click(heading())
    await user.click(await screen.findByRole("button", { name: /^ChatGPT/ }))

    expect(await screen.findByText(/The Cloudflare tunnel is not running/)).toBeVisible()
    await user.click(screen.getByRole("button", { name: "Start the tunnel" }))
    expect(open).toHaveBeenCalledExactlyOnceWith("tg", 9001)
  })

  it("takes the tool off the tunnel when its server stops", async () => {
    const user = userEvent.setup()
    vi.spyOn(platform, "mcpServerStatus").mockResolvedValue({
      ...RUNNING,
      connectorUrl: "https://wirecat.example.com/tg/mcp",
    })
    vi.spyOn(platform, "cloudflareRoutes").mockResolvedValue([
      { tool: "tg", url: "https://wirecat.example.com/tg", port: 9001, live: true },
    ])
    vi.spyOn(platform, "mcpServerStop").mockResolvedValue()
    const close = vi.spyOn(platform, "cloudflareTunnelClose").mockResolvedValue()
    render(<McpServer tool={tool("tg")} />)
    await user.click(heading())
    await openDetails(user)
    expect(await within(row()).findByText(/through your Cloudflare tunnel/)).toBeInTheDocument()
    await user.click(within(row()).getByRole("button", { name: "Stop the MCP server for tg" }))

    await waitFor(() => expect(close).toHaveBeenCalledExactlyOnceWith("tg"))
  })
})

describe("server details", () => {
  it("shows the new login code within seconds after an app used it, names the app, and copies the new one", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    vi.spyOn(document, "hasFocus").mockReturnValue(true)
    const status = vi.spyOn(platform, "mcpServerStatus").mockResolvedValue(RUNNING)
    render(<McpServer tool={tool("tg")} />)
    await user.click(heading())
    await openDetails(user)
    expect(await screen.findByText("ABCD-EF23")).toBeVisible()
    expect(screen.getByText(/Each code works for one login/)).toBeVisible()

    status.mockResolvedValue({
      ...RUNNING,
      loginCode: { code: "QRST-UV45", expiresAt: new Date(Date.now() + 600_000).toISOString() },
      clients: [client("ChatGPT", new Date().toISOString()), ...RUNNING.clients],
    })
    await vi.advanceTimersByTimeAsync(3100)
    expect(await screen.findByText("QRST-UV45")).toBeVisible()
    expect(screen.getByText("New code — the last one was used by “ChatGPT”.")).toBeVisible()
    const copied = vi.spyOn(navigator.clipboard, "writeText")
    await user.click(screen.getByRole("button", { name: "Copy the login code" }))
    expect(copied).toHaveBeenCalledWith("QRST-UV45")
  })

  it("does not say a code was used when it only ran out", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    vi.spyOn(document, "hasFocus").mockReturnValue(true)
    const status = vi.spyOn(platform, "mcpServerStatus").mockResolvedValue({
      ...RUNNING,
      loginCode: { code: "ABCD-EF23", expiresAt: new Date(Date.now() + 1000).toISOString() },
    })
    render(<McpServer tool={tool("tg")} />)
    await user.click(heading())
    await openDetails(user)
    expect(await screen.findByText("ABCD-EF23")).toBeVisible()
    status.mockResolvedValue({
      ...RUNNING,
      loginCode: { code: "QRST-UV45", expiresAt: new Date(Date.now() + 600_000).toISOString() },
    })
    await vi.advanceTimersByTimeAsync(3100)
    expect(await screen.findByText("QRST-UV45")).toBeVisible()
    expect(screen.queryByText(/New code/)).not.toBeInTheDocument()
  })

  it("stops reading the code while the window is in the background or the section is closed", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    const focus = vi.spyOn(document, "hasFocus").mockReturnValue(false)
    const status = vi.spyOn(platform, "mcpServerStatus").mockResolvedValue(RUNNING)
    render(<McpServer tool={tool("tg")} />)
    await user.click(heading())
    await screen.findByRole("button", { name: "Connect another app" })
    const before = status.mock.calls.length
    await vi.advanceTimersByTimeAsync(9100)
    expect(status.mock.calls.length).toBe(before)

    focus.mockReturnValue(true)
    window.dispatchEvent(new Event("focus"))
    await vi.advanceTimersByTimeAsync(3100)
    expect(status.mock.calls.length).toBeGreaterThan(before + 1)

    await user.click(heading())
    const closed = status.mock.calls.length
    await vi.advanceTimersByTimeAsync(9100)
    expect(status.mock.calls.length).toBe(closed)
  })

  it("does not offer Stop for a server started in a terminal", async () => {
    const user = userEvent.setup()
    vi.spyOn(platform, "mcpServerStatus").mockResolvedValue({ ...RUNNING, startedHere: false })
    render(<McpServer tool={tool("tg")} />)
    await user.click(heading())
    await openDetails(user)

    await waitFor(() => expect(within(row()).getByText(/stop it there/)).toBeInTheDocument())
    expect(within(row()).queryByRole("button", { name: /Stop/ })).not.toBeInTheDocument()
  })

  it("stops the server it started with its Funnel, and forgets logins after a confirmation", async () => {
    const user = userEvent.setup()
    vi.spyOn(platform, "mcpServerStatus").mockResolvedValue({ ...RUNNING, connectorUrl: "https://h.ts.net/tg/mcp" })
    vi.spyOn(platform, "tailscaleFunnels").mockResolvedValue([
      { tool: "tg", profile: null, url: "https://h.ts.net/tg", port: 9001, live: true, shared: true },
    ])
    const stop = vi.spyOn(platform, "mcpServerStop").mockResolvedValue()
    const close = vi.spyOn(platform, "tailscaleFunnelClose").mockResolvedValue()
    const revoke = vi.spyOn(platform, "mcpServerRevoke").mockResolvedValue()
    render(<McpServer tool={tool("tg")} />)
    await user.click(heading())
    await openDetails(user)

    expect(await within(row()).findByText(/through Tailscale Funnel/)).toBeInTheDocument()
    await user.click(within(row()).getByRole("button", { name: "Stop the MCP server for tg" }))
    expect(stop).toHaveBeenCalledExactlyOnceWith("tg")
    await waitFor(() => expect(close).toHaveBeenCalledExactlyOnceWith("tg"))

    await user.click(within(row()).getByRole("button", { name: "Forget all logins" }))
    const dialog = screen.getByRole("dialog", { name: "Forget every login to tg?" })
    expect(revoke).not.toHaveBeenCalled()
    await user.click(within(dialog).getByRole("button", { name: "Forget all logins" }))
    expect(revoke).toHaveBeenCalledExactlyOnceWith("tg")
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
    await openDetails(user)

    expect(await within(row()).findByText(/older Tailscale Funnel for profile work/)).toHaveTextContent(
      "https://h.ts.net:8443",
    )
    await user.click(within(row()).getByRole("button", { name: "Turn it off" }))
    expect(close).toHaveBeenCalledExactlyOnceWith("tg")
  })
})

describe("the address form", () => {
  it("takes a tunnel's https address, with one plain path at most, and a port above 1023", () => {
    expect(formProblem("https://laptop.tail1234.ts.net", "8765")).toBeNull()
    expect(formProblem("https://laptop.tail1234.ts.net/tg", "8765")).toBeNull()
    expect(formProblem("http://127.0.0.1:8765", "8765")).toBeNull()
    expect(formProblem("http://laptop.ts.net", "8765")).toMatch(/https/)
    expect(formProblem("https://x.ts.net/tg/mcp", "8765")).toMatch(/path of its own/)
    expect(formProblem("https://x.ts.net/.well-known", "8765")).toMatch(/path of its own/)
    expect(formProblem("https://x.ts.net", "80")).toMatch(/1024/)
  })
})
