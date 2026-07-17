import { lazy, Suspense, useEffect, useState, type FormEvent } from 'react'
import { createSearchParams, useNavigate } from 'react-router-dom'
import { skipToken } from '@reduxjs/toolkit/query'
import {
  CheckCircle2,
  Flag,
  LocateFixed,
  MapPin,
  MoveRight,
  Search as SearchIcon,
  XCircle,
} from 'lucide-react'
import { Button } from '../../components/ui/button'
import { DateRangePicker, type DateRangeValue } from '../../components/ui/date-range-picker'
import { Field } from '../../components/ui/field'
import { Skeleton } from '../../components/ui/skeleton'
import { useToast } from '../../components/ui/toast'
import { dayAtDefaultHour, isValidRange } from '../../lib/date'
import type { LatLng } from '../../lib/types'
import { cn } from '../../lib/utils'
import { haversineKm, useCoversPointQuery, useGetCitiesQuery, usePlaceLabel } from './api'
import { LocationInput } from './location-input'
import type { PinKind } from './trip-map'

// Leaflet is heavy — the map loads as its own chunk.
const TripMap = lazy(() => import('./trip-map'))

/** Fallback map view when no cities are known: India, zoomed out. */
const DEFAULT_CENTER: LatLng = { lat: 21.0, lng: 78.5 }

function defaultDateRange(): DateRangeValue {
  const from = new Date()
  from.setDate(from.getDate() + 1)
  const to = new Date()
  to.setDate(to.getDate() + 4)
  return { from, to }
}

/**
 * Home: the trip planner. Type any Indian city/town (geocoder typeahead) or
 * drop a pin on the map; agencies whose operating area covers the pickup point
 * are offered. Desktop: form on the left, map on the right.
 */
export function TripSearchPage() {
  const toast = useToast()
  const navigate = useNavigate()
  const { data: cities = [] } = useGetCitiesQuery()

  const [pickup, setPickup] = useState<LatLng | null>(null)
  const [drop, setDrop] = useState<LatLng | null>(null)
  const [activePin, setActivePin] = useState<PinKind>('pickup')
  const [oneWay, setOneWay] = useState(false)
  const [range, setRange] = useState<DateRangeValue>(defaultDateRange)
  const [locating, setLocating] = useState(false)
  /** Where the map should fly to (geolocation grant / typeahead selection). */
  const [focus, setFocus] = useState<LatLng | null>(null)

  // Ask for the user's location as soon as the app opens: granted -> the
  // pickup pin is pre-placed at their position and the map flies there.
  useEffect(() => {
    if (!('geolocation' in navigator)) return
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const here = { lat: pos.coords.latitude, lng: pos.coords.longitude }
        setPickup((prev) => prev ?? here)
        setFocus(here)
        setActivePin('drop')
      },
      () => {
        /* denied/unavailable — the typeahead and map still work */
      },
      { enableHighAccuracy: false, timeout: 8000 },
    )
  }, [])

  // Live serviced-or-not feedback per pin + reverse-geocoded labels.
  const pickupCovered = useCoversPointQuery(pickup ?? skipToken)
  const dropCovered = useCoversPointQuery(drop ?? skipToken)
  const pickupLabel = usePlaceLabel(pickup)
  const dropLabel = usePlaceLabel(drop)

  const center =
    cities[0]?.latitude != null && cities[0]?.longitude != null
      ? { lat: cities[0].latitude, lng: cities[0].longitude }
      : DEFAULT_CENTER
  const zoom = cities.length > 0 ? 10 : 5

  const routeKm =
    pickup && drop ? haversineKm(pickup.lat, pickup.lng, drop.lat, drop.lng) : null

  function place(kind: PinKind, point: LatLng) {
    if (kind === 'pickup') setPickup(point)
    else setDrop(point)
  }

  function onMapClick(point: LatLng) {
    place(activePin, point)
    // After placing the pickup, the next tap naturally means the drop.
    if (activePin === 'pickup') setActivePin('drop')
  }

  function useMyLocation() {
    if (!('geolocation' in navigator)) {
      toast.error('Geolocation is not supported by your browser')
      return
    }
    setLocating(true)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const here = { lat: pos.coords.latitude, lng: pos.coords.longitude }
        setPickup(here)
        setFocus(here)
        setActivePin('drop')
        setLocating(false)
      },
      (err) => {
        toast.error(err.message || 'Could not get your location')
        setLocating(false)
      },
      { enableHighAccuracy: false, timeout: 10_000 },
    )
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (!pickup) {
      toast.error('Set a pickup point — search a city or tap the map')
      return
    }
    if (pickupCovered.data && !pickupCovered.data.covered) {
      toast.error('No agency operates at your pickup point yet — try a nearby city')
      return
    }
    const from = range.from ? dayAtDefaultHour(range.from) : undefined
    const to = range.to ? dayAtDefaultHour(range.to) : undefined
    if (!isValidRange(from ?? null, to ?? null)) {
      toast.error('Choose your pickup and return dates')
      return
    }
    if (oneWay && !drop) {
      toast.error('A one-way trip needs a drop point')
      return
    }
    const params: Record<string, string> = {
      plat: pickup.lat.toFixed(6),
      plng: pickup.lng.toFixed(6),
      from: from!,
      to: to!,
    }
    if (drop) {
      params.dlat = drop.lat.toFixed(6)
      params.dlng = drop.lng.toFixed(6)
    }
    if (oneWay && drop) params.oneWay = '1'
    navigate({ pathname: '/agencies', search: `?${createSearchParams(params)}` })
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 py-2">
      <div className="text-center">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Where to next?</h1>
        <p className="mt-2 text-muted-foreground">
          Search any city in India — or drop a pin — and agencies operating there will pick you up.
        </p>
      </div>

      <form
        onSubmit={onSubmit}
        className="rounded-3xl border border-border bg-card p-4 shadow-lg sm:p-6"
      >
        <div className="grid gap-6 lg:grid-cols-[380px_minmax(0,1fr)]">
          {/* left: the trip form */}
          <div className="flex flex-col gap-4">
            <div className="space-y-1.5">
              <LocationInput
                id="pickup-search"
                icon={<MapPin className="h-4 w-4 text-primary" />}
                placeholder="Pickup — search any city or town…"
                label={pickupLabel}
                cities={cities}
                value={pickup}
                onSelect={(p) => {
                  setPickup(p)
                  setFocus(p)
                  setActivePin('drop')
                }}
                onClear={() => setPickup(null)}
              />
              <CoverageNote point={pickup} covered={pickupCovered.data?.covered} kind="pickup" />
            </div>

            <div className="space-y-1.5">
              <LocationInput
                id="drop-search"
                icon={<Flag className="h-4 w-4 text-violet-500" />}
                placeholder="Drop — optional, for one-way trips…"
                label={dropLabel}
                cities={cities}
                value={drop}
                onSelect={(p) => {
                  setDrop(p)
                  setFocus(p)
                }}
                onClear={() => {
                  setDrop(null)
                  setOneWay(false)
                }}
              />
              <CoverageNote point={drop} covered={dropCovered.data?.covered} kind="drop" />
            </div>

            {routeKm != null && routeKm >= 1 && (
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <MoveRight className="h-4 w-4" /> ~{Math.round(routeKm)} km trip
              </p>
            )}

            <Field label="Dates" htmlFor="trip-dates" required>
              <DateRangePicker value={range} onChange={setRange} disabledBefore={new Date()} />
            </Field>

            {drop && routeKm != null && routeKm >= 1 && (
              <label className="flex cursor-pointer items-start gap-3 rounded-[var(--radius)] border border-border bg-muted/40 p-3">
                <input
                  type="checkbox"
                  checked={oneWay}
                  onChange={(e) => setOneWay(e.target.checked)}
                  className="mt-0.5 h-4 w-4 accent-[var(--primary)]"
                />
                <span className="text-sm">
                  <span className="font-medium">One-way drop-off</span>
                  <span className="block text-muted-foreground">
                    Leave the car at your drop point — a distance-based relocation fee applies.
                    Unchecked, you return it to the pickup point.
                  </span>
                </span>
              </label>
            )}

            <Button type="submit" size="lg" className="mt-auto w-full">
              <SearchIcon className="h-4 w-4" /> Find agencies
            </Button>
          </div>

          {/* right: the map */}
          <div className="flex flex-col gap-2">
            <div className="flex flex-wrap items-center gap-2">
              {(
                [
                  { kind: 'pickup' as PinKind, icon: MapPin, label: 'Pickup pin' },
                  { kind: 'drop' as PinKind, icon: Flag, label: 'Drop pin' },
                ] as const
              ).map(({ kind, icon: Icon, label }) => (
                <button
                  key={kind}
                  type="button"
                  onClick={() => setActivePin(kind)}
                  className={cn(
                    'inline-flex items-center gap-1.5 rounded-full border px-4 py-1.5 text-sm font-medium transition-colors',
                    activePin === kind
                      ? 'border-primary bg-primary text-primary-foreground shadow-sm'
                      : 'border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground',
                  )}
                >
                  <Icon className="h-4 w-4" /> {label}
                </button>
              ))}
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="ml-auto rounded-full"
                onClick={useMyLocation}
                loading={locating}
              >
                <LocateFixed className="h-4 w-4" /> Use my location
              </Button>
            </div>
            <div className="h-[340px] flex-1 overflow-hidden rounded-2xl border border-border lg:h-auto lg:min-h-[460px]">
              <Suspense fallback={<Skeleton className="h-full w-full rounded-none" />}>
                <TripMap
                  center={center}
                  zoom={zoom}
                  focus={focus}
                  pickup={pickup}
                  drop={drop}
                  onPlace={place}
                  onMapClick={onMapClick}
                />
              </Suspense>
            </div>
          </div>
        </div>
      </form>
    </div>
  )
}

/** One-line serviced/not-serviced feedback under a location input. */
function CoverageNote({
  point,
  covered,
  kind,
}: {
  point: LatLng | null
  covered: boolean | undefined
  kind: PinKind
}) {
  if (!point || covered === undefined) return null
  return covered ? (
    <p className="flex items-center gap-1 text-xs font-medium text-emerald-600 dark:text-emerald-400">
      <CheckCircle2 className="h-3.5 w-3.5" /> Agencies operate here
    </p>
  ) : (
    <p className="flex items-center gap-1 text-xs font-medium text-destructive">
      <XCircle className="h-3.5 w-3.5" />
      {kind === 'pickup'
        ? 'Not serviced yet — try a nearby city'
        : 'Outside all service areas — one-way drop-off unavailable'}
    </p>
  )
}
