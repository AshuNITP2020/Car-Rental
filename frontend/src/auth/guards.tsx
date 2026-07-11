import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { Spinner } from '../components/ui/spinner'
import { useAuth } from './auth-context'

function FullPageLoading() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <Spinner className="h-7 w-7" />
    </div>
  )
}

/** Requires a valid session; otherwise bounces to /login (remembering origin). */
export function RequireAuth() {
  const { status } = useAuth()
  const location = useLocation()
  if (status === 'loading') return <FullPageLoading />
  if (status === 'unauthenticated')
    return <Navigate to="/login" replace state={{ from: location }} />
  return <Outlet />
}

/** Requires agency membership (JWT agencyId claim); else routes to onboarding. */
export function RequireAgency() {
  const { status, hasAgency } = useAuth()
  if (status === 'loading') return <FullPageLoading />
  if (!hasAgency) return <Navigate to="/agency/onboard" replace />
  return <Outlet />
}

/** Requires the PLATFORM_ADMIN role; else routes back to the customer home. */
export function RequireAdmin() {
  const { status, isAdmin } = useAuth()
  if (status === 'loading') return <FullPageLoading />
  if (!isAdmin) return <Navigate to="/" replace />
  return <Outlet />
}
