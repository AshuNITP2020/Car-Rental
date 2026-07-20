import { CheckCircle2, LocateFixed, MoveRight, XCircle } from 'lucide-react'
import { Button } from '../../components/ui/button'
import { DateRangePicker } from '../../components/ui/date-range-picker'
import { Select } from '../../components/ui/select'
import { useToast } from '../../components/ui/toast'
import type { CityInfo, LatLng } from '../../lib/types'
import { cn } from '../../lib/utils'
import { LocationInput } from './location-input'
import type { TripPlanner } from './use-trip-planner'
import type { PinKind } from './trip-map'

const CAR_TYPES = ['Hatchback', 'Sedan', 'SUV', 'MPV', 'Luxury'] as const
const SEAT_OPTIONS = [2, 4, 5, 7] as const

/**
 * The trip form itself — trip-type pills, pickup/destination rail with live
 * coverage feedback, dates, car type + seats. Identical on the home hero and
 * the results page, so a trip stays editable after searching.
 */
export function TripPlannerFields({
  planner,
  cities,
}: {
  planner: TripPlanner
  cities: CityInfo[]
}) {
  const toast = useToast()
  const p = planner

  function useMyLocation() {
    if (!('geolocation' in navigator)) {
      toast.error('Geolocation is not supported by your browser')
      return
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => p.selectPickup({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      (err) => toast.error(err.message || 'Could not get your location'),
      { enableHighAccuracy: false, timeout: 10_000 },
    )
  }

  return (
    <div className="space-y-4">
      {/* round trip / one way — the car returns, or stays at the destination */}
      <div className="inline-flex rounded-full bg-muted p-1" role="tablist">
        {(
          [
            { value: false, label: 'Round trip' },
            { value: true, label: 'One way' },
          ] as const
        ).map(({ value, label }) => (
          <button
            key={label}
            type="button"
            role="tab"
            aria-selected={p.oneWay === value}
            onClick={() => p.setOneWay(value)}
            className={cn(
              'rounded-full px-4 py-2 text-sm font-medium transition-all duration-200',
              p.oneWay === value
                ? 'bg-foreground text-background shadow-sm'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {/* pickup -> destination, connected by a rail */}
      <div>
        <div className="flex items-center gap-2">
          <div className="min-w-0 flex-1">
            <LocationInput
              id="pickup-search"
              icon={<span className="block h-2.5 w-2.5 rounded-full bg-foreground" />}
              placeholder="Enter pickup — any city or town…"
              label={p.pickupLabel}
              cities={cities}
              value={p.pickup}
              onSelect={p.selectPickup}
              onClear={() => p.setPickup(null)}
            />
          </div>
          <Button
            type="button"
            variant="outline"
            size="icon"
            aria-label="Use my location"
            className="shrink-0 rounded-full"
            onClick={useMyLocation}
          >
            <LocateFixed className="h-4 w-4" />
          </Button>
        </div>
        {/* the connector row: rail segment + pickup feedback beside it */}
        <div className="flex min-h-4 items-center gap-2 pl-[18px]">
          <span aria-hidden className="w-px self-stretch bg-border" />
          <CoverageNote point={p.pickup} covered={p.pickupCovered.data?.covered} kind="pickup" />
        </div>
        <LocationInput
          id="drop-search"
          icon={<span className="block h-2.5 w-2.5 bg-foreground" />}
          placeholder="Enter destination…"
          label={p.dropLabel}
          cities={cities}
          value={p.drop}
          onSelect={p.selectDrop}
          onClear={() => p.setDrop(null)}
        />
        <div className="pl-1 pt-1">
          <CoverageNote point={p.drop} covered={p.dropCovered.data?.covered} kind="drop" />
        </div>
      </div>

      {p.routeKm != null && p.routeKm >= 1 && (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <MoveRight className="h-4 w-4" /> ~{Math.round(p.routeKm)} km
          {p.oneWay && ' · car stays at your destination (relocation fee applies)'}
        </p>
      )}

      {/* dates + car type + seats — self-describing filled controls */}
      <DateRangePicker value={p.range} onChange={p.setRange} disabledBefore={new Date()} />
      <div className="grid grid-cols-2 gap-3">
        <Select
          id="car-type"
          aria-label="Car type"
          value={p.carType}
          onChange={(e) => p.setCarType(e.target.value)}
        >
          <option value="">Any car type</option>
          {CAR_TYPES.map((t) => (
            <option key={t} value={t.toUpperCase()}>
              {t}
            </option>
          ))}
        </Select>
        <Select
          id="car-seats"
          aria-label="Minimum seats"
          value={p.seats}
          onChange={(e) => p.setSeats(e.target.value)}
        >
          <option value="">Any seats</option>
          {SEAT_OPTIONS.map((n) => (
            <option key={n} value={n}>
              {n}+ seats
            </option>
          ))}
        </Select>
      </div>
    </div>
  )
}

/** One-line serviced/not-serviced feedback under a location input. */
export function CoverageNote({
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
    <p className="flex items-center gap-1 pl-1 text-xs font-medium text-emerald-600 dark:text-emerald-400">
      <CheckCircle2 className="h-3.5 w-3.5" /> Agencies operate here
    </p>
  ) : (
    <p className="flex items-center gap-1 pl-1 text-xs font-medium text-destructive">
      <XCircle className="h-3.5 w-3.5" />
      {kind === 'pickup'
        ? 'Not serviced yet — try a nearby city'
        : 'Outside all service areas'}
    </p>
  )
}
