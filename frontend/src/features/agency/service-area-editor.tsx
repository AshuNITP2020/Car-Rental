import { lazy, Suspense, useState } from 'react'
import { Building2, MapPinned, Pencil, RotateCcw, Save, X } from 'lucide-react'
import { Alert } from '../../components/ui/alert'
import { Button } from '../../components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card'
import { Skeleton } from '../../components/ui/skeleton'
import { useToast } from '../../components/ui/toast'
import { errorMessage } from '../../lib/errors'
import type { CityArea, LatLng } from '../../lib/types'
import { cn } from '../../lib/utils'
import { LocationInput } from '../trip/location-input'
import {
  useGetMyServiceAreaQuery,
  useUpdateServiceAreaCitiesMutation,
  useUpdateServiceAreaMutation,
} from './api'

const CitiesPreviewMap = lazy(() => import('./cities-preview-map'))
const AreaEditorMap = lazy(() => import('./area-editor-map'))

const FALLBACK_CENTER: LatLng = { lat: 21.0, lng: 78.5 }
const DEFAULT_RADIUS_KM = 25

type Tab = 'CITIES' | 'CUSTOM'

/**
 * "Operating area" — where this agency's cars work; a trip must start AND end
 * inside it. Two ways to define it, controls on the left, live map preview on
 * the right:
 *   Cities — pick any cities (typeahead over all of India) + a service radius;
 *            the area is a circle around each pick and may be scattered.
 *   Custom — draw a polygon by hand (the advanced tool).
 */
export function ServiceAreaEditor({
  agencyCenter,
  canEdit,
}: {
  /** The agency's base coordinates, used to center empty maps. */
  agencyCenter: LatLng | null
  canEdit: boolean
}) {
  const toast = useToast()
  const { data, isLoading } = useGetMyServiceAreaQuery()
  const [saveCities, { isLoading: savingCities }] = useUpdateServiceAreaCitiesMutation()
  const [saveCustom, { isLoading: savingCustom }] = useUpdateServiceAreaMutation()

  // Local edits snapshot server state on first change (derived, no effects).
  const [tabChoice, setTabChoice] = useState<Tab | null>(null)
  const [cityEdits, setCityEdits] = useState<CityArea[] | null>(null)
  const [radiusEdit, setRadiusEdit] = useState<number | null>(null)
  const [ringEdits, setRingEdits] = useState<LatLng[] | null>(null)

  const tab: Tab = tabChoice ?? (data?.mode === 'CUSTOM' ? 'CUSTOM' : 'CITIES')
  const cities = cityEdits ?? data?.cities ?? []
  const radiusKm = radiusEdit ?? data?.radiusKm ?? DEFAULT_RADIUS_KM
  const ring = ringEdits ?? (data?.mode === 'CUSTOM' ? (data?.polygons[0] ?? []) : [])
  const citiesDirty = cityEdits != null || radiusEdit != null
  const ringDirty = ringEdits != null
  const hasSavedArea = (data?.polygons.length ?? 0) > 0

  const center: LatLng =
    agencyCenter ?? (cities.length > 0 ? { lat: cities[0].lat, lng: cities[0].lng } : FALLBACK_CENTER)

  function addCity(point: LatLng, name: string) {
    if (cities.some((c) => c.name === name)) return
    setCityEdits([...cities, { name, lat: point.lat, lng: point.lng }])
  }

  async function onSaveCities() {
    try {
      await saveCities({ cities, radiusKm }).unwrap()
      setCityEdits(null)
      setRadiusEdit(null)
      toast.success('Operating area saved — you serve trips inside these circles')
    } catch (e) {
      toast.error(errorMessage(e), 'Could not save the area')
    }
  }

  async function onSaveCustom() {
    try {
      await saveCustom({ polygon: ring }).unwrap()
      setRingEdits(null)
      toast.success('Operating area saved — you now appear in searches inside it')
    } catch (e) {
      toast.error(errorMessage(e), 'Could not save the area')
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MapPinned className="h-4 w-4" /> Operating area
        </CardTitle>
        <CardDescription>
          Customers see your agency only for trips that start <em>and</em> end inside
          this area. It can be scattered — e.g. Pune and Nagpur, without the road
          in between.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!isLoading && !hasSavedArea && (
          <Alert variant="warning" title="No operating area yet">
            Define your area to appear in trip searches.
          </Alert>
        )}

        {/* mode tabs */}
        {canEdit && (
          <div className="flex gap-2">
            {(
              [
                { key: 'CITIES' as Tab, icon: Building2, label: 'Cities I serve' },
                { key: 'CUSTOM' as Tab, icon: Pencil, label: 'Draw manually' },
              ] as const
            ).map(({ key, icon: Icon, label }) => (
              <button
                key={key}
                type="button"
                onClick={() => setTabChoice(key)}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-full border px-4 py-1.5 text-sm font-medium transition-colors',
                  tab === key
                    ? 'border-primary bg-primary text-primary-foreground shadow-sm'
                    : 'border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground',
                )}
              >
                <Icon className="h-4 w-4" /> {label}
              </button>
            ))}
          </div>
        )}

        <div className="grid gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
          {/* ── left: controls ── */}
          <div className="space-y-4">
            {tab === 'CITIES' ? (
              <>
                {canEdit && (
                  <LocationInput
                    id="area-city-search"
                    icon={<Building2 className="h-4 w-4 text-primary" />}
                    placeholder="Add a city you serve…"
                    label=""
                    cities={[]}
                    value={null}
                    onSelect={addCity}
                    onClear={() => {}}
                  />
                )}

                {cities.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No cities yet — search and pick every city your fleet serves.
                  </p>
                ) : (
                  <ul className="flex flex-wrap gap-1.5">
                    {cities.map((c) => (
                      <li
                        key={`${c.name}|${c.lat}`}
                        className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-3 py-1 text-sm font-medium text-primary"
                      >
                        {c.name}
                        {canEdit && (
                          <button
                            type="button"
                            aria-label={`Remove ${c.name}`}
                            onClick={() => setCityEdits(cities.filter((x) => x !== c))}
                            className="rounded-full p-0.5 hover:bg-primary/20"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        )}
                      </li>
                    ))}
                  </ul>
                )}

                <div className="space-y-1">
                  <label htmlFor="area-radius" className="text-sm font-medium">
                    Service radius per city:{' '}
                    <span className="font-semibold text-primary">{radiusKm} km</span>
                  </label>
                  <input
                    id="area-radius"
                    type="range"
                    min={5}
                    max={100}
                    step={5}
                    value={radiusKm}
                    disabled={!canEdit}
                    onChange={(e) => setRadiusEdit(Number(e.target.value))}
                    className="w-full accent-[var(--primary)]"
                  />
                </div>

                {canEdit && (
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      onClick={onSaveCities}
                      loading={savingCities}
                      disabled={cities.length === 0 || !citiesDirty}
                    >
                      <Save className="h-4 w-4" /> Save area
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => {
                        setCityEdits(null)
                        setRadiusEdit(null)
                      }}
                      disabled={!citiesDirty}
                    >
                      <RotateCcw className="h-4 w-4" /> Reset
                    </Button>
                  </div>
                )}
              </>
            ) : (
              <>
                <p className="text-sm text-muted-foreground">
                  Click the map to add corners; drag a corner to adjust. One
                  contiguous shape — use “Cities I serve” for scattered areas.
                </p>
                <p className="text-xs text-muted-foreground">
                  {ring.length < 3
                    ? `${ring.length}/3 corners — add ${3 - ring.length} more`
                    : `${ring.length} corners`}
                </p>
                {canEdit && (
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      onClick={onSaveCustom}
                      loading={savingCustom}
                      disabled={ring.length < 3 || !ringDirty}
                    >
                      <Save className="h-4 w-4" /> Save area
                    </Button>
                    <Button variant="outline" onClick={() => setRingEdits(null)} disabled={!ringDirty}>
                      <RotateCcw className="h-4 w-4" /> Reset
                    </Button>
                  </div>
                )}
              </>
            )}
            {!canEdit && (
              <p className="text-xs text-muted-foreground">
                Only an agency admin can edit the area.
              </p>
            )}
          </div>

          {/* ── right: live map preview ── */}
          <div className="h-[320px] overflow-hidden rounded-2xl border border-border lg:h-[380px]">
            {isLoading ? (
              <Skeleton className="h-full w-full rounded-none" />
            ) : (
              <Suspense fallback={<Skeleton className="h-full w-full rounded-none" />}>
                {tab === 'CITIES' ? (
                  <CitiesPreviewMap center={center} cities={cities} radiusKm={radiusKm} />
                ) : (
                  <AreaEditorMap
                    center={center}
                    points={ring}
                    onAdd={(p) => {
                      if (!canEdit) return
                      setRingEdits([...ring, p])
                    }}
                    onMove={(i, p) => {
                      if (!canEdit) return
                      setRingEdits(ring.map((old, idx) => (idx === i ? p : old)))
                    }}
                  />
                )}
              </Suspense>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
