import { useState } from 'react'
import { CarFront, CircleCheck } from 'lucide-react'
import { Alert } from '../../components/ui/alert'
import { StatusBadge } from '../../components/ui/badge'
import { Button } from '../../components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card'
import { Field } from '../../components/ui/field'
import { Input } from '../../components/ui/input'
import { useToast } from '../../components/ui/toast'
import { formatDateTime } from '../../lib/date'
import { errorMessage } from '../../lib/errors'
import { formatMoney } from '../../lib/utils'
import type { BookingResponse } from '../../lib/types'
import { useActivateBookingMutation, useCompleteBookingMutation } from './api'

export function AgencyBookingsPage() {
  const [bookingId, setBookingId] = useState('')
  const [last, setLast] = useState<BookingResponse | null>(null)
  const [activate, activateState] = useActivateBookingMutation()
  const [complete, completeState] = useCompleteBookingMutation()
  const toast = useToast()

  const id = Number(bookingId)
  const valid = bookingId.trim() !== '' && Number.isInteger(id) && id > 0

  async function run(action: 'activate' | 'complete') {
    try {
      const res =
        action === 'activate' ? await activate(id).unwrap() : await complete(id).unwrap()
      setLast(res)
      toast.success(
        action === 'activate' ? 'Car marked as picked up (active)' : 'Trip completed — payout triggered',
      )
    } catch (e) {
      toast.error(errorMessage(e), 'Action failed')
    }
  }

  return (
    <div className="max-w-xl space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Bookings</h1>

      <Alert variant="info" title="Actions only">
        The backend currently exposes only the pickup and completion actions by booking id — there’s
        no agency booking list endpoint yet. Enter a booking id to advance its lifecycle
        (Confirmed → Active → Completed).
      </Alert>

      <Card>
        <CardHeader>
          <CardTitle>Advance a booking</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Field label="Booking ID" htmlFor="bid">
            <Input
              id="bid"
              type="number"
              min={1}
              placeholder="e.g. 1024"
              value={bookingId}
              onChange={(e) => setBookingId(e.target.value)}
            />
          </Field>
          <div className="flex flex-wrap gap-2">
            <Button
              disabled={!valid}
              loading={activateState.isLoading}
              onClick={() => run('activate')}
            >
              <CarFront className="h-4 w-4" /> Mark picked up
            </Button>
            <Button
              variant="outline"
              disabled={!valid}
              loading={completeState.isLoading}
              onClick={() => run('complete')}
            >
              <CircleCheck className="h-4 w-4" /> Complete trip
            </Button>
          </div>
        </CardContent>
      </Card>

      {last && (
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle>Booking #{last.id}</CardTitle>
            <StatusBadge status={last.status} />
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <Row label="Pickup" value={formatDateTime(last.from)} />
            <Row label="Return" value={formatDateTime(last.to)} />
            <Row label="Rental" value={formatMoney(last.amount)} />
          </CardContent>
        </Card>
      )}
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  )
}
