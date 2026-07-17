import { lazy, Suspense, useState } from 'react'
import { MapPinned, RotateCcw, Save } from 'lucide-react'
import { Alert } from '../../components/ui/alert'
import { Button } from '../../components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card'
import { Skeleton } from '../../components/ui/skeleton'
import { useToast } from '../../components/ui/toast'
import { errorMessage } from '../../lib/errors'
import type { LatLng } from '../../lib/types'
import { useGetCitiesQuery } from '../trip/api'
import { useGetMyServiceAreaQuery, useUpdateServiceAreaMutation } from './api'

const AreaEditorMap = lazy(() => import('./area-editor-map'))

const FALLBACK_CENTER: LatLng = { lat: 21.0, lng: 78.5 }

/**
 * "Operating area" — the polygon that decides whether this agency appears when
 * a customer drops a pickup pin. Click the map to add corners, drag to adjust.
 */
export function ServiceAreaCard({
  agencyCenter,
  canEdit,
}: {
  /** The agency's base coordinates, used to center the map. */
  agencyCenter: LatLng | null
  canEdit: boolean
}) {
  const toast = useToast()
  const { data, isLoading } = useGetMyServiceAreaQuery()
  const [save, { isLoading: saving }] = useUpdateServiceAreaMutation()
  const { data: cities = [] } = useGetCitiesQuery()

  // Unedited -> show the saved polygon; first edit snapshots it (derived
  // state, no effects). null = "no local edits yet".
  const [edits, setEdits] = useState<LatLng[] | null>(null)
  const points = edits ?? data?.polygon ?? []
  const dirty = edits != null

  const center: LatLng =
    agencyCenter ??
    (points.length > 0
      ? points[0]
      : cities[0]?.latitude != null && cities[0]?.longitude != null
        ? { lat: cities[0].latitude, lng: cities[0].longitude }
        : FALLBACK_CENTER)

  async function onSave() {
    try {
      await save({ polygon: points }).unwrap()
      setEdits(null) // saved -> the server copy is the truth again
      toast.success('Operating area saved — you now appear in searches inside it')
    } catch (e) {
      toast.error(errorMessage(e), 'Could not save the area')
    }
  }

  function reset() {
    setEdits(null)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MapPinned className="h-4 w-4" /> Operating area
        </CardTitle>
        <CardDescription>
          Customers see your agency when their pickup pin lands inside this area.
          {canEdit && ' Click the map to add corners; drag a corner to adjust.'}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {!isLoading && !data?.polygon && points.length === 0 && (
          <Alert variant="warning" title="No operating area yet">
            Draw your area to appear in trip searches.
          </Alert>
        )}

        <div className="h-[340px] overflow-hidden rounded-2xl border border-border">
          {isLoading ? (
            <Skeleton className="h-full w-full rounded-none" />
          ) : (
            <Suspense fallback={<Skeleton className="h-full w-full rounded-none" />}>
              <AreaEditorMap
                center={center}
                points={points}
                onAdd={(p) => {
                  if (!canEdit) return
                  setEdits([...points, p])
                }}
                onMove={(i, p) => {
                  if (!canEdit) return
                  setEdits(points.map((old, idx) => (idx === i ? p : old)))
                }}
              />
            </Suspense>
          )}
        </div>

        {canEdit ? (
          <div className="flex flex-wrap items-center gap-2">
            <Button onClick={onSave} loading={saving} disabled={points.length < 3 || !dirty}>
              <Save className="h-4 w-4" /> Save area
            </Button>
            <Button variant="outline" onClick={reset} disabled={!dirty}>
              <RotateCcw className="h-4 w-4" /> Reset
            </Button>
            <span className="text-xs text-muted-foreground">
              {points.length < 3
                ? `${points.length}/3 corners — add ${3 - points.length} more`
                : `${points.length} corners`}
            </span>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">Only an agency admin can edit the area.</p>
        )}
      </CardContent>
    </Card>
  )
}
