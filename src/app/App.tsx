import { Bug } from "lucide-react"
import { useEffect, useState } from "react"
import { AboutDialog } from "@/features/about/AboutDialog"
import { useNav } from "@/features/nav"
import { HelpMenu } from "@/features/onboarding/HelpMenu"
import { Onboarding, SetupSteps } from "@/features/onboarding/Onboarding"
import { useOnboarding } from "@/features/onboarding/store"
import { Tour, useTour } from "@/features/onboarding/Tour"
import { ReportDialog } from "@/features/report/ReportDialog"
import { useReport } from "@/features/report/store"
import { useApplyScale, useScaleKeys } from "@/features/settings/scale"
import { SignInDialog } from "@/features/signin/SignInDialog"
import { ReadinessStrip } from "@/features/system/ReadinessStrip"
import { ClearDataOffer } from "@/features/tools/ClearDataOffer"
import { useUpdate } from "@/features/update/store"
import { UpdateButton, UpdateDialog } from "@/features/update/UpdateDialog"
import { Button } from "@/ui/Button"
import { ErrorBoundary } from "./ErrorBoundary"
import { useSectionHistory } from "./history"
import { Sidebar } from "./Sidebar"
import { CrashScenario } from "./scenarios"
import { sections } from "./sections"
import { TopBar } from "./TopBar"
import { useApplyTheme } from "./theme"

export function App() {
  useApplyTheme()
  useApplyScale()
  useScaleKeys()
  const active = useNav((s) => s.active)
  const setActive = useNav((s) => s.go)
  const onboarding = useOnboarding((s) => s.open)
  useSectionHistory(!onboarding)
  const Page = sections.find((s) => s.id === active)?.page

  // The tour points at the Tools page, so it opens there.
  const startTour = () => {
    setActive("tools")
    useTour.getState().start()
  }
  const toTools = () => setActive("tools")
  const [about, setAbout] = useState(false)
  useEffect(() => {
    useUpdate.getState().check()
  }, [])

  return (
    <div className="flex h-full">
      {onboarding ? <SetupSteps onExit={toTools} /> : <Sidebar active={active} onSelect={setActive} />}
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar>
          {!onboarding && (
            <>
              <UpdateButton />
              <Button
                variant="ghost"
                size="sm"
                title="Tell the WireCat team what went wrong"
                icon={<Bug className="size-4" strokeWidth={1.8} aria-hidden />}
                onClick={() => useReport.getState().start()}
              >
                Report a problem
              </Button>
              <HelpMenu
                onTour={startTour}
                onWelcome={() => useOnboarding.getState().reopen("welcome")}
                onAbout={() => setAbout(true)}
              />
            </>
          )}
        </TopBar>
        {onboarding ? (
          <ErrorBoundary scope="page">
            <Onboarding onExit={toTools} onTour={startTour} />
          </ErrorBoundary>
        ) : (
          <>
            <div data-tour="readiness" className="flex h-[3.9rem] shrink-0 items-center px-[2.1rem]">
              <ReadinessStrip />
            </div>
            <main className="min-h-0 flex-1 overflow-y-auto">
              <ErrorBoundary key={active} scope="page">
                <CrashScenario section={active} />
                {Page && <Page />}
              </ErrorBoundary>
            </main>
          </>
        )}
        <ClearDataOffer />
        <AboutDialog open={about} onClose={() => setAbout(false)} />
        <SignInDialog />
        <ReportDialog />
        <UpdateDialog />
      </div>
      <Tour />
    </div>
  )
}
