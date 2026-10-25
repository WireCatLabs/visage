import { findTool } from "@/domain/catalog"

export const toolName = (id: string) => findTool(id)?.name ?? id

export const LOGS_DOCS = "https://wirecat.dev/en/docs/desktop/logs"
