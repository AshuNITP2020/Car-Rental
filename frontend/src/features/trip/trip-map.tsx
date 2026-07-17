import 'leaflet/dist/leaflet.css'
import { useEffect } from 'react'
import { divIcon, type LeafletMouseEvent } from 'leaflet'
import { MapContainer, Marker, Polyline, TileLayer, useMap, useMapEvents } from 'react-leaflet'
import type { LatLng } from '../../lib/types'

export type PinKind = 'pickup' | 'drop'

function pinIcon(kind: PinKind) {
  const color = kind === 'pickup' ? '#4f46e5' : '#7c3aed'
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

function ClickHandler({ onClick }: { onClick: (p: LatLng) => void }) {
  useMapEvents({
    click: (e: LeafletMouseEvent) => onClick({ lat: e.latlng.lat, lng: e.latlng.lng }),
  })
  return null
}

/** Leaflet only reads center/zoom at mount — fly to `focus` whenever it changes
 *  (geolocation grant, a typeahead selection, …). */
function Recenter({ focus }: { focus: LatLng | null }) {
  const map = useMap()
  useEffect(() => {
    if (focus) {
      map.flyTo([focus.lat, focus.lng], Math.max(map.getZoom(), 11), { duration: 0.6 })
    }
  }, [focus, map])
  return null
}

/**
 * The trip planner's pin-picker: tap to place the active pin, drag to adjust.
 * Default export so the page can React.lazy() it (Leaflet is heavy).
 */
export default function TripMap({
  center,
  zoom,
  focus,
  pickup,
  drop,
  onPlace,
  onMapClick,
}: {
  center: LatLng
  zoom: number
  /** Fly here when it changes (geolocation / typeahead selection). */
  focus: LatLng | null
  pickup: LatLng | null
  drop: LatLng | null
  /** Fired when a pin is placed or dragged. */
  onPlace: (kind: PinKind, point: LatLng) => void
  /** Fired on any map click — the page decides which pin it sets. */
  onMapClick: (point: LatLng) => void
}) {
  return (
    <MapContainer
      center={[center.lat, center.lng]}
      zoom={zoom}
      scrollWheelZoom
      className="h-full w-full"
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <ClickHandler onClick={onMapClick} />
      <Recenter focus={focus} />
      {pickup && (
        <Marker
          position={[pickup.lat, pickup.lng]}
          icon={pinIcon('pickup')}
          draggable
          eventHandlers={{
            dragend: (e) => {
              const p = e.target.getLatLng()
              onPlace('pickup', { lat: p.lat, lng: p.lng })
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
              const p = e.target.getLatLng()
              onPlace('drop', { lat: p.lat, lng: p.lng })
            },
          }}
        />
      )}
      {pickup && drop && (
        <Polyline
          positions={[
            [pickup.lat, pickup.lng],
            [drop.lat, drop.lng],
          ]}
          pathOptions={{ color: '#4f46e5', weight: 3, dashArray: '8 8', opacity: 0.7 }}
        />
      )}
    </MapContainer>
  )
}
