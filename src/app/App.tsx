import { Bug } from "lucide-react"
import { useState } from "react"
import { HelpMenu } from "@/features/onboarding/HelpMenu"
import { Onboarding, SetupSteps } from "@/features/onboarding/Onboarding"
import { useOnboarding } from "@/features/onboarding/store"
import { Tour, useTour } from "@/features/onboarding/Tour"
import { ReportDialog } from "@/features/report/ReportDialog"
import { useReport } from "@/features/report/store"
import { ReadinessStrip } from "@/features/system/ReadinessStrip"
import { ClearDataOffer } from "@/features/tools/ClearDataOffer"
import { Button } from "@/ui/Button"
import { ErrorBoundary } from "./ErrorBoundary"
import { Sidebar } from "./Sidebar"
import { sections } from "./sections"
import { TopBar } from "./TopBar"
import { useApplyTheme } from "./theme"

export function App() {
  useApplyTheme()
  const [active, setActive] = useState("tools")
  const onboarding = useOnboarding((s) => s.open)
  const Page = sections.find((s) => s.id === active)?.page

  // The tour points at the Tools page, so it opens there.
  const startTour = () => {
    setActive("tools")
    useTour.getState().start()
  }
  const toTools = () => setActive("tools")

  return (
    <div className="flex h-full">
      {onboarding ? <SetupSteps onExit={toTools} /> : <Sidebar active={active} onSelect={setActive} />}
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar>
          {!onboarding && (
            <>
              <Button
                variant="ghost"
                size="sm"
                title="Tell the WireCat team what went wrong"
                icon={<Bug className="size-4" strokeWidth={1.8} aria-hidden />}
                onClick={() => useReport.getState().start()}
              >
                Report a problem
              </Button>
              <HelpMenu onTour={startTour} onWelcome={() => useOnboarding.getState().reopen("welcome")} />
            </>
          )}
        </TopBar>
        {onboarding ? (
          <ErrorBoundary>
            <Onboarding onExit={toTools} onTour={startTour} />
          </ErrorBoundary>
        ) : (
          <>
            <div data-tour="readiness" className="flex h-[3.9rem] shrink-0 items-center px-[2.1rem]">
              <ReadinessStrip />
            </div>
            <main className="min-h-0 flex-1 overflow-y-auto">
              <ErrorBoundary>{Page && <Page />}</ErrorBoundary>
            </main>
          </>
        )}
        <ClearDataOffer />
        <ReportDialog />
      </div>
      <Tour />
    </div>
  )
}
