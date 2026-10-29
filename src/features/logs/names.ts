import { findTool } from "@/domain/catalog"
import { isBareCommand, type QueryProblem } from "@/domain/runs"
import type { logsMessages } from "./messages"

export type LogsWords = (typeof logsMessages)["en"]

export const toolName = (id: string) => findTool(id)?.name ?? id

export const LOGS_DOCS = "https://wirecat.dev/en/docs/desktop/logs"

export const fieldLabel = (m: LogsWords, field: string) => m.fields[field] ?? field
export const viaName = (m: LogsWords, via: string) => m.via[via] ?? via
export const commandLabel = (m: LogsWords, value: string) => (isBareCommand(value) ? m.commandLabel(value) : value)

export function problemText(m: LogsWords, p: QueryProblem): string {
  if (p.code === "unclosed") return m.unclosedQuote
  if (p.code === "noValue") return m.needsValue(p.field)
  if (p.code === "notNumber") return m.notANumber(p.op, p.value)
  return m.unknownField(p.field)
}
