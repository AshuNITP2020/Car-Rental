import { Link, useNavigate } from 'react-router-dom'
import { Building2, Car as CarIcon, MapPin, Star } from 'lucide-react'
import type { CarSearchResult } from '../../lib/types'
import { formatMoney } from '../../lib/utils'
import { useGetCarImagesQuery } from './api'
import { carPlaceholderStyle } from './placeholder'

export function CarCard({
  car,
  distanceKm,
  search,
}: {
  car: CarSearchResult
  distanceKm?: number
  /** Trip context ("?from=…&to=…&dest=…") forwarded into the car page. */
  search?: string
}) {
  const { data: images } = useGetCarImagesQuery(car.id)
  const navigate = useNavigate()
  const thumb = images?.[0]?.url

  return (
    <Link
      to={{ pathname: `/cars/${car.id}`, search }}
      state={{ car }}
      className="group flex flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg"
    >
      <div className="relative aspect-[16/10] overflow-hidden bg-muted">
        {thumb ? (
          <img
            src={thumb}
            alt={`${car.make} ${car.model}`}
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div
            className="flex h-full w-full items-center justify-center"
            style={carPlaceholderStyle(car.id)}
          >
            <CarIcon className="h-14 w-14 text-white/40 transition-transform duration-300 group-hover:scale-110" />
          </div>
        )}
        {distanceKm != null && (
          <span className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-full bg-black/55 px-2.5 py-1 text-xs font-medium text-white backdrop-blur">
            <MapPin className="h-3 w-3" /> {distanceKm} km away
          </span>
        )}
        <span className="absolute bottom-3 right-3 rounded-full bg-black/55 px-3 py-1 text-sm font-semibold text-white backdrop-blur">
          {formatMoney(car.pricePerDay)}
          <span className="text-xs font-normal opacity-80">/day</span>
        </span>
      </div>

      <div className="flex flex-1 flex-col gap-1.5 p-4">
        <div className="flex items-start justify-between gap-2">
          <h3 className="truncate font-semibold leading-tight">
            {car.make} {car.model}
          </h3>
          {car.averageRating != null && (
            <span className="inline-flex shrink-0 items-center gap-1 text-sm font-medium">
              <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
              {car.averageRating.toFixed(1)}
              <span className="font-normal text-muted-foreground">({car.reviewCount})</span>
            </span>
          )}
        </div>
        {/* The card is a <Link>, so the agency "link" navigates programmatically. */}
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault()
            e.stopPropagation()
            navigate(`/agencies/${car.agencyId}`)
          }}
          className="flex w-fit max-w-full items-center gap-1.5 text-sm text-muted-foreground hover:text-primary hover:underline"
        >
          <Building2 className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">{car.agencyName}</span>
        </button>
        <div className="mt-auto flex items-center justify-between pt-1.5 text-xs text-muted-foreground">
          <span className="rounded-md bg-muted px-2 py-0.5 font-medium">{car.category}</span>
          {car.city && (
            <span className="inline-flex items-center gap-1">
              <MapPin className="h-3.5 w-3.5" />
              {car.city}
            </span>
          )}
        </div>
      </div>
    </Link>
  )
}
