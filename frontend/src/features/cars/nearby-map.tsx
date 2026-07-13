import 'leaflet/dist/leaflet.css'
import { divIcon } from 'leaflet'
import { MapContainer, Marker, Popup, TileLayer } from 'react-leaflet'
import { Link } from 'react-router-dom'
import type { NearbyCarResult } from '../../lib/types'
import { formatMoney } from '../../lib/utils'

/** Price-pill marker (avoids Leaflet's default icon-asset headaches). */
function priceIcon(label: string) {
  return divIcon({
    className: '', // no default styles
    iconSize: [0, 0],
    html: `<div style="transform:translate(-50%,-100%);background:#312e81;color:#fff;
      border-radius:9999px;padding:3px 10px;font-size:12px;font-weight:600;
      white-space:nowrap;box-shadow:0 2px 6px rgb(0 0 0 / .35);border:2px solid #fff;">${label}</div>`,
  })
}

const originIcon = divIcon({
  className: '',
  iconSize: [0, 0],
  html: `<div style="transform:translate(-50%,-50%);width:16px;height:16px;border-radius:9999px;
    background:#4f46e5;border:3px solid #fff;box-shadow:0 0 0 4px rgb(79 70 229 / .3);"></div>`,
})

/** Default export so the browse page can React.lazy() this (Leaflet is heavy). */
export default function NearbyMap({
  center,
  results,
}: {
  center: { lat: number; lng: number }
  results: NearbyCarResult[]
}) {
  const markers = results.filter((r) => r.car.latitude != null && r.car.longitude != null)

  return (
    <div className="h-[540px] overflow-hidden rounded-2xl border border-border shadow-sm">
      <MapContainer
        center={[center.lat, center.lng]}
        zoom={12}
        scrollWheelZoom
        className="h-full w-full"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <Marker position={[center.lat, center.lng]} icon={originIcon} />
        {markers.map((r) => (
          <Marker
            key={r.car.id}
            position={[r.car.latitude!, r.car.longitude!]}
            icon={priceIcon(formatMoney(r.car.pricePerDay))}
          >
            <Popup>
              <div style={{ minWidth: 160 }}>
                <p style={{ fontWeight: 600, margin: 0 }}>
                  {r.car.make} {r.car.model}
                </p>
                <p style={{ margin: '2px 0', fontSize: 12, color: '#64748b' }}>
                  {r.car.agencyName} · {r.distanceKm} km away
                </p>
                <p style={{ margin: '2px 0', fontWeight: 600 }}>
                  {formatMoney(r.car.pricePerDay)}/day
                </p>
                <Link to={`/cars/${r.car.id}`} state={{ car: r.car }}>
                  View car →
                </Link>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  )
}
