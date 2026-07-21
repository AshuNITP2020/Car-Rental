import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { Spinner } from '../components/ui/spinner'
import { useAuth } from '../features/auth/use-auth'

function FullPageLoading() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <Spinner className="h-7 w-7" />
    </div>
  )
}

/** Requires a valid session; otherwise bounces to the right portal's sign-in
 *  (agency paths go to the agency door), remembering where they were headed. */
export function RequireAuth() {
  const { status } = useAuth()
  const location = useLocation()
  if (status === 'loading') return <FullPageLoading />
  if (status === 'unauthenticated') {
    const door = location.pathname.startsWith('/agency') ? '/agency/login' : '/login'
    return <Navigate to={door} replace state={{ from: location }} />
  }
  return <Outlet />
}

/** Customer-only surfaces (trip planner, results): agency accounts are
 *  supply-side only and get sent to their console instead. */
export function RequireCustomer() {
  const { status, hasAgency } = useAuth()
  if (status === 'loading') return <FullPageLoading />
  if (hasAgency) return <Navigate to="/agency" replace />
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
