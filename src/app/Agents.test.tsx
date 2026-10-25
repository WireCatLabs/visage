import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { useAgentChoice } from "@/features/agents/AgentList"
import { useNav } from "@/features/nav"
import { useOnboarding } from "@/features/onboarding/store"
import { useTools } from "@/features/tools/store"
import { platform } from "@/platform/bridge"
import { App } from "./App"

const wait = { timeout: 8000 }

async function openAgents() {
  const user = userEvent.setup()
  render(<App />)
  await user.click(screen.getByRole("button", { name: /Agents/ }))
  return user
}

// A found agent's tab replaces its placeholder, so it is looked up by the text only a found tab has.
const foundTab = (name: RegExp) => screen.findByRole("tab", { name }, wait)
const pane = () => screen.getByRole("tabpanel")

// Mock: Claude Code reads ~/.claude, Codex ~/.agents, Cursor both; Gemini CLI and OpenCode are not found. Telegram's
// ~/.agents copy is old, WhatsApp has none, MAX and Zoom are too old to report, Telegram's "work" profile is signed
// out. Claude Code has tg-personal registered over MCP and holds Q-15; Zoom is not on a terminal's PATH.
describe("Agents", () => {
  beforeEach(() => {
    useOnboarding.setState({ status: "done", open: false })
    useAgentChoice.setState({ chosen: null })
  })

  it("lists every known agent, dims the ones not found and opens on the first one with skills to set up", async () => {
    await openAgents()
    const list = screen.getByRole("tablist", { name: "Agents" })
    const claude = await foundTab(/^Claude Code.*to set up/)
    expect(claude).toHaveAttribute("aria-selected", "true")
    for (const name of ["Codex", "Cursor", "Gemini CLI", "OpenCode"])
      expect(within(list).getByRole("tab", { name: new RegExp(`^${name}`) })).toBeInTheDocument()
    const gemini = await foundTab(/^Gemini CLI.*Not found/)
    expect(within(gemini).getByText("Gemini CLI")).toHaveClass("text-ink-dim")

    expect(within(pane()).getByRole("heading", { name: "Claude Code" })).toBeInTheDocument()
    expect(await within(pane()).findAllByText(/Update MAX/, {}, wait)).toHaveLength(1)
    expect(within(pane()).getAllByText(/Update Zoom/)).toHaveLength(1)
    expect(screen.getByRole("button", { name: /Check again|Checking/ })).toBeInTheDocument()
  }, 20000)

  it("moves through agents with the arrow keys, Home and End, and shows where a missing agent's skills go", async () => {
    const user = await openAgents()
    const claude = await foundTab(/^Claude Code.*to set up/)
    claude.focus()
    await user.keyboard("{ArrowDown}")
    const codex = screen.getByRole("tab", { name: /^Codex/ })
    expect(codex).toHaveFocus()
    expect(codex).toHaveAttribute("aria-selected", "true")
    expect(claude).toHaveAttribute("tabindex", "-1")
    expect(within(pane()).getByRole("heading", { name: "Codex" })).toBeInTheDocument()

    await user.keyboard("{End}")
    expect(screen.getByRole("tab", { name: /^OpenClaw/ })).toHaveFocus()
    await user.keyboard("{ArrowUp}{ArrowUp}")
    expect(screen.getByRole("tab", { name: /^OpenCode/ })).toHaveFocus()
    expect(within(pane()).getByText(/Not found on this computer/)).toHaveTextContent(
      "~/.agents/skills, ~/.claude/skills",
    )
    await user.keyboard("{End}{ArrowDown}")
    expect(claude).toHaveFocus()
    await user.keyboard("{ArrowUp}")
    expect(screen.getByRole("tab", { name: /^OpenClaw/ })).toHaveFocus()
    await user.keyboard("{Home}")
    expect(claude).toHaveAttribute("aria-selected", "true")
  }, 20000)

  it("keeps the chosen agent when the owner comes back to the page", async () => {
    const user = await openAgents()
    await user.click(await foundTab(/^Cursor.*to set up/))
    const sections = screen.getByRole("navigation", { name: "Sections" })
    await user.click(within(sections).getByRole("button", { name: /Tools/ }))
    await user.click(within(sections).getByRole("button", { name: /Agents/ }))
    expect(await foundTab(/^Cursor/)).toHaveAttribute("aria-selected", "true")
    expect(within(pane()).getByRole("heading", { name: "Cursor" })).toBeInTheDocument()
  }, 20000)

  it("installs every missing or old skill of the selected agent and returns focus to its tab", async () => {
    const user = await openAgents()
    await user.click(await foundTab(/^Codex.*to set up/))
    await user.click(await within(pane()).findByRole("button", { name: /^Install all: .*Codex/ }, wait))
    const dialog = await screen.findByRole("dialog", { name: /^Install 3 skills for Codex\?/ })
    expect(within(dialog).getByText(/Cursor, OpenClaw read the same folder/)).toBeInTheDocument()
    await user.click(within(dialog).getByRole("button", { name: "Install all" }))
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument(), wait)

    expect(await within(pane()).findByText("Every skill it can see is current", {}, wait)).toBeInTheDocument()
    expect(within(pane()).queryByRole("button", { name: /^Install all/ })).not.toBeInTheDocument()
    expect(within(pane()).getByRole("img", { name: "Telegram skill for Codex: Current" })).toBeInTheDocument()
    await waitFor(() => expect(screen.getByRole("tab", { name: /^Codex/ })).toHaveFocus())
  }, 20000)

  it("installs one tool's skill from its row", async () => {
    const user = await openAgents()
    await foundTab(/^Claude Code.*to set up/)
    const skills = await within(pane()).findByRole("list", { name: "Skills for Claude Code" }, wait)
    await user.click(
      await within(skills).findByRole("button", { name: "Install the WhatsApp skill for Claude Code" }, wait),
    )
    const dialog = await screen.findByRole("dialog", { name: "Install the WhatsApp skill for Claude Code?" })
    expect(within(dialog).getByText(/wa skill install --for claude/)).toBeInTheDocument()
    await user.click(within(dialog).getByRole("button", { name: "Install" }))
    expect(
      await within(skills).findByRole("img", { name: "WhatsApp skill for Claude Code: Current" }, wait),
    ).toBeInTheDocument()
  }, 20000)

  it("lists what else stops the agent, with a signed-out profile from the tool's own status", async () => {
    const check = vi.spyOn(platform, "mcpCheck")
    const user = await openAgents()
    await foundTab(/^Claude Code.*to set up/)
    const fixes = await within(pane()).findByRole("list", { name: "Other things to fix for Claude Code" }, wait)
    expect(await within(fixes).findByText("Zoom is not on a terminal's PATH", {}, wait)).toBeInTheDocument()
    expect(within(fixes).getByText(/^export PATH=/)).toBeInTheDocument()
    expect(await within(fixes).findByText(/Telegram profile/, {}, wait)).toHaveTextContent(
      "Telegram profile work is not signed in",
    )
    expect(within(fixes).queryByText(/personal is not signed in/)).not.toBeInTheDocument()

    await user.click(within(fixes).getByRole("button", { name: "Sign in to Telegram (work)" }))
    expect(useNav.getState().active).toBe("tools")
    expect(useTools.getState().expanded).toBe("tg")
    expect(check).not.toHaveBeenCalled()
  }, 20000)

  it("keeps MCP out of the main flow and lists existing servers read-only under Advanced", async () => {
    const add = vi.spyOn(platform, "mcpAdd")
    const check = vi.spyOn(platform, "mcpCheck")
    const remove = vi.spyOn(platform, "mcpRemove")
    const user = await openAgents()
    await foundTab(/^Claude Code.*to set up/)
    const fixes = await within(pane()).findByRole("list", { name: "Other things to fix for Claude Code" }, wait)
    expect(fixes).not.toHaveTextContent(/MCP/)
    expect(screen.getByRole("tablist", { name: "Agents" })).not.toHaveTextContent(/MCP/)
    await user.click(within(pane()).getByRole("button", { name: "Connect WireCat to Claude Code" }))
    const connect = await screen.findByRole("dialog", { name: "Connect WireCat to Claude Code" })
    expect(connect).toHaveTextContent("MCP is not part of this")
    expect(connect).not.toHaveTextContent(/mcp add/)
    await user.click(within(connect).getByRole("button", { name: "Cancel" }))
    expect(check).not.toHaveBeenCalled()

    const advanced = within(pane()).getByText("Advanced: MCP")
    expect(advanced.closest("details")).not.toHaveAttribute("open")
    await user.click(advanced)
    expect(within(pane()).getByText(/Agents on this computer use the tools directly/)).toBeVisible()
    const servers = await within(pane()).findByRole("list", { name: "WireCat MCP servers in Claude Code" }, wait)
    expect(within(servers).getByText("tg-personal")).toBeInTheDocument()

    await user.click(
      within(servers).getByRole("button", { name: "Remove the tg-personal MCP server from Claude Code" }),
    )
    const dialog = await screen.findByRole("dialog", { name: "Remove the tg-personal MCP server from Claude Code?" })
    expect(within(dialog).getByText("claude mcp remove tg-personal --scope user")).toBeInTheDocument()
    await user.click(within(dialog).getByRole("button", { name: "Remove" }))
    expect(remove).toHaveBeenCalledWith("tg", "personal", "claude")
    expect(
      await within(pane()).findByText("Claude Code has no WireCat MCP server registered.", {}, wait),
    ).toBeInTheDocument()
    expect(add).not.toHaveBeenCalled()
  }, 20000)

  it("connects Hermes only with tools that can write its skill, warns about its gateway and checks its own PATH", async () => {
    const install = vi.spyOn(platform, "skillInstall")
    const user = await openAgents()
    await user.click(await foundTab(/^Hermes Agent/))
    expect(
      await within(pane()).findByText("Needs a newer Telegram to write a skill for Hermes Agent", {}, wait),
    ).toBeInTheDocument()
    const fixes = await within(pane()).findByRole("list", { name: "Other things to fix for Hermes Agent" }, wait)
    expect(await within(fixes).findByText("Hermes Agent cannot find Telegram, MAX", {}, wait)).toBeInTheDocument()
    expect(within(fixes).getByText(/bash -l/)).toHaveTextContent("~/.profile")
    expect(within(fixes).getByText(`export PATH="$HOME/.local/share/pnpm/bin:$PATH"`)).toBeInTheDocument()

    await user.click(within(pane()).getByRole("button", { name: "Connect WireCat to Hermes Agent" }))
    const dialog = await screen.findByRole("dialog", { name: "Connect WireCat to Hermes Agent" })
    expect(within(dialog).getByRole("checkbox", { name: /Telegram/ })).toBeDisabled()
    const whatsapp = within(dialog).getByRole("checkbox", { name: /WhatsApp/ })
    for (const box of within(dialog).getAllByRole("checkbox")) expect(box).not.toBeChecked()
    expect(within(dialog).getByRole("button", { name: "Connect" })).toBeDisabled()
    expect(await within(dialog).findByRole("note", {}, wait)).toHaveTextContent(
      /answers in Telegram\. Anyone the bot accepts there can ask it to run the tools/,
    )

    await user.click(whatsapp)
    expect(within(dialog).getByText(/wa skill install --for hermes --json/)).toBeInTheDocument()
    await user.click(within(dialog).getByRole("button", { name: "Connect 1 tool" }))
    expect(await within(dialog).findByText("Hermes Agent finds every tool you chose", {}, wait)).toBeInTheDocument()
    expect(install).toHaveBeenCalledWith("wa", "hermes")
    expect(install).toHaveBeenCalledTimes(1)
  }, 20000)

  it("offers read only for the chosen profiles of a chat-driven agent and the OpenClaw PATH fix", async () => {
    const set = vi.spyOn(platform, "settingsSet")
    const user = await openAgents()
    await user.click(await foundTab(/^OpenClaw/))
    await within(pane()).findByRole("list", { name: "Other things to fix for OpenClaw" }, wait)
    vi.spyOn(platform, "terminalReach").mockResolvedValue({ tg: false, wa: true, drive: true, memo: true })

    await user.click(within(pane()).getByRole("button", { name: "Connect WireCat to OpenClaw" }))
    const dialog = await screen.findByRole("dialog", { name: "Connect WireCat to OpenClaw" })
    expect(await within(dialog).findByRole("note", {}, wait)).toHaveTextContent("answers in Discord, WhatsApp")
    expect(within(dialog).getByText("Choose a tool to see its profiles.")).toBeInTheDocument()

    await user.click(within(dialog).getByRole("checkbox", { name: /Telegram/ }))
    const personal = within(dialog).getByRole("checkbox", { name: "Telegram · personal" })
    expect(personal).not.toBeChecked()
    expect(within(dialog).getByRole("checkbox", { name: "Telegram · work" })).not.toBeChecked()
    await user.click(personal)
    expect(within(dialog).getByText(/tg personal config set --json permissions\.messages readonly/)).toBeInTheDocument()

    await user.click(within(dialog).getByRole("button", { name: "Connect 1 tool" }))
    expect(await within(dialog).findByText("OpenClaw cannot find Telegram", {}, wait)).toBeInTheDocument()
    expect(set).toHaveBeenCalledWith("tg", "personal", false, "permissions.messages", "readonly")
    expect(set).not.toHaveBeenCalledWith("tg", "work", expect.anything(), expect.anything(), expect.anything())
    expect(
      within(dialog).getByText(
        `openclaw config set tools.exec.pathPrepend '["~/.local/share/pnpm/bin"]' --strict-json`,
      ),
    ).toBeInTheDocument()
    expect(within(dialog).getByText("Telegram skill")).toBeInTheDocument()
  }, 20000)

  it("keeps a group the owner blocked when it sets a profile read only", async () => {
    const set = vi.spyOn(platform, "settingsSet")
    const user = await openAgents()
    await user.click(await foundTab(/^OpenClaw/))
    await within(pane()).findByRole("list", { name: "Other things to fix for OpenClaw" }, wait)
    await user.click(within(pane()).getByRole("button", { name: "Connect WireCat to OpenClaw" }))
    const dialog = await screen.findByRole("dialog", { name: "Connect WireCat to OpenClaw" })
    await user.click(within(dialog).getByRole("checkbox", { name: /Telegram/ }))
    await user.click(within(dialog).getByRole("checkbox", { name: "Telegram · work" }))
    await user.click(within(dialog).getByRole("button", { name: "Connect 1 tool" }))
    expect(await within(dialog).findByText(/Kept Block on contacts/, {}, wait)).toBeInTheDocument()
    expect(set).toHaveBeenCalledWith("tg", "work", false, "permissions.messages", "readonly")
    expect(set).not.toHaveBeenCalledWith("tg", "work", false, "permissions.contacts", "readonly")
  }, 20000)

  it("explains how to disconnect, since no tool can remove its skill", async () => {
    const user = await openAgents()
    await user.click(await foundTab(/^Codex/))
    const disconnect = within(pane()).getByRole("button", { name: "Disconnect WireCat from Codex" })
    await waitFor(() => expect(disconnect).toBeEnabled(), wait)
    await user.click(disconnect)
    const dialog = await screen.findByRole("dialog", { name: "Disconnect WireCat from Codex" })
    expect(dialog).toHaveTextContent("no command that removes their skill yet")
    expect(within(dialog).getByText("~/.agents/skills/tg-cli")).toBeInTheDocument()
    expect(dialog).toHaveTextContent(/Cursor, OpenClaw read ~\/\.agents\/skills too/)
  }, 20000)

  it("releases a task the agent holds", async () => {
    const user = await openAgents()
    await foundTab(/^Claude Code.*to set up/)
    await user.click(await within(pane()).findByRole("button", { name: "Release Q-15" }, wait))
    const dialog = await screen.findByRole("dialog", { name: "Release Q-15?" })
    expect(within(dialog).getByText("tg personal tasks release Q-15 --holder owner --json")).toBeInTheDocument()
    await user.click(within(dialog).getByRole("button", { name: "Release" }))
    await waitFor(
      () => expect(within(pane()).queryByRole("button", { name: "Release Q-15" })).not.toBeInTheDocument(),
      wait,
    )
  }, 20000)
})
