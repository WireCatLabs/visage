import { Brain, HardDrive, UserRound, Wrench } from "lucide-react"
import type { ComponentType, SVGProps } from "react"
import { StoragePage } from "@/features/storage/StoragePage"
import { ToolsPage } from "@/features/tools/ToolsPage"

export type Section = {
  id: string
  label: string
  icon: ComponentType<SVGProps<SVGSVGElement>>
  /** Absent while the section is announced but not built yet. */
  page?: ComponentType
}

// A new area of the app (accounts, memory, people, projects…) is one entry here and one folder in features/.
export const sections: readonly Section[] = [
  { id: "tools", label: "Tools", icon: Wrench, page: ToolsPage },
  { id: "storage", label: "Storage", icon: HardDrive, page: StoragePage },
  { id: "accounts", label: "Accounts", icon: UserRound },
  { id: "memory", label: "Memory", icon: Brain },
]
