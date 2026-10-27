import { delay } from "./mock-delay"
import type { FunnelState, TailscaleLinux, TailscaleStatus } from "./tailscale-schemas"
import type { Platform } from "./types"

// `?tailscale=<state>` opens tg's MCP server Start dialog for the profile personal with the Tailscale guide at that
// state: `missing`, `nooperator` (Linux: only root may change Tailscale), `nodaemon` (installed, not running),
// `loggedout`, `approval` (the tailnet's admin approves new devices), `stopped`, `nohttps`, `nofunnel`, `full` (all
// three Funnel ports taken), `ready`. `?tailscale-os=macos|windows` changes the install step; Linux is Ubuntu, which
// offers a .deb. `?tailscale-distro=<id>` picks another Linux: `debian`, `fedora` (.rpm, dnf 5), `rhel`, `opensuse`,
// `arch`, `nixos`, `other` (no commands: Tailscale's script). `?tailscale=nosource` is installed from a package without
// Tailscale's update source. `?tailscale-nocurl=1`: curl is missing, so the Ubuntu, Debian and script commands start with
// the line that installs it. These commands are the shape `tailscale_linux.rs` builds; its tests hold the real ones.
// `?tailscale=leftover` with `?mcp=<tool>`: the server is off but the funnel the app set up still points at it.
// `?tailscale-fail=funnel` makes turning Funnel on fail. Logging in finishes by itself after a few seconds.

const params = new URLSearchParams(typeof window === "undefined" ? "" : window.location.search)
const HOST = "laptop.tail4a2c.ts.net"
const PKGS = "https://pkgs.tailscale.com/stable"
const INSTALLER = "https://github.com/tailscale/tailscale/blob/main/scripts/installer.sh"
const ENABLE = "sudo systemctl enable --now tailscaled"

const apt = (dist: string, codename: string) => ({
  commands: [
    "sudo mkdir -p --mode=0755 /usr/share/keyrings",
    `curl -fsSL ${PKGS}/${dist}/${codename}.noarmor.gpg | sudo tee /usr/share/keyrings/tailscale-archive-keyring.gpg >/dev/null`,
    `curl -fsSL ${PKGS}/${dist}/${codename}.tailscale-keyring.list | sudo tee /etc/apt/sources.list.d/tailscale.list`,
    "sudo apt-get update && sudo apt-get install tailscale",
  ],
  source: `${PKGS}/#${dist}-${codename}`,
})

const DISTROS = {
  ubuntu: [
    "deb",
    { name: "Ubuntu 24.04.3 LTS", family: "debian", method: "repo", ...apt("ubuntu", "noble"), updates: null },
  ],
  debian: [
    "deb",
    {
      name: "Debian GNU/Linux 13 (trixie)",
      family: "debian",
      method: "repo",
      ...apt("debian", "trixie"),
      updates: null,
    },
  ],
  fedora: [
    "rpm",
    {
      name: "Fedora Linux 42 (Workstation Edition)",
      family: "fedora",
      method: "repo",
      commands: [
        "sudo dnf install 'dnf-command(config-manager)'",
        `sudo dnf config-manager addrepo --overwrite --from-repofile=${PKGS}/fedora/tailscale.repo`,
        "sudo dnf install tailscale",
        ENABLE,
      ],
      source: INSTALLER,
      updates: null,
    },
  ],
  rhel: [
    "rpm",
    {
      name: "Red Hat Enterprise Linux 9.4 (Plow)",
      family: "fedora",
      method: "repo",
      commands: [
        `sudo dnf config-manager --add-repo ${PKGS}/rhel/9/tailscale.repo`,
        "sudo dnf install tailscale",
        ENABLE,
      ],
      source: `${PKGS}/#rhel-9`,
      updates: null,
    },
  ],
  opensuse: [
    null,
    {
      name: "openSUSE Tumbleweed",
      family: "opensuse",
      method: "repo",
      commands: [
        `sudo zypper ar -g -r ${PKGS}/opensuse/tumbleweed/tailscale.repo`,
        "sudo zypper ref && sudo zypper in tailscale",
        ENABLE,
      ],
      source: `${PKGS}/#opensuse-tumbleweed`,
      updates: null,
    },
  ],
  arch: [
    null,
    {
      name: "Arch Linux",
      family: "arch",
      method: "package",
      commands: ["sudo pacman -S tailscale", ENABLE],
      source: "https://wiki.archlinux.org/title/Tailscale",
      updates: null,
    },
  ],
  nixos: [
    null,
    {
      name: "NixOS 25.05 (Warbler)",
      family: "nixos",
      method: "config",
      commands: ["services.tailscale.enable = true;"],
      source: INSTALLER,
      updates: null,
    },
  ],
  other: [
    null,
    {
      name: "Void Linux",
      family: "other",
      method: "script",
      commands: ["curl -fsSL https://tailscale.com/install.sh | sh"],
      source: "https://tailscale.com/docs/install/linux",
      updates: null,
    },
  ],
} satisfies Record<string, [TailscaleStatus["package"], TailscaleLinux]>

const withCurl = (commands: string[]) =>
  params.get("tailscale-nocurl") && commands.some((c) => c.startsWith("curl "))
    ? [
        commands.some((c) => c.includes("apt-get")) ? "sudo apt-get install -y curl" : "sudo dnf install -y curl",
        ...commands,
      ]
    : commands

function initial(): TailscaleStatus {
  const scenario = params.get("tailscale")
  const os = (["macos", "windows"] as const).find((o) => o === params.get("tailscale-os")) ?? "linux"
  const distro = params.get("tailscale-distro") ?? ""
  const [linuxPackage, linux]: [TailscaleStatus["package"], TailscaleLinux] = Object.hasOwn(DISTROS, distro)
    ? DISTROS[distro as keyof typeof DISTROS]
    : DISTROS.ubuntu
  const ready: TailscaleStatus = {
    os,
    installed: true,
    package: os === "macos" ? "pkg" : os === "windows" ? "exe" : linuxPackage,
    linux:
      os === "linux"
        ? {
            ...linux,
            commands: withCurl(linux.commands),
            updates: linux.method === "repo" ? scenario !== "nosource" : null,
          }
        : null,
    operator: os === "linux" ? true : null,
    user: "alex",
    daemon: true,
    backend: "running",
    https: true,
    funnel: true,
    host: HOST,
    freePorts: [443, 8443, 10000],
  }
  const off = { https: false, funnel: false, host: null, freePorts: [] }
  switch (scenario) {
    case "missing":
      return {
        ...ready,
        linux: ready.linux && { ...ready.linux, updates: ready.linux.updates === null ? null : false },
        installed: false,
        operator: null,
        daemon: false,
        backend: "unknown",
        ...off,
      }
    case "nosource":
      return { ...ready, backend: "needsLogin", ...off }
    case "nooperator":
      return { ...ready, operator: false, backend: "needsLogin", ...off }
    case "nodaemon":
      return { ...ready, daemon: false, backend: "unknown", ...off }
    case "loggedout":
      return { ...ready, backend: "needsLogin", ...off }
    case "approval":
      return { ...ready, backend: "needsApproval", ...off }
    case "stopped":
      return { ...ready, backend: "stopped", ...off }
    case "nohttps":
      return { ...ready, https: false, funnel: false, freePorts: [] }
    case "nofunnel":
      return { ...ready, funnel: false, freePorts: [] }
    case "full":
      return { ...ready, freePorts: [] }
    default:
      return ready
  }
}

export function tailscaleMock(): Pick<
  Platform,
  | "tailscaleStatus"
  | "tailscaleDownload"
  | "tailscaleTerminal"
  | "tailscaleLogin"
  | "tailscaleStop"
  | "tailscaleFunnelOpen"
  | "tailscaleFunnelClose"
  | "tailscaleFunnels"
> {
  let state = initial()
  let stopped = false
  const funnels: FunnelState[] = []
  const shown = params.get("mcp")
  if (shown) {
    const profile = shown === "memo" ? null : "personal"
    funnels.push({ tool: shown, profile, url: `https://${HOST}`, port: 8765, live: true })
  }

  return {
    async tailscaleStatus() {
      await delay(500)
      return state
    },
    async tailscaleDownload(kind) {
      await delay(1800)
      const file = {
        pkg: "Tailscale-1.104.2-macos.pkg",
        exe: "tailscale-setup-1.104.2.exe",
        deb: "tailscale_1.104.2_amd64.deb",
        rpm: "tailscale_1.104.2_x86_64.rpm",
      }[kind]
      return { path: `~/Downloads/${file}`, file, opened: kind === "pkg" || kind === "exe" }
    },
    async tailscaleTerminal() {
      await delay(200)
    },
    async tailscaleLogin(onPage) {
      stopped = false
      await delay(800)
      onPage("https://login.tailscale.com/a/1a2b3c4d5e")
      for (let i = 0; i < 8; i++) {
        await delay(500)
        if (stopped) throw new Error("Stopped.")
      }
      state = { ...state, backend: "running", https: true, funnel: true, host: HOST, freePorts: [443, 8443, 10000] }
    },
    async tailscaleStop() {
      stopped = true
    },
    async tailscaleFunnelOpen(id, profile, port) {
      await delay(1200)
      if (params.get("tailscale-fail") === "funnel")
        throw new Error("Tailscale did not turn Funnel on: serve config denied")
      const https = state.freePorts[0]
      if (https === undefined)
        throw new Error("Tailscale Funnel allows 3 public addresses per computer, and all are in use.")
      const url = https === 443 ? `https://${HOST}` : `https://${HOST}:${https}`
      const others = funnels.filter((f) => f.tool !== id || f.profile !== profile)
      funnels.splice(0, funnels.length, ...others, { tool: id, profile, url, port, live: true })
      return url
    },
    async tailscaleFunnelClose(id, profile) {
      await delay(400)
      for (const f of funnels) if (f.tool === id && f.profile === profile) f.live = false
    },
    async tailscaleFunnels() {
      await delay(300)
      return funnels.map((f) => ({ ...f }))
    },
  }
}
