import 'leaflet/dist/leaflet.css'
import { useEffect } from 'react'
import { divIcon, latLngBounds } from 'leaflet'
import { Circle, MapContainer, Marker, TileLayer, useMap } from 'react-leaflet'
import type { CityArea, LatLng } from '../../lib/types'

function cityIcon(name: string) {
  return divIcon({
    className: '',
    iconSize: [0, 0],
    html: `<div style="transform:translate(-50%,-50%);background:#312e81;color:#fff;
      border-radius:9999px;padding:2px 9px;font-size:11px;font-weight:600;white-space:nowrap;
      box-shadow:0 2px 5px rgb(0 0 0/.35);border:2px solid #fff;">${name}</div>`,
  })
}

/** Keep every circle in view as cities/radius change (Leaflet reads bounds only imperatively). */
function FitCities({ cities, radiusKm }: { cities: CityArea[]; radiusKm: number }) {
  const map = useMap()
  useEffect(() => {
    if (cities.length === 0) return
    const bounds = latLngBounds(cities.map((c) => [c.lat, c.lng] as [number, number]))
    map.fitBounds(bounds.pad(0.35), { maxZoom: 10 })
  }, [cities, radiusKm, map])
  return null
}

/**
 * Live preview of a cities-mode operating area: one circle of {@code radiusKm}
 * around each picked city — scattered circles are exactly what gets saved.
 * Default export for React.lazy (Leaflet is heavy).
 */
export default function CitiesPreviewMap({
  center,
  cities,
  radiusKm,
}: {
  center: LatLng
  cities: CityArea[]
  radiusKm: number
}) {
  return (
    <MapContainer center={[center.lat, center.lng]} zoom={5} scrollWheelZoom className="h-full w-full">
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <FitCities cities={cities} radiusKm={radiusKm} />
      {cities.map((c) => (
        <span key={`${c.name}|${c.lat}`}>
          <Circle
            center={[c.lat, c.lng]}
            radius={radiusKm * 1000}
            pathOptions={{ color: '#4f46e5', weight: 2, fillOpacity: 0.08 }}
          />
          <Marker position={[c.lat, c.lng]} icon={cityIcon(c.name)} />
        </span>
      ))}
    </MapContainer>
  )
}
