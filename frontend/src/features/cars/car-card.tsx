import { Link, useNavigate } from 'react-router-dom'
import { Building2, Car as CarIcon, MapPin, Star, Users } from 'lucide-react'
import type { CarSearchResult } from '../../lib/types'
import { formatMoney, humanizeStatus } from '../../lib/utils'

/** "SUV"/"MPV" stay acronyms; everything else humanizes ("HATCHBACK" -> "Hatchback"). */
function typeLabel(category: string): string {
  return /^(suv|mpv)$/i.test(category) ? category.toUpperCase() : humanizeStatus(category)
}
import { useGetCarImagesQuery } from './api'
import { carPlaceholderStyle } from './placeholder'

export function CarCard({
  car,
  search,
}: {
  car: CarSearchResult
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
      className="group flex flex-col overflow-hidden rounded-2xl bg-muted transition-all duration-200 hover:shadow-lifted"
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
        <span className="absolute bottom-3 right-3 rounded-full bg-black/55 px-3 py-1 text-sm font-semibold text-white backdrop-blur">
          {formatMoney(car.pricePerDay)}
          <span className="text-xs font-normal opacity-80">/day</span>
        </span>
      </div>

      <div className="flex flex-1 flex-col gap-1.5 p-4">
        {/* Customers pick by TYPE + seats; make/model is secondary detail. */}
        <div className="flex items-start justify-between gap-2">
          <h3 className="flex items-center gap-2 truncate font-semibold leading-tight">
            {typeLabel(car.category)}
            <span className="inline-flex items-center gap-1 text-sm font-medium text-muted-foreground">
              <Users className="h-3.5 w-3.5" /> {car.seats} seats
            </span>
          </h3>
          {car.averageRating != null && (
            <span className="inline-flex shrink-0 items-center gap-1 text-sm font-medium">
              <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
              {car.averageRating.toFixed(1)}
              <span className="font-normal text-muted-foreground">({car.reviewCount})</span>
            </span>
          )}
        </div>
        <p className="truncate text-xs text-muted-foreground">
          {car.make} {car.model}
        </p>
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
        <div className="mt-auto flex items-center justify-end pt-1.5 text-xs text-muted-foreground">
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
