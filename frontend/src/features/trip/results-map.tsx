import 'leaflet/dist/leaflet.css'
import { divIcon } from 'leaflet'
import { MapContainer, Marker, Polygon, Popup, TileLayer } from 'react-leaflet'
import type { AgencySearchResult, LatLng } from '../../lib/types'
import { formatMoney } from '../../lib/utils'

const pickupIcon = divIcon({
  className: '',
  iconSize: [0, 0],
  html: `<div style="transform:translate(-50%,-50%);width:16px;height:16px;border-radius:9999px;
    background:#4f46e5;border:3px solid #fff;box-shadow:0 0 0 4px rgb(79 70 229/.3);"></div>`,
})

function agencyIcon(label: string) {
  return divIcon({
    className: '',
    iconSize: [0, 0],
    html: `<div style="transform:translate(-50%,-100%);background:#312e81;color:#fff;
      border-radius:9999px;padding:3px 10px;font-size:12px;font-weight:600;white-space:nowrap;
      box-shadow:0 2px 6px rgb(0 0 0/.35);border:2px solid #fff;">${label}</div>`,
  })
}

/** Agencies covering the pickup pin, each with its operating polygon — the map
 *  shows WHY every agency matched. Default export for React.lazy(). */
export default function ResultsMap({
  pickup,
  agencies,
}: {
  pickup: LatLng
  agencies: AgencySearchResult[]
}) {
  return (
    <div className="h-[360px] overflow-hidden rounded-2xl border border-border shadow-sm">
      <MapContainer
        center={[pickup.lat, pickup.lng]}
        zoom={10}
        scrollWheelZoom
        className="h-full w-full"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <Marker position={[pickup.lat, pickup.lng]} icon={pickupIcon} />
        {agencies.map((a) => (
          <span key={a.agencyId}>
            {a.serviceArea && a.serviceArea.length >= 3 && (
              <Polygon
                positions={a.serviceArea.map((p) => [p.lat, p.lng] as [number, number])}
                pathOptions={{ color: '#6366f1', weight: 1.5, fillOpacity: 0.07 }}
              />
            )}
            {a.latitude != null && a.longitude != null && (
              <Marker position={[a.latitude, a.longitude]} icon={agencyIcon(a.name)}>
                <Popup>
                  <div style={{ minWidth: 150 }}>
                    <p style={{ fontWeight: 600, margin: 0 }}>{a.name}</p>
                    <p style={{ margin: '2px 0', fontSize: 12, color: '#64748b' }}>
                      {a.availableCars} car{a.availableCars === 1 ? '' : 's'} ·{' '}
                      from {formatMoney(a.fromPricePerDay)}/day
                    </p>
                  </div>
                </Popup>
              </Marker>
            )}
          </span>
        ))}
      </MapContainer>
    </div>
  )
}
