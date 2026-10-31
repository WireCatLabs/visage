import { Bot, Brain, HardDrive, ScrollText, Search, Settings, Wrench } from "lucide-react"
import type { ComponentType, SVGProps } from "react"
import { AgentsPage } from "@/features/agents/AgentsPage"
import { ConfigPage } from "@/features/config/ConfigPage"
import { LogsPage } from "@/features/logs/LogsPage"
import { SearchPage } from "@/features/search/SearchPage"
import { StoragePage } from "@/features/storage/StoragePage"
import { ToolsPage } from "@/features/tools/ToolsPage"

export type Section = {
  id: string
  icon: ComponentType<SVGProps<SVGSVGElement>>
  /** Absent while the section is announced but not built yet. */
  page?: ComponentType
  /** `system` sections sit at the bottom of the sidebar, apart from the everyday ones. */
  group?: "system"
}

// A new area of the app (accounts, memory, people, projects…) is one entry here and one folder in features/.
export const sections: readonly Section[] = [
  { id: "tools", icon: Wrench, page: ToolsPage },
  { id: "agents", icon: Bot, page: AgentsPage },
  { id: "search", icon: Search, page: SearchPage },
  { id: "memory", icon: Brain },
  { id: "storage", icon: HardDrive, page: StoragePage, group: "system" },
  { id: "logs", icon: ScrollText, page: LogsPage, group: "system" },
  { id: "settings", icon: Settings, page: ConfigPage, group: "system" },
]
