import { useEffect, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from "react-leaflet";
import L from "leaflet";

// Fix Leaflet default icon bug in Vite
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
  iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
});

const pickupIcon = new L.Icon({
  iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
  iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34],
});

const dropIcon = new L.Icon({
  iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
  iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34],
});

const agentIcon = new L.Icon({
  iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
  iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34],
});

function FitBounds({ points }) {
  const map = useMap();
  useEffect(() => {
    if (points.length > 0) {
      map.fitBounds(L.latLngBounds(points), { padding: [40, 40] });
    }
  }, [points]);
  return null;
}

/**
 * Fetch a road-following route between two [lat,lng] points from the public
 * OSRM demo server (no API key). Returns the geometry as [lat,lng] pairs plus
 * driving distance (km) and duration (min). Falls back to a straight line.
 */
async function fetchRoute(from, to, signal) {
  const url =
    `https://router.project-osrm.org/route/v1/driving/` +
    `${from[1]},${from[0]};${to[1]},${to[0]}?overview=full&geometries=geojson`;
  const res = await fetch(url, { signal });
  const data = await res.json();
  if (!data.routes?.length) throw new Error("no route");
  const r = data.routes[0];
  return {
    line: r.geometry.coordinates.map(([lng, lat]) => [lat, lng]),
    distanceKm: r.distance / 1000,
    durationMin: r.duration / 60,
  };
}

export default function MapView({ pickup, drop, agent, onRoute }) {
  const center = pickup || drop || agent || [19.076, 72.877];
  const [route, setRoute] = useState(null);

  useEffect(() => {
    if (!pickup || !drop) { setRoute(null); return; }
    const controller = new AbortController();
    let active = true;
    fetchRoute(pickup, drop, controller.signal)
      .then(r => {
        if (!active) return;
        setRoute(r);
        onRoute?.({ distanceKm: r.distanceKm, durationMin: r.durationMin });
      })
      .catch(() => { if (active) setRoute(null); });
    return () => { active = false; controller.abort(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pickup?.[0], pickup?.[1], drop?.[0], drop?.[1]]);

  // Points to frame: the route if we have it, otherwise the raw markers
  const framePoints = (route?.line?.length ? route.line : [pickup, drop, agent]).filter(Boolean);

  return (
    <MapContainer center={center} zoom={13} style={{ height: "100%", width: "100%", borderRadius: "12px" }}>
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; OpenStreetMap'
      />
      {framePoints.length > 0 && <FitBounds points={framePoints} />}
      {pickup && (
        <Marker position={pickup} icon={pickupIcon}>
          <Popup>📦 Pickup / Hub</Popup>
        </Marker>
      )}
      {drop && (
        <Marker position={drop} icon={dropIcon}>
          <Popup>🏠 Doorstep</Popup>
        </Marker>
      )}
      {agent && (
        <Marker position={agent} icon={agentIcon}>
          <Popup>🛵 Agent</Popup>
        </Marker>
      )}
      {route?.line?.length ? (
        // Road-following route
        <Polyline positions={route.line} color="#A3E635" weight={4} opacity={0.9} />
      ) : (
        // Fallback: straight dashed line while routing / if OSRM is unavailable
        pickup && drop && (
          <Polyline positions={[pickup, drop]} color="#A3E635" weight={3} dashArray="8 6" opacity={0.6} />
        )
      )}
    </MapContainer>
  );
}
