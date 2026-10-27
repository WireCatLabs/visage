import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, describe, expect, it, vi } from "vitest"
import { platform } from "@/platform/bridge"
import type { TailscaleLinux, TailscaleStatus } from "@/platform/tailscale-schemas"
import { guideUrl, TailscaleGuide } from "./TailscaleGuide"

afterEach(() => vi.restoreAllMocks())

const UBUNTU: TailscaleLinux = {
  name: "Ubuntu 24.04.3 LTS",
  family: "debian",
  method: "repo",
  commands: ["sudo mkdir -p --mode=0755 /usr/share/keyrings", "sudo apt-get update && sudo apt-get install tailscale"],
  source: "https://pkgs.tailscale.com/stable/#ubuntu-noble",
  updates: false,
}

const MISSING: TailscaleStatus = {
  os: "linux",
  installed: false,
  package: "deb",
  linux: UBUNTU,
  operator: null,
  user: "alex",
  daemon: false,
  backend: "unknown",
  https: false,
  funnel: false,
  host: null,
  freePorts: [],
}

const show = (status: TailscaleStatus) =>
  render(<TailscaleGuide tailscale={{ status, error: null, checking: false, check: async () => {} }} />)

describe("Tailscale guide on Linux", () => {
  it("offers the package first, then Tailscale's commands for this release, which keep it updated", async () => {
    const terminal = vi.spyOn(platform, "tailscaleTerminal").mockResolvedValue()
    show(MISSING)
    expect(screen.getByRole("button", { name: "Download Tailscale (.deb)" })).toBeVisible()
    expect(screen.getByText("Or install with Tailscale's commands for Ubuntu 24.04.3 LTS")).toBeVisible()
    expect(screen.getByText(/sudo apt-get update && sudo apt-get install tailscale/)).toBeVisible()
    expect(screen.getByText(/update source, so your system's updates keep Tailscale current/)).toBeVisible()
    await userEvent.setup().click(screen.getByRole("button", { name: "Open a terminal with them" }))
    expect(terminal).toHaveBeenCalledWith("install")
  })

  it("after the download, asks to add the update source", async () => {
    vi.spyOn(platform, "tailscaleDownload").mockResolvedValue({
      path: "~/Downloads/tailscale_1.104.2_amd64.deb",
      file: "tailscale_1.104.2_amd64.deb",
      opened: false,
    })
    show(MISSING)
    await userEvent.setup().click(screen.getByRole("button", { name: "Download Tailscale (.deb)" }))
    expect(await screen.findByText("Then add Tailscale's update source for Ubuntu 24.04.3 LTS")).toBeVisible()
  })

  it("makes the commands the main option where there is no package to download", () => {
    show({
      ...MISSING,
      package: null,
      linux: {
        ...UBUNTU,
        name: "Arch Linux",
        family: "arch",
        method: "package",
        commands: ["sudo pacman -S tailscale"],
      },
    })
    expect(screen.queryByRole("button", { name: /Download/ })).toBeNull()
    expect(screen.getByText("Install with Tailscale's commands for Arch Linux")).toBeVisible()
    expect(screen.getByText(/distribution's own Tailscale package/)).toBeVisible()
    expect(screen.getByRole("button", { name: "Open a terminal with it" })).toBeVisible()
  })

  it("gives NixOS a configuration line and no terminal", () => {
    show({
      ...MISSING,
      package: null,
      linux: { ...UBUNTU, family: "nixos", method: "config", commands: ["services.tailscale.enable = true;"] },
    })
    expect(screen.getByText("services.tailscale.enable = true;")).toBeVisible()
    expect(screen.queryByRole("button", { name: /Open a terminal/ })).toBeNull()
    expect(screen.getByRole("button", { name: "NixOS wiki" })).toBeVisible()
  })

  it("falls back to Tailscale's script and links on a system it lists no commands for", async () => {
    const open = vi.spyOn(platform, "openUrl").mockResolvedValue()
    show({
      ...MISSING,
      package: null,
      linux: {
        ...UBUNTU,
        name: "Void Linux",
        family: "other",
        method: "script",
        commands: ["curl -fsSL https://tailscale.com/install.sh | sh"],
      },
    })
    expect(screen.getByText(/Tailscale lists no commands for Void Linux/)).toBeVisible()
    await userEvent.setup().click(screen.getByRole("button", { name: "static binaries" }))
    expect(open).toHaveBeenCalledWith("https://pkgs.tailscale.com/stable/#static")
  })

  it("links each step to its section of the website guide", async () => {
    const open = vi.spyOn(platform, "openUrl").mockResolvedValue()
    show(MISSING)
    await userEvent.setup().click(screen.getByRole("button", { name: "Full guide" }))
    expect(open).toHaveBeenCalledWith("https://wirecat.dev/en/docs/desktop/tailscale-funnel#debian-and-ubuntu")
    expect(guideUrl("install", { ...MISSING, os: "macos", linux: null })).toMatch(/#macos$/)
    expect(guideUrl("funnel", MISSING)).toMatch(/#allow-funnel$/)
    expect(guideUrl("install", { ...MISSING, installed: true, operator: false })).toMatch(/#let-your-user-control/)
  })

  it("says when an installed Tailscale has no update source, with the commands behind a disclosure", async () => {
    show({ ...MISSING, installed: true, operator: true, daemon: true, backend: "needsLogin" })
    const install = screen.getAllByRole("listitem")[0]
    if (!install) throw new Error("the install step is listed")
    expect(within(install).getByText(/Installed without Tailscale.s update source/)).toBeVisible()
    await userEvent.setup().click(within(install).getByText("Add the update source"))
    expect(within(install).getByRole("button", { name: "Open a terminal with them" })).toBeVisible()
  })

  it("does not claim a missing update source where the distribution ships Tailscale itself", () => {
    show({ ...MISSING, package: "rpm", installed: true, operator: true, daemon: true, backend: "needsLogin" })
    expect(screen.queryByText(/Installed without Tailscale.s update source/)).toBeNull()
  })
})
