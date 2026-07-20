import { useState } from 'react'
import { Link } from 'react-router-dom'
import { CarFront, History } from 'lucide-react'
import { StatusBadge } from '../../components/ui/badge'
import { Button } from '../../components/ui/button'
import { EmptyState } from '../../components/ui/empty-state'
import { LoadingState } from '../../components/ui/spinner'
import { formatDateRange } from '../../lib/date'
import { cn, formatMoney } from '../../lib/utils'
import { useGetMyBookingsQuery } from './api'

type Tab = 'upcoming' | 'past'

/** A trip is "past" when its window ended or it terminally failed. */
const ENDED = new Set(['COMPLETED', 'CANCELLED', 'EXPIRED', 'FAILED', 'REFUNDED'])

export function TripsPage() {
  const { data, isLoading, isError } = useGetMyBookingsQuery()
  const [tab, setTab] = useState<Tab>('upcoming')
  // Stable "now" for the whole mount — render must stay pure.
  const [now] = useState(() => Date.now())

  if (isLoading) return <LoadingState />

  const all = [...(data ?? [])].sort((a, b) => b.id - a.id)
  const isPast = (b: (typeof all)[number]) =>
    ENDED.has(b.status) || new Date(b.to).getTime() < now
  const bookings = all.filter((b) => (tab === 'past' ? isPast(b) : !isPast(b)))

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <h1 className="text-3xl font-bold tracking-tight">My trips</h1>

      <div className="inline-flex rounded-full bg-muted p-1" role="tablist">
        {(
          [
            { key: 'upcoming' as Tab, label: 'Upcoming & active' },
            { key: 'past' as Tab, label: 'Past' },
          ] as const
        ).map(({ key, label }) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={tab === key}
            onClick={() => setTab(key)}
            className={cn(
              'rounded-full px-4 py-2 text-sm font-medium transition-all duration-200',
              tab === key
                ? 'bg-foreground text-background shadow-sm'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {isError ? (
        <EmptyState icon={CarFront} title="Couldn’t load your trips" description="Please try again." />
      ) : bookings.length === 0 ? (
        tab === 'upcoming' ? (
          <EmptyState
            icon={CarFront}
            title="No upcoming trips"
            description="Plan a trip and it’ll show up here."
            action={
              <Link to="/">
                <Button>Plan a trip</Button>
              </Link>
            }
          />
        ) : (
          <EmptyState icon={History} title="No past trips yet" />
        )
      ) : (
        <div className="space-y-3">
          {bookings.map((b) => (
            <Link key={b.id} to={`/trips/${b.id}`} className="block">
              <div className="flex items-center justify-between rounded-2xl bg-muted p-5 transition-all duration-200 hover:shadow-lifted">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">Booking #{b.id}</span>
                    <StatusBadge status={b.status} />
                  </div>
                  <p className="text-sm text-muted-foreground">{formatDateRange(b.from, b.to)}</p>
                </div>
                <div className="text-right">
                  <p className="font-semibold">{formatMoney(b.amount)}</p>
                  <p className="text-xs text-muted-foreground">rental</p>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
