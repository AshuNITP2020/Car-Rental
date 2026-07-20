import { z } from 'zod'
import type { CreateCarRequest, UpdateCarRequest } from '../../lib/types'

const optionalCoord = z
  .string()
  .optional()
  .refine((v) => !v || !Number.isNaN(Number(v)), 'Must be a number')

export const CAR_STATUSES = ['AVAILABLE', 'BOOKED', 'MAINTENANCE', 'OUT_OF_SERVICE'] as const

export const carSchema = z.object({
  make: z.string().min(1, 'Required').max(60, 'Too long'),
  model: z.string().min(1, 'Required').max(60, 'Too long'),
  category: z.string().min(1, 'Required').max(40, 'Too long'),
  seats: z
    .string()
    .min(1, 'Required')
    .refine((v) => Number(v) >= 1 && Number(v) <= 12, '1–12'),
  regNo: z.string().min(1, 'Required').max(20, 'Too long'),
  pricePerDay: z
    .string()
    .min(1, 'Required')
    .refine((v) => !Number.isNaN(Number(v)) && Number(v) >= 0, 'Must be a number ≥ 0'),
  status: z.enum(CAR_STATUSES).optional(),
  latitude: optionalCoord,
  longitude: optionalCoord,
})
export type CarFormValues = z.infer<typeof carSchema>

export function toCreateCarRequest(v: CarFormValues): CreateCarRequest {
  return {
    make: v.make.trim(),
    model: v.model.trim(),
    category: v.category.trim(),
    seats: Number(v.seats),
    regNo: v.regNo.trim(),
    pricePerDay: Number(v.pricePerDay),
    latitude: v.latitude ? Number(v.latitude) : undefined,
    longitude: v.longitude ? Number(v.longitude) : undefined,
  }
}

export function toUpdateCarRequest(v: CarFormValues): UpdateCarRequest {
  return { ...toCreateCarRequest(v), status: v.status ?? 'AVAILABLE' }
}
