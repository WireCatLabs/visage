import { useNav } from "../nav"
import { keep } from "./kept"
import { useTools } from "./store"

/** Takes the owner to a tool's Manage panel on the Tools page, wherever they are. */
export function openTool(id: string) {
  useNav.getState().go("tools")
  useTools.setState({ expanded: id })
}

/** Opens a tool's "Connect an AI app" section and brings it into view. */
export function openConnect(id: string) {
  keep(`mcp:${id}`, "open", true)
  keep(`mcp:${id}`, "reveal", true)
  openTool(id)
}
