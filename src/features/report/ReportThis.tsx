import { Bug } from "lucide-react"
import { type Failure, failureReport } from "@/domain/report"
import { Button } from "@/ui/Button"
import { useNav } from "../nav"
import { useOnboarding } from "../onboarding/store"
import { recentErrors } from "./errors"
import { useReport } from "./store"

type Props = Omit<Failure, "message" | "page"> & {
  error: unknown
  page?: string | null
  log?: readonly string[]
  /** For a place that must step aside first, such as a dialog the report would cover. */
  onOpen?: () => void
}

const messageOf = (e: unknown) => (e instanceof Error ? e.message : String(e))

function currentPage() {
  if (useOnboarding.getState().open) return "the first-run setup"
  const id = useNav.getState().active
  return id.charAt(0).toUpperCase() + id.slice(1)
}

/** Opens the report form filled in from a failure. Nothing is sent until the owner presses Send there. */
export function reportFailure({ error, log, page, ...failure }: Omit<Props, "onOpen">) {
  const f = failureReport({ ...failure, message: messageOf(error), page: page === undefined ? currentPage() : page })
  useReport.getState().start({
    tool: f.about,
    summary: f.summary,
    steps: f.steps,
    details: f.happened,
    errors: recentErrors(),
    ...(log ? { log } : {}),
  })
}

export function ReportThis({ onOpen, ...props }: Props) {
  return (
    <Button
      size="sm"
      variant="ghost"
      title="Open a report about this, filled in. You can read and change it before sending."
      icon={<Bug className="size-4" aria-hidden />}
      onClick={() => {
        onOpen?.()
        reportFailure(props)
      }}
    >
      Report this
    </Button>
  )
}
