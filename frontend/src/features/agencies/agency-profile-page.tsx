import { useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { ArrowLeft, BadgeCheck, Building2, CalendarRange, MapPin } from 'lucide-react'
import { EmptyState } from '../../components/ui/empty-state'
import { Pagination } from '../../components/ui/pagination'
import { StarRating } from '../../components/ui/rating'
import { Skeleton } from '../../components/ui/skeleton'
import { LoadingState } from '../../components/ui/spinner'
import { CarCard } from '../cars/car-card'
import { useSearchCarsQuery } from '../cars/api'
import { useGetAgencyProfileQuery, useGetAgencyRatingQuery } from './api'

const PAGE_SIZE = 12

/** Public agency profile — the marketplace's "driver profile" equivalent:
 *  who you're renting from, their trust score, and their available fleet. */
export function AgencyProfilePage() {
  const { id } = useParams()
  const agencyId = Number(id)
  const [page, setPage] = useState(0)

  // Trip context from the agency-results screen: dates scope the fleet to what's
  // actually free, and the whole context is forwarded into each car page.
  const [searchParams] = useSearchParams()
  const from = searchParams.get('from') ?? undefined
  const to = searchParams.get('to') ?? undefined
  const hasWindow = !!from && !!to
  const tripSearch = searchParams.toString() ? `?${searchParams.toString()}` : undefined

  const { data: agency, isLoading } = useGetAgencyProfileQuery(agencyId)
  const { data: rating } = useGetAgencyRatingQuery(agencyId)
  const fleet = useSearchCarsQuery({ agencyId, from, to, page, size: PAGE_SIZE })

  if (isLoading) return <LoadingState />
  if (!agency) return <EmptyState icon={Building2} title="Agency not found" />

  const cars = fleet.data?.content ?? []

  return (
    <div className="space-y-6">
      <Link
        to="/"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Back to home
      </Link>

      {/* ── Profile header ────────────────────────────────────────────────── */}
      <section className="flex flex-wrap items-center gap-5 rounded-3xl border border-border bg-card p-6 shadow-sm">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-600 to-violet-600 text-2xl font-bold text-white shadow-sm">
          {agency.name.charAt(0).toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">{agency.name}</h1>
            {agency.status === 'ACTIVE' && (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-xs font-medium text-emerald-600 ring-1 ring-inset ring-emerald-500/30 dark:text-emerald-400">
                <BadgeCheck className="h-3.5 w-3.5" /> Verified agency
              </span>
            )}
          </div>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
            {agency.city && (
              <span className="inline-flex items-center gap-1">
                <MapPin className="h-4 w-4" /> {agency.city}
              </span>
            )}
            {fleet.data && (
              <span>
                {fleet.data.totalElements} car{fleet.data.totalElements === 1 ? '' : 's'} available
              </span>
            )}
          </div>
        </div>
        <div className="text-right">
          {rating && rating.reviewCount > 0 ? (
            <>
              <div className="flex items-center justify-end gap-2">
                <StarRating value={rating.averageRating ?? 0} />
                <span className="text-lg font-semibold">{rating.averageRating?.toFixed(1)}</span>
              </div>
              <p className="text-xs text-muted-foreground">
                {rating.reviewCount} review{rating.reviewCount === 1 ? '' : 's'} across the fleet
              </p>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">No reviews yet</p>
          )}
        </div>
      </section>

      {/* ── Fleet ─────────────────────────────────────────────────────────── */}
      <section className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-lg font-semibold">Available cars</h2>
          {hasWindow && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-accent px-3 py-1 text-xs font-medium text-accent-foreground">
              <CalendarRange className="h-3.5 w-3.5" /> for your dates
            </span>
          )}
        </div>
        {fleet.isLoading ? (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-72 w-full rounded-2xl" />
            ))}
          </div>
        ) : cars.length === 0 ? (
          <EmptyState
            icon={Building2}
            title="No cars available right now"
            description="This agency has no available listings at the moment."
          />
        ) : (
          <>
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {cars.map((car) => (
                <CarCard key={car.id} car={car} search={tripSearch} />
              ))}
            </div>
            <Pagination page={page} totalPages={fleet.data?.totalPages ?? 0} onPage={setPage} />
          </>
        )}
      </section>
    </div>
  )
}
