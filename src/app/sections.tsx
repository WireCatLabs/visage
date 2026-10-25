import { Bot, Brain, HardDrive, ScrollText, SlidersHorizontal, UserRound, Wrench } from "lucide-react"
import type { ComponentType, SVGProps } from "react"
import { AgentsPage } from "@/features/agents/AgentsPage"
import { ConfigPage } from "@/features/config/ConfigPage"
import { LogsPage } from "@/features/logs/LogsPage"
import { StoragePage } from "@/features/storage/StoragePage"
import { ToolsPage } from "@/features/tools/ToolsPage"

export type Section = {
  id: string
  label: string
  icon: ComponentType<SVGProps<SVGSVGElement>>
  /** Absent while the section is announced but not built yet. */
  page?: ComponentType
  /** `system` sections sit at the bottom of the sidebar, apart from the everyday ones. */
  group?: "system"
}

// A new area of the app (accounts, memory, people, projects…) is one entry here and one folder in features/.
export const sections: readonly Section[] = [
  { id: "tools", label: "Tools", icon: Wrench, page: ToolsPage },
  { id: "agents", label: "Agents", icon: Bot, page: AgentsPage },
  { id: "accounts", label: "Accounts", icon: UserRound },
  { id: "memory", label: "Memory", icon: Brain },
  { id: "storage", label: "Storage", icon: HardDrive, page: StoragePage, group: "system" },
  { id: "logs", label: "Logs", icon: ScrollText, page: LogsPage, group: "system" },
  { id: "config", label: "Config", icon: SlidersHorizontal, page: ConfigPage, group: "system" },
]
