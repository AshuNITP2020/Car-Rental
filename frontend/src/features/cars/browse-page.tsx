import { lazy, Suspense, useEffect, useMemo, useState, type FormEvent } from 'react'
import { useSearchParams } from 'react-router-dom'
import { skipToken } from '@reduxjs/toolkit/query'
import {
  LayoutGrid,
  LocateFixed,
  Map as MapIcon,
  MapPin,
  Search as SearchIcon,
  SlidersHorizontal,
  X,
} from 'lucide-react'
import { Button } from '../../components/ui/button'
import { DateRangePicker, type DateRangeValue } from '../../components/ui/date-range-picker'
import { EmptyState } from '../../components/ui/empty-state'
import { Field } from '../../components/ui/field'
import { Input } from '../../components/ui/input'
import { Pagination } from '../../components/ui/pagination'
import { Popover, PopoverContent, PopoverTrigger } from '../../components/ui/popover'
import { Select } from '../../components/ui/select'
import { Skeleton } from '../../components/ui/skeleton'
import { useToast } from '../../components/ui/toast'
import { dayAtDefaultHour, formatDate, isValidRange } from '../../lib/date'
import type { CarSearchResult } from '../../lib/types'
import { cn } from '../../lib/utils'
import { CarCard } from './car-card'
import { useNearbyCarsQuery, useSearchCarsQuery } from './api'

// Leaflet is heavy — only loaded when the user switches to the map view.
const NearbyMap = lazy(() => import('./nearby-map'))

const CATEGORIES = ['Hatchback', 'Sedan', 'SUV', 'Luxury', 'Van', 'Electric']
const PAGE_SIZE = 12
const DEFAULT_SORT = 'price,asc'

/** Filters applied by the Search button (chips/sort apply instantly). */
interface AppliedFilters {
  city?: string
  q?: string
  minPrice?: string
  maxPrice?: string
  from?: string
  to?: string
}

function toWindow(range: DateRangeValue): { from?: string; to?: string } {
  const from = range.from ? dayAtDefaultHour(range.from) : undefined
  const to = range.to ? dayAtDefaultHour(range.to) : undefined
  return isValidRange(from ?? null, to ?? null) ? { from, to } : {}
}

/** Uber-style default: a concrete WHEN (tomorrow -> +3 days) so results are
 *  actual availability, never just "every car in the system". */
function defaultDateRange(): DateRangeValue {
  const from = new Date()
  from.setDate(from.getDate() + 1)
  const to = new Date()
  to.setDate(to.getDate() + 4)
  return { from, to }
}

export function BrowsePage() {
  const toast = useToast()
  const [searchParams, setSearchParams] = useSearchParams()

  // ── State, seeded from the URL so searches are shareable/bookmarkable ────
  const [city, setCity] = useState(() => searchParams.get('city') ?? '')
  const [q, setQ] = useState(() => searchParams.get('q') ?? '')
  const [minPrice, setMinPrice] = useState(() => searchParams.get('minPrice') ?? '')
  const [maxPrice, setMaxPrice] = useState(() => searchParams.get('maxPrice') ?? '')
  const [range, setRange] = useState<DateRangeValue>(() => {
    const from = searchParams.get('from')
    const to = searchParams.get('to')
    if (from && to && isValidRange(from, to)) return { from: new Date(from), to: new Date(to) }
    return defaultDateRange()
  })
  const [category, setCategory] = useState(() => searchParams.get('category') ?? '')
  const [sort, setSort] = useState(() => searchParams.get('sort') ?? DEFAULT_SORT)
  const [page, setPage] = useState(() => Math.max(0, Number(searchParams.get('page') ?? 0) || 0))
  const [applied, setApplied] = useState<AppliedFilters>(() => {
    const from = searchParams.get('from')
    const to = searchParams.get('to')
    return {
      city: searchParams.get('city') ?? undefined,
      q: searchParams.get('q') ?? undefined,
      minPrice: searchParams.get('minPrice') ?? undefined,
      maxPrice: searchParams.get('maxPrice') ?? undefined,
      ...(from && to && isValidRange(from, to)
        ? { from, to }
        : toWindow(defaultDateRange())),
    }
  })

  // Near-me (not URL-synced — depends on live geolocation)
  const [mode, setMode] = useState<'search' | 'nearby'>('search')
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null)
  const [radiusKm, setRadiusKm] = useState(25)
  const [locating, setLocating] = useState(false)
  const [view, setView] = useState<'grid' | 'map'>('grid')

  // ── Keep the URL in sync with what's applied (replace: no history spam) ──
  useEffect(() => {
    const params: Record<string, string> = {}
    if (applied.city) params.city = applied.city
    if (applied.q) params.q = applied.q
    if (applied.minPrice) params.minPrice = applied.minPrice
    if (applied.maxPrice) params.maxPrice = applied.maxPrice
    if (applied.from && applied.to) {
      params.from = applied.from
      params.to = applied.to
    }
    if (category) params.category = category
    if (sort !== DEFAULT_SORT) params.sort = sort
    if (page > 0) params.page = String(page)
    setSearchParams(params, { replace: true })
  }, [applied, category, sort, page, setSearchParams])

  const commonFilters = {
    category: category || undefined,
    q: applied.q,
    minPrice: applied.minPrice,
    maxPrice: applied.maxPrice,
    from: applied.from,
    to: applied.to,
  }

  const searchQuery = useSearchCarsQuery(
    mode === 'search'
      ? { ...commonFilters, city: applied.city, sort, page, size: PAGE_SIZE }
      : skipToken,
  )
  const nearbyQuery = useNearbyCarsQuery(
    mode === 'nearby' && coords
      ? { ...coords, radiusKm, ...commonFilters, page, size: PAGE_SIZE }
      : skipToken,
  )

  const active = mode === 'search' ? searchQuery : nearbyQuery
  const results = useMemo<{ car: CarSearchResult; distanceKm?: number }[]>(() => {
    if (mode === 'search') return (searchQuery.data?.content ?? []).map((car) => ({ car }))
    return (nearbyQuery.data?.content ?? []).map((r) => ({ car: r.car, distanceKm: r.distanceKm }))
  }, [mode, searchQuery.data, nearbyQuery.data])

  const totalPages = active.data?.totalPages ?? 0
  const totalElements = active.data?.totalElements ?? 0
  const windowLabel =
    applied.from && applied.to ? `${formatDate(applied.from)} → ${formatDate(applied.to)}` : 'any dates'

  function applyDraft(): AppliedFilters {
    return {
      city: city.trim() || undefined,
      q: q.trim() || undefined,
      minPrice: minPrice.trim() || undefined,
      maxPrice: maxPrice.trim() || undefined,
      ...toWindow(range),
    }
  }

  function onSearch(e: FormEvent) {
    e.preventDefault()
    setApplied(applyDraft())
    setMode('search')
    setPage(0)
  }

  function useMyLocation() {
    if (!('geolocation' in navigator)) {
      toast.error('Geolocation is not supported by your browser')
      return
    }
    setLocating(true)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude })
        setApplied(applyDraft())
        setMode('nearby')
        setPage(0)
        setLocating(false)
      },
      (err) => {
        toast.error(err.message || 'Could not get your location')
        setLocating(false)
      },
      { enableHighAccuracy: false, timeout: 10_000 },
    )
  }

  function pickCategory(value: string) {
    setCategory(value)
    setPage(0)
  }

  const showMap = mode === 'nearby' && view === 'map' && coords

  return (
    <div className="space-y-6">
      {/* ── Hero: where + when, search-first like a ride app ─────────────── */}
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-600 via-indigo-600 to-violet-700 px-6 py-10 text-white shadow-lg sm:px-10">
        <div className="pointer-events-none absolute -right-24 -top-28 h-80 w-80 rounded-full bg-white/10 blur-2xl" />
        <div className="pointer-events-none absolute -bottom-32 -left-16 h-72 w-72 rounded-full bg-violet-400/20 blur-2xl" />
        <div className="relative">
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Where to next?</h1>
          <p className="mt-2 max-w-xl text-sm text-indigo-100 sm:text-base">
            Self-drive cars from trusted local agencies — you pick the keys, they handle the rest.
          </p>

          <form
            onSubmit={onSearch}
            className="mt-6 grid gap-2 rounded-2xl bg-card p-3 text-foreground shadow-xl md:grid-cols-[1fr_1fr_auto]"
          >
            <div className="relative">
              <MapPin className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                aria-label="City"
                placeholder="City (e.g. Mumbai)"
                className="pl-9"
                value={city}
                onChange={(e) => setCity(e.target.value)}
              />
            </div>
            <DateRangePicker value={range} onChange={setRange} disabledBefore={new Date()} />
            <div className="flex gap-2">
              <Button type="submit" className="flex-1 md:px-6">
                <SearchIcon className="h-4 w-4" /> Search
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={useMyLocation}
                loading={locating}
                title="Find cars near your location"
              >
                <LocateFixed className="h-4 w-4" />
                <span className="hidden lg:inline">Near me</span>
              </Button>
            </div>
          </form>
        </div>
      </section>

      {/* ── Category chips (ride-class style) + filters/sort ─────────────── */}
      <div className="flex flex-wrap items-center gap-2">
        {['', ...CATEGORIES].map((c) => (
          <button
            key={c || 'all'}
            type="button"
            onClick={() => pickCategory(c)}
            className={cn(
              'rounded-full border px-4 py-1.5 text-sm font-medium transition-colors',
              category === c
                ? 'border-primary bg-primary text-primary-foreground shadow-sm'
                : 'border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground',
            )}
          >
            {c || 'All'}
          </button>
        ))}

        <div className="ml-auto flex items-center gap-2">
          <Popover>
            <PopoverTrigger className="inline-flex h-9 items-center gap-1.5 rounded-full border border-border bg-card px-4 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground">
              <SlidersHorizontal className="h-4 w-4" /> Filters
            </PopoverTrigger>
            <PopoverContent align="end" className="w-72 space-y-3 p-4">
              <Field label="Keyword" htmlFor="flt-q">
                <Input
                  id="flt-q"
                  placeholder="Make or model"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Min ₹/day" htmlFor="flt-min">
                  <Input
                    id="flt-min"
                    type="number"
                    min={0}
                    value={minPrice}
                    onChange={(e) => setMinPrice(e.target.value)}
                  />
                </Field>
                <Field label="Max ₹/day" htmlFor="flt-max">
                  <Input
                    id="flt-max"
                    type="number"
                    min={0}
                    value={maxPrice}
                    onChange={(e) => setMaxPrice(e.target.value)}
                  />
                </Field>
              </div>
              {mode === 'nearby' && (
                <Field label="Search radius" htmlFor="flt-radius">
                  <Select
                    id="flt-radius"
                    value={String(radiusKm)}
                    onChange={(e) => {
                      setRadiusKm(Number(e.target.value))
                      setPage(0)
                    }}
                  >
                    {[10, 25, 50, 100].map((r) => (
                      <option key={r} value={r}>
                        {r} km
                      </option>
                    ))}
                  </Select>
                </Field>
              )}
              <Button
                className="w-full"
                onClick={() => {
                  setApplied(applyDraft())
                  setPage(0)
                }}
              >
                Apply filters
              </Button>
            </PopoverContent>
          </Popover>

          {mode === 'search' ? (
            <Select
              aria-label="Sort results"
              className="h-9 w-44 rounded-full"
              value={sort}
              onChange={(e) => {
                setSort(e.target.value)
                setPage(0)
              }}
            >
              <option value="price,asc">Price: low to high</option>
              <option value="price,desc">Price: high to low</option>
              <option value="newest,desc">Newest first</option>
            </Select>
          ) : (
            <>
              {/* grid / map toggle for near-me results */}
              <div className="flex rounded-full border border-border bg-card p-0.5">
                {(
                  [
                    { key: 'grid', icon: LayoutGrid, label: 'Grid' },
                    { key: 'map', icon: MapIcon, label: 'Map' },
                  ] as const
                ).map(({ key, icon: Icon, label }) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setView(key)}
                    className={cn(
                      'inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-medium transition-colors',
                      view === key
                        ? 'bg-primary text-primary-foreground shadow-sm'
                        : 'text-muted-foreground hover:text-foreground',
                    )}
                  >
                    <Icon className="h-4 w-4" /> {label}
                  </button>
                ))}
              </div>
              <Button
                variant="outline"
                size="sm"
                className="rounded-full"
                onClick={() => {
                  setMode('search')
                  setCoords(null)
                  setView('grid')
                  setPage(0)
                }}
              >
                <X className="h-4 w-4" /> Exit near-me
              </Button>
            </>
          )}
        </div>
      </div>

      {/* ── Results ───────────────────────────────────────────────────────── */}
      <div className="flex items-baseline justify-between">
        <p className="text-sm text-muted-foreground">
          {active.isFetching ? (
            'Searching…'
          ) : (
            <>
              <span className="font-semibold text-foreground">{totalElements}</span> cars available
              · {windowLabel}
              {mode === 'nearby' && ' · near you'}
            </>
          )}
        </p>
      </div>

      {showMap ? (
        <Suspense fallback={<Skeleton className="h-[540px] w-full rounded-2xl" />}>
          <NearbyMap center={coords} results={nearbyQuery.data?.content ?? []} />
        </Suspense>
      ) : active.isLoading ? (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="overflow-hidden rounded-2xl border border-border">
              <Skeleton className="aspect-[16/10] w-full rounded-none" />
              <div className="space-y-2 p-4">
                <Skeleton className="h-4 w-2/3" />
                <Skeleton className="h-3 w-1/2" />
              </div>
            </div>
          ))}
        </div>
      ) : active.isError ? (
        <EmptyState
          icon={SearchIcon}
          title="Couldn’t load cars"
          description="Something went wrong. Adjust your filters and try again."
        />
      ) : results.length === 0 ? (
        <EmptyState
          icon={SearchIcon}
          title="No cars for these dates"
          description="Try different dates, another city, or widen your price range."
        />
      ) : (
        <>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {results.map(({ car, distanceKm }) => (
              <CarCard key={car.id} car={car} distanceKm={distanceKm} />
            ))}
          </div>
          <Pagination page={page} totalPages={totalPages} onPage={setPage} />
        </>
      )}
    </div>
  )
}
