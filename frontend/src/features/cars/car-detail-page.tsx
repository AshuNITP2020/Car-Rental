import { ArrowLeft, Building2, Car as CarIcon, MapPin } from 'lucide-react'
import { Link, useLocation, useParams } from 'react-router-dom'
import { StatusBadge } from '../../components/ui/badge'
import { EmptyState } from '../../components/ui/empty-state'
import { LoadingState } from '../../components/ui/spinner'
import type { CarSearchResult } from '../../lib/types'
import { BookingWidget } from './booking-widget'
import { CarGallery } from './car-gallery'
import { CarReviews } from './car-reviews'
import { useGetCarImagesQuery, useGetCarQuery } from './api'

export function CarDetailPage() {
  const { id } = useParams()
  const carId = Number(id)
  const location = useLocation()
  // Car passed via router state renders instantly while the fetch refreshes it.
  const initial = (location.state as { car?: CarSearchResult } | null)?.car

  const { data, isLoading } = useGetCarQuery(carId)
  const { data: images } = useGetCarImagesQuery(carId)
  const car = data ?? initial

  if (!car && isLoading) return <LoadingState />
  if (!car)
    return (
      <EmptyState
        icon={CarIcon}
        title="Car not found"
        description="This car may no longer be listed."
        action={
          <Link to="/" className="text-sm font-medium text-primary hover:underline">
            Back to browse
          </Link>
        }
      />
    )

  return (
    <div className="space-y-6">
      <Link
        to="/"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Back to browse
      </Link>

      <div className="grid gap-8 lg:grid-cols-[1fr_360px]">
        <div className="space-y-6">
          <CarGallery images={images} />
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-semibold tracking-tight">
                {car.make} {car.model}
              </h1>
              <StatusBadge status={car.status} />
            </div>
            <p className="text-muted-foreground">{car.category}</p>
            <div className="mt-3 flex flex-wrap gap-4 text-sm text-muted-foreground">
              <span className="inline-flex items-center gap-1">
                <Building2 className="h-4 w-4" /> {car.agencyName}
              </span>
              {car.city && (
                <span className="inline-flex items-center gap-1">
                  <MapPin className="h-4 w-4" /> {car.city}
                </span>
              )}
            </div>
          </div>
          <section>
            <h2 className="mb-3 text-lg font-semibold">Reviews</h2>
            <CarReviews carId={carId} />
          </section>
        </div>

        <div>
          <BookingWidget carId={carId} pricePerDay={car.pricePerDay} />
        </div>
      </div>
    </div>
  )
}
