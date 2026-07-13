import { useState } from 'react'
import { ArrowLeft, CreditCard, Star, XCircle } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import { StatusBadge } from '../../components/ui/badge'
import { Button } from '../../components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card'
import { ConfirmDialog } from '../../components/ui/confirm-dialog'
import { EmptyState } from '../../components/ui/empty-state'
import { LoadingState } from '../../components/ui/spinner'
import { useToast } from '../../components/ui/toast'
import { formatDateTime } from '../../lib/date'
import { errorMessage } from '../../lib/errors'
import { formatMoney } from '../../lib/utils'
import type { BookingResponse } from '../../lib/types'
import { StarRating } from '../../components/ui/rating'
import { useGetCarQuery } from '../cars/api'
import { useAppDispatch } from '../../app/hooks'
import { baseApi } from '../../app/base-api'
import { useAuth } from '../auth/use-auth'
import { openRazorpayCheckout } from '../../lib/razorpay'
import {
  useBooking,
  useCancelBookingMutation,
  useCreatePaymentOrderMutation,
  useGetBookingReviewQuery,
  useMockCaptureMutation,
  useVerifyCheckoutMutation,
} from './api'
import { HoldCountdown } from './hold-countdown'
import { ReviewDialog } from './review-dialog'

export function TripDetailPage() {
  const { id } = useParams()
  const bookingId = Number(id)
  // useBooking polls by itself while the booking is PENDING (awaiting payment).
  const { data: booking, isLoading, isError } = useBooking(bookingId)

  if (isLoading) return <LoadingState />
  if (isError || !booking)
    return <EmptyState title="Booking not found" description="This booking may not exist." />

  return <TripDetailContent booking={booking} />
}

function TripDetailContent({ booking }: { booking: BookingResponse }) {
  const toast = useToast()
  const dispatch = useAppDispatch()
  const { user } = useAuth()
  const { data: car } = useGetCarQuery(booking.carId)
  const [createOrder, orderState] = useCreatePaymentOrderMutation()
  const [capture, captureState] = useMockCaptureMutation()
  const [verifyCheckout, verifyState] = useVerifyCheckoutMutation()
  const [cancel, cancelState] = useCancelBookingMutation()
  // 404 = not reviewed yet; only asked for once the trip is COMPLETED.
  const { data: review } = useGetBookingReviewQuery(booking.id, {
    skip: booking.status !== 'COMPLETED',
  })
  const [confirmCancel, setConfirmCancel] = useState(false)
  const [reviewOpen, setReviewOpen] = useState(false)

  const paying = orderState.isLoading || captureState.isLoading || verifyState.isLoading
  const canCancel = booking.status === 'PENDING' || booking.status === 'CONFIRMED'

  async function pay() {
    try {
      const order = await createOrder(booking.id).unwrap()

      if (order.provider.toUpperCase() === 'MOCK') {
        // Local mock provider: capture instantly, no checkout UI.
        await capture(booking.id).unwrap()
        toast.success('Payment successful — your booking is confirmed!')
        return
      }

      if (order.keyId) {
        // Razorpay: open the hosted checkout, then verify the returned
        // signature server-side to confirm the booking immediately.
        const result = await openRazorpayCheckout({
          keyId: order.keyId,
          orderId: order.orderId,
          description: `Booking #${booking.id}`,
          prefillName: user?.name,
          prefillEmail: user?.email,
        })
        if (!result) {
          // The modal can be closed AFTER paying (or the handshake can be lost
          // to a network blip) — re-fetch so a webhook-confirmed payment still
          // shows up, and reassure the user either way.
          dispatch(baseApi.util.invalidateTags([{ type: 'Bookings', id: booking.id }]))
          toast.info(
            'Checkout closed. If you completed the payment, this booking will confirm automatically in a moment.',
          )
          return
        }
        await verifyCheckout({ bookingId: booking.id, body: result }).unwrap()
        toast.success('Payment successful — your booking is confirmed!')
        return
      }

      toast.error('The payment provider is not fully configured on the server.')
    } catch (e) {
      toast.error(errorMessage(e), 'Payment failed')
    }
  }

  async function doCancel() {
    try {
      const res = await cancel(booking.id).unwrap()
      setConfirmCancel(false)
      toast.success(
        `Booking cancelled. Refund: ${formatMoney(res.refundedAmount, res.currency)}`,
      )
    } catch (e) {
      toast.error(errorMessage(e), 'Could not cancel')
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <Link
        to="/trips"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> All trips
      </Link>

      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {car ? `${car.make} ${car.model}` : `Booking #${booking.id}`}
          </h1>
          <p className="text-sm text-muted-foreground">Booking #{booking.id}</p>
        </div>
        <StatusBadge status={booking.status} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Trip details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          {booking.tripType === 'ONE_WAY' && booking.pickupCity && booking.dropCity ? (
            <Row label="Route" value={`${booking.pickupCity} → ${booking.dropCity} (one-way)`} />
          ) : (
            booking.pickupCity && <Row label="Pickup city" value={booking.pickupCity} />
          )}
          <Row label="Pickup" value={formatDateTime(booking.from)} />
          <Row label="Return" value={formatDateTime(booking.to)} />
          <Row label="Rental" value={formatMoney(booking.amount)} />
          <Row label="Refundable deposit" value={formatMoney(booking.deposit)} />
          {booking.oneWayFee > 0 && (
            <Row label="One-way drop-off fee" value={formatMoney(booking.oneWayFee)} />
          )}
        </CardContent>
      </Card>

      {booking.status === 'PENDING' && (
        <Card>
          <CardContent className="space-y-3 pt-5">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Awaiting payment</span>
              {booking.expiresAt && <HoldCountdown expiresAt={booking.expiresAt} />}
            </div>
            <Button className="w-full" onClick={pay} loading={paying}>
              <CreditCard className="h-4 w-4" /> Pay {formatMoney(booking.amount + booking.deposit)}
            </Button>
            <p className="text-center text-xs text-muted-foreground">
              Secure checkout — your booking confirms as soon as payment succeeds.
            </p>
          </CardContent>
        </Card>
      )}

      {booking.status === 'CONFIRMED' && (
        <Card>
          <CardContent className="pt-5 text-sm text-muted-foreground">
            Payment received. Your booking is confirmed — the agency will hand over the car at
            pickup.
          </CardContent>
        </Card>
      )}

      {booking.status === 'ACTIVE' && (
        <Card>
          <CardContent className="pt-5 text-sm text-muted-foreground">
            Trip in progress — enjoy the ride! Return the car by {formatDateTime(booking.to)}.
          </CardContent>
        </Card>
      )}

      {booking.status === 'COMPLETED' && (
        <Card>
          <CardContent className="flex items-center justify-between pt-5">
            {review ? (
              <>
                <span className="text-sm text-muted-foreground">Your review — thanks!</span>
                <StarRating value={review.rating} />
              </>
            ) : (
              <>
                <span className="text-sm text-muted-foreground">Trip complete. How was it?</span>
                <Button variant="outline" onClick={() => setReviewOpen(true)}>
                  <Star className="h-4 w-4" /> Leave a review
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      )}

      {canCancel && (
        <div>
          <Button variant="ghost" className="text-destructive" onClick={() => setConfirmCancel(true)}>
            <XCircle className="h-4 w-4" /> Cancel booking
          </Button>
        </div>
      )}

      <ConfirmDialog
        open={confirmCancel}
        onOpenChange={setConfirmCancel}
        title="Cancel this booking?"
        description="The deposit is refunded in full. The rental refund depends on timing — cancel at least 24h before pickup for a full rental refund, otherwise 50%."
        confirmLabel="Cancel booking"
        variant="destructive"
        loading={cancelState.isLoading}
        onConfirm={doCancel}
      />
      <ReviewDialog bookingId={booking.id} open={reviewOpen} onOpenChange={setReviewOpen} />
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
