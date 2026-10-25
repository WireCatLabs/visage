import { findTool } from "@/domain/catalog"

export const toolName = (id: string) => findTool(id)?.name ?? id
