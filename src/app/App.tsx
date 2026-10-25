import { useState } from "react"
import { ReadinessStrip } from "@/features/system/ReadinessStrip"
import { ClearDataOffer } from "@/features/tools/ClearDataOffer"
import { ErrorBoundary } from "./ErrorBoundary"
import { Sidebar } from "./Sidebar"
import { sections } from "./sections"
import { TopBar } from "./TopBar"
import { useApplyTheme } from "./theme"

export function App() {
  useApplyTheme()
  const [active, setActive] = useState("tools")
  const Page = sections.find((s) => s.id === active)?.page

  return (
    <div className="flex h-full">
      <Sidebar active={active} onSelect={setActive} />
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar />
        <div className="flex h-[3.9rem] shrink-0 items-center px-[2.1rem]">
          <ReadinessStrip />
        </div>
        <main className="min-h-0 flex-1 overflow-y-auto">
          <ErrorBoundary>{Page && <Page />}</ErrorBoundary>
        </main>
        <ClearDataOffer />
      </div>
    </div>
  )
}
