import { createBrowserRouter, Navigate } from 'react-router-dom'
import { RequireAdmin, RequireAgency, RequireAuth } from '../auth/guards'
import { AppShell } from '../components/layout/app-shell'
import { NotFound } from '../components/not-found'
import { Placeholder } from '../components/placeholder'
import { LoginPage } from '../features/auth/login-page'
import { RegisterPage } from '../features/auth/register-page'

export const router = createBrowserRouter([
  { path: '/login', element: <LoginPage /> },
  { path: '/register', element: <RegisterPage /> },
  {
    element: <RequireAuth />,
    children: [
      {
        element: <AppShell />,
        children: [
          // ── Customer (Phase B) ──
          { index: true, element: <Placeholder title="Browse cars" /> },
          { path: 'cars/:id', element: <Placeholder title="Car detail" /> },
          { path: 'trips', element: <Placeholder title="My trips" /> },
          { path: 'account', element: <Placeholder title="Account & KYC" /> },

          // ── Agency (Phase C) ──
          {
            path: 'agency',
            children: [
              { path: 'onboard', element: <Placeholder title="Become an agency" /> },
              {
                element: <RequireAgency />,
                children: [
                  { index: true, element: <Placeholder title="Agency dashboard" /> },
                  { path: 'cars', element: <Placeholder title="Fleet" /> },
                  { path: 'cars/:id', element: <Placeholder title="Manage car" /> },
                  { path: 'bookings', element: <Placeholder title="Agency bookings" /> },
                  { path: 'settings', element: <Placeholder title="Agency settings" /> },
                ],
              },
            ],
          },

          // ── Admin (Phase D) ──
          {
            path: 'admin',
            element: <RequireAdmin />,
            children: [
              { index: true, element: <Navigate to="/admin/users" replace /> },
              { path: 'users', element: <Placeholder title="Users" /> },
              { path: 'documents', element: <Placeholder title="Document review" /> },
            ],
          },

          { path: '*', element: <NotFound /> },
        ],
      },
    ],
  },
])
