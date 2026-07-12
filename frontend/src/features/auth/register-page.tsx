import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from './use-auth'
import { Button } from '../../components/ui/button'
import { Field } from '../../components/ui/field'
import { Input } from '../../components/ui/input'
import { useToast } from '../../components/ui/toast'
import { errorMessage, fieldErrors } from '../../lib/errors'
import { AuthLayout } from './auth-layout'
import { registerSchema, type RegisterValues } from './schemas'

export function RegisterPage() {
  const { register: registerUser, isAuthenticated } = useAuth()
  const toast = useToast()
  const navigate = useNavigate()

  const form = useForm<RegisterValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: { name: '', email: '', phone: '', password: '', confirmPassword: '' },
  })
  const { errors, isSubmitting } = form.formState

  if (isAuthenticated) return <Navigate to="/" replace />

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      await registerUser({
        name: values.name,
        email: values.email,
        password: values.password,
        phone: values.phone?.trim() ? values.phone.trim() : undefined,
      })
      toast.success('Account created — welcome!')
      navigate('/', { replace: true })
    } catch (e) {
      for (const [field, message] of Object.entries(fieldErrors(e))) {
        form.setError(field as keyof RegisterValues, { message })
      }
      toast.error(errorMessage(e), 'Registration failed')
    }
  })

  return (
    <AuthLayout
      title="Create your account"
      subtitle="Rent a car, or list your fleet as an agency"
      footer={
        <>
          Already have an account?{' '}
          <Link to="/login" className="font-medium text-primary hover:underline">
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
