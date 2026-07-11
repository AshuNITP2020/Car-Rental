import type { HTMLAttributes } from 'react'
import { cn } from '../../lib/utils'

type Tone = 'success' | 'info' | 'warning' | 'danger' | 'neutral'

const tones: Record<Tone, string> = {
  success: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 ring-emerald-500/30',
  info: 'bg-blue-500/15 text-blue-600 dark:text-blue-400 ring-blue-500/30',
  warning: 'bg-amber-500/15 text-amber-600 dark:text-amber-400 ring-amber-500/30',
  danger: 'bg-rose-500/15 text-rose-600 dark:text-rose-400 ring-rose-500/30',
  neutral: 'bg-slate-500/15 text-slate-600 dark:text-slate-300 ring-slate-500/30',
}

export function Badge({
  tone = 'neutral',
  className,
  ...props
}: HTMLAttributes<HTMLSpanElement> & { tone?: Tone }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset',
        tones[tone],
        className,
      )}
      {...props}
    />
  )
}

/** Maps a backend status enum value to a badge tone. Shared across
 *  Booking/Car/Kyc/Document/Agency/Payment status values. */
const STATUS_TONE: Record<string, Tone> = {
  // green — good / done / verified
  VERIFIED: 'success',
  COMPLETED: 'success',
  CONFIRMED: 'success',
  AVAILABLE: 'success',
  CAPTURED: 'success',
  // blue — in progress / occupied
  ACTIVE: 'info',
  BOOKED: 'info',
  // amber — awaiting action
  PENDING: 'warning',
  CREATED: 'warning',
  MAINTENANCE: 'warning',
  // rose — failed / terminal-negative
  REJECTED: 'danger',
  FAILED: 'danger',
  CANCELLED: 'danger',
  EXPIRED: 'danger',
  SUSPENDED: 'danger',
  OUT_OF_SERVICE: 'danger',
  // neutral
  REFUNDED: 'neutral',
}

/** Turn UPPER_SNAKE into "Title case". */
export function humanizeStatus(value: string): string {
  return value
    .toLowerCase()
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}

export function StatusBadge({ status, className }: { status: string; className?: string }) {
  return (
    <Badge tone={STATUS_TONE[status] ?? 'neutral'} className={className}>
      {humanizeStatus(status)}
    </Badge>
  )
}
