import { Component, type ErrorInfo, type ReactNode } from 'react'

interface Props {
  children: ReactNode
}
interface State {
  error: Error | null
}

/**
 * Last-resort catch for render/lifecycle errors so an unexpected exception
 * degrades to a recoverable message instead of a blank page. Kept dependency-
 * free (no UI-kit imports) so a bug in the kit can't take the boundary down too.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Central place to forward to an error tracker (Sentry etc.) later.
    console.error('Unhandled render error:', error, info.componentStack)
  }

  render() {
    if (this.state.error) {
      return (
        <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center">
          <p className="text-5xl">🚧</p>
          <h1 className="text-2xl font-semibold">Something went wrong</h1>
          <p className="max-w-md text-sm text-muted-foreground">
            An unexpected error occurred. Reloading usually fixes it — if not, please try again
            later.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="rounded-[var(--radius)] bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Reload page
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
