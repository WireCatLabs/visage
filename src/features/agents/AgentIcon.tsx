import { BotMessageSquare, SquareTerminal } from "lucide-react"
import { CHAT_AGENTS } from "@/domain/agents"

/** Generic marks, never the agents' own logos: a terminal for coding agents, a chat bot for the ones chats drive. */
export function AgentIcon({ id, className }: { id: string; className?: string }) {
  const Icon = CHAT_AGENTS.has(id) ? BotMessageSquare : SquareTerminal
  return <Icon className={className} strokeWidth={1.7} aria-hidden />
}
