import 'leaflet/dist/leaflet.css'
import { useEffect } from 'react'
import { divIcon, latLngBounds, type LeafletMouseEvent } from 'leaflet'
import {
  MapContainer,
  Marker,
  Polygon,
  Polyline,
  TileLayer,
  useMap,
  useMapEvents,
} from 'react-leaflet'
import type { AgencySearchResult, LatLng } from '../../lib/types'
import type { PinKind } from './trip-map'

function pinIcon(kind: PinKind) {
  const color = kind === 'pickup' ? '#4f46e5' : '#09090b'
  const letter = kind === 'pickup' ? 'P' : 'D'
  return divIcon({
    className: '',
    iconSize: [0, 0],
    html: `<div style="transform:translate(-50%,-100%);display:flex;flex-direction:column;align-items:center;">
      <div style="width:28px;height:28px;border-radius:9999px;background:${color};color:#fff;
        display:flex;align-items:center;justify-content:center;font-weight:700;font-size:13px;
        border:3px solid #fff;box-shadow:0 2px 6px rgb(0 0 0/.4);">${letter}</div>
      <div style="width:2px;height:8px;background:${color};"></div></div>`,
  })
}

function agencyIcon(label: string, emphasized: boolean) {
  return divIcon({
    className: '',
    iconSize: [0, 0],
    html: `<div style="transform:translate(-50%,-100%);background:${emphasized ? '#4f46e5' : '#312e81'};color:#fff;
      border-radius:9999px;padding:3px 10px;font-size:12px;font-weight:600;white-space:nowrap;
      box-shadow:0 2px 6px rgb(0 0 0/.35);border:2px solid #fff;">${label}</div>`,
  })
}

function ClickHandler({ onClick }: { onClick: (p: LatLng) => void }) {
  useMapEvents({
    click: (e: LeafletMouseEvent) => onClick({ lat: e.latlng.lat, lng: e.latlng.lng }),
  })
  return null
}

/** Frame the WHOLE trip: pickup + destination, padded (Leaflet is imperative). */
function FitRoute({ pickup, drop }: { pickup: LatLng | null; drop: LatLng | null }) {
  const map = useMap()
  useEffect(() => {
    if (pickup && drop) {
      map.fitBounds(
        latLngBounds([
          [pickup.lat, pickup.lng],
          [drop.lat, drop.lng],
        ]).pad(0.35),
      )
    } else if (pickup) {
      map.setView([pickup.lat, pickup.lng], 10)
    }
  }, [pickup, drop, map])
  return null
}

/**
 * The results map: the whole route in frame — P/D pins (draggable, edits the
 * live search), the dashed route line, and every matched agency's operating
 * area, so it's visible WHY each one qualifies. Hovering a result card
 * emphasizes its zone. Default export for React.lazy().
 */
export default function RouteMap({
  pickup,
  drop,
  agencies,
  hoveredId,
  onPlace,
  onMapClick,
  onAgencyClick,
}: {
  pickup: LatLng | null
  drop: LatLng | null
  agencies: AgencySearchResult[]
  /** Agency whose zone to emphasize (hovered in the list). */
  hoveredId: number | null
  onPlace: (kind: PinKind, point: LatLng) => void
  onMapClick: (point: LatLng) => void
  onAgencyClick: (agencyId: number) => void
}) {
  const center = pickup ?? { lat: 21.0, lng: 78.5 }
  return (
    <MapContainer center={[center.lat, center.lng]} zoom={6} scrollWheelZoom className="h-full w-full">
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <ClickHandler onClick={onMapClick} />
      <FitRoute pickup={pickup} drop={drop} />

      {agencies.map((a) => {
        const emphasized = a.agencyId === hoveredId
        return (
          <span key={a.agencyId}>
            {a.serviceArea?.map(
              (ring, i) =>
                ring.length >= 3 && (
                  <Polygon
                    key={i}
                    positions={ring.map((pt) => [pt.lat, pt.lng] as [number, number])}
                    pathOptions={{
                      color: '#4f46e5',
                      weight: emphasized ? 2.5 : 1.5,
                      fillOpacity: emphasized ? 0.15 : 0.06,
                    }}
                  />
                ),
            )}
            {a.latitude != null && a.longitude != null && (
              <Marker
                position={[a.latitude, a.longitude]}
                icon={agencyIcon(a.name, emphasized)}
                eventHandlers={{ click: () => onAgencyClick(a.agencyId) }}
              />
            )}
          </span>
        )
      })}

      {pickup && drop && (
        <Polyline
          positions={[
            [pickup.lat, pickup.lng],
            [drop.lat, drop.lng],
          ]}
          pathOptions={{ color: '#09090b', weight: 2.5, dashArray: '8 8', opacity: 0.6 }}
        />
      )}
      {pickup && (
        <Marker
          position={[pickup.lat, pickup.lng]}
          icon={pinIcon('pickup')}
          draggable
          eventHandlers={{
            dragend: (e) => {
              const pt = e.target.getLatLng()
              onPlace('pickup', { lat: pt.lat, lng: pt.lng })
            },
          }}
        />
      )}
      {drop && (
        <Marker
          position={[drop.lat, drop.lng]}
          icon={pinIcon('drop')}
          draggable
          eventHandlers={{
            dragend: (e) => {
              const pt = e.target.getLatLng()
              onPlace('drop', { lat: pt.lat, lng: pt.lng })
            },
          }}
        />
      )}
    </MapContainer>
  )
}
