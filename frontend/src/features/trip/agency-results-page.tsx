import { createSearchParams, Link, useSearchParams } from 'react-router-dom'
import { skipToken } from '@reduxjs/toolkit/query'
import { ArrowLeft, ArrowRight, Building2, CarFront, ChevronRight, MoveRight } from 'lucide-react'
import { EmptyState } from '../../components/ui/empty-state'
import { StarRating } from '../../components/ui/rating'
import { Skeleton } from '../../components/ui/skeleton'
import { formatDate } from '../../lib/date'
import { formatMoney } from '../../lib/utils'
import { cityDistanceKm, useGetCitiesQuery, useSearchAgenciesQuery } from './api'

/**
 * The "choose your ride" screen: agencies operating at the pickup city for the
 * chosen window — rating, fleet available, starting price. Selecting one goes
 * to its profile with the whole trip context (dates, destination, one-way).
 */
export function AgencyResultsPage() {
  const [searchParams] = useSearchParams()
  const city = searchParams.get('city') ?? ''
  const dest = searchParams.get('dest') ?? ''
  const oneWay = searchParams.get('oneWay') === '1'
  const from = searchParams.get('from') ?? undefined
  const to = searchParams.get('to') ?? undefined

  const { data: cities = [] } = useGetCitiesQuery()
  const results = useSearchAgenciesQuery(city ? { city, from, to } : skipToken)

  const distanceKm = dest ? cityDistanceKm(cities, city, dest) : null
  const agencies = results.data ?? []

  /** Trip context forwarded to the agency profile / cars / booking. */
  const tripSearch = `?${createSearchParams({
    ...(from && to ? { from, to } : {}),
    ...(dest ? { dest } : {}),
    ...(oneWay ? { oneWay: '1' } : {}),
  })}`

  if (!city) {
    return (
      <EmptyState
        icon={Building2}
        title="No pickup city chosen"
        description="Start from the trip form."
        action={
          <Link to="/" className="text-sm font-medium text-primary hover:underline">
            Plan a trip
          </Link>
        }
      />
    )
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Link
        to="/"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Change trip
      </Link>

      {/* ── Route summary ─────────────────────────────────────────────────── */}
      <section className="rounded-3xl bg-gradient-to-br from-indigo-600 to-violet-700 px-6 py-5 text-white shadow-lg">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xl font-semibold">
          <span>{city}</span>
          {dest && (
            <>
              <MoveRight className="h-5 w-5 text-indigo-200" />
              <span>{dest}</span>
            </>
          )}
          {oneWay && (
            <span className="rounded-full bg-white/15 px-2.5 py-0.5 text-xs font-medium">
              One-way drop-off
            </span>
          )}
        </div>
        <p className="mt-1 text-sm text-indigo-100">
          {from && to ? `${formatDate(from)} → ${formatDate(to)}` : 'Any dates'}
          {distanceKm != null && ` · ~${Math.round(distanceKm)} km`}
          {dest && !oneWay && ' · round trip'}
        </p>
      </section>

      {/* ── Agencies ──────────────────────────────────────────────────────── */}
      <div className="flex items-baseline justify-between">
        <h1 className="text-lg font-semibold">
          {results.isFetching
            ? 'Finding agencies…'
            : `${agencies.length} agenc${agencies.length === 1 ? 'y' : 'ies'} in ${city}`}
        </h1>
      </div>

      {results.isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full rounded-2xl" />
          ))}
        </div>
      ) : results.isError ? (
        <EmptyState icon={Building2} title="Couldn’t load agencies" description="Please try again." />
      ) : agencies.length === 0 ? (
        <EmptyState
          icon={CarFront}
          title={`No cars available in ${city} for these dates`}
          description="Try different dates or a nearby city."
        />
      ) : (
        <div className="space-y-3">
          {agencies.map((a) => (
            <Link
              key={a.agencyId}
              to={{ pathname: `/agencies/${a.agencyId}`, search: tripSearch }}
              className="group flex items-center gap-4 rounded-2xl border border-border bg-card p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
            >
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-600 to-violet-600 text-xl font-bold text-white">
                {a.name.charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <h2 className="truncate font-semibold">{a.name}</h2>
                  {a.averageRating != null && (
                    <span className="inline-flex shrink-0 items-center gap-1 text-sm">
                      <StarRating value={a.averageRating} size={13} />
                      <span className="font-medium">{a.averageRating.toFixed(1)}</span>
                      <span className="text-muted-foreground">({a.reviewCount})</span>
                    </span>
                  )}
                </div>
                <p className="mt-0.5 text-sm text-muted-foreground">
                  {a.availableCars} car{a.availableCars === 1 ? '' : 's'} available
                  {from && to ? ' for your dates' : ''}
                </p>
              </div>
              <div className="shrink-0 text-right">
                <p className="font-semibold">
                  {formatMoney(a.fromPricePerDay)}
                  <span className="text-xs font-normal text-muted-foreground">/day</span>
                </p>
                <p className="text-xs text-muted-foreground">starting at</p>
              </div>
              <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
            </Link>
          ))}
        </div>
      )}

      <p className="text-center text-sm text-muted-foreground">
        Just want to scan inventory?{' '}
        <Link to="/browse" className="inline-flex items-center gap-1 font-medium text-primary hover:underline">
          Browse all cars <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </p>
    </div>
  )
}
