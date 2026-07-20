import { useState } from 'react'
import { skipToken } from '@reduxjs/toolkit/query'
import type { LatLng } from '../../lib/types'
import type { DateRangeValue } from '../../components/ui/date-range-picker'
import {
  haversineKm,
  useCoversPointQuery,
  useCoversRouteQuery,
  usePlaceLabel,
} from './api'
import type { PinKind } from './trip-map'

export interface TripPlannerInitial {
  pickup?: LatLng | null
  drop?: LatLng | null
  oneWay?: boolean
  carType?: string
  seats?: string
  range?: DateRangeValue
}

export function defaultDateRange(): DateRangeValue {
  const from = new Date()
  from.setDate(from.getDate() + 1)
  const to = new Date()
  to.setDate(to.getDate() + 4)
  return { from, to }
}

/**
 * All the state + derived data behind the trip planner form — shared between
 * the home hero and the live results page, so editing a trip is the same
 * experience everywhere. The map lives with the page; it talks to this state
 * through {@link place}/{@link onMapClick} and the {@code focus} point.
 */
export function useTripPlanner(initial: TripPlannerInitial = {}) {
  const [pickup, setPickup] = useState<LatLng | null>(initial.pickup ?? null)
  const [drop, setDrop] = useState<LatLng | null>(initial.drop ?? null)
  const [activePin, setActivePin] = useState<PinKind>(initial.pickup ? 'drop' : 'pickup')
  const [oneWay, setOneWay] = useState(initial.oneWay ?? false)
  const [carType, setCarType] = useState(initial.carType ?? '')
  const [seats, setSeats] = useState(initial.seats ?? '')
  const [range, setRange] = useState<DateRangeValue>(initial.range ?? defaultDateRange())
  /** Where the map should fly to (geolocation grant / typeahead selection). */
  const [focus, setFocus] = useState<LatLng | null>(initial.pickup ?? null)

  // Live serviced-or-not feedback per pin + reverse-geocoded labels.
  const pickupCovered = useCoversPointQuery(pickup ?? skipToken)
  const dropCovered = useCoversPointQuery(drop ?? skipToken)
  const pickupLabel = usePlaceLabel(pickup)
  const dropLabel = usePlaceLabel(drop)

  // Can any single agency run the WHOLE route? (cars never leave their zone)
  const routeCoverage = useCoversRouteQuery(
    pickup && drop
      ? { plat: pickup.lat, plng: pickup.lng, dlat: drop.lat, dlng: drop.lng }
      : skipToken,
  )

  const routeKm =
    pickup && drop ? haversineKm(pickup.lat, pickup.lng, drop.lat, drop.lng) : null

  /** Both trip ends are required before anything can be searched. */
  const canSubmit = pickup != null && drop != null

  function place(kind: PinKind, point: LatLng) {
    if (kind === 'pickup') setPickup(point)
    else setDrop(point)
  }

  function onMapClick(point: LatLng) {
    place(activePin, point)
    // After placing the pickup, the next tap naturally means the destination.
    if (activePin === 'pickup') setActivePin('drop')
  }

  function selectPickup(p: LatLng) {
    setPickup(p)
    setFocus(p)
    setActivePin('drop')
  }

  function selectDrop(p: LatLng) {
    setDrop(p)
    setFocus(p)
  }

  return {
    pickup, setPickup,
    drop, setDrop,
    activePin, setActivePin,
    oneWay, setOneWay,
    carType, setCarType,
    seats, setSeats,
    range, setRange,
    focus, setFocus,
    pickupCovered, dropCovered,
    pickupLabel, dropLabel,
    routeCoverage, routeKm, canSubmit,
    place, onMapClick, selectPickup, selectDrop,
  }
}

export type TripPlanner = ReturnType<typeof useTripPlanner>
