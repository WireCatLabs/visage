import { RotateCcw } from "lucide-react"
import { Component, type ErrorInfo, type ReactNode } from "react"
import { recordError } from "@/features/report/errors"
import { ReportDialog } from "@/features/report/ReportDialog"
import { ReportThis } from "@/features/report/ReportThis"
import { Button } from "@/ui/Button"

type Props = { children: ReactNode; scope: "page" | "app" }
type State = { error: Error | null; componentStack: string | null }

export class ErrorBoundary extends Component<Props, State> {
  override state: State = { error: null, componentStack: null }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error }
  }

  override componentDidCatch(error: Error, info: ErrorInfo) {
    const componentStack = info.componentStack ?? null
    recordError("render", error, `${error.stack ?? ""}\n${componentStack ?? ""}`.trim())
    this.setState({ componentStack })
  }

  override render() {
    const { error, componentStack } = this.state
    if (!error) return this.props.children
    const page = this.props.scope === "page"
    return (
      <div role="alert" className="grid h-full place-items-center p-10">
        <div className="max-w-lg">
          <h1 className="font-display text-2xl font-extrabold">
            {page ? "Something broke on this page" : "Something broke in WireCat"}
          </h1>
          <p className="mt-3 text-ink-soft">
            {page
              ? "This page hit an error it could not recover from. The rest of WireCat still works. Reload to try again."
              : "The window hit an error it could not recover from. Reload to try again."}
          </p>
          <pre className="selectable mt-4 overflow-auto whitespace-pre-wrap rounded-md bg-app-3 p-3 font-mono text-sm">
            {error.name}: {error.message}
          </pre>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button
              variant="primary"
              icon={<RotateCcw className="size-4" aria-hidden />}
              onClick={() => window.location.reload()}
            >
              Reload
            </Button>
            <ReportThis
              what={page ? "Showing this page" : "Showing the window"}
              error={`${error.name}: ${error.message}`}
              stack={componentStack}
            />
          </div>
        </div>
        {/* The app's own dialog is gone with the app, so the report opens from here. */}
        {!page && <ReportDialog />}
      </div>
    )
  }
}
