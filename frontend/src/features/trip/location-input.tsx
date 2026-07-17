import { useEffect, useRef, useState, type ReactNode } from 'react'
import { skipToken } from '@reduxjs/toolkit/query'
import { Loader2, X } from 'lucide-react'
import { Input } from '../../components/ui/input'
import type { CityInfo, LatLng, PlaceSuggestion } from '../../lib/types'
import { useDebouncedValue } from '../../lib/use-debounced'
import { cn } from '../../lib/utils'
import { useSearchPlacesQuery } from './api'

const MIN_QUERY = 2

/** Operating cities as suggestions — the offline fallback when the geocoder fails. */
function cityFallback(cities: CityInfo[], query: string): PlaceSuggestion[] {
  const q = query.toLowerCase()
  return cities
    .filter((c) => c.latitude != null && c.longitude != null && c.city.toLowerCase().includes(q))
    .slice(0, 6)
    .map((c) => ({ name: c.city, state: null, lat: c.latitude!, lng: c.longitude! }))
}

/**
 * Location input with typeahead over any Indian city/town/village (server-side
 * geocoder, debounced). Picking a suggestion drops the pin at that place's
 * centroid — drag on the map to fine-tune. Shows the pin's label when idle.
 */
export function LocationInput({
  id,
  icon,
  placeholder,
  label,
  cities,
  value,
  onSelect,
  onClear,
}: {
  id: string
  icon: ReactNode
  placeholder: string
  /** Idle display for the current pin (reverse-geocoded by the parent). */
  label: string
  cities: CityInfo[]
  value: LatLng | null
  onSelect: (point: LatLng, name: string) => void
  onClear: () => void
}) {
  const [query, setQuery] = useState('')
  const [focused, setFocused] = useState(false)
  /** Blur hides the dropdown after a grace period so suggestion clicks land —
   *  a refocus inside that window must cancel it or the list stays hidden. */
  const blurTimer = useRef<number | undefined>(undefined)
  useEffect(() => () => window.clearTimeout(blurTimer.current), [])

  const debounced = useDebouncedValue(query.trim(), 300)
  const active = focused && debounced.length >= MIN_QUERY
  const search = useSearchPlacesQuery(active ? debounced : skipToken)

  // `data` (not currentData) keeps the previous list on screen while the next
  // keystroke's results load — no flicker. Geocoder down -> operating cities.
  const suggestions: PlaceSuggestion[] = !active
    ? []
    : search.isError || (search.data && search.data.length === 0 && !search.isFetching)
      ? cityFallback(cities, debounced)
      : (search.data ?? [])

  const display = focused ? query : value ? label : ''

  function pick(place: PlaceSuggestion) {
    onSelect({ lat: place.lat, lng: place.lng }, place.name)
    setQuery('')
    setFocused(false)
  }

  return (
    <div className="relative">
      <span className="pointer-events-none absolute left-3 top-1/2 z-10 -translate-y-1/2">
        {icon}
      </span>
      <Input
        id={id}
        autoComplete="off"
        placeholder={placeholder}
        className={cn('pl-9', value && 'pr-8')}
        value={display}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => {
          window.clearTimeout(blurTimer.current)
          setFocused(true)
          setQuery('')
        }}
        onBlur={() => {
          blurTimer.current = window.setTimeout(() => setFocused(false), 150)
        }}
      />
      {focused && search.isFetching && (
        <Loader2 className="absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
      )}
      {value && !focused && (
        <button
          type="button"
          onClick={onClear}
          aria-label="Clear location"
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:bg-muted"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}
      {suggestions.length > 0 && (
        <ul className="absolute z-[1000] mt-1 w-full overflow-hidden rounded-[var(--radius)] border border-border bg-card shadow-lg">
          {suggestions.map((s) => (
            <li key={`${s.name}|${s.state}|${s.lat}`}>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()} // keep focus until click fires
                onClick={() => pick(s)}
                className="flex w-full items-baseline justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-muted"
              >
                <span className="truncate font-medium">{s.name}</span>
                {s.state && (
                  <span className="shrink-0 text-xs text-muted-foreground">{s.state}</span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
      {active && !search.isFetching && suggestions.length === 0 && (
        <div className="absolute z-[1000] mt-1 w-full rounded-[var(--radius)] border border-border bg-card px-3 py-2 text-sm text-muted-foreground shadow-lg">
          No places match “{debounced}”
        </div>
      )}
    </div>
  )
}
