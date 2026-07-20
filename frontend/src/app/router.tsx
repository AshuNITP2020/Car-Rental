import { lazy, Suspense, type ReactNode } from 'react'
import { createBrowserRouter, Navigate } from 'react-router-dom'
import { RequireAdmin, RequireAgency, RequireAuth } from '../auth/guards'
import { AppShell } from '../components/layout/app-shell'
import { NotFound } from '../components/not-found'
import { RouteErrorPage } from '../components/route-error'
import { LoadingState } from '../components/ui/spinner'

// Route-level code splitting — keeps the initial bundle small and isolates
// heavy deps (e.g. Recharts on the agency dashboard) into their own chunks.
const LoginPage = lazy(() => import('../features/auth/login-page').then((m) => ({ default: m.LoginPage })))
const RegisterPage = lazy(() =>
  import('../features/auth/register-page').then((m) => ({ default: m.RegisterPage })),
)
const CarDetailPage = lazy(() =>
  import('../features/cars/car-detail-page').then((m) => ({ default: m.CarDetailPage })),
)
const TripsPage = lazy(() => import('../features/bookings/trips-page').then((m) => ({ default: m.TripsPage })))
const TripDetailPage = lazy(() =>
  import('../features/bookings/trip-detail-page').then((m) => ({ default: m.TripDetailPage })),
)
const AccountPage = lazy(() => import('../features/account/account-page').then((m) => ({ default: m.AccountPage })))
const AgencyProfilePage = lazy(() =>
  import('../features/agencies/agency-profile-page').then((m) => ({ default: m.AgencyProfilePage })),
)
const TripSearchPage = lazy(() =>
  import('../features/trip/trip-search-page').then((m) => ({ default: m.TripSearchPage })),
)
const AgencyResultsPage = lazy(() =>
  import('../features/trip/agency-results-page').then((m) => ({ default: m.AgencyResultsPage })),
)
const DestinationsPage = lazy(() =>
  import('../features/trip/destinations-page').then((m) => ({ default: m.DestinationsPage })),
)
const AgencyOnboardPage = lazy(() =>
  import('../features/agency/onboard-page').then((m) => ({ default: m.AgencyOnboardPage })),
)
const AgencyDashboardPage = lazy(() =>
  import('../features/agency/dashboard-page').then((m) => ({ default: m.AgencyDashboardPage })),
)
const FleetPage = lazy(() => import('../features/agency/fleet-page').then((m) => ({ default: m.FleetPage })))
const CarManagePage = lazy(() =>
  import('../features/agency/car-manage-page').then((m) => ({ default: m.CarManagePage })),
)
const AgencyBookingsPage = lazy(() =>
  import('../features/agency/bookings-page').then((m) => ({ default: m.AgencyBookingsPage })),
)
const AgencySettingsPage = lazy(() =>
  import('../features/agency/settings-page').then((m) => ({ default: m.AgencySettingsPage })),
)
const AdminUsersPage = lazy(() => import('../features/admin/users-page').then((m) => ({ default: m.AdminUsersPage })))
const AdminAgenciesPage = lazy(() =>
  import('../features/admin/agencies-page').then((m) => ({ default: m.AdminAgenciesPage })),
)
const AdminDocumentsPage = lazy(() =>
  import('../features/admin/documents-page').then((m) => ({ default: m.AdminDocumentsPage })),
)

function Boundary({ children }: { children: ReactNode }) {
  return <Suspense fallback={<LoadingState />}>{children}</Suspense>
}

export const router = createBrowserRouter([
  {
    path: '/login',
    element: <Boundary><LoginPage /></Boundary>,
    errorElement: <RouteErrorPage />,
  },
  {
    path: '/register',
    element: <Boundary><RegisterPage /></Boundary>,
    errorElement: <RouteErrorPage />,
  },
  // The agency portal: same identity/auth API, its own branded doors.
  {
    path: '/agency/login',
    element: <Boundary><LoginPage portal="agency" /></Boundary>,
    errorElement: <RouteErrorPage />,
  },
  {
    path: '/agency/register',
    element: <Boundary><RegisterPage portal="agency" /></Boundary>,
    errorElement: <RouteErrorPage />,
  },
  {
    element: <RequireAuth />,
    errorElement: <RouteErrorPage />,
    children: [
      {
        // The shell wraps its <Outlet/> in a Suspense boundary, so lazy pages
        // below render their own fallback without extra wrappers here.
        element: <AppShell />,
        children: [
          // ── Customer: trip-first flow (pickup + drop + dates is all it takes) ──
          { index: true, element: <TripSearchPage /> },
          { path: 'destinations', element: <DestinationsPage /> },
          { path: 'agencies', element: <AgencyResultsPage /> },
          { path: 'cars/:id', element: <CarDetailPage /> },
          { path: 'agencies/:id', element: <AgencyProfilePage /> },
          { path: 'trips', element: <TripsPage /> },
          { path: 'trips/:id', element: <TripDetailPage /> },
          { path: 'account', element: <AccountPage /> },

          // ── Agency (Phase C) ──
          {
            path: 'agency',
            children: [
              { path: 'onboard', element: <AgencyOnboardPage /> },
              {
                element: <RequireAgency />,
                children: [
                  { index: true, element: <AgencyDashboardPage /> },
                  { path: 'cars', element: <FleetPage /> },
                  { path: 'cars/:id', element: <CarManagePage /> },
                  { path: 'bookings', element: <AgencyBookingsPage /> },
                  { path: 'settings', element: <AgencySettingsPage /> },
                ],
              },
            ],
          },

          // ── Admin (Phase D) ──
          {
            path: 'admin',
            element: <RequireAdmin />,
            children: [
              { index: true, element: <Navigate to="/admin/agencies" replace /> },
              { path: 'agencies', element: <AdminAgenciesPage /> },
              { path: 'users', element: <AdminUsersPage /> },
              { path: 'documents', element: <AdminDocumentsPage /> },
            ],
          },

          { path: '*', element: <NotFound /> },
        ],
      },
    ],
  },
])
