import { skipToken } from '@reduxjs/toolkit/query'
import { baseApi } from '../../app/base-api'
import type { AgencySearchResult, CityInfo, LatLng, PlaceSuggestion } from '../../lib/types'

export type AgencySearchArgs = {
  lat: number
  lng: number
  /** Destination — when set, only agencies whose zone covers BOTH ends match. */
  dlat?: number
  dlng?: number
  from?: string
  to?: string
}

/** Trip-first search: operating cities (labels) + agencies covering a pin. */
export const tripApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    getCities: build.query<CityInfo[], void>({
      query: () => ({ url: '/cities' }),
    }),
    searchAgencies: build.query<AgencySearchResult[], AgencySearchArgs>({
      query: (params) => ({ url: '/agencies/search', params }),
      providesTags: ['Agency'],
    }),
    /** Is a map point inside ANY agency's operating area? (pin feedback) */
    coversPoint: build.query<{ covered: boolean }, { lat: number; lng: number }>({
      query: (params) => ({ url: '/service-areas/covers', params }),
    }),
    /** Can anyone run the WHOLE route? (one zone must contain both ends) */
    coversRoute: build.query<
      { covered: boolean; agencies: number },
      { plat: number; plng: number; dlat: number; dlng: number }
    >({
      query: (params) => ({ url: '/service-areas/covers-route', params }),
    }),
    /** Typeahead over any Indian city/town/village (server-proxied geocoder). */
    searchPlaces: build.query<PlaceSuggestion[], string>({
      query: (q) => ({ url: '/geo/search', params: { q } }),
    }),
    /** Nearest place name for a free map pin; null where nothing is known. */
    reversePlace: build.query<PlaceSuggestion | null, LatLng>({
      query: ({ lat, lng }) => ({ url: '/geo/reverse', params: { lat, lng } }),
    }),
  }),
})

export const {
  useGetCitiesQuery,
  useSearchAgenciesQuery,
  useCoversPointQuery,
  useCoversRouteQuery,
  useSearchPlacesQuery,
  useReversePlaceQuery,
} = tripApi

/** "Coimbatore, Tamil Nadu" — or just the name for state-level places. */
export function placeDisplay(place: PlaceSuggestion): string {
  return place.state && place.state !== place.name ? `${place.name}, ${place.state}` : place.name
}

/**
 * Human label for a map point: reverse-geocoded place name when the geocoder
 * knows one, otherwise the self-contained operating-city estimate. Coordinates
 * are snapped to ~110 m so dragging a pin reuses cached lookups.
 */
export function usePlaceLabel(point: LatLng | null | undefined): string {
  const { data: cities = [] } = useGetCitiesQuery()
  const rounded = point ? { lat: +point.lat.toFixed(3), lng: +point.lng.toFixed(3) } : null
  // currentData (not data): a stale label for the *previous* pin must not show.
  const { currentData: place } = useReversePlaceQuery(rounded ?? skipToken)
  if (!point) return ''
  return place ? placeDisplay(place) : pointLabel(cities, point.lat, point.lng)
}

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

/** The known city nearest to a coordinate (for "use my location" + labels). */
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

/** Self-contained human label for a free map point: "Mumbai" / "~7 km from Pune". */
export function pointLabel(cities: CityInfo[], lat: number, lng: number): string {
  const city = nearestCity(cities, lat, lng)
  if (!city || city.latitude == null || city.longitude == null) {
    return `${lat.toFixed(3)}, ${lng.toFixed(3)}`
  }
  const km = haversineKm(lat, lng, city.latitude, city.longitude)
  return km <= 3 ? city.city : `~${Math.round(km)} km from ${city.city}`
}
