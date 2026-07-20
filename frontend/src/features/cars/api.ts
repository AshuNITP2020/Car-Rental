import { baseApi } from '../../app/base-api'
import type {
  AvailabilityResponse,
  CarImageResponse,
  CarReviewsResponse,
  CarSearchResult,
  PageResponse,
  PriceBreakdown,
} from '../../lib/types'

/* Type alias (not interface) so it satisfies the params index signature.
 * The trip-first flow needs no more than this: an agency's fleet for a window.
 * (The backend supports richer filters for other API clients.) */
export type SearchParams = {
  /** Restrict to one agency's fleet (its public profile page). */
  agencyId?: number
  /** Car type (e.g. "SUV", case-insensitive) — how customers filter. */
  category?: string
  /** Minimum passenger seats. */
  minSeats?: number
  from?: string
  to?: string
  page?: number
  size?: number
}

export type DateWindowArg = { id: number; from: string; to: string }
export type QuoteArg = DateWindowArg & { dropLat?: number; dropLng?: number }

export const carsApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    searchCars: build.query<PageResponse<CarSearchResult>, SearchParams>({
      query: (params) => ({ url: '/cars/search', params }),
      providesTags: ['Car'],
    }),
    getCar: build.query<CarSearchResult, number>({
      query: (id) => ({ url: `/cars/${id}` }),
      providesTags: (_r, _e, id) => [{ type: 'Car', id }],
    }),
    getCarImages: build.query<CarImageResponse[], number>({
      query: (carId) => ({ url: `/cars/${carId}/images` }),
      providesTags: (_r, _e, carId) => [{ type: 'CarImages', id: carId }],
    }),
    getCarReviews: build.query<CarReviewsResponse, number>({
      query: (carId) => ({ url: `/cars/${carId}/reviews` }),
      providesTags: (_r, _e, carId) => [{ type: 'CarReviews', id: carId }],
    }),
    getCarQuote: build.query<PriceBreakdown, QuoteArg>({
      query: ({ id, from, to, dropLat, dropLng }) => ({
        url: `/cars/${id}/quote`,
        params: { from, to, dropLat, dropLng },
      }),
    }),
    getCarAvailability: build.query<AvailabilityResponse, DateWindowArg>({
      query: ({ id, from, to }) => ({ url: `/cars/${id}/availability`, params: { from, to } }),
      // Tagged so booking/cancelling elsewhere refetches any mounted check.
      providesTags: (_r, _e, { id }) => [{ type: 'Availability', id }],
    }),
  }),
})

export const {
  useSearchCarsQuery,
  useGetCarQuery,
  useGetCarImagesQuery,
  useGetCarReviewsQuery,
  useGetCarQuoteQuery,
  useGetCarAvailabilityQuery,
} = carsApi
