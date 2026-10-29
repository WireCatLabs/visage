import type { CatalogTool } from "@/domain/catalog"
import type { ToolsText } from "./messages"

export const syncNote = (t: CatalogTool) => t.sync?.note?.replace(" {profile}", "") ?? null

/** A tool's own text in the reader's language, or tools.json's English for a tool not translated yet. */
export const toolText = (m: ToolsText, t: CatalogTool) => ({
  tagline: m.tool.tagline[t.id] ?? t.tagline,
  summary: m.tool.summary[t.id] ?? t.summary,
  syncNote: m.tool.syncNote[t.id] ?? syncNote(t),
})

export const groupLabel = (m: ToolsText, key: string, label: string) => m.tool.group[key] ?? label
