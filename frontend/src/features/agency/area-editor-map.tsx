import 'leaflet/dist/leaflet.css'
import { divIcon, type LeafletMouseEvent } from 'leaflet'
import { MapContainer, Marker, Polygon, TileLayer, useMapEvents } from 'react-leaflet'
import type { LatLng } from '../../lib/types'

const vertexIcon = divIcon({
  className: '',
  iconSize: [0, 0],
  html: `<div style="transform:translate(-50%,-50%);width:12px;height:12px;border-radius:9999px;
    background:#4f46e5;border:2px solid #fff;box-shadow:0 1px 4px rgb(0 0 0/.4);cursor:grab;"></div>`,
})

function ClickHandler({ onClick }: { onClick: (p: LatLng) => void }) {
  useMapEvents({
    click: (e: LeafletMouseEvent) => onClick({ lat: e.latlng.lat, lng: e.latlng.lng }),
  })
  return null
}

/**
 * Hand-rolled polygon editor: click adds a vertex, dragging a vertex reshapes
 * the area, the parent owns the points. Default export for React.lazy().
 */
export default function AreaEditorMap({
  center,
  points,
  onAdd,
  onMove,
}: {
  center: LatLng
  points: LatLng[]
  onAdd: (p: LatLng) => void
  onMove: (index: number, p: LatLng) => void
}) {
  return (
    <MapContainer
      center={[center.lat, center.lng]}
      zoom={10}
      scrollWheelZoom
      className="h-full w-full"
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <ClickHandler onClick={onAdd} />
      {points.length >= 3 && (
        <Polygon
          positions={points.map((p) => [p.lat, p.lng] as [number, number])}
          pathOptions={{ color: '#4f46e5', weight: 2, fillOpacity: 0.12 }}
        />
      )}
      {points.map((p, i) => (
        <Marker
          key={i}
          position={[p.lat, p.lng]}
          icon={vertexIcon}
          draggable
          eventHandlers={{
            dragend: (e) => {
              const ll = e.target.getLatLng()
              onMove(i, { lat: ll.lat, lng: ll.lng })
            },
          }}
        />
      ))}
    </MapContainer>
  )
}
