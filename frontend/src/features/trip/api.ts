import { baseApi } from '../../app/base-api'
import type { AgencySearchResult, CityInfo } from '../../lib/types'

export type AgencySearchArgs = {
  city: string
  from?: string
  to?: string
}

/** Trip-first search: operating cities + agencies at the pickup city. */
export const tripApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    getCities: build.query<CityInfo[], void>({
      query: () => ({ url: '/cities' }),
    }),
    searchAgencies: build.query<AgencySearchResult[], AgencySearchArgs>({
      query: (params) => ({ url: '/agencies/search', params }),
      providesTags: ['Agency'],
    }),
  }),
})

export const { useGetCitiesQuery, useSearchAgenciesQuery } = tripApi

/** Great-circle distance in km between two coordinates (route estimates). */
export function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const toRad = (d: number) => (d * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2
  return 2 * 6371 * Math.asin(Math.sqrt(h))
}

/** Distance between two known cities' centroids, when both have coordinates. */
export function cityDistanceKm(cities: CityInfo[], a: string, b: string): number | null {
  const find = (name: string) =>
    cities.find((c) => c.city.toLowerCase() === name.trim().toLowerCase())
  const ca = find(a)
  const cb = find(b)
  if (!ca?.latitude || !ca?.longitude || !cb?.latitude || !cb?.longitude) return null
  return haversineKm(ca.latitude, ca.longitude, cb.latitude, cb.longitude)
}

/** The known city nearest to a coordinate (for "use my location"). */
export function nearestCity(cities: CityInfo[], lat: number, lng: number): CityInfo | null {
  let best: CityInfo | null = null
  let bestKm = Infinity
  for (const c of cities) {
    if (c.latitude == null || c.longitude == null) continue
    const km = haversineKm(lat, lng, c.latitude, c.longitude)
    if (km < bestKm) {
      best = c
      bestKm = km
    }
  }
  return best
}
