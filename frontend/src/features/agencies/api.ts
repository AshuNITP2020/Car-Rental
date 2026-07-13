import { baseApi } from '../../app/base-api'
import type { AgencyRatingResponse, AgencyResponse } from '../../lib/types'

/** Customer-facing agency data (public profile page) — distinct from the
 *  tenant-scoped console endpoints in features/agency. */
export const agenciesApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    getAgencyProfile: build.query<AgencyResponse, number>({
      query: (id) => ({ url: `/agencies/${id}` }),
      providesTags: (_r, _e, id) => [{ type: 'Agency', id }],
    }),
    getAgencyRating: build.query<AgencyRatingResponse, number>({
      query: (id) => ({ url: `/agencies/${id}/rating` }),
      providesTags: (_r, _e, id) => [{ type: 'Agency', id }],
    }),
  }),
})

export const { useGetAgencyProfileQuery, useGetAgencyRatingQuery } = agenciesApi
