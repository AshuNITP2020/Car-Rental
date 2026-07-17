import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { Button } from '../../components/ui/button'
import { Field } from '../../components/ui/field'
import { Input } from '../../components/ui/input'
import type { AgencyResponse } from '../../lib/types'
import { agencySchema, type AgencyFormValues } from './agency-schema'

/** Shared create/edit form for an agency profile. */
export function AgencyForm({
  defaultValues,
  submitLabel,
  loading,
  onSubmit,
}: {
  defaultValues?: Partial<AgencyResponse>
  submitLabel: string
  loading?: boolean
  onSubmit: (values: AgencyFormValues) => void
}) {
  const form = useForm<AgencyFormValues>({
    resolver: zodResolver(agencySchema),
    defaultValues: {
      name: defaultValues?.name ?? '',
      city: defaultValues?.city ?? '',
      gstNo: defaultValues?.gstNo ?? '',
      payoutAccount: defaultValues?.payoutAccount ?? '',
      latitude: defaultValues?.latitude != null ? String(defaultValues.latitude) : '',
      longitude: defaultValues?.longitude != null ? String(defaultValues.longitude) : '',
    },
  })
  const { errors, isSubmitting } = form.formState

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" noValidate>
      <Field label="Agency name" htmlFor="name" required error={errors.name?.message}>
        <Input id="name" invalid={!!errors.name} {...form.register('name')} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="City" htmlFor="city" error={errors.city?.message}>
          <Input id="city" {...form.register('city')} />
        </Field>
        <Field label="GST number" htmlFor="gstNo" error={errors.gstNo?.message}>
          <Input id="gstNo" {...form.register('gstNo')} />
        </Field>
      </div>
      <Field
        label="Payout account"
        htmlFor="payoutAccount"
        hint="Where marketplace payouts are sent"
        error={errors.payoutAccount?.message}
      >
        <Input id="payoutAccount" {...form.register('payoutAccount')} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Latitude" htmlFor="latitude" hint="Optional" error={errors.latitude?.message}>
          <Input id="latitude" inputMode="decimal" {...form.register('latitude')} />
        </Field>
        <Field
          label="Longitude"
          htmlFor="longitude"
          hint="Optional"
          error={errors.longitude?.message}
        >
          <Input id="longitude" inputMode="decimal" {...form.register('longitude')} />
        </Field>
      </div>
      <Button type="submit" loading={loading || isSubmitting}>
        {submitLabel}
      </Button>
    </form>
  )
}
