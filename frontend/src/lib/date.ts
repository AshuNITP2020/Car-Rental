import { differenceInCalendarDays, format, isValid, parseISO } from 'date-fns'

/** Default pickup/return hour applied when the user picks a calendar day. */
export const DEFAULT_RENTAL_HOUR = 10

function safe(iso: string | null | undefined): Date | null {
  if (!iso) return null
  const d = parseISO(iso)
  return isValid(d) ? d : null
}

export function formatDate(iso: string | null | undefined): string {
  const d = safe(iso)
  return d ? format(d, 'd MMM yyyy') : '—'
}

export function formatDateTime(iso: string | null | undefined): string {
  const d = safe(iso)
  return d ? format(d, 'd MMM yyyy, h:mm a') : '—'
}

export function formatDateRange(from: string, to: string): string {
  return `${formatDate(from)} → ${formatDate(to)}`
}

/** Whole rental days between two ISO instants (minimum 1). */
export function rentalDays(from: string, to: string): number {
  const a = safe(from)
  const b = safe(to)
  if (!a || !b) return 0
  return Math.max(1, differenceInCalendarDays(b, a))
}

/** Set a calendar day to the default rental hour (local) and return an ISO instant. */
export function dayAtDefaultHour(day: Date): string {
  const d = new Date(day)
  d.setHours(DEFAULT_RENTAL_HOUR, 0, 0, 0)
  return d.toISOString()
}

/** True if `to` is strictly after `from`. */
export function isValidRange(from: string | null, to: string | null): boolean {
  const a = safe(from)
  const b = safe(to)
  return !!a && !!b && a.getTime() < b.getTime()
}
