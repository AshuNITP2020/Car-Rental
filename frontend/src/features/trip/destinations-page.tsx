import { useNavigate } from 'react-router-dom'
import { Building2, MapPin } from 'lucide-react'
import { EmptyState } from '../../components/ui/empty-state'
import { Skeleton } from '../../components/ui/skeleton'
import { useGetCitiesQuery } from './api'

/**
 * Destinations: every city the marketplace operates in (has at least one
 * agency), busiest first. Picking one starts a trip from that city.
 */
export function DestinationsPage() {
  const navigate = useNavigate()
  const { data: cities = [], isLoading } = useGetCitiesQuery()

  return (
    <div className="mx-auto max-w-6xl space-y-6 py-2">
      <div>
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Destinations</h1>
        <p className="mt-2 max-w-2xl text-muted-foreground">
          Cities where agencies operate today — pick one to start a trip from there.
          Anywhere inside an agency's operating area works too.
        </p>
      </div>

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-2xl" />
          ))}
        </div>
      ) : cities.length === 0 ? (
        <EmptyState
          icon={MapPin}
          title="No destinations yet"
          description="Agencies are still onboarding — check back soon."
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {cities.map((c) => (
            <button
              key={c.city}
              type="button"
              disabled={c.latitude == null || c.longitude == null}
              onClick={() =>
                c.latitude != null &&
                c.longitude != null &&
                navigate(`/?plat=${c.latitude.toFixed(6)}&plng=${c.longitude.toFixed(6)}`)
              }
              className="group flex items-center gap-4 rounded-2xl bg-muted p-5 text-left transition-all duration-200 hover:shadow-lifted disabled:opacity-60"
            >
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-600 to-violet-600 text-white">
                <MapPin className="h-5 w-5" />
              </span>
              <span className="min-w-0">
                <span className="block truncate font-semibold group-hover:text-primary">
                  {c.city}
                </span>
                <span className="mt-0.5 flex items-center gap-1 text-sm text-muted-foreground">
                  <Building2 className="h-3.5 w-3.5" />
                  {c.agencyCount} agenc{c.agencyCount === 1 ? 'y' : 'ies'}
                </span>
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
