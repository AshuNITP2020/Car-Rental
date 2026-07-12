import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { skipToken } from '@reduxjs/toolkit/query'
import { CheckCircle2, XCircle } from 'lucide-react'
import { Button } from '../../components/ui/button'
import { Card } from '../../components/ui/card'
import { DateRangePicker, type DateRangeValue } from '../../components/ui/date-range-picker'
import { Spinner } from '../../components/ui/spinner'
import { useToast } from '../../components/ui/toast'
import { dayAtDefaultHour, isValidRange } from '../../lib/date'
import { errorMessage } from '../../lib/errors'
import { formatMoney } from '../../lib/utils'
import { useCreateBookingMutation } from '../bookings/api'
import { useGetCarAvailabilityQuery, useGetCarQuoteQuery } from './api'

export function BookingWidget({ carId, pricePerDay }: { carId: number; pricePerDay: number }) {
  const [range, setRange] = useState<DateRangeValue>({})
  const toast = useToast()
  const navigate = useNavigate()
  const [createBooking, { isLoading: creating }] = useCreateBookingMutation()

  const rawFrom = range.from ? dayAtDefaultHour(range.from) : undefined
  const rawTo = range.to ? dayAtDefaultHour(range.to) : undefined
  // A single calendar click yields from===to; only treat a real multi-day span
  // as a usable window so we never query with an empty range.
  const bothSet = isValidRange(rawFrom ?? null, rawTo ?? null)
  const from = bothSet ? rawFrom : undefined
  const to = bothSet ? rawTo : undefined

  const window = from && to ? { id: carId, from, to } : skipToken
  const availability = useGetCarAvailabilityQuery(window)
  const quote = useGetCarQuoteQuery(window)

  const available = availability.data?.available
  const canBook = bothSet && available === true && !creating

  async function book() {
    if (!from || !to) return
    try {
      const booking = await createBooking({ carId, from, to }).unwrap()
      toast.success('Car held — complete payment to confirm your booking')
      navigate(`/trips/${booking.id}`)
    } catch (e) {
      toast.error(errorMessage(e), 'Booking failed')
    }
  }

  return (
    <Card className="sticky top-20 space-y-4 p-5">
      <div>
        <span className="text-2xl font-semibold">{formatMoney(pricePerDay)}</span>
        <span className="text-sm text-muted-foreground"> / day</span>
      </div>

      <DateRangePicker
        value={range}
        onChange={setRange}
        disabledBefore={new Date()}
        placeholder="Pickup → return"
      />

      {bothSet && (
        <div className="rounded-[var(--radius)] border border-border p-3 text-sm">
          {availability.isFetching ? (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Spinner className="h-4 w-4" /> Checking availability…
            </div>
          ) : available === false ? (
            <div className="flex items-center gap-2 text-destructive">
              <XCircle className="h-4 w-4" />
              {availability.data?.reason || 'Not available for these dates'}
            </div>
          ) : available === true ? (
            <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="h-4 w-4" /> Available
            </div>
          ) : null}
        </div>
      )}

      {quote.data && available !== false && (
        <dl className="space-y-1.5 text-sm">
          <div className="flex justify-between">
            <dt className="text-muted-foreground">
              Rental · {quote.data.days} day{quote.data.days > 1 ? 's' : ''}
            </dt>
            <dd>{formatMoney(quote.data.rental)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted-foreground">GST</dt>
            <dd>{formatMoney(quote.data.gst)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Refundable deposit</dt>
            <dd>{formatMoney(quote.data.deposit)}</dd>
          </div>
          <div className="mt-1 flex justify-between border-t border-border pt-2 font-semibold">
            <dt>Total due now</dt>
            <dd>{formatMoney(quote.data.total)}</dd>
          </div>
        </dl>
      )}

      <Button className="w-full" disabled={!canBook} loading={creating} onClick={book}>
        {bothSet ? 'Book & hold' : 'Select dates'}
      </Button>
      <p className="text-center text-xs text-muted-foreground">
        You won’t be charged until you pay on the next step.
      </p>
    </Card>
  )
}
