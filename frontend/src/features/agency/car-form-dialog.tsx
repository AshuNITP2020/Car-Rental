import { lazy, Suspense, useEffect } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm, useWatch } from 'react-hook-form'
import { MapPin } from 'lucide-react'
import { Button } from '../../components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../components/ui/dialog'
import { Field } from '../../components/ui/field'
import { Input } from '../../components/ui/input'
import { Select } from '../../components/ui/select'
import { Skeleton } from '../../components/ui/skeleton'
import { useToast } from '../../components/ui/toast'
import { errorMessage } from '../../lib/errors'
import { humanizeStatus } from '../../lib/utils'
import type { CarResponse, LatLng } from '../../lib/types'
import { usePlaceLabel } from '../trip/api'
import {
  CAR_STATUSES,
  carSchema,
  toCreateCarRequest,
  toUpdateCarRequest,
  type CarFormValues,
} from './car-schema'
import { useCreateCarMutation, useGetMyAgencyQuery, useGetMyServiceAreaQuery, useUpdateCarMutation } from './api'

const CarLocationMap = lazy(() => import('./car-location-map'))

const CATEGORY_SUGGESTIONS = ['Hatchback', 'Sedan', 'SUV', 'Luxury', 'Van', 'Electric']

function defaultsFor(car?: CarResponse): CarFormValues {
  return {
    make: car?.make ?? '',
    model: car?.model ?? '',
    category: car?.category ?? '',
    seats: car?.seats != null ? String(car.seats) : '5',
    regNo: car?.regNo ?? '',
    pricePerDay: car?.pricePerDay != null ? String(car.pricePerDay) : '',
    status: car?.status ?? 'AVAILABLE',
    latitude: car?.latitude != null ? String(car.latitude) : '',
    longitude: car?.longitude != null ? String(car.longitude) : '',
  }
}

export function CarFormDialog({
  car,
  open,
  onOpenChange,
}: {
  car?: CarResponse
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const isEdit = !!car
  const [createCar, createState] = useCreateCarMutation()
  const [updateCar, updateState] = useUpdateCarMutation()
  const toast = useToast()
  const { data: agency } = useGetMyAgencyQuery()
  const { data: area } = useGetMyServiceAreaQuery()

  const form = useForm<CarFormValues>({
    resolver: zodResolver(carSchema),
    defaultValues: defaultsFor(car),
  })
  const { errors } = form.formState

  useEffect(() => {
    if (open) form.reset(defaultsFor(car))
  }, [open, car, form])

  // The car's pin, derived from the form values (strings -> LatLng | null).
  // useWatch (not form.watch) — subscription-based, React Compiler-friendly.
  const latStr = useWatch({ control: form.control, name: 'latitude' })
  const lngStr = useWatch({ control: form.control, name: 'longitude' })
  const pin: LatLng | null =
    latStr && lngStr && !Number.isNaN(Number(latStr)) && !Number.isNaN(Number(lngStr))
      ? { lat: Number(latStr), lng: Number(lngStr) }
      : null
  const pinLabel = usePlaceLabel(pin)
  const agencyBase: LatLng | null =
    agency?.latitude != null && agency?.longitude != null
      ? { lat: agency.latitude, lng: agency.longitude }
      : null
  const zone = area?.polygons ?? []
  const mapCenter = pin ?? agencyBase ?? (zone[0]?.[0] ?? null)

  function setPin(p: LatLng) {
    form.setValue('latitude', p.lat.toFixed(6), { shouldDirty: true })
    form.setValue('longitude', p.lng.toFixed(6), { shouldDirty: true })
  }

  async function onSubmit(values: CarFormValues) {
    try {
      if (car) {
        await updateCar({ id: car.id, body: toUpdateCarRequest(values) }).unwrap()
        toast.success('Car updated')
      } else {
        await createCar(toCreateCarRequest(values)).unwrap()
        toast.success('Car added to fleet')
      }
      onOpenChange(false)
    } catch (e) {
      toast.error(errorMessage(e), 'Could not save car')
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit car' : 'Add a car'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" noValidate>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Make" htmlFor="make" required error={errors.make?.message}>
              <Input id="make" invalid={!!errors.make} {...form.register('make')} />
            </Field>
            <Field label="Model" htmlFor="model" required error={errors.model?.message}>
              <Input id="model" invalid={!!errors.model} {...form.register('model')} />
            </Field>
            <Field label="Category" htmlFor="category" required error={errors.category?.message}>
              <Input
                id="category"
                list="car-categories"
                invalid={!!errors.category}
                {...form.register('category')}
              />
              <datalist id="car-categories">
                {CATEGORY_SUGGESTIONS.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </Field>
            <Field label="Seats" htmlFor="seats" required error={errors.seats?.message}>
              <Select id="seats" {...form.register('seats')}>
                {[2, 4, 5, 6, 7, 8].map((n) => (
                  <option key={n} value={n}>
                    {n} seats
                  </option>
                ))}
              </Select>
            </Field>
            <Field
              label="Registration no."
              htmlFor="regNo"
              required
              error={errors.regNo?.message}
            >
              <Input id="regNo" invalid={!!errors.regNo} {...form.register('regNo')} />
            </Field>
            <Field
              label="Price / day (₹)"
              htmlFor="pricePerDay"
              required
              error={errors.pricePerDay?.message}
            >
              <Input
                id="pricePerDay"
                type="number"
                min={0}
                invalid={!!errors.pricePerDay}
                {...form.register('pricePerDay')}
              />
            </Field>
            {isEdit && (
              <Field label="Status" htmlFor="status" error={errors.status?.message}>
                <Select id="status" {...form.register('status')}>
                  {CAR_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {humanizeStatus(s)}
                    </option>
                  ))}
                </Select>
              </Field>
            )}
          </div>

          {/* where the car is parked — must stay inside the operating area */}
          {mapCenter && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="flex items-center gap-1.5 text-sm font-medium">
                  <MapPin className="h-4 w-4 text-primary" /> Parked at
                  <span className="font-normal text-muted-foreground">
                    {pin ? pinLabel : 'agency base (default)'}
                  </span>
                </p>
                {pin && (
                  <button
                    type="button"
                    className="text-xs text-muted-foreground hover:underline"
                    onClick={() => {
                      form.setValue('latitude', '', { shouldDirty: true })
                      form.setValue('longitude', '', { shouldDirty: true })
                    }}
                  >
                    Reset to agency base
                  </button>
                )}
              </div>
              <div className="h-[220px] overflow-hidden rounded-xl border border-border">
                <Suspense fallback={<Skeleton className="h-full w-full rounded-none" />}>
                  <CarLocationMap center={mapCenter} zone={zone} value={pin} onChange={setPin} />
                </Suspense>
              </div>
              <p className="text-xs text-muted-foreground">
                Click the map to place the car. It must be inside your operating area
                (dashed outline) or customers can’t find it.
              </p>
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={createState.isLoading || updateState.isLoading}>
              {isEdit ? 'Save changes' : 'Add car'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
