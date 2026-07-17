import { useRouteError } from 'react-router-dom'
import { Button } from './ui/button'

/** True for failures loading a lazy route chunk — typically a stale client
 *  after a redeploy (old hashed chunk gone) or a dev-server restart. */
function isChunkLoadError(error: unknown): boolean {
  return (
    error instanceof Error &&
    /dynamically imported module|Loading chunk|import\(\)|Failed to fetch/i.test(error.message)
  )
}

/**
 * Router-level error page (React Router catches route errors internally, so
 * the app-level ErrorBoundary never sees them). Chunk-load failures get a
 * reload prompt; anything else gets a generic recovery screen.
 */
export function RouteErrorPage() {
  const error = useRouteError()
  const stale = isChunkLoadError(error)
  console.error('Route error:', error)

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center">
      <p className="text-5xl">{stale ? '🔄' : '🚧'}</p>
      <h1 className="text-2xl font-semibold">
        {stale ? 'App updated — reload needed' : 'Something went wrong'}
      </h1>
      <p className="max-w-md text-sm text-muted-foreground">
        {stale
          ? 'A newer version of the app is available (or the dev server restarted), so this page couldn’t load. Reloading fixes it.'
          : 'An unexpected error occurred while loading this page. Reloading usually fixes it.'}
      </p>
      <Button onClick={() => window.location.reload()}>Reload page</Button>
    </div>
  )
}
