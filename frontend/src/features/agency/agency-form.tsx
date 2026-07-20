import { lazy, Suspense } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm, useWatch } from 'react-hook-form'
import { MapPin } from 'lucide-react'
import { Button } from '../../components/ui/button'
import { Field } from '../../components/ui/field'
import { Input } from '../../components/ui/input'
import { Skeleton } from '../../components/ui/skeleton'
import type { AgencyResponse, LatLng } from '../../lib/types'
import { usePlaceLabel } from '../trip/api'
import { LocationInput } from '../trip/location-input'
import { agencySchema, type AgencyFormValues } from './agency-schema'

// Same mini-map as the car form: a draggable marker, no zone overlay needed.
const BaseLocationMap = lazy(() => import('./car-location-map'))

/** Fallback map view when nothing is known yet: India, zoomed out. */
const DEFAULT_CENTER: LatLng = { lat: 21.0, lng: 78.5 }

/**
 * Shared create/edit form for an agency profile — details on the left, the
 * base location on a map on the right (search a city or click/drag the pin;
 * no raw coordinate fields).
 */
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

  // Base pin derived from the (hidden) coordinate fields.
  const latStr = useWatch({ control: form.control, name: 'latitude' })
  const lngStr = useWatch({ control: form.control, name: 'longitude' })
  const base: LatLng | null =
    latStr && lngStr && !Number.isNaN(Number(latStr)) && !Number.isNaN(Number(lngStr))
      ? { lat: Number(latStr), lng: Number(lngStr) }
      : null
  const baseLabel = usePlaceLabel(base)

  function setBase(p: LatLng, cityName?: string) {
    form.setValue('latitude', p.lat.toFixed(6), { shouldDirty: true })
    form.setValue('longitude', p.lng.toFixed(6), { shouldDirty: true })
    if (cityName) form.setValue('city', cityName, { shouldDirty: true })
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} noValidate>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        {/* ── left: the details ── */}
        <div className="space-y-4">
          <Field label="Agency name" htmlFor="name" required error={errors.name?.message}>
            <Input id="name" invalid={!!errors.name} {...form.register('name')} />
          </Field>
          <Field label="GST number" htmlFor="gstNo" error={errors.gstNo?.message}>
            <Input id="gstNo" {...form.register('gstNo')} />
          </Field>
          <Field
            label="Payout account"
            htmlFor="payoutAccount"
            hint="Where marketplace payouts are sent"
            error={errors.payoutAccount?.message}
          >
            <Input id="payoutAccount" {...form.register('payoutAccount')} />
          </Field>
          <Field label="Base city" htmlFor="city" error={errors.city?.message}>
            <Input id="city" {...form.register('city')} />
          </Field>
        </div>

        {/* ── right: base location on the map ── */}
        <div className="space-y-2">
          <LocationInput
            id="base-search"
            icon={<MapPin className="h-4 w-4 text-primary" />}
            placeholder="Search your base city…"
            label=""
            cities={[]}
            value={null}
            onSelect={(p, name) => setBase(p, name)}
            onClear={() => {}}
          />
          <div className="h-[240px] overflow-hidden rounded-xl border border-border">
            <Suspense fallback={<Skeleton className="h-full w-full rounded-none" />}>
              <BaseLocationMap
                center={base ?? DEFAULT_CENTER}
                zoom={base ? 11 : 5}
                zone={[]}
                value={base}
                onChange={(p) => setBase(p)}
              />
            </Suspense>
          </div>
          <p className="text-xs text-muted-foreground">
            <MapPin className="mr-1 inline h-3.5 w-3.5" />
            {base
              ? `Base: ${baseLabel}`
              : 'Search a city or click the map to place your base — where your fleet starts out.'}
          </p>
        </div>
      </div>

      <Button type="submit" className="mt-5" loading={loading || isSubmitting}>
        {submitLabel}
      </Button>
    </form>
  )
}
