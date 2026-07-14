import { useState, type FormEvent } from 'react'
import { createSearchParams, useNavigate } from 'react-router-dom'
import { ArrowDownUp, Flag, LocateFixed, MapPin, Search as SearchIcon } from 'lucide-react'
import { Button } from '../../components/ui/button'
import { DateRangePicker, type DateRangeValue } from '../../components/ui/date-range-picker'
import { Field } from '../../components/ui/field'
import { Input } from '../../components/ui/input'
import { useToast } from '../../components/ui/toast'
import { dayAtDefaultHour, isValidRange } from '../../lib/date'
import { cn } from '../../lib/utils'
import { nearestCity, useGetCitiesQuery } from './api'

function defaultDateRange(): DateRangeValue {
  const from = new Date()
  from.setDate(from.getDate() + 1)
  const to = new Date()
  to.setDate(to.getDate() + 4)
  return { from, to }
}

/**
 * Home: the trip form (Uber-style "where to?"). Pickup + optional destination
 * from the marketplace's operating cities, dates, and one-way drop-off. Lands
 * on the agency results — the "choose your ride" screen.
 */
export function TripSearchPage() {
  const toast = useToast()
  const navigate = useNavigate()
  const { data: cities = [] } = useGetCitiesQuery()

  const [pickup, setPickup] = useState('')
  const [destination, setDestination] = useState('')
  const [oneWay, setOneWay] = useState(false)
  const [range, setRange] = useState<DateRangeValue>(defaultDateRange)
  const [locating, setLocating] = useState(false)

  const knownCity = (name: string) =>
    cities.some((c) => c.city.toLowerCase() === name.trim().toLowerCase())
  const differentCities =
    destination.trim() !== '' && destination.trim().toLowerCase() !== pickup.trim().toLowerCase()

  function useMyLocation() {
    if (!('geolocation' in navigator)) {
      toast.error('Geolocation is not supported by your browser')
      return
    }
    setLocating(true)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const city = nearestCity(cities, pos.coords.latitude, pos.coords.longitude)
        if (city) {
          setPickup(city.city)
          toast.info(`Pickup set to ${city.city} — the nearest city we operate in`)
        } else {
          toast.error('Could not match your location to an operating city')
        }
        setLocating(false)
      },
      (err) => {
        toast.error(err.message || 'Could not get your location')
        setLocating(false)
      },
      { enableHighAccuracy: false, timeout: 10_000 },
    )
  }

  function swap() {
    setPickup(destination)
    setDestination(pickup)
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (!pickup.trim()) {
      toast.error('Choose a pickup city')
      return
    }
    if (!knownCity(pickup)) {
      toast.error(`We don't operate in “${pickup.trim()}” yet — pick a city from the list`)
      return
    }
    const from = range.from ? dayAtDefaultHour(range.from) : undefined
    const to = range.to ? dayAtDefaultHour(range.to) : undefined
    if (!isValidRange(from ?? null, to ?? null)) {
      toast.error('Choose your pickup and return dates')
      return
    }
    if (oneWay && !differentCities) {
      toast.error('A one-way trip needs a destination different from the pickup city')
      return
    }
    const params: Record<string, string> = { city: pickup.trim(), from: from!, to: to! }
    if (differentCities) params.dest = destination.trim()
    if (oneWay && differentCities) params.oneWay = '1'
    navigate({ pathname: '/agencies', search: `?${createSearchParams(params)}` })
  }

  const popular = cities.slice(0, 6)

  return (
    <div className="mx-auto max-w-2xl space-y-8 py-6">
      <div className="text-center">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Where to next?</h1>
        <p className="mt-2 text-muted-foreground">
          Pick up a self-drive car from a local agency — drop it back, or drive it one-way to
          another city.
        </p>
      </div>

      <form
        onSubmit={onSubmit}
        className="space-y-4 rounded-3xl border border-border bg-card p-6 shadow-lg"
      >
        {/* pickup + destination with swap, Uber-style stacked fields */}
        <div className="relative space-y-3">
          <Field label="Pickup city" htmlFor="pickup" required>
            <div className="relative">
              <MapPin className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-primary" />
              <Input
                id="pickup"
                list="operating-cities"
                placeholder="Where do you pick up?"
                className="pl-9"
                value={pickup}
                onChange={(e) => setPickup(e.target.value)}
              />
              <button
                type="button"
                onClick={useMyLocation}
                title="Use my location"
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <LocateFixed className={cn('h-4 w-4', locating && 'animate-pulse')} />
              </button>
            </div>
          </Field>

          <button
            type="button"
            onClick={swap}
            title="Swap pickup and destination"
            className="absolute right-4 top-[52px] z-10 rounded-full border border-border bg-card p-1.5 text-muted-foreground shadow-sm hover:text-foreground"
          >
            <ArrowDownUp className="h-3.5 w-3.5" />
          </button>

          <Field label="Destination" htmlFor="destination" hint="Optional — where are you headed?">
            <div className="relative">
              <Flag className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="destination"
                list="operating-cities"
                placeholder="Round trip, or driving somewhere?"
                className="pl-9"
                value={destination}
                onChange={(e) => setDestination(e.target.value)}
              />
            </div>
          </Field>
        </div>

        <datalist id="operating-cities">
          {cities.map((c) => (
            <option key={c.city} value={c.city}>
              {`${c.agencyCount} agencies`}
            </option>
          ))}
        </datalist>

        <Field label="Dates" htmlFor="trip-dates" required>
          <DateRangePicker value={range} onChange={setRange} disabledBefore={new Date()} />
        </Field>

        {differentCities && (
          <label className="flex cursor-pointer items-start gap-3 rounded-[var(--radius)] border border-border bg-muted/40 p-3">
            <input
              type="checkbox"
              checked={oneWay}
              onChange={(e) => setOneWay(e.target.checked)}
              className="mt-0.5 h-4 w-4 accent-[var(--primary)]"
            />
            <span className="text-sm">
              <span className="font-medium">One-way drop-off</span>
              <span className="block text-muted-foreground">
                Leave the car in {destination.trim()} — a distance-based relocation fee applies.
                Unchecked, you return it to {pickup.trim() || 'the pickup city'}.
              </span>
            </span>
          </label>
        )}

        <Button type="submit" size="lg" className="w-full">
          <SearchIcon className="h-4 w-4" /> Find agencies
        </Button>
      </form>

      {popular.length > 0 && (
        <div className="text-center">
          <p className="mb-2 text-sm text-muted-foreground">Popular pickup cities</p>
          <div className="flex flex-wrap justify-center gap-2">
            {popular.map((c) => (
              <button
                key={c.city}
                type="button"
                onClick={() => setPickup(c.city)}
                className={cn(
                  'rounded-full border px-4 py-1.5 text-sm font-medium transition-colors',
                  pickup === c.city
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground',
                )}
              >
                {c.city}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
