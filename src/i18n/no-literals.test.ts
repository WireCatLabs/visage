import { readdirSync, readFileSync } from "node:fs"
import { join, relative } from "node:path"
import { parseSync } from "vite"
import { describe, expect, it } from "vitest"

// Folders and files whose text is not in catalogs yet. Each conversion removes its lines; the list ends empty.
const PENDING = [
  "src/features/about",
  "src/features/agents",
  "src/features/config",
  "src/features/logs",
  "src/features/onboarding",
  "src/features/report",
  "src/features/signin",
  "src/features/storage",
  "src/features/system",
  // The Connect guide and the MCP server: messages-connect.tsx.
  "src/features/tools/ConnectGuide",
  "src/features/tools/TailscaleGuide",
  "src/features/tools/CloudflareGuide",
  "src/features/tools/McpServer",
  "src/features/tools/LoginCode",
  // The rest of the Tools page: messages.tsx.
  "src/features/tools/ClearDataOffer",
  "src/features/tools/Health",
  "src/features/tools/InstallPanel",
  "src/features/tools/LevelsHelp",
  "src/features/tools/Permissions",
  "src/features/tools/StorageFit",
  "src/features/tools/Sync",
  "src/features/tools/ToolDetails",
  "src/features/tools/ToolIcon",
  "src/features/tools/ToolRow",
  "src/features/tools/ToolsIntro",
  "src/features/tools/ToolsPage",
  "src/features/tools/UpgradeWarning",
  "src/features/update",
]

// Names and words that are the same in every language: products, tools, and what a reader types.
const KEEP = new Set([
  "WireCat",
  "Telegram",
  "MAX",
  "WhatsApp",
  "Zoom",
  "Google Drive",
  "Memo",
  "Email",
  "Node.js",
  "npm",
])

// Props that a reader sees or hears. `what` names a failure in the team's bug report, which stays in English.
const SHOWN = new Set(["title", "aria-label", "placeholder", "alt", "label", "aria-valuetext", "confirm"])

const ROOT = join(__dirname, "..", "..")
const words = (text: string) => /[A-Za-z]{2,}/.test(text) && !KEEP.has(text.trim())

function files(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const path = join(dir, e.name)
    if (e.isDirectory()) return files(path)
    return e.name.endsWith(".tsx") && !e.name.includes(".test.") && !e.name.startsWith("messages") ? [path] : []
  })
}

type Node = { type: string; [key: string]: unknown }
const isNode = (v: unknown): v is Node => typeof v === "object" && v !== null && "type" in v

/** String literals a JSX slot shows directly, through `a ? "x" : "y"` and `a && "x"` as well. */
function shownStrings(expr: unknown): string[] {
  if (!isNode(expr)) return []
  if (expr.type === "Literal" && typeof expr.value === "string") return [expr.value]
  if (expr.type === "TemplateLiteral")
    return (expr.quasis as { value: { cooked: string } }[]).map((q) => q.value.cooked).filter((t) => t.trim())
  if (expr.type === "ConditionalExpression") return [...shownStrings(expr.consequent), ...shownStrings(expr.alternate)]
  if (expr.type === "LogicalExpression") return shownStrings(expr.right)
  return []
}

function scan(path: string): string[] {
  const source = readFileSync(path, "utf8")
  const found: string[] = []
  const line = (at: number) => source.slice(0, at).split("\n").length
  const visit = (node: unknown, inCode: boolean) => {
    if (Array.isArray(node)) {
      for (const n of node) visit(n, inCode)
      return
    }
    if (!isNode(node)) return
    if (node.type === "JSXElement") {
      const name = (node.openingElement as { name: { name?: string } }).name.name
      const code = inCode || name === "code" || name === "kbd"
      visit(node.openingElement, code)
      visit(node.children, code)
      return
    }
    if (node.type === "JSXText" && !inCode && words(String(node.value)))
      found.push(`${line(node.start as number)}: ${String(node.value).trim()}`)
    if (node.type === "JSXExpressionContainer" && !inCode)
      for (const s of shownStrings(node.expression)) if (words(s)) found.push(`${line(node.start as number)}: ${s}`)
    if (node.type === "JSXAttribute") {
      const name = (node.name as { name: string }).name
      if (!SHOWN.has(name)) return
      const value = node.value as Node | null
      const strings = value?.type === "Literal" ? [String(value.value)] : shownStrings(value?.expression)
      for (const s of strings) if (words(s)) found.push(`${line(node.start as number)}: ${name}="${s}"`)
      return
    }
    for (const [key, child] of Object.entries(node)) if (key !== "type") visit(child, inCode)
  }
  visit(parseSync(path, source, { lang: "tsx" }).program, false)
  return found
}

describe("interface text", () => {
  it("comes from a message catalog, not from English written into the JSX", () => {
    const pending = PENDING.map((p) => join(ROOT, p))
    const report = files(join(ROOT, "src"))
      .filter((f) => !pending.some((p) => f.startsWith(p)) && !f.includes("/platform/"))
      .flatMap((f) => scan(f).map((hit) => `${relative(ROOT, f)}:${hit}`))
    expect(report).toEqual([])
  })
})
