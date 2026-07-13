import { useMemo } from 'react'
import { useAppSelector } from '../../app/hooks'
import { baseApi } from '../../app/base-api'
import type {
  BookingResponse,
  CancelResponse,
  CreateBookingRequest,
  CreateReviewRequest,
  PaymentOrderResponse,
  ReviewResponse,
  VerifyCheckoutRequest,
} from '../../lib/types'

export const bookingsApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    getMyBookings: build.query<BookingResponse[], void>({
      query: () => ({ url: '/bookings' }),
      providesTags: ['Bookings'],
    }),
    getBooking: build.query<BookingResponse, number>({
      query: (id) => ({ url: `/bookings/${id}` }),
      providesTags: (_r, _e, id) => [{ type: 'Bookings', id }],
    }),
    createBooking: build.mutation<BookingResponse, CreateBookingRequest>({
      query: (body) => ({ url: '/bookings', method: 'POST', body }),
      invalidatesTags: ['Bookings', 'Availability'],
    }),
    cancelBooking: build.mutation<CancelResponse, number>({
      query: (id) => ({ url: `/bookings/${id}/cancel`, method: 'POST' }),
      invalidatesTags: (_r, _e, id) => ['Bookings', { type: 'Bookings', id }, 'Availability'],
    }),
    createPaymentOrder: build.mutation<PaymentOrderResponse, number>({
      query: (bookingId) => ({ url: `/bookings/${bookingId}/payment`, method: 'POST' }),
    }),
    /** Dev-only capture for the mock payment provider (confirms the booking). */
    mockCapture: build.mutation<PaymentOrderResponse, number>({
      query: (bookingId) => ({
        url: `/bookings/${bookingId}/payment/mock-capture`,
        method: 'POST',
      }),
      invalidatesTags: (_r, _e, id) => ['Bookings', { type: 'Bookings', id }],
    }),
    /** Razorpay checkout handshake — server verifies the signature and
     *  confirms the booking immediately (no webhook round-trip). */
    verifyCheckout: build.mutation<
      PaymentOrderResponse,
      { bookingId: number; body: VerifyCheckoutRequest }
    >({
      query: ({ bookingId, body }) => ({
        url: `/bookings/${bookingId}/payment/verify`,
        method: 'POST',
        body,
      }),
      invalidatesTags: (_r, _e, { bookingId }) => ['Bookings', { type: 'Bookings', id: bookingId }],
    }),
    /** 404 (error state) means "not reviewed yet". */
    getBookingReview: build.query<ReviewResponse, number>({
      query: (bookingId) => ({ url: `/bookings/${bookingId}/review` }),
      providesTags: (_r, _e, id) => [{ type: 'BookingReview', id }],
    }),
    submitReview: build.mutation<ReviewResponse, { bookingId: number; body: CreateReviewRequest }>({
      query: ({ bookingId, body }) => ({
        url: `/bookings/${bookingId}/review`,
        method: 'POST',
        body,
      }),
      invalidatesTags: (_r, _e, { bookingId }) => [
        { type: 'BookingReview', id: bookingId },
        'CarReviews',
      ],
    }),
  }),
})

export const {
  useGetMyBookingsQuery,
  useGetBookingQuery,
  useCreateBookingMutation,
  useCancelBookingMutation,
  useCreatePaymentOrderMutation,
  useMockCaptureMutation,
  useVerifyCheckoutMutation,
  useGetBookingReviewQuery,
  useSubmitReviewMutation,
} = bookingsApi

/**
 * Booking detail that polls while the hold awaits payment (PENDING) so a
 * confirmation or expiry reflects promptly, and stops polling after that.
 * The interval is DERIVED from the cached entry via the endpoint's selector —
 * no component state or effects involved.
 */
export function useBooking(id: number) {
  const selectBooking = useMemo(() => bookingsApi.endpoints.getBooking.select(id), [id])
  const cached = useAppSelector(selectBooking)
  const pollingInterval = cached.data?.status === 'PENDING' ? 5000 : 0
  return useGetBookingQuery(id, { pollingInterval })
}
