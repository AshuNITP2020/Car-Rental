import 'leaflet/dist/leaflet.css'
import { useEffect } from 'react'
import { divIcon, type LeafletMouseEvent } from 'leaflet'
import { MapContainer, Marker, Polygon, TileLayer, useMap, useMapEvents } from 'react-leaflet'
import type { LatLng } from '../../lib/types'

const carIcon = divIcon({
  className: '',
  iconSize: [0, 0],
  html: `<div style="transform:translate(-50%,-100%);display:flex;flex-direction:column;align-items:center;">
    <div style="width:28px;height:28px;border-radius:9999px;background:#4f46e5;color:#fff;
      display:flex;align-items:center;justify-content:center;font-size:14px;
      border:3px solid #fff;box-shadow:0 2px 6px rgb(0 0 0/.4);">🚗</div>
    <div style="width:2px;height:8px;background:#4f46e5;"></div></div>`,
})

function ClickHandler({ onPick }: { onPick: (p: LatLng) => void }) {
  useMapEvents({
    click: (e: LeafletMouseEvent) => onPick({ lat: e.latlng.lat, lng: e.latlng.lng }),
  })
  return null
}

/** Leaflet reads center only at mount — follow the zone/agency when it loads. */
function Recenter({ focus }: { focus: LatLng | null }) {
  const map = useMap()
  useEffect(() => {
    if (focus) map.flyTo([focus.lat, focus.lng], Math.max(map.getZoom(), 11), { duration: 0.4 })
  }, [focus, map])
  return null
}

/**
 * Mini map for placing a car inside the agency's operating area: the zone is
 * drawn for guidance, click (or drag the marker) to set the car's position.
 * Default export for React.lazy (Leaflet is heavy).
 */
export default function CarLocationMap({
  center,
  zoom = 11,
  zone,
  value,
  onChange,
}: {
  center: LatLng
  /** Initial zoom — pass a low value for a country-wide "pick anywhere" view. */
  zoom?: number
  /** The agency's operating area ring(s), drawn as guidance (cars must stay inside). */
  zone: LatLng[][]
  value: LatLng | null
  onChange: (p: LatLng) => void
}) {
  return (
    <MapContainer center={[center.lat, center.lng]} zoom={zoom} scrollWheelZoom className="h-full w-full">
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <ClickHandler onPick={onChange} />
      <Recenter focus={value} />
      {zone.map(
        (ring, i) =>
          ring.length >= 3 && (
            <Polygon
              key={i}
              positions={ring.map((p) => [p.lat, p.lng] as [number, number])}
              pathOptions={{ color: '#4f46e5', weight: 2, fillOpacity: 0.06, dashArray: '6 6' }}
            />
          ),
      )}
      {value && (
        <Marker
          position={[value.lat, value.lng]}
          icon={carIcon}
          draggable
          eventHandlers={{
            dragend: (e) => {
              const p = e.target.getLatLng()
              onChange({ lat: p.lat, lng: p.lng })
            },
          }}
        />
      )}
    </MapContainer>
  )
}
