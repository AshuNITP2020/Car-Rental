import { baseApi } from '../../app/base-api'
import type {
  AvailabilityResponse,
  CarImageResponse,
  CarReviewsResponse,
  CarSearchResult,
  NearbyCarResult,
  PageResponse,
  PriceBreakdown,
} from '../../lib/types'

/* Type aliases (not interfaces) so they satisfy the params index signature. */
export type SearchParams = {
  city?: string
  category?: string
  q?: string
  minPrice?: string
  maxPrice?: string
  from?: string
  to?: string
  /** Restrict to one agency's fleet (its public profile page). */
  agencyId?: number
  sort?: string
  page?: number
  size?: number
}

export type NearbyParams = {
  lat: number
  lng: number
  radiusKm?: number
  category?: string
  q?: string
  minPrice?: string
  maxPrice?: string
  from?: string
  to?: string
  page?: number
  size?: number
}

export type DateWindowArg = { id: number; from: string; to: string }
export type QuoteArg = DateWindowArg & { dropCity?: string }

export const carsApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    searchCars: build.query<PageResponse<CarSearchResult>, SearchParams>({
      query: (params) => ({ url: '/cars/search', params }),
      providesTags: ['Car'],
    }),
    nearbyCars: build.query<PageResponse<NearbyCarResult>, NearbyParams>({
      query: (params) => ({ url: '/cars/search/nearby', params }),
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
      query: ({ id, from, to, dropCity }) => ({
        url: `/cars/${id}/quote`,
        params: { from, to, dropCity },
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
  useNearbyCarsQuery,
  useGetCarQuery,
  useGetCarImagesQuery,
  useGetCarReviewsQuery,
  useGetCarQuoteQuery,
  useGetCarAvailabilityQuery,
} = carsApi
