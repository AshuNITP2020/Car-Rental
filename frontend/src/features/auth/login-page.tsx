import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../../auth/auth-context'
import { Button } from '../../components/ui/button'
import { Field } from '../../components/ui/field'
import { Input } from '../../components/ui/input'
import { useToast } from '../../components/ui/toast'
import { errorMessage, fieldErrors } from '../../lib/errors'
import { AuthLayout } from './auth-layout'
import { loginSchema, type LoginValues } from './schemas'

export function LoginPage() {
  const { login, isAuthenticated } = useAuth()
  const toast = useToast()
  const navigate = useNavigate()
  const location = useLocation()
  const from = (location.state as { from?: { pathname?: string } } | null)?.from?.pathname ?? '/'

  const form = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  })
  const { errors, isSubmitting } = form.formState

  if (isAuthenticated) return <Navigate to={from} replace />

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      await login(values)
      navigate(from, { replace: true })
    } catch (e) {
      for (const [field, message] of Object.entries(fieldErrors(e))) {
        form.setError(field as keyof LoginValues, { message })
      }
      toast.error(errorMessage(e), 'Sign in failed')
    }
  })

  return (
    <AuthLayout
      title="Welcome back"
      subtitle="Sign in to browse and book cars"
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
