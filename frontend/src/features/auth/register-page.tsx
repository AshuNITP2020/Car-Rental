import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from './use-auth'
import { Button } from '../../components/ui/button'
import { Field } from '../../components/ui/field'
import { Input } from '../../components/ui/input'
import { useToast } from '../../components/ui/toast'
import { errorMessage, fieldErrors } from '../../lib/errors'
import { AuthLayout } from './auth-layout'
import { registerSchema, type RegisterValues } from './schemas'

/** Portal-specific framing over the same account registration. */
const PORTALS = {
  customer: {
    title: 'Create your account',
    subtitle: 'Rent a car anywhere an agency operates',
    badge: undefined as string | undefined,
    loginPath: '/login',
    home: '/',
  },
  agency: {
    title: 'Register your agency',
    subtitle: 'Step 1 of 2 — create the account that will own your agency',
    badge: 'for Agencies',
    loginPath: '/agency/login',
    home: '/agency',
  },
}

export function RegisterPage({ portal = 'customer' }: { portal?: keyof typeof PORTALS }) {
  const cfg = PORTALS[portal]
  const { register: registerUser, isAuthenticated } = useAuth()
  const toast = useToast()
  const navigate = useNavigate()
  const location = useLocation()
  // Login page hands over the typed email when it finds no account for it.
  const prefillEmail = (location.state as { email?: string } | null)?.email ?? ''

  const form = useForm<RegisterValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: { name: '', email: prefillEmail, phone: '', password: '', confirmPassword: '' },
  })
  const { errors, isSubmitting } = form.formState

  if (isAuthenticated) return <Navigate to={cfg.home} replace />

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      await registerUser({
        name: values.name,
        email: values.email,
        password: values.password,
        phone: values.phone?.trim() ? values.phone.trim() : undefined,
      })
      // Account creation does NOT sign the user in — hand off to sign-in
      // with the email prefilled. (Agency portal: signing in then leads to
      // the agency onboarding wizard.)
      toast.success('Account created — please sign in')
      navigate(cfg.loginPath, { replace: true, state: { email: values.email, justRegistered: true } })
    } catch (e) {
      for (const [field, message] of Object.entries(fieldErrors(e))) {
        form.setError(field as keyof RegisterValues, { message })
      }
      toast.error(errorMessage(e), 'Registration failed')
    }
  })

  return (
    <AuthLayout
      title={cfg.title}
      subtitle={cfg.subtitle}
      badge={cfg.badge}
      footer={
        <>
          Already have an account?{' '}
          <Link to={cfg.loginPath} className="font-medium text-primary hover:underline">
            Sign in
          </Link>
        </>
      }
    >
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        <Field label="Full name" htmlFor="name" required error={errors.name?.message}>
          <Input id="name" autoComplete="name" invalid={!!errors.name} {...form.register('name')} />
        </Field>
        <Field label="Email" htmlFor="email" required error={errors.email?.message}>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            invalid={!!errors.email}
            {...form.register('email')}
          />
        </Field>
        <Field label="Phone" htmlFor="phone" hint="Optional" error={errors.phone?.message}>
          <Input id="phone" type="tel" autoComplete="tel" invalid={!!errors.phone} {...form.register('phone')} />
        </Field>
        <Field label="Password" htmlFor="password" required error={errors.password?.message}>
          <Input
            id="password"
            type="password"
            autoComplete="new-password"
            invalid={!!errors.password}
            {...form.register('password')}
          />
        </Field>
        <Field
          label="Confirm password"
          htmlFor="confirmPassword"
          required
          error={errors.confirmPassword?.message}
        >
          <Input
            id="confirmPassword"
            type="password"
            autoComplete="new-password"
            invalid={!!errors.confirmPassword}
            {...form.register('confirmPassword')}
          />
        </Field>
        <Button type="submit" className="w-full" loading={isSubmitting}>
          Create account
        </Button>
      </form>
    </AuthLayout>
  )
}
