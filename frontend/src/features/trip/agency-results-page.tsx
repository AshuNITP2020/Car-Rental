import { lazy, Suspense } from 'react'
import { createSearchParams, Link, useSearchParams } from 'react-router-dom'
import { skipToken } from '@reduxjs/toolkit/query'
import { ArrowLeft, Building2, CarFront, ChevronRight, MoveRight } from 'lucide-react'
import { EmptyState } from '../../components/ui/empty-state'
import { StarRating } from '../../components/ui/rating'
import { Skeleton } from '../../components/ui/skeleton'
import { formatDate } from '../../lib/date'
import { formatMoney } from '../../lib/utils'
import { haversineKm, usePlaceLabel, useSearchAgenciesQuery } from './api'

const ResultsMap = lazy(() => import('./results-map'))

/**
 * The "choose your ride" screen: agencies whose operating polygon covers the
 * pickup pin — with the map proving why each one matched. Selecting one goes
 * to its profile with the whole trip context (pins, dates, one-way).
 */
export function AgencyResultsPage() {
  const [searchParams] = useSearchParams()
  const plat = Number(searchParams.get('plat'))
  const plng = Number(searchParams.get('plng'))
  const dlat = searchParams.get('dlat') ? Number(searchParams.get('dlat')) : null
  const dlng = searchParams.get('dlng') ? Number(searchParams.get('dlng')) : null
  const oneWay = searchParams.get('oneWay') === '1'
  const from = searchParams.get('from') ?? undefined
  const to = searchParams.get('to') ?? undefined
  const hasPickup = Number.isFinite(plat) && Number.isFinite(plng) && (plat !== 0 || plng !== 0)

  const hasDrop = dlat != null && dlng != null
  const results = useSearchAgenciesQuery(
    hasPickup
      ? {
          lat: plat,
          lng: plng,
          ...(hasDrop ? { dlat: dlat!, dlng: dlng! } : {}),
          from,
          to,
        }
      : skipToken,
  )
  const pickupLabel = usePlaceLabel(hasPickup ? { lat: plat, lng: plng } : null)
  const dropLabel = usePlaceLabel(dlat != null && dlng != null ? { lat: dlat, lng: dlng } : null)

  const agencies = results.data ?? []
  const routeKm = dlat != null && dlng != null ? haversineKm(plat, plng, dlat, dlng) : null

  /** Trip context forwarded to the agency profile / cars / booking. */
  const tripSearch = `?${createSearchParams({
    ...(from && to ? { from, to } : {}),
    ...(dlat != null && dlng != null
      ? { dlat: String(dlat), dlng: String(dlng) }
      : {}),
    ...(oneWay ? { oneWay: '1' } : {}),
  })}`

  if (!hasPickup) {
    return (
      <EmptyState
        icon={Building2}
        title="No pickup pin"
        description="Start from the trip planner."
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
          <span>{pickupLabel}</span>
          {dlat != null && dlng != null && (
            <>
              <MoveRight className="h-5 w-5 text-indigo-200" />
              <span>{dropLabel}</span>
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
          {routeKm != null && routeKm >= 1 && ` · ~${Math.round(routeKm)} km`}
          {dlat != null && !oneWay && ' · round trip'}
        </p>
      </section>

      {/* ── Coverage map ──────────────────────────────────────────────────── */}
      {agencies.length > 0 && (
        <Suspense fallback={<Skeleton className="h-[360px] w-full rounded-2xl" />}>
          <ResultsMap pickup={{ lat: plat, lng: plng }} agencies={agencies} />
        </Suspense>
      )}

      {/* ── Agencies ──────────────────────────────────────────────────────── */}
      <h1 className="text-lg font-semibold">
        {results.isFetching
          ? 'Finding agencies…'
          : `${agencies.length} agenc${agencies.length === 1 ? 'y' : 'ies'} can run ${
              hasDrop ? 'your whole route' : 'trips from your pickup point'
            }`}
      </h1>

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
          title={
            hasDrop
              ? 'No agency covers your whole route'
              : 'No agency operates at this point for these dates'
          }
          description={
            hasDrop
              ? "An agency's cars never leave its operating area — no single zone contains both your pickup and drop. Try a nearer drop point or different dates."
              : 'Move your pickup pin toward a city, or try different dates.'
          }
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
                  {a.distanceKm != null && ` · base ${a.distanceKm.toFixed(1)} km away`}
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
    </div>
  )
}
