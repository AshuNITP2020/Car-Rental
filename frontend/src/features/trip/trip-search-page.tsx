import { lazy, Suspense, useEffect, useState, type FormEvent } from 'react'
import { createSearchParams, Link as RouterLink, useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowRight, History, MapPin, MoveRight, XCircle } from 'lucide-react'
import { Button } from '../../components/ui/button'
import { Skeleton } from '../../components/ui/skeleton'
import { useToast } from '../../components/ui/toast'
import { dayAtDefaultHour, isValidRange } from '../../lib/date'
import type { CityInfo, LatLng } from '../../lib/types'
import { useGetCitiesQuery } from './api'
import { TripPlannerFields } from './trip-planner-fields'
import { loadRecentSearches, saveRecentSearch, type RecentSearch } from './recent-searches'
import { useTripPlanner } from './use-trip-planner'

// Leaflet is heavy — the map loads as its own chunk.
const TripMap = lazy(() => import('./trip-map'))

/** Fallback map view when no cities are known: India, zoomed out. */
const DEFAULT_CENTER: LatLng = { lat: 21.0, lng: 78.5 }

/**
 * Home: the trip planner — the form on the left, the map on the right.
 * Searching goes to /agencies where the SAME form stays editable beside the
 * live results.
 */
export function TripSearchPage() {
  const toast = useToast()
  const navigate = useNavigate()
  const [initialParams] = useSearchParams()
  const { data: cities = [] } = useGetCitiesQuery()

  // A destination page can hand over a starting pickup (?plat&plng).
  const handedPickup = (() => {
    const plat = Number(initialParams.get('plat'))
    const plng = Number(initialParams.get('plng'))
    return initialParams.get('plat') && Number.isFinite(plat) && Number.isFinite(plng)
      ? { lat: plat, lng: plng }
      : null
  })()
  const p = useTripPlanner({ pickup: handedPickup })

  // Ask for the user's location as soon as the app opens: granted -> the
  // pickup pin is pre-placed at their position and the map flies there.
  // Skipped when a destination page handed over a pickup (?plat&plng).
  const { setPickup, setFocus, setActivePin } = p
  useEffect(() => {
    if (initialParams.get('plat') || !('geolocation' in navigator)) return
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const here = { lat: pos.coords.latitude, lng: pos.coords.longitude }
        setPickup((prev) => prev ?? here) // never clobber a user-placed pin
        setFocus(here)
        setActivePin('drop')
      },
      () => {
        /* denied/unavailable — the typeahead and map still work */
      },
      { enableHighAccuracy: false, timeout: 8000 },
    )
  }, [initialParams, setPickup, setFocus, setActivePin])

  const center =
    cities[0]?.latitude != null && cities[0]?.longitude != null
      ? { lat: cities[0].latitude, lng: cities[0].longitude }
      : DEFAULT_CENTER
  const zoom = cities.length > 0 ? 10 : 5

  // Below the planner: this device's recent searches (routes the user cares
  // about), or popular destinations while there's no history yet.
  const [recent, setRecent] = useState<RecentSearch[]>(loadRecentSearches)

  /** Re-fill the whole form from a remembered search (dates stay fresh). */
  function applyRecent(s: RecentSearch) {
    const point = { lat: s.plat, lng: s.plng }
    p.setPickup(point)
    p.setDrop(s.dlat != null && s.dlng != null ? { lat: s.dlat, lng: s.dlng } : null)
    p.setOneWay(s.oneWay)
    p.setCarType(s.carType)
    p.setSeats(s.seats)
    p.setFocus(point)
    p.setActivePin('drop')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (!p.pickup || !p.drop) {
      toast.error('Set both your pickup and destination first')
      return
    }
    if (p.pickupCovered.data && !p.pickupCovered.data.covered) {
      toast.error('No agency operates at your pickup point yet — try a nearby city')
      return
    }
    if (p.routeCoverage.data && !p.routeCoverage.data.covered) {
      toast.error('No agency covers your whole route — try a nearer destination')
      return
    }
    const from = p.range.from ? dayAtDefaultHour(p.range.from) : undefined
    const to = p.range.to ? dayAtDefaultHour(p.range.to) : undefined
    if (!isValidRange(from ?? null, to ?? null)) {
      toast.error('Choose your start and end dates')
      return
    }
    const params: Record<string, string> = {
      plat: p.pickup.lat.toFixed(6),
      plng: p.pickup.lng.toFixed(6),
      dlat: p.drop.lat.toFixed(6),
      dlng: p.drop.lng.toFixed(6),
      from: from!,
      to: to!,
    }
    if (p.oneWay) params.oneWay = '1'
    if (p.carType) params.carType = p.carType
    if (p.seats) params.seats = p.seats
    // Remember the trip (labels resolve by now) so it's one click next time.
    setRecent(
      saveRecentSearch({
        pickupLabel: p.pickupLabel || `${p.pickup.lat.toFixed(3)}, ${p.pickup.lng.toFixed(3)}`,
        dropLabel: p.dropLabel || null,
        plat: p.pickup.lat,
        plng: p.pickup.lng,
        dlat: p.drop.lat,
        dlng: p.drop.lng,
        oneWay: p.oneWay,
        carType: p.carType,
        seats: p.seats,
      }),
    )
    navigate({ pathname: '/agencies', search: `?${createSearchParams(params)}` })
  }

  return (
    <div className="space-y-14 py-2">
      <div className="grid items-start gap-10 lg:grid-cols-[440px_minmax(0,1fr)]">
        {/* ── left: the trip form, directly on the page (no card chrome) ── */}
        <form onSubmit={onSubmit} className="space-y-5">
          {p.pickup && p.pickupLabel && (
            <button
              type="button"
              onClick={() => document.getElementById('pickup-search')?.focus()}
              className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors duration-150 hover:text-foreground"
            >
              <MapPin className="h-4 w-4" /> {p.pickupLabel}
              <span className="font-medium underline underline-offset-2">Change</span>
            </button>
          )}
          <h1 className="text-4xl font-extrabold leading-[1.05] tracking-tight xl:text-5xl">
            Plan your trip
          </h1>

          <TripPlannerFields planner={p} cities={cities} />

          <div className="space-y-2">
            <Button type="submit" size="lg" className="px-10" disabled={!p.canSubmit}>
              Plan My Trip
            </Button>
            {!p.canSubmit && (
              <p className="text-xs text-muted-foreground">
                Enter both a pickup and a destination to continue.
              </p>
            )}
          </div>
        </form>

        {/* ── right: the map ── */}
        <div className="space-y-2">
          <div className="h-[440px] overflow-hidden rounded-2xl md:h-[540px] lg:h-[640px]">
            <Suspense fallback={<Skeleton className="h-full w-full rounded-none" />}>
              <TripMap
                center={center}
                zoom={zoom}
                focus={p.focus}
                pickup={p.pickup}
                drop={p.drop}
                onPlace={p.place}
                onMapClick={p.onMapClick}
              />
            </Suspense>
          </div>
          <p className="text-xs text-muted-foreground">
            Tap the map to drop your pickup pin, tap again for the destination — drag
            either pin to fine-tune.
          </p>
        </div>
      </div>

      <PromoBanner />

      {/* ── below the planner: the routes YOU care about ── */}
      {recent.length > 0 ? (
        <section className="space-y-4">
          <h2 className="flex items-center gap-2 text-xl font-semibold tracking-tight">
            <History className="h-5 w-5 text-muted-foreground" /> Your recent searches
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {recent.map((s) => (
              <button
                key={s.ts}
                type="button"
                onClick={() => applyRecent(s)}
                className="group flex items-center gap-4 rounded-2xl bg-muted p-4 text-left transition-all duration-200 hover:shadow-lifted"
              >
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-card text-foreground shadow-soft">
                  <History className="h-5 w-5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex min-w-0 items-center gap-1.5 font-semibold">
                    <span className="truncate">{s.pickupLabel}</span>
                    {s.dropLabel && (
                      <>
                        <MoveRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                        <span className="truncate">{s.dropLabel}</span>
                      </>
                    )}
                  </span>
                  <span className="mt-0.5 block text-sm text-muted-foreground">
                    {s.dropLabel ? (s.oneWay ? 'One way' : 'Round trip') : 'From here'}
                    {s.carType && <> · {s.carType.charAt(0) + s.carType.slice(1).toLowerCase()}</>}
                    {s.seats && <> · {s.seats}+ seats</>}
                  </span>
                </span>
                <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200 group-hover:translate-x-0.5 group-hover:text-primary" />
              </button>
            ))}
          </div>
        </section>
      ) : (
        <section className="space-y-4">
          <h2 className="flex items-center gap-2 text-xl font-semibold tracking-tight">
            <MapPin className="h-5 w-5 text-muted-foreground" /> Popular destinations
          </h2>
          <p className="-mt-2 text-sm text-muted-foreground">
            Pick where you're headed — we'll set it as your destination.
          </p>
          {cities.length === 0 ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-20 rounded-2xl" />
              ))}
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {cities.slice(0, 8).map((c) => (
                <DestinationCard
                  key={c.city}
                  city={c}
                  onPick={(point) => {
                    p.setDrop(point)
                    p.setFocus(point)
                    window.scrollTo({ top: 0, behavior: 'smooth' })
                  }}
                />
              ))}
            </div>
          )}
        </section>
      )}

      {/* ── explore what you can do ── */}
      <section className="space-y-5">
        <h2 className="text-3xl font-bold tracking-tight">Explore what you can do</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {EXPLORE.map((item) => (
            <ExploreCard key={item.title} {...item} />
          ))}
        </div>
      </section>

      {/* ── how it works ── */}
      <section className="space-y-5">
        <h2 className="text-3xl font-bold tracking-tight">How it works</h2>
        <div className="grid gap-4 md:grid-cols-3">
          {STEPS.map((step, i) => (
            <div key={step.title} className="rounded-2xl bg-muted p-6">
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-foreground text-sm font-bold text-background">
                {i + 1}
              </span>
              <h3 className="mt-4 font-semibold">{step.title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                {step.body}
              </p>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}

const EXPLORE = [
  {
    title: 'Round trips',
    body: 'Pick up and return at the same point — the classic rental, by the day.',
    to: '/',
  },
  {
    title: 'One-way drop-offs',
    body: 'Leave the car at your destination; a distance-based fee covers relocation.',
    to: '/',
  },
  {
    title: 'Intercity routes',
    body: 'Corridor agencies cover whole routes — Mumbai–Pune, Delhi–Jaipur and more.',
    to: '/destinations',
  },
  {
    title: 'List your fleet',
    body: 'Run a rental agency? Define your area, add cars, start earning.',
    to: '/agency/onboard',
  },
]

const STEPS = [
  {
    title: 'Set your route',
    body: 'Search any city or drop pins on the map — we instantly check which operating areas cover the whole trip.',
  },
  {
    title: 'Choose your agency',
    body: 'Compare local agencies by fleet, price and rating. Filter by car type and seats, never by make and model.',
  },
  {
    title: 'Book and drive',
    body: 'Pay securely online. One-way trips leave the car at your destination — the agency handles the rest.',
  },
]

/** Dismissible promo strip (remembered on this device). */
function PromoBanner() {
  const [dismissed, setDismissed] = useState(
    () => localStorage.getItem('cr.promo.launch') === '1',
  )
  if (dismissed) return null
  return (
    <div className="flex items-center gap-3 rounded-2xl bg-accent px-5 py-3.5 text-sm text-accent-foreground">
      <span className="min-w-0 flex-1 truncate">
        <span className="font-semibold">New:</span> one-way trips between cities — leave
        the car at your destination.
      </span>
      <button
        type="button"
        aria-label="Dismiss"
        onClick={() => {
          localStorage.setItem('cr.promo.launch', '1')
          setDismissed(true)
        }}
        className="rounded-full p-1 transition-colors duration-150 hover:bg-accent-foreground/10"
      >
        <XCircle className="h-4 w-4" />
      </button>
    </div>
  )
}

/** A destination shortcut: picking it sets the trip's drop point. */
function DestinationCard({
  city,
  onPick,
}: {
  city: CityInfo
  onPick: (point: LatLng) => void
}) {
  const usable = city.latitude != null && city.longitude != null
  return (
    <button
      type="button"
      disabled={!usable}
      onClick={() => usable && onPick({ lat: city.latitude!, lng: city.longitude! })}
      className="group flex items-center gap-3 rounded-2xl bg-muted p-4 text-left transition-all duration-200 hover:shadow-lifted disabled:opacity-60"
    >
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-600 to-violet-600 text-white">
        <MapPin className="h-4 w-4" />
      </span>
      <span className="min-w-0 flex-1 truncate font-semibold group-hover:text-primary">
        {city.city}
      </span>
      <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200 group-hover:translate-x-0.5 group-hover:text-primary" />
    </button>
  )
}

/** A feature tile in the explore grid — filled surface, no border. */
function ExploreCard({ title, body, to }: { title: string; body: string; to: string }) {
  return (
    <RouterLink
      to={to}
      className="group flex flex-col gap-2 rounded-2xl bg-muted p-6 transition-all duration-200 hover:shadow-lifted"
    >
      <h3 className="font-semibold group-hover:text-primary">{title}</h3>
      <p className="text-sm leading-relaxed text-muted-foreground">{body}</p>
      <span className="mt-auto inline-flex items-center gap-1 pt-2 text-sm font-medium">
        Learn more
        <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5" />
      </span>
    </RouterLink>
  )
}
