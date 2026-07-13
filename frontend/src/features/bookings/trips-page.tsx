import { Link } from 'react-router-dom'
import { CarFront } from 'lucide-react'
import { StatusBadge } from '../../components/ui/badge'
import { Button } from '../../components/ui/button'
import { Card } from '../../components/ui/card'
import { EmptyState } from '../../components/ui/empty-state'
import { LoadingState } from '../../components/ui/spinner'
import { formatDateRange } from '../../lib/date'
import { formatMoney } from '../../lib/utils'
import { useGetMyBookingsQuery } from './api'

export function TripsPage() {
  const { data, isLoading, isError } = useGetMyBookingsQuery()

  if (isLoading) return <LoadingState />

  const bookings = [...(data ?? [])].sort((a, b) => b.id - a.id)

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">My trips</h1>

      {isError ? (
        <EmptyState icon={CarFront} title="Couldn’t load your trips" description="Please try again." />
      ) : bookings.length === 0 ? (
        <EmptyState
          icon={CarFront}
          title="No trips yet"
          description="Book a car and it’ll show up here."
          action={
            <Link to="/">
              <Button>Browse cars</Button>
            </Link>
          }
        />
      ) : (
        <div className="space-y-3">
          {bookings.map((b) => (
            <Link key={b.id} to={`/trips/${b.id}`}>
              <Card className="flex items-center justify-between p-4 transition-shadow hover:shadow-sm">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">Booking #{b.id}</span>
                    <StatusBadge status={b.status} />
                  </div>
                  <p className="text-sm text-muted-foreground">{formatDateRange(b.from, b.to)}</p>
                </div>
                <div className="text-right">
                  <p className="font-semibold">{formatMoney(b.amount)}</p>
                  <p className="text-xs text-muted-foreground">rental</p>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
