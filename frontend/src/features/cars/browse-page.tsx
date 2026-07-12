import { useMemo, useState, type FormEvent } from 'react'
import { LocateFixed, Search as SearchIcon, X } from 'lucide-react'
import { Button } from '../../components/ui/button'
import { Card } from '../../components/ui/card'
import { DateRangePicker, type DateRangeValue } from '../../components/ui/date-range-picker'
import { EmptyState } from '../../components/ui/empty-state'
import { Field } from '../../components/ui/field'
import { Input } from '../../components/ui/input'
import { Pagination } from '../../components/ui/pagination'
import { Select } from '../../components/ui/select'
import { Skeleton } from '../../components/ui/skeleton'
import { useToast } from '../../components/ui/toast'
import { skipToken } from '@reduxjs/toolkit/query'
import { dayAtDefaultHour, isValidRange } from '../../lib/date'
import type { CarSearchResult } from '../../lib/types'
import { CarCard } from './car-card'
import { useNearbyCarsQuery, useSearchCarsQuery } from './api'

const CATEGORIES = ['Hatchback', 'Sedan', 'SUV', 'Luxury', 'Van', 'Electric']
const PAGE_SIZE = 12

interface AppliedFilters {
  city?: string
  category?: string
  q?: string
  minPrice?: string
  maxPrice?: string
  from?: string
  to?: string
}

export function BrowsePage() {
  const toast = useToast()

  // Draft (form) state
  const [q, setQ] = useState('')
  const [city, setCity] = useState('')
  const [category, setCategory] = useState('')
  const [minPrice, setMinPrice] = useState('')
  const [maxPrice, setMaxPrice] = useState('')
  const [range, setRange] = useState<DateRangeValue>({})

  // Applied state (drives the query)
  const [applied, setApplied] = useState<AppliedFilters>({})
  const [sort, setSort] = useState('price,asc')
  const [page, setPage] = useState(0)

  // Near-me
  const [mode, setMode] = useState<'search' | 'nearby'>('search')
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null)
  const [radiusKm, setRadiusKm] = useState(25)
  const [locating, setLocating] = useState(false)

  const commonFilters = {
    category: applied.category,
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
    if (mode === 'search') {
      return (searchQuery.data?.content ?? []).map((car) => ({ car }))
    }
    return (nearbyQuery.data?.content ?? []).map((r) => ({ car: r.car, distanceKm: r.distanceKm }))
  }, [mode, searchQuery.data, nearbyQuery.data])

  const totalPages = active.data?.totalPages ?? 0
  const totalElements = active.data?.totalElements ?? 0

  function applyDraft(): AppliedFilters {
    const from = range.from ? dayAtDefaultHour(range.from) : undefined
    const to = range.to ? dayAtDefaultHour(range.to) : undefined
    const validWindow = isValidRange(from ?? null, to ?? null)
    return {
      city: city.trim() || undefined,
      category: category || undefined,
      q: q.trim() || undefined,
      minPrice: minPrice.trim() || undefined,
      maxPrice: maxPrice.trim() || undefined,
      from: validWindow ? from : undefined,
      to: validWindow ? to : undefined,
    }
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    setApplied(applyDraft())
    setPage(0)
  }

  function onClear() {
    setQ('')
    setCity('')
    setCategory('')
    setMinPrice('')
    setMaxPrice('')
    setRange({})
    setApplied({})
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

  const hasFilters =
    !!(q || city || category || minPrice || maxPrice || range.from) || mode === 'nearby'

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Find a car</h1>
          <p className="text-sm text-muted-foreground">
            {active.isFetching ? 'Searching…' : `${totalElements} cars available`}
          </p>
        </div>
      </div>

      <Card className="p-4">
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Field label="Keyword" htmlFor="q">
              <Input
                id="q"
                placeholder="Make or model"
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
            </Field>
            <Field label="City" htmlFor="city">
              <Input
                id="city"
                placeholder="Any city"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                disabled={mode === 'nearby'}
              />
            </Field>
            <Field label="Category" htmlFor="category">
              <Select
                id="category"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
              >
                <option value="">All categories</option>
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Dates" htmlFor="dates">
              <DateRangePicker
                value={range}
                onChange={setRange}
                disabledBefore={new Date()}
                placeholder="Any dates"
              />
            </Field>
            <Field label="Min price / day" htmlFor="minPrice">
              <Input
                id="minPrice"
                type="number"
                min={0}
                placeholder="0"
                value={minPrice}
                onChange={(e) => setMinPrice(e.target.value)}
              />
            </Field>
            <Field label="Max price / day" htmlFor="maxPrice">
              <Input
                id="maxPrice"
                type="number"
                min={0}
                placeholder="Any"
                value={maxPrice}
                onChange={(e) => setMaxPrice(e.target.value)}
              />
            </Field>
            {mode === 'nearby' && (
              <Field label="Radius" htmlFor="radius">
                <Select
                  id="radius"
                  value={String(radiusKm)}
                  onChange={(e) => setRadiusKm(Number(e.target.value))}
                >
                  {[10, 25, 50, 100].map((r) => (
                    <option key={r} value={r}>
                      {r} km
                    </option>
                  ))}
                </Select>
              </Field>
            )}
            <Field label="Sort" htmlFor="sort">
              <Select
                id="sort"
                value={sort}
                onChange={(e) => {
                  setSort(e.target.value)
                  setPage(0)
                }}
                disabled={mode === 'nearby'}
              >
                <option value="price,asc">Price: low to high</option>
                <option value="price,desc">Price: high to low</option>
                <option value="newest,desc">Newest first</option>
              </Select>
            </Field>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button type="submit">
              <SearchIcon className="h-4 w-4" /> Search
            </Button>
            <Button type="button" variant="outline" onClick={useMyLocation} loading={locating}>
              <LocateFixed className="h-4 w-4" /> Near me
            </Button>
            {mode === 'nearby' && (
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setMode('search')
                  setCoords(null)
                  setPage(0)
                }}
              >
                <X className="h-4 w-4" /> Exit near-me
              </Button>
            )}
            {hasFilters && (
              <Button type="button" variant="ghost" onClick={onClear}>
                Clear filters
              </Button>
            )}
          </div>
        </form>
      </Card>

      {active.isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-64 w-full" />
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
          title="No cars match"
          description="Try widening your dates, price range, or location."
        />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
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
