import React, { useMemo } from 'react';
import { MapContainer, TileLayer, Polyline, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import FitBounds from './FitBounds';
import { getWeatherDescription } from '../../utils/helpers';

// Custom marker icons for start/end/waypoints
const createIcon = (color, size = 25) => new L.DivIcon({
  className: 'custom-marker',
  html: `<div style="
    background-color: ${color};
    width: ${size}px;
    height: ${size}px;
    border-radius: 50%;
    border: 3px solid white;
    box-shadow: 0 2px 5px rgba(0,0,0,0.4);
  "></div>`,
  iconSize: [size, size],
  iconAnchor: [size/2, size/2],
});

const startIcon = createIcon('#22c55e', 28); // Green
const endIcon = createIcon('#ef4444', 28);   // Red
const waypointIcon = createIcon('#00FFFF', 18); // Cyan

const RouteMap = ({ routeCoordinates, waypoints, startName, endName, alternativeRoutes = [], selectedRouteIndex = 0, onSelectRoute }) => {
  // Convert OSRM coordinates [lon, lat] to Leaflet [lat, lon]
  const polylinePositions = useMemo(() =>
    routeCoordinates.map(coord => [coord[1], coord[0]]),
    [routeCoordinates]
  );

  // Convert alternative routes coordinates
  const alternativePolylines = useMemo(() =>
    alternativeRoutes.map(route =>
      route.coordinates.map(coord => [coord[1], coord[0]])
    ),
    [alternativeRoutes]
  );

  // Get center from first coordinate
  const center = polylinePositions.length > 0
    ? polylinePositions[Math.floor(polylinePositions.length / 2)]
    : [39.8283, -98.5795]; // US center as fallback

  return (
    <MapContainer
      center={center}
      zoom={6}
      style={{ height: '300px', width: '100%' }}
      scrollWheelZoom={false}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <FitBounds coordinates={routeCoordinates} />

      {/* Alternative Route Polylines (rendered first so they're behind) */}
      {alternativePolylines.map((positions, idx) => (
        idx !== selectedRouteIndex && (
          <Polyline
            key={`alt-${idx}`}
            positions={positions}
            pathOptions={{
              color: '#666666',
              weight: 4,
              opacity: 0.5,
              dashArray: '10, 10',
            }}
            eventHandlers={{
              click: () => onSelectRoute && onSelectRoute(idx),
            }}
          />
        )
      ))}

      {/* Selected Route Polyline */}
      <Polyline
        positions={polylinePositions}
        pathOptions={{
          color: '#00FFFF',
          weight: 5,
          opacity: 0.8,
        }}
      />

      {/* Waypoint Markers */}
      {waypoints && waypoints.map((wp, idx) => (
        <Marker
          key={idx}
          position={[wp.lat, wp.lon]}
          icon={
            idx === 0 ? startIcon :
            idx === waypoints.length - 1 ? endIcon :
            waypointIcon
          }
        >
          <Popup>
            <div style={{ fontFamily: 'VT323, monospace', fontSize: '14px' }}>
              <strong>{wp.label}</strong><br />
              {wp.locationName}<br />
              {wp.weather && (
                <>
                  {Math.round(wp.weather.temperature_2m)}°F - {getWeatherDescription(wp.weather.weather_code)}
                </>
              )}
            </div>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
};

export default RouteMap;
