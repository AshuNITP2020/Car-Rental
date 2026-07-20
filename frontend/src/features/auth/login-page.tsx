import { useState } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { Alert } from '../../components/ui/alert'
import { Button } from '../../components/ui/button'
import { Field } from '../../components/ui/field'
import { Input } from '../../components/ui/input'
import { errorMessage, fieldErrors, type SerializedApiError } from '../../lib/errors'
import { AuthLayout } from './auth-layout'
import { loginSchema, type LoginValues } from './schemas'
import { useAuth } from './use-auth'

interface LocationState {
  from?: { pathname?: string }
  /** Prefilled by the register page after account creation. */
  email?: string
  justRegistered?: boolean
}

/** The two doors into the same auth: one identity, portal-specific framing. */
const PORTALS = {
  customer: {
    title: 'Welcome back',
    subtitle: 'Sign in to plan your next trip',
    badge: undefined as string | undefined,
    home: '/',
    registerPath: '/register',
  },
  agency: {
    title: 'Agency sign in',
    subtitle: 'Manage your fleet, bookings and operating area',
    badge: 'for Agencies',
    home: '/agency',
    registerPath: '/agency/register',
  },
}

export function LoginPage({ portal = 'customer' }: { portal?: keyof typeof PORTALS }) {
  const cfg = PORTALS[portal]
  const { login, isAuthenticated } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const state = (location.state as LocationState | null) ?? {}
  const from = state.from?.pathname ?? cfg.home

  const [authError, setAuthError] = useState<SerializedApiError | null>(null)

  const form = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: state.email ?? '', password: '' },
  })
  const { errors, isSubmitting } = form.formState

  if (isAuthenticated) return <Navigate to={from} replace />

  const onSubmit = form.handleSubmit(async (values) => {
    setAuthError(null)
    try {
      await login(values)
      navigate(from, { replace: true })
    } catch (e) {
      for (const [field, message] of Object.entries(fieldErrors(e))) {
        form.setError(field as keyof LoginValues, { message })
      }
      setAuthError(e as SerializedApiError)
    }
  })

  const unknownEmail = authError?.status === 404

  return (
    <AuthLayout
      title={cfg.title}
      subtitle={cfg.subtitle}
      badge={cfg.badge}
      footer={
        <div className="space-y-1">
          <div>
            New here?{' '}
            <Link to={cfg.registerPath} className="font-medium text-primary hover:underline">
              {portal === 'agency' ? 'Register your agency' : 'Create an account'}
            </Link>
          </div>
          <div>
            {portal === 'agency' ? (
              <Link to="/login" className="text-xs hover:underline">
                Looking to rent a car? Customer sign in →
              </Link>
            ) : (
              <Link to="/agency/login" className="text-xs hover:underline">
                Run a rental agency? Agency sign in →
              </Link>
            )}
          </div>
        </div>
      }
    >
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        {state.justRegistered && !authError && (
          <Alert variant="success">Account created — sign in to get started.</Alert>
        )}

        {authError && (
          <Alert variant="error" title={unknownEmail ? 'No account found' : 'Sign in failed'}>
            {unknownEmail ? (
              <>
                This email isn’t registered yet.{' '}
                <Link
                  to={cfg.registerPath}
                  state={{ email: form.getValues('email') }}
                  className="font-medium underline"
                >
                  Create an account
                </Link>
              </>
            ) : (
              errorMessage(authError)
            )}
          </Alert>
        )}

        <Field label="Email" htmlFor="email" required error={errors.email?.message}>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            invalid={!!errors.email}
            {...form.register('email')}
          />
        </Field>
        <Field label="Password" htmlFor="password" required error={errors.password?.message}>
          <Input
            id="password"
            type="password"
            autoComplete="current-password"
            invalid={!!errors.password}
            {...form.register('password')}
          />
        </Field>
        <Button type="submit" className="w-full" loading={isSubmitting}>
          Sign in
        </Button>
      </form>
    </AuthLayout>
  )
}
