import { Component, type ReactNode } from "react"

type State = { error: Error | null }

export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  override state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  override render() {
    const { error } = this.state
    if (!error) return this.props.children
    return (
      <div role="alert" className="grid h-full place-items-center p-10">
        <div className="max-w-lg">
          <h1 className="font-display text-2xl font-extrabold">Something broke in WireCat</h1>
          <p className="mt-3 text-ink-soft">The window hit an error it could not recover from. Reload to try again.</p>
          <pre className="selectable mt-4 overflow-auto rounded-md bg-app-3 p-3 font-mono text-sm">{error.message}</pre>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="mt-4 rounded-md bg-brand px-4 py-2 font-medium text-brand-ink"
          >
            Reload
          </button>
        </div>
      </div>
    )
  }
}
