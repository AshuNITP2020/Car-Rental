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

export function LoginPage() {
  const { login, isAuthenticated } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const state = (location.state as LocationState | null) ?? {}
  const from = state.from?.pathname ?? '/'

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
      title="Welcome back"
      subtitle="Sign in to plan your next trip"
      footer={
        <>
          New here?{' '}
          <Link to="/register" className="font-medium text-primary hover:underline">
            Create an account
          </Link>
        </>
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
                  to="/register"
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
