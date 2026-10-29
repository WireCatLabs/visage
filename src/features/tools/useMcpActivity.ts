import { useEffect, useState } from "react"
import type { CatalogTool } from "@/domain/catalog"
import { platform } from "@/platform/bridge"
import type { McpClient } from "@/platform/mcp-server-schemas"
import { busiest, latestLogin } from "./connect-steps"

/**
 * The browser app that called the tool last (or, from a tool too old to report calls, logged in last), for its row. Each read runs the tool once, so it is read when the row
 * appears and when its Manage panel closes, where the guide may just have connected an app; not on a timer.
 */
export function useMcpActivity(tool: CatalogTool, installed: boolean, expanded: boolean): McpClient | null {
  const [client, setClient] = useState<McpClient | null>(null)
  const [, tick] = useState(0)
  const active = installed && tool.mcpServer !== null && !expanded

  useEffect(() => {
    if (!active) return
    let live = true
    platform
      .mcpServerStatus(tool.id)
      .then((s) => live && setClient(busiest(s) ?? latestLogin(s)))
      .catch(() => live && setClient(null))
    return () => {
      live = false
    }
  }, [active, tool.id])

  // "2 min ago" keeps counting without asking the tool again.
  useEffect(() => {
    if (!client) return
    const t = setInterval(() => tick((n) => n + 1), 60_000)
    return () => clearInterval(t)
  }, [client])

  return active ? client : null
}
