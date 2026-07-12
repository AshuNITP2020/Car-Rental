import { Link } from 'react-router-dom'
import { Car as CarIcon, MapPin } from 'lucide-react'
import type { CarSearchResult } from '../../lib/types'
import { formatMoney } from '../../lib/utils'
import { useGetCarImagesQuery } from './api'

export function CarCard({ car, distanceKm }: { car: CarSearchResult; distanceKm?: number }) {
  const { data: images } = useGetCarImagesQuery(car.id)
  const thumb = images?.[0]?.url

  return (
    <Link
      to={`/cars/${car.id}`}
      state={{ car }}
      className="group flex flex-col overflow-hidden rounded-[calc(var(--radius)+2px)] border border-border bg-card transition-shadow hover:shadow-md"
    >
      <div className="flex aspect-video items-center justify-center overflow-hidden bg-muted">
        {thumb ? (
          <img
            src={thumb}
            alt={`${car.make} ${car.model}`}
            loading="lazy"
            className="h-full w-full object-cover transition-transform group-hover:scale-105"
          />
        ) : (
          <CarIcon className="h-10 w-10 text-muted-foreground/40" />
        )}
      </div>
      <div className="flex flex-1 flex-col gap-1 p-4">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-medium leading-tight">
            {car.make} {car.model}
          </h3>
          <span className="whitespace-nowrap font-semibold">
            {formatMoney(car.pricePerDay)}
            <span className="text-xs font-normal text-muted-foreground">/day</span>
          </span>
        </div>
        <p className="text-sm text-muted-foreground">
          {car.category} · {car.agencyName}
        </p>
        {(car.city || distanceKm != null) && (
          <p className="mt-auto flex items-center gap-1 pt-1 text-xs text-muted-foreground">
            <MapPin className="h-3.5 w-3.5" />
            {car.city}
            {distanceKm != null && <span>· {distanceKm} km away</span>}
          </p>
        )}
      </div>
    </Link>
  )
}
