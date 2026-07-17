import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { skipToken } from '@reduxjs/toolkit/query'
import { CheckCircle2, MapPin, MoveRight, ShieldCheck, XCircle } from 'lucide-react'
import { Button } from '../../components/ui/button'
import { Card } from '../../components/ui/card'
import { DateRangePicker, type DateRangeValue } from '../../components/ui/date-range-picker'
import { Field } from '../../components/ui/field'
import { Select } from '../../components/ui/select'
import { Spinner } from '../../components/ui/spinner'
import { useToast } from '../../components/ui/toast'
import { dayAtHour, DEFAULT_RENTAL_HOUR, isValidRange } from '../../lib/date'
import { errorMessage } from '../../lib/errors'
import { formatMoney } from '../../lib/utils'
import { useCreateBookingMutation } from '../bookings/api'
import { usePlaceLabel } from '../trip/api'
import { useGetCarAvailabilityQuery, useGetCarQuoteQuery } from './api'

/** Selectable pickup/return hours (6 AM – 10 PM). */
const HOURS = Array.from({ length: 17 }, (_, i) => i + 6)

function hourLabel(h: number): string {
  const period = h < 12 ? 'AM' : 'PM'
  const display = h % 12 === 0 ? 12 : h % 12
  return `${display}:00 ${period}`
}

export interface TripContext {
  from?: string
  to?: string
  /** Drop pin from the trip planner (one-way trips are booked to a map point). */
  dropLat?: number
  dropLng?: number
  oneWay?: boolean
}

export function BookingWidget({
  carId,
  pricePerDay,
  trip,
}: {
  carId: number
  pricePerDay: number
  /** Prefill from the trip-first flow (dates, drop pin, one-way). */
  trip?: TripContext
}) {
  const toast = useToast()
  const navigate = useNavigate()
  const [createBooking, { isLoading: creating }] = useCreateBookingMutation()

  const [range, setRange] = useState<DateRangeValue>(() =>
    trip?.from && trip?.to && isValidRange(trip.from, trip.to)
      ? { from: new Date(trip.from), to: new Date(trip.to) }
      : {},
  )
  const [pickupHour, setPickupHour] = useState(() =>
    trip?.from ? new Date(trip.from).getHours() : DEFAULT_RENTAL_HOUR,
  )
  const [returnHour, setReturnHour] = useState(() =>
    trip?.to ? new Date(trip.to).getHours() : DEFAULT_RENTAL_HOUR,
  )
  const hasDropPin = trip?.dropLat != null && trip?.dropLng != null
  const [oneWay, setOneWay] = useState((trip?.oneWay ?? false) && hasDropPin)

  const rawFrom = range.from ? dayAtHour(range.from, pickupHour) : undefined
  const rawTo = range.to ? dayAtHour(range.to, returnHour) : undefined
  // A single calendar click yields from===to; only treat a real multi-day span
  // as a usable window so we never query with an empty range.
  const bothSet = isValidRange(rawFrom ?? null, rawTo ?? null)
  const from = bothSet ? rawFrom : undefined
  const to = bothSet ? rawTo : undefined

  const wantsOneWay = oneWay && hasDropPin
  const window = from && to ? { id: carId, from, to } : skipToken
  const availability = useGetCarAvailabilityQuery(window)
  const quote = useGetCarQuoteQuery(
    from && to
      ? {
          id: carId,
          from,
          to,
          ...(wantsOneWay ? { dropLat: trip!.dropLat, dropLng: trip!.dropLng } : {}),
        }
      : skipToken,
  )

  const available = availability.data?.available
  const quoteBlocked = wantsOneWay && quote.isError // e.g. drop point not serviced
  const canBook = bothSet && available === true && !creating && !quoteBlocked

  const dropLabel = usePlaceLabel(
    hasDropPin ? { lat: trip!.dropLat!, lng: trip!.dropLng! } : null,
  )

  async function book() {
    if (!from || !to) return
    try {
      const booking = await createBooking({
        carId,
        from,
        to,
        ...(wantsOneWay
          ? { tripType: 'ONE_WAY' as const, dropLat: trip!.dropLat, dropLng: trip!.dropLng }
          : {}),
      }).unwrap()
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
        <div className="grid grid-cols-2 gap-3">
          <Field label="Pickup time" htmlFor="pickup-hour">
            <Select
              id="pickup-hour"
              value={String(pickupHour)}
              onChange={(e) => setPickupHour(Number(e.target.value))}
            >
              {HOURS.map((h) => (
                <option key={h} value={h}>
                  {hourLabel(h)}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Return time" htmlFor="return-hour">
            <Select
              id="return-hour"
              value={String(returnHour)}
              onChange={(e) => setReturnHour(Number(e.target.value))}
            >
              {HOURS.map((h) => (
                <option key={h} value={h}>
                  {hourLabel(h)}
                </option>
              ))}
            </Select>
          </Field>
        </div>
      )}

      {/* ── Trip type ─────────────────────────────────────────────────────── */}
      {hasDropPin ? (
        <label className="flex cursor-pointer items-start gap-2 rounded-[var(--radius)] border border-border bg-muted/40 p-3 text-sm">
          <input
            type="checkbox"
            checked={oneWay}
            onChange={(e) => setOneWay(e.target.checked)}
            className="mt-0.5 h-4 w-4 accent-[var(--primary)]"
          />
          <span>
            <span className="inline-flex items-center gap-1.5 font-medium">
              One-way drop-off <MoveRight className="h-4 w-4 text-muted-foreground" />
            </span>
            <span className="mt-0.5 flex items-center gap-1 text-muted-foreground">
              <MapPin className="h-3.5 w-3.5 shrink-0" /> {dropLabel}
            </span>
          </span>
        </label>
      ) : (
        <p className="text-xs text-muted-foreground">
          Want to drop the car somewhere else? Set a drop pin on the trip planner.
        </p>
      )}

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

      {quoteBlocked && <p className="text-sm text-destructive">{errorMessage(quote.error)}</p>}

      {quote.data && available !== false && !quoteBlocked && (
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
          {quote.data.oneWayFee > 0 && (
            <div className="flex justify-between">
              <dt className="text-muted-foreground">One-way drop-off ({dropLabel})</dt>
              <dd>{formatMoney(quote.data.oneWayFee)}</dd>
            </div>
          )}
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

      <div className="flex gap-2 rounded-[var(--radius)] bg-muted/60 p-3 text-xs text-muted-foreground">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
        <span>
          <span className="font-medium text-foreground">Free cancellation</span> until 24h before
          pickup (full rental refund) — 50% after that. Your deposit
          {oneWay ? ' and one-way fee are' : ' is'} always refunded in full.
        </span>
      </div>
    </Card>
  )
}
