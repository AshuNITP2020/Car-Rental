import { lazy, Suspense, useEffect, useState } from 'react'
import { createSearchParams, Link, useSearchParams } from 'react-router-dom'
import { skipToken } from '@reduxjs/toolkit/query'
import { Building2, ChevronRight, Map as MapIcon, X } from 'lucide-react'
import { Button } from '../../components/ui/button'
import { EmptyState } from '../../components/ui/empty-state'
import { StarRating } from '../../components/ui/rating'
import { Select } from '../../components/ui/select'
import { Skeleton } from '../../components/ui/skeleton'
import { dayAtDefaultHour, isValidRange } from '../../lib/date'
import type { AgencySearchResult } from '../../lib/types'
import { formatMoney } from '../../lib/utils'
import { useGetCitiesQuery, useSearchAgenciesQuery } from './api'
import { TripPlannerFields } from './trip-planner-fields'
import { useTripPlanner } from './use-trip-planner'

const RouteMap = lazy(() => import('./route-map'))

type SortKey = 'price' | 'rating' | 'cars'

function num(params: URLSearchParams, key: string): number | null {
  const v = params.get(key)
  if (!v) return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

/**
 * Results: the SAME planner form stays on the left — every edit re-runs the
 * search live — with the matched agencies beneath it and a route-fitted map
 * (P/D pins, dashed route, each agency's operating area) on the right.
 */
export function AgencyResultsPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const { data: cities = [] } = useGetCitiesQuery()

  // Hydrate the planner once from the URL; afterwards state drives the URL.
  const p = useTripPlanner({
    pickup: (() => {
      const lat = num(searchParams, 'plat')
      const lng = num(searchParams, 'plng')
      return lat != null && lng != null ? { lat, lng } : null
    })(),
    drop: (() => {
      const lat = num(searchParams, 'dlat')
      const lng = num(searchParams, 'dlng')
      return lat != null && lng != null ? { lat, lng } : null
    })(),
    oneWay: searchParams.get('oneWay') === '1',
    carType: searchParams.get('carType') ?? '',
    seats: searchParams.get('seats') ?? '',
    range: (() => {
      const from = searchParams.get('from')
      const to = searchParams.get('to')
      return from && to ? { from: new Date(from), to: new Date(to) } : undefined
    })(),
  })

  const [sort, setSort] = useState<SortKey>('price')
  const [hoveredId, setHoveredId] = useState<number | null>(null)
  const [showMobileMap, setShowMobileMap] = useState(false)

  const from = p.range.from ? dayAtDefaultHour(p.range.from) : undefined
  const to = p.range.to ? dayAtDefaultHour(p.range.to) : undefined
  const datesValid = isValidRange(from ?? null, to ?? null)

  // The live search — every form edit re-queries (RTK dedupes + caches).
  const results = useSearchAgenciesQuery(
    p.pickup && p.drop
      ? {
          lat: p.pickup.lat,
          lng: p.pickup.lng,
          dlat: p.drop.lat,
          dlng: p.drop.lng,
          ...(p.carType ? { carType: p.carType } : {}),
          ...(p.seats ? { seats: Number(p.seats) } : {}),
          ...(datesValid ? { from, to } : {}),
        }
      : skipToken,
  )

  // Keep the URL shareable/refreshable as the trip is edited in place.
  useEffect(() => {
    if (!p.pickup || !p.drop) return
    const params: Record<string, string> = {
      plat: p.pickup.lat.toFixed(6),
      plng: p.pickup.lng.toFixed(6),
      dlat: p.drop.lat.toFixed(6),
      dlng: p.drop.lng.toFixed(6),
    }
    if (datesValid) {
      params.from = from!
      params.to = to!
    }
    if (p.oneWay) params.oneWay = '1'
    if (p.carType) params.carType = p.carType
    if (p.seats) params.seats = p.seats
    setSearchParams(params, { replace: true })
  }, [p.pickup, p.drop, p.oneWay, p.carType, p.seats, from, to, datesValid, setSearchParams])

  /** Trip context forwarded to the agency profile / cars / booking. */
  const tripSearch = `?${createSearchParams({
    ...(datesValid ? { from: from!, to: to! } : {}),
    ...(p.drop ? { dlat: String(p.drop.lat), dlng: String(p.drop.lng) } : {}),
    ...(p.oneWay ? { oneWay: '1' } : {}),
    ...(p.carType ? { carType: p.carType } : {}),
    ...(p.seats ? { seats: p.seats } : {}),
  })}`

  const agencies = [...(results.currentData ?? [])].sort((a, b) => {
    if (sort === 'rating') return (b.averageRating ?? 0) - (a.averageRating ?? 0)
    if (sort === 'cars') return b.availableCars - a.availableCars
    return (a.fromPricePerDay ?? Infinity) > (b.fromPricePerDay ?? Infinity) ? 1 : -1
  })
  const loading = results.isFetching && !results.currentData

  function scrollToAgency(agencyId: number) {
    document.getElementById(`agency-${agencyId}`)?.scrollIntoView({
      behavior: 'smooth',
      block: 'center',
    })
    setShowMobileMap(false)
  }

  const mapPane = (
    <Suspense fallback={<Skeleton className="h-full w-full rounded-none" />}>
      <RouteMap
        pickup={p.pickup}
        drop={p.drop}
        agencies={agencies}
        hoveredId={hoveredId}
        onPlace={p.place}
        onMapClick={p.onMapClick}
        onAgencyClick={scrollToAgency}
      />
    </Suspense>
  )

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[300px_minmax(0,1fr)] xl:grid-cols-[300px_minmax(0,1fr)_440px] xl:gap-8">
      {/* ── left: the SAME editable form ── */}
      <div className="space-y-5">
        <h1 className="text-2xl font-bold tracking-tight">Your trip</h1>
        <TripPlannerFields planner={p} cities={cities} />
      </div>

      {/* ── middle: what's selected + the agencies that match it ── */}
      <div className="space-y-4">
        <div className="space-y-4">
          {!p.canSubmit ? (
            <p className="text-sm text-muted-foreground">
              Set both a pickup and a destination to see agencies.
            </p>
          ) : (
            <>
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-sm font-semibold">
                  {loading
                    ? 'Finding agencies…'
                    : `${agencies.length} agenc${agencies.length === 1 ? 'y' : 'ies'} can run your route`}
                </h2>
                {agencies.length > 1 && (
                  <Select
                    aria-label="Sort agencies"
                    value={sort}
                    onChange={(e) => setSort(e.target.value as SortKey)}
                    className="h-9 w-36 px-3 text-xs"
                  >
                    <option value="price">Cheapest first</option>
                    <option value="rating">Top rated</option>
                    <option value="cars">Most cars</option>
                  </Select>
                )}
              </div>

              {loading ? (
                <div className="space-y-3">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <Skeleton key={i} className="h-28 w-full rounded-2xl" />
                  ))}
                </div>
              ) : results.isError ? (
                <EmptyState
                  icon={Building2}
                  title="Couldn’t load agencies"
                  description="Please try again."
                  action={<Button onClick={() => results.refetch()}>Retry</Button>}
                />
              ) : agencies.length === 0 ? (
                <div className="space-y-3 rounded-2xl bg-muted p-5">
                  <p className="font-semibold">No agency covers this whole route</p>
                  <p className="text-sm text-muted-foreground">
                    An agency's cars never leave its operating area — none contains both
                    your pickup and destination
                    {(p.carType || p.seats) && ' with these filters'}.
                  </p>
                  <div className="flex flex-wrap gap-2 pt-1">
                    {p.carType && (
                      <Button variant="outline" size="sm" onClick={() => p.setCarType('')}>
                        <X className="h-3.5 w-3.5" /> Remove car type
                      </Button>
                    )}
                    {p.seats && (
                      <Button variant="outline" size="sm" onClick={() => p.setSeats('')}>
                        <X className="h-3.5 w-3.5" /> Remove seats
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => document.getElementById('drop-search')?.focus()}
                    >
                      Try a nearer destination
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  {agencies.map((a) => (
                    <AgencyCard
                      key={a.agencyId}
                      agency={a}
                      search={tripSearch}
                      hasWindow={datesValid}
                      onHover={setHoveredId}
                    />
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* ── right: the route map (wide screens, sticky) ── */}
      <div className="sticky top-24 hidden h-[70vh] min-h-[420px] overflow-hidden rounded-2xl xl:block">
        {mapPane}
      </div>

      {/* below xl: floating toggle -> full-screen map */}
      <button
        type="button"
        onClick={() => setShowMobileMap(true)}
        className="fixed bottom-6 left-1/2 z-40 inline-flex -translate-x-1/2 items-center gap-2 rounded-full bg-foreground px-5 py-2.5 text-sm font-medium text-background shadow-lifted xl:hidden"
      >
        <MapIcon className="h-4 w-4" /> Map
      </button>
      {showMobileMap && (
        <div className="fixed inset-0 z-50 bg-background xl:hidden">
          {mapPane}
          <button
            type="button"
            onClick={() => setShowMobileMap(false)}
            className="absolute right-4 top-4 z-[1000] rounded-full bg-foreground p-2.5 text-background shadow-lifted"
            aria-label="Close map"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      )}
    </div>
  )
}

/** One agency the customer can choose — enough signal to decide. */
function AgencyCard({
  agency,
  search,
  hasWindow,
  onHover,
}: {
  agency: AgencySearchResult
  search: string
  hasWindow: boolean
  onHover: (id: number | null) => void
}) {
  return (
    <Link
      id={`agency-${agency.agencyId}`}
      to={{ pathname: `/agencies/${agency.agencyId}`, search }}
      onMouseEnter={() => onHover(agency.agencyId)}
      onMouseLeave={() => onHover(null)}
      className="group block rounded-2xl bg-muted p-4 transition-all duration-200 hover:shadow-lifted"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="truncate font-semibold group-hover:text-primary">{agency.name}</h3>
            {agency.averageRating != null ? (
              <span className="inline-flex shrink-0 items-center gap-1 text-sm">
                <StarRating value={agency.averageRating} size={12} />
                <span className="font-medium">{agency.averageRating.toFixed(1)}</span>
                <span className="text-muted-foreground">({agency.reviewCount})</span>
              </span>
            ) : (
              <span className="shrink-0 rounded-full bg-card px-2 py-0.5 text-xs font-medium text-muted-foreground shadow-soft">
                New
              </span>
            )}
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Covers your whole route{agency.city && <> · Based in {agency.city}</>}
          </p>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {agency.availableCars} car{agency.availableCars === 1 ? '' : 's'} available
            {hasWindow ? ' for your dates' : ''}
          </p>
        </div>
        <div className="shrink-0 text-right">
          {agency.fromPricePerDay != null && (
            <p className="font-semibold">
              from {formatMoney(agency.fromPricePerDay)}
              <span className="text-xs font-normal text-muted-foreground">/day</span>
            </p>
          )}
          <span className="mt-1 inline-flex items-center gap-0.5 text-sm font-medium text-primary">
            View cars
            <ChevronRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5" />
          </span>
        </div>
      </div>
    </Link>
  )
}
