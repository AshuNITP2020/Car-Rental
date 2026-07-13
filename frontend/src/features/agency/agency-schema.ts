import { z } from 'zod'

const optionalCoord = z
  .string()
  .optional()
  .refine((v) => !v || !Number.isNaN(Number(v)), 'Must be a number')

export const agencySchema = z.object({
  name: z.string().min(1, 'Agency name is required').max(200, 'Too long'),
  city: z.string().max(100, 'Too long').optional().or(z.literal('')),
  gstNo: z.string().max(20, 'Too long').optional().or(z.literal('')),
  payoutAccount: z.string().max(100, 'Too long').optional().or(z.literal('')),
  latitude: optionalCoord,
  longitude: optionalCoord,
})
export type AgencyFormValues = z.infer<typeof agencySchema>

/** Map a validated form into the API request (empty strings -> omitted). */
export function toAgencyRequest(v: AgencyFormValues) {
  return {
    name: v.name.trim(),
    city: v.city?.trim() || undefined,
    gstNo: v.gstNo?.trim() || undefined,
    payoutAccount: v.payoutAccount?.trim() || undefined,
    latitude: v.latitude ? Number(v.latitude) : undefined,
    longitude: v.longitude ? Number(v.longitude) : undefined,
  }
}
