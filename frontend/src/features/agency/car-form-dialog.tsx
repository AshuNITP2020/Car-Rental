import { useEffect } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
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
import { useToast } from '../../components/ui/toast'
import { errorMessage } from '../../lib/errors'
import { humanizeStatus } from '../../lib/utils'
import type { CarResponse } from '../../lib/types'
import {
  CAR_STATUSES,
  carSchema,
  toCreateCarRequest,
  toUpdateCarRequest,
  type CarFormValues,
} from './car-schema'
import { useCreateCarMutation, useUpdateCarMutation } from './api'

const CATEGORY_SUGGESTIONS = ['Hatchback', 'Sedan', 'SUV', 'Luxury', 'Van', 'Electric']

function defaultsFor(car?: CarResponse): CarFormValues {
  return {
    make: car?.make ?? '',
    model: car?.model ?? '',
    category: car?.category ?? '',
    regNo: car?.regNo ?? '',
    pricePerDay: car?.pricePerDay != null ? String(car.pricePerDay) : '',
    status: car?.status ?? 'AVAILABLE',
    latitude: '',
    longitude: '',
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

  const form = useForm<CarFormValues>({
    resolver: zodResolver(carSchema),
    defaultValues: defaultsFor(car),
  })
  const { errors } = form.formState

  useEffect(() => {
    if (open) form.reset(defaultsFor(car))
  }, [open, car, form])

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
