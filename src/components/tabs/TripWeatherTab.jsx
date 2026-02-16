import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { MapContainer, TileLayer, Polyline, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import { Map as MapIcon, MapPin, Clock, AlertTriangle, Thermometer, Wind, Droplets, CloudRain, CloudRainWind, Zap, ArrowRight, Radio, Settings, ChevronDown, Gauge } from 'lucide-react';
import TabPanel from '../layout/TabPanel';
import LoadingIndicator from '../common/LoadingIndicator';
import { WindCompass, AnimatedWeatherIcon } from '../weather';
import { DARK_BLUE, BRIGHT_CYAN } from '../../utils/constants';
import { getWeatherApiUrl } from '../../utils/api';
import { getWeatherDescription, degreeToCardinal } from '../../utils/helpers';

// Component to fit map bounds to route
const FitBounds = ({ coordinates }) => {
  const map = useMap();
  useEffect(() => {
    if (coordinates && coordinates.length > 0) {
      const latLngs = coordinates.map(coord => [coord[1], coord[0]]);
      const bounds = L.latLngBounds(latLngs);
      map.fitBounds(bounds, { padding: [30, 30] });
    }
  }, [coordinates, map]);
  return null;
};

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

// Route Map Component
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

// Haversine distance formula (returns miles)
const haversineDistance = (lat1, lon1, lat2, lon2) => {
  const R = 3959; // Earth radius in miles
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
};

const TripWeatherTab = ({ location }) => {
  // === STATE ===
  const [destination, setDestination] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [routeData, setRouteData] = useState(null);
  const [allRoutes, setAllRoutes] = useState([]);
  const [selectedRouteIndex, setSelectedRouteIndex] = useState(0);
  const [waypointWeather, setWaypointWeather] = useState([]);
  const [isLoadingRoute, setIsLoadingRoute] = useState(false);
  const [isLoadingWeather, setIsLoadingWeather] = useState(false);
  const [error, setError] = useState(null);
  const [expandedWaypoint, setExpandedWaypoint] = useState(null);
  const [departureTime, setDepartureTime] = useState(() => {
    // Default to current local time
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  });
  const [tripSummary, setTripSummary] = useState(null);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [lastRefresh, setLastRefresh] = useState(null);
  const [showMap, setShowMap] = useState(true);
  const debounceRef = useRef(null);

  // OSRM speed correction factor (OSRM estimates are ~27% slower than real driving)
  const SPEED_CORRECTION = 1.27;
  const tripContainerRef = useRef(null);
  const autoRefreshRef = useRef(null);

  // Toggle waypoint expansion
  const toggleWaypoint = (idx) => {
    setExpandedWaypoint(expandedWaypoint === idx ? null : idx);
  };

  // Calculate trip summary from waypoint weather data
  const calculateTripSummary = (waypoints) => {
    if (!waypoints || waypoints.length === 0) return null;

    const validWaypoints = waypoints.filter(wp => wp.weather);
    if (validWaypoints.length === 0) return null;

    const temps = validWaypoints.map(wp => wp.weather.temperature_2m);
    const maxTemp = Math.max(...temps);
    const minTemp = Math.min(...temps);
    const maxTempWp = validWaypoints.find(wp => wp.weather.temperature_2m === maxTemp);
    const minTempWp = validWaypoints.find(wp => wp.weather.temperature_2m === minTemp);

    // Check for precipitation
    const precipWaypoints = validWaypoints.filter(wp =>
      wp.weather.precipitation > 0 ||
      (wp.weather.weather_code >= 51 && wp.weather.weather_code <= 99)
    );

    // Check for snow (codes 71-77, 85-86)
    const snowWaypoints = validWaypoints.filter(wp =>
      (wp.weather.weather_code >= 71 && wp.weather.weather_code <= 77) ||
      (wp.weather.weather_code >= 85 && wp.weather.weather_code <= 86)
    );

    // Check for severe weather (thunderstorms 95-99)
    const severeWaypoints = validWaypoints.filter(wp =>
      wp.weather.weather_code >= 95
    );

    // Find worst wind
    const winds = validWaypoints.map(wp => wp.weather.wind_speed_10m);
    const maxWind = Math.max(...winds);
    const maxWindWp = validWaypoints.find(wp => wp.weather.wind_speed_10m === maxWind);

    return {
      maxTemp: Math.round(maxTemp),
      minTemp: Math.round(minTemp),
      maxTempLocation: maxTempWp?.locationName || 'Unknown',
      minTempLocation: minTempWp?.locationName || 'Unknown',
      hasPrecip: precipWaypoints.length > 0,
      precipCount: precipWaypoints.length,
      hasSnow: snowWaypoints.length > 0,
      snowCount: snowWaypoints.length,
      hasSevere: severeWaypoints.length > 0,
      severeCount: severeWaypoints.length,
      maxWind: Math.round(maxWind),
      maxWindLocation: maxWindWp?.locationName || 'Unknown',
      totalWaypoints: validWaypoints.length
    };
  };

  // === GEOCODING (debounced search) ===
  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    if (searchQuery.trim().length < 2) {
      setSearchResults([]);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      setIsSearching(true);
      try {
        const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(searchQuery.trim())}&count=5&language=en&format=json`;
        const res = await fetch(url);
        if (res.ok) {
          const data = await res.json();
          setSearchResults(data.results || []);
        }
      } catch (e) {
        console.error("Destination search error:", e);
      } finally {
        setIsSearching(false);
      }
    }, 300);

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [searchQuery]);

  // Select destination from search results
  const selectDestination = (result) => {
    const displayName = result.admin1
      ? `${result.name}, ${result.admin1}`
      : result.name;
    setDestination({
      name: displayName,
      lat: result.latitude,
      lon: result.longitude
    });
    setSearchResults([]);
    setSearchQuery('');
    setError(null);
  };

  // Extract waypoints every ~50 miles from route geometry with ETA
  const extractWaypoints = (coordinates, totalDistanceMeters, totalDurationSeconds) => {
    const INTERVAL_MILES = 50;
    const totalMiles = totalDistanceMeters * 0.000621371;
    const waypoints = [];

    // Apply speed adjustment (OSRM tends to overestimate drive times)
    const adjustedDuration = totalDurationSeconds / SPEED_CORRECTION;

    const departure = new Date(departureTime);
    const totalCoords = coordinates.length;

    // Always include start point
    waypoints.push({
      lat: coordinates[0][1],
      lon: coordinates[0][0],
      distanceFromStart: 0,
      routeProgress: 0,
      label: 'Start',
      etaSeconds: 0,
      etaTime: new Date(departure)
    });

    let accumulatedDistance = 0;
    let lastWaypointDistance = 0;

    for (let i = 1; i < coordinates.length; i++) {
      const prevCoord = coordinates[i - 1];
      const currCoord = coordinates[i];

      const segmentDistance = haversineDistance(
        prevCoord[1], prevCoord[0],
        currCoord[1], currCoord[0]
      );
      accumulatedDistance += segmentDistance;

      // Add waypoint if we've traveled ~50 miles since last waypoint
      if (accumulatedDistance - lastWaypointDistance >= INTERVAL_MILES) {
        // Use coordinate index for ETA (more accurate than Haversine distance)
        const routeProgress = i / (totalCoords - 1);
        const etaSeconds = routeProgress * adjustedDuration;
        const etaTime = new Date(departure.getTime() + etaSeconds * 1000);

        // Estimate road miles based on progress
        const estimatedMiles = Math.round(routeProgress * totalMiles);

        waypoints.push({
          lat: currCoord[1],
          lon: currCoord[0],
          distanceFromStart: estimatedMiles,
          routeProgress: routeProgress,
          label: `Mile ${estimatedMiles}`,
          etaSeconds: Math.round(etaSeconds),
          etaTime: etaTime
        });
        lastWaypointDistance = accumulatedDistance;
      }
    }

    // Always include destination (if not too close to last waypoint)
    const lastCoord = coordinates[coordinates.length - 1];
    const finalMiles = Math.round(totalMiles);
    const finalEtaTime = new Date(departure.getTime() + adjustedDuration * 1000);

    if (waypoints.length === 1 || finalMiles - waypoints[waypoints.length - 1].distanceFromStart > 10) {
      waypoints.push({
        lat: lastCoord[1],
        lon: lastCoord[0],
        distanceFromStart: finalMiles,
        routeProgress: 1,
        label: 'Destination',
        etaSeconds: Math.round(adjustedDuration),
        etaTime: finalEtaTime
      });
    } else {
      // Update last waypoint to be destination
      waypoints[waypoints.length - 1].label = 'Destination';
      waypoints[waypoints.length - 1].distanceFromStart = finalMiles;
      waypoints[waypoints.length - 1].routeProgress = 1;
      waypoints[waypoints.length - 1].etaSeconds = Math.round(adjustedDuration);
      waypoints[waypoints.length - 1].etaTime = finalEtaTime;
    }

    return waypoints;
  };

  // Calculate route using OSRM (Open Source Routing Machine)
  const calculateRoute = async () => {
    if (!destination || !location) return;

    setIsLoadingRoute(true);
    setError(null);
    setRouteData(null);
    setAllRoutes([]);
    setSelectedRouteIndex(0);
    setWaypointWeather([]);

    try {
      // OSRM public demo server - request alternatives
      const response = await fetch(
        `https://router.project-osrm.org/route/v1/driving/${location.lon},${location.lat};${destination.lon},${destination.lat}?overview=full&geometries=geojson&alternatives=true`
      );

      if (!response.ok) {
        throw new Error('Failed to calculate route');
      }

      const data = await response.json();

      if (data.code === 'Ok' && data.routes && data.routes.length > 0) {
        // Process all routes
        const processedRoutes = data.routes.map((route, idx) => ({
          distance: route.distance,
          duration: route.duration,
          coordinates: route.geometry.coordinates,
          waypoints: extractWaypoints(route.geometry.coordinates, route.distance, route.duration)
        }));

        setAllRoutes(processedRoutes);
        setRouteData(processedRoutes[0]); // Select first route by default
        setTripSummary(null); // Reset summary until weather loads
      } else {
        throw new Error('No route found');
      }
    } catch (e) {
      console.error("Route calculation error:", e);
      setError("Unable to calculate route. Please try again.");
    } finally {
      setIsLoadingRoute(false);
    }
  };

  // Handle route selection change
  const selectRoute = (index) => {
    if (index >= 0 && index < allRoutes.length) {
      setSelectedRouteIndex(index);
      setRouteData(allRoutes[index]);
      setWaypointWeather([]); // Reset weather to trigger refetch
      setTripSummary(null);
    }
  };

  // Helper to find weather for a specific hour from hourly data
  const getWeatherForHour = (hourlyData, targetTime) => {
    if (!hourlyData?.time || !hourlyData.time.length) return null;

    // Find the closest hour in the forecast
    const targetHour = new Date(targetTime);
    targetHour.setMinutes(0, 0, 0);

    for (let i = 0; i < hourlyData.time.length; i++) {
      const forecastTime = new Date(hourlyData.time[i]);
      if (forecastTime >= targetHour) {
        return {
          temperature_2m: hourlyData.temperature_2m?.[i],
          precipitation_probability: hourlyData.precipitation_probability?.[i],
          precipitation: hourlyData.precipitation?.[i],
          weather_code: hourlyData.weather_code?.[i],
          wind_speed_10m: hourlyData.wind_speed_10m?.[i],
          snowfall: hourlyData.snowfall?.[i],
          forecastHour: forecastTime
        };
      }
    }
    return null;
  };

  // Fetch weather for waypoints when route is calculated
  const fetchWaypointWeather = useCallback(async (isRefresh = false) => {
    if (!routeData?.waypoints?.length) return;

    if (!isRefresh) setIsLoadingWeather(true);

    try {
      // Parallel fetch weather for all waypoints
      const weatherPromises = routeData.waypoints.map(async (waypoint) => {
        try {
          const res = await fetch(getWeatherApiUrl(waypoint.lat, waypoint.lon));
          if (res.ok) {
            const data = await res.json();
            // Get forecast for the ETA hour, fallback to current
            const forecastWeather = getWeatherForHour(data.hourly, waypoint.etaTime);
            const weather = forecastWeather ? {
              ...data.current,
              temperature_2m: forecastWeather.temperature_2m ?? data.current.temperature_2m,
              weather_code: forecastWeather.weather_code ?? data.current.weather_code,
              wind_speed_10m: forecastWeather.wind_speed_10m ?? data.current.wind_speed_10m,
              precipitation: forecastWeather.precipitation ?? data.current.precipitation,
              precipitation_probability: forecastWeather.precipitation_probability,
              isForecast: true,
              forecastHour: forecastWeather.forecastHour
            } : data.current;

            return {
              ...waypoint,
              weather: weather,
              success: true
            };
          }
          return { ...waypoint, weather: null, success: false };
        } catch {
          return { ...waypoint, weather: null, success: false };
        }
      });

      // Parallel reverse geocode each waypoint (with small delays to respect rate limits)
      // Skip geocoding on refresh since we already have location names
      const locationPromises = isRefresh && waypointWeather.length > 0
        ? Promise.resolve(waypointWeather.map(wp => wp.locationName))
        : Promise.all(routeData.waypoints.map(async (waypoint, idx) => {
            try {
              await new Promise(resolve => setTimeout(resolve, idx * 200));
              const res = await fetch(
                `https://nominatim.openstreetmap.org/reverse?lat=${waypoint.lat}&lon=${waypoint.lon}&format=json`,
                { headers: { 'User-Agent': 'WeatherBird-App' } }
              );
              if (res.ok) {
                const data = await res.json();
                const addr = data.address || {};
                // Try multiple location fields in order of preference
                const place = addr.city || addr.town || addr.village ||
                             addr.hamlet || addr.municipality || addr.suburb ||
                             addr.county || addr.road || addr.highway;
                const state = addr.state;
                if (place && state) {
                  // US state abbreviations lookup
                  const stateAbbreviations = {
                    'Alabama': 'AL', 'Alaska': 'AK', 'Arizona': 'AZ', 'Arkansas': 'AR',
                    'California': 'CA', 'Colorado': 'CO', 'Connecticut': 'CT', 'Delaware': 'DE',
                    'Florida': 'FL', 'Georgia': 'GA', 'Hawaii': 'HI', 'Idaho': 'ID',
                    'Illinois': 'IL', 'Indiana': 'IN', 'Iowa': 'IA', 'Kansas': 'KS',
                    'Kentucky': 'KY', 'Louisiana': 'LA', 'Maine': 'ME', 'Maryland': 'MD',
                    'Massachusetts': 'MA', 'Michigan': 'MI', 'Minnesota': 'MN', 'Mississippi': 'MS',
                    'Missouri': 'MO', 'Montana': 'MT', 'Nebraska': 'NE', 'Nevada': 'NV',
                    'New Hampshire': 'NH', 'New Jersey': 'NJ', 'New Mexico': 'NM', 'New York': 'NY',
                    'North Carolina': 'NC', 'North Dakota': 'ND', 'Ohio': 'OH', 'Oklahoma': 'OK',
                    'Oregon': 'OR', 'Pennsylvania': 'PA', 'Rhode Island': 'RI', 'South Carolina': 'SC',
                    'South Dakota': 'SD', 'Tennessee': 'TN', 'Texas': 'TX', 'Utah': 'UT',
                    'Vermont': 'VT', 'Virginia': 'VA', 'Washington': 'WA', 'West Virginia': 'WV',
                    'Wisconsin': 'WI', 'Wyoming': 'WY', 'District of Columbia': 'DC'
                  };
                  const stateAbbr = stateAbbreviations[state] || state;
                  return `${place}, ${stateAbbr}`;
                }
                return place || `Near ${waypoint.lat.toFixed(2)}, ${waypoint.lon.toFixed(2)}`;
              }
              return `Near ${waypoint.lat.toFixed(2)}, ${waypoint.lon.toFixed(2)}`;
            } catch {
              return `Near ${waypoint.lat.toFixed(2)}, ${waypoint.lon.toFixed(2)}`;
            }
          }));

      const [weatherResults, locationResults] = await Promise.all([
        Promise.all(weatherPromises),
        locationPromises
      ]);

      // Combine weather and location data
      const combinedResults = weatherResults.map((wr, idx) => ({
        ...wr,
        locationName: Array.isArray(locationResults) ? locationResults[idx] : locationResults[idx]
      }));

      setWaypointWeather(combinedResults);
      setTripSummary(calculateTripSummary(combinedResults));
      setLastRefresh(new Date());
    } catch (e) {
      console.error("Weather fetch error:", e);
      setError("Failed to load weather for some waypoints.");
    } finally {
      setIsLoadingWeather(false);
    }
  }, [routeData, waypointWeather]);

  // Initial weather fetch when route changes
  useEffect(() => {
    if (routeData?.waypoints?.length) {
      fetchWaypointWeather(false);
    }
  }, [routeData]);

  // Recalculate ETAs when departure time or speed adjustment changes
  useEffect(() => {
    if (routeData?.waypoints?.length && waypointWeather.length > 0) {
      const departure = new Date(departureTime);
      const adjustedDuration = routeData.duration / SPEED_CORRECTION;

      const updatedWaypoints = waypointWeather.map(wp => {
        // Calculate ETA based on route progress (0 to 1)
        const progress = wp.routeProgress ?? 0;
        const etaSeconds = progress * adjustedDuration;
        const etaTime = new Date(departure.getTime() + etaSeconds * 1000);
        return {
          ...wp,
          etaSeconds: Math.round(etaSeconds),
          etaTime: etaTime
        };
      });

      setWaypointWeather(updatedWaypoints);
    }
  }, [departureTime]);

  // Auto-refresh effect
  useEffect(() => {
    if (autoRefresh && routeData?.waypoints?.length) {
      autoRefreshRef.current = setInterval(() => {
        fetchWaypointWeather(true);
      }, 5 * 60 * 1000); // Refresh every 5 minutes
    }

    return () => {
      if (autoRefreshRef.current) {
        clearInterval(autoRefreshRef.current);
      }
    };
  }, [autoRefresh, routeData, fetchWaypointWeather]);

  // Print/Share functionality
  const handleShare = async () => {
    if (!tripSummary || !waypointWeather.length) return;

    const tripText = `Trip Weather: ${location.name} to ${destination?.name}
Departure: ${new Date(departureTime).toLocaleString()}
Distance: ${Math.round(routeData.distance * 0.000621371)} mi
Duration: ${Math.floor(routeData.duration / 3600)}h ${Math.round((routeData.duration % 3600) / 60)}m

Summary:
- Temp Range: ${tripSummary.minTemp}F to ${tripSummary.maxTemp}F
- Max Wind: ${tripSummary.maxWind} mph at ${tripSummary.maxWindLocation}
${tripSummary.hasPrecip ? `- Precipitation at ${tripSummary.precipCount} location(s)` : '- No precipitation expected'}
${tripSummary.hasSnow ? `- Snow at ${tripSummary.snowCount} location(s)` : ''}
${tripSummary.hasSevere ? `- SEVERE WEATHER at ${tripSummary.severeCount} location(s)!` : ''}

Waypoints:
${waypointWeather.map(wp => `${wp.label} (${wp.locationName}): ${wp.weather ? `${Math.round(wp.weather.temperature_2m)}F, ${getWeatherDescription(wp.weather.weather_code)}` : 'N/A'}`).join('\n')}

Generated by WeatherBird`;

    if (navigator.share) {
      try {
        await navigator.share({
          title: `Trip Weather: ${location.name} to ${destination?.name}`,
          text: tripText
        });
      } catch (e) {
        // User cancelled or share failed, copy to clipboard instead
        await navigator.clipboard.writeText(tripText);
        alert('Trip summary copied to clipboard!');
      }
    } else {
      await navigator.clipboard.writeText(tripText);
      alert('Trip summary copied to clipboard!');
    }
  };

  const handlePrint = () => {
    window.print();
  };

  // Clear trip data
  const clearTrip = () => {
    setDestination(null);
    setRouteData(null);
    setWaypointWeather([]);
    setTripSummary(null);
    setError(null);
    setAutoRefresh(false);
  };

  return (
    <TabPanel title="TRIP WEATHER">
      {/* Destination Search Section */}
      <div className="mb-6 p-4 rounded-lg" style={{ border: `2px solid ${BRIGHT_CYAN}`, backgroundColor: `${DARK_BLUE}33` }} ref={tripContainerRef}>
        <h3 className="text-xl text-white font-bold mb-3 flex items-center gap-2">
          <MapIcon size={20} style={{ color: BRIGHT_CYAN }} /> PLAN YOUR TRIP
        </h3>

        {/* Starting Location Display */}
        <div className="flex items-center gap-2 text-cyan-300 mb-3 p-2 bg-black/30 rounded">
          <MapPin size={16} />
          <span className="text-sm">FROM:</span>
          <span className="text-white font-bold">{location.name}</span>
        </div>

        {/* Destination Search */}
        <div className="relative mb-3">
          <input
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Enter destination city..."
            className="w-full p-3 text-white text-xl rounded outline-none font-vt323"
            style={{ backgroundColor: DARK_BLUE, border: `2px solid ${BRIGHT_CYAN}` }}
          />
          {isSearching && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              <div className="w-5 h-5 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin"></div>
            </div>
          )}

          {/* Autocomplete Dropdown */}
          {searchResults.length > 0 && (
            <div className="absolute z-10 w-full mt-1 rounded border-2 overflow-hidden shadow-lg max-h-60 overflow-y-auto"
                 style={{ borderColor: BRIGHT_CYAN, backgroundColor: DARK_BLUE }}>
              {searchResults.map((result, idx) => (
                <button
                  key={idx}
                  onClick={() => selectDestination(result)}
                  className="w-full p-3 text-left text-white hover:bg-cyan-900 transition border-b border-cyan-800 last:border-b-0 flex items-center gap-2"
                >
                  <MapPin size={16} className="text-cyan-400 shrink-0" />
                  <div>
                    <span className="font-bold">{result.name}</span>
                    {result.admin1 && <span className="text-cyan-400">, {result.admin1}</span>}
                    {result.country && <span className="text-cyan-500 text-sm ml-2">({result.country})</span>}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Departure Time Picker */}
        <div className="flex flex-wrap items-center gap-3 mb-3">
          <div className="flex items-center gap-2 text-cyan-300 p-2 bg-black/30 rounded">
            <Clock size={16} />
            <span className="text-sm">DEPART:</span>
            <input
              type="datetime-local"
              value={departureTime}
              onChange={e => setDepartureTime(e.target.value)}
              className="bg-transparent text-white font-bold outline-none font-vt323 text-lg"
              style={{ colorScheme: 'dark' }}
            />
          </div>
        </div>

        {/* Selected Destination & Calculate Button */}
        {destination && (
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 text-cyan-300 p-2 bg-black/30 rounded flex-grow">
              <MapPin size={16} />
              <span className="text-sm">TO:</span>
              <span className="text-white font-bold">{destination.name}</span>
            </div>
            <button
              onClick={calculateRoute}
              disabled={isLoadingRoute}
              className="px-4 py-2 text-black font-bold rounded hover:bg-cyan-300 transition disabled:opacity-50 font-vt323 text-lg"
              style={{ backgroundColor: BRIGHT_CYAN }}
            >
              {isLoadingRoute ? 'CALCULATING...' : 'GET WEATHER'}
            </button>
            {routeData && (
              <button
                onClick={clearTrip}
                className="px-4 py-2 text-cyan-400 font-bold rounded hover:bg-white/10 transition font-vt323 text-lg border border-cyan-600"
              >
                CLEAR
              </button>
            )}
          </div>
        )}
      </div>

      {/* Error Display */}
      {error && (
        <div className="bg-red-900/50 border border-red-400 p-3 rounded flex items-center gap-2 mb-4">
          <AlertTriangle size={20} className="text-red-400" />
          <p className="text-red-300">{error}</p>
        </div>
      )}

      {/* Route Selection */}
      {allRoutes.length > 1 && (
        <div className="mb-4 p-3 bg-black/30 rounded border border-cyan-700">
          <p className="text-sm text-cyan-400 mb-2 text-center">SELECT ROUTE ({allRoutes.length} options available)</p>
          <div className="flex flex-wrap gap-2 justify-center">
            {allRoutes.map((route, idx) => (
              <button
                key={idx}
                onClick={() => selectRoute(idx)}
                className={`px-4 py-2 rounded border transition-all ${
                  idx === selectedRouteIndex
                    ? 'bg-cyan-600 border-cyan-400 text-white'
                    : 'bg-black/30 border-gray-600 text-gray-300 hover:border-cyan-500 hover:text-cyan-400'
                }`}
              >
                <div className="text-sm font-bold">Route {idx + 1}</div>
                <div className="text-xs opacity-80">
                  {Math.round(route.distance * 0.000621371)} mi - {Math.floor((route.duration / SPEED_CORRECTION) / 3600)}h {Math.round(((route.duration / SPEED_CORRECTION) % 3600) / 60)}m
                </div>
              </button>
            ))}
          </div>
          <p className="text-xs text-cyan-600 mt-2 text-center">You can also click alternate routes on the map</p>
        </div>
      )}

      {/* Route Summary */}
      {routeData && (
        <div className="mb-4 p-3 bg-black/30 rounded border border-cyan-700">
          <div className="flex flex-wrap gap-4 justify-center text-center mb-3">
            <div>
              <p className="text-sm text-cyan-400">TOTAL DISTANCE</p>
              <p className="text-2xl font-bold text-white">{Math.round(routeData.distance * 0.000621371)} mi</p>
            </div>
            <div>
              <p className="text-sm text-cyan-400">EST. DRIVE TIME</p>
              <p className="text-2xl font-bold text-white">
                {Math.floor((routeData.duration / SPEED_CORRECTION) / 3600)}h {Math.round(((routeData.duration / SPEED_CORRECTION) % 3600) / 60)}m
              </p>
            </div>
            <div>
              <p className="text-sm text-cyan-400">WAYPOINTS</p>
              <p className="text-2xl font-bold text-white">{routeData.waypoints.length}</p>
            </div>
            <div>
              <p className="text-sm text-cyan-400">ARRIVAL</p>
              <p className="text-2xl font-bold text-white">
                {new Date(new Date(departureTime).getTime() + (routeData.duration / SPEED_CORRECTION) * 1000).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Trip Summary - Weather Overview */}
      {tripSummary && (
        <div className="mb-4 p-4 rounded-lg border-2 border-cyan-600 bg-gradient-to-r from-cyan-900/30 to-blue-900/30">
          <h4 className="text-lg font-bold text-cyan-300 mb-3 flex items-center gap-2">
            <Zap size={18} /> TRIP WEATHER SUMMARY
          </h4>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {/* Temp Range */}
            <div className="bg-black/30 rounded p-3 text-center">
              <p className="text-xs text-cyan-500 mb-1">TEMP RANGE</p>
              <p className="text-xl font-bold text-white">{tripSummary.minTemp}°F - {tripSummary.maxTemp}°F</p>
            </div>

            {/* Hottest */}
            <div className="bg-black/30 rounded p-3 text-center">
              <p className="text-xs text-orange-400 mb-1 flex items-center justify-center gap-1">
                <Thermometer size={12} /> HOTTEST
              </p>
              <p className="text-lg font-bold text-orange-300">{tripSummary.maxTemp}°F</p>
              <p className="text-xs text-cyan-600 truncate">{tripSummary.maxTempLocation}</p>
            </div>

            {/* Coldest */}
            <div className="bg-black/30 rounded p-3 text-center">
              <p className="text-xs text-blue-400 mb-1 flex items-center justify-center gap-1">
                <Thermometer size={12} /> COLDEST
              </p>
              <p className="text-lg font-bold text-blue-300">{tripSummary.minTemp}°F</p>
              <p className="text-xs text-cyan-600 truncate">{tripSummary.minTempLocation}</p>
            </div>

            {/* Max Wind */}
            <div className="bg-black/30 rounded p-3 text-center">
              <p className="text-xs text-cyan-500 mb-1 flex items-center justify-center gap-1">
                <Wind size={12} /> MAX WIND
              </p>
              <p className="text-lg font-bold text-white">{tripSummary.maxWind} mph</p>
              <p className="text-xs text-cyan-600 truncate">{tripSummary.maxWindLocation}</p>
            </div>

            {/* Precipitation Alert */}
            {tripSummary.hasPrecip && (
              <div className="bg-blue-900/40 rounded p-3 text-center border border-blue-500">
                <p className="text-xs text-blue-300 mb-1 flex items-center justify-center gap-1">
                  <CloudRain size={12} /> PRECIPITATION
                </p>
                <p className="text-lg font-bold text-blue-200">{tripSummary.precipCount} location(s)</p>
              </div>
            )}

            {/* Snow Alert */}
            {tripSummary.hasSnow && (
              <div className="bg-purple-900/40 rounded p-3 text-center border border-purple-400">
                <p className="text-xs text-purple-300 mb-1 flex items-center justify-center gap-1">
                  <CloudRainWind size={12} /> SNOW
                </p>
                <p className="text-lg font-bold text-purple-200">{tripSummary.snowCount} location(s)</p>
              </div>
            )}

            {/* Severe Weather Alert */}
            {tripSummary.hasSevere && (
              <div className="bg-red-900/50 rounded p-3 text-center border-2 border-red-500 col-span-2">
                <p className="text-xs text-red-300 mb-1 flex items-center justify-center gap-1">
                  <AlertTriangle size={12} /> SEVERE WEATHER
                </p>
                <p className="text-lg font-bold text-red-200">{tripSummary.severeCount} location(s) - USE CAUTION!</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Controls: Auto-refresh, Map Toggle, Share/Print */}
      {routeData && waypointWeather.length > 0 && (
        <div className="mb-4 flex flex-wrap items-center gap-3">
          {/* Auto Refresh Toggle */}
          <button
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={`px-3 py-2 rounded font-vt323 text-sm flex items-center gap-2 transition ${
              autoRefresh ? 'bg-green-600 text-white' : 'bg-black/30 text-cyan-400 border border-cyan-600'
            }`}
          >
            <Radio size={14} />
            {autoRefresh ? 'AUTO-REFRESH ON' : 'AUTO-REFRESH OFF'}
          </button>

          {/* Map Toggle */}
          <button
            onClick={() => setShowMap(!showMap)}
            className={`px-3 py-2 rounded font-vt323 text-sm flex items-center gap-2 transition ${
              showMap ? 'bg-cyan-700 text-white' : 'bg-black/30 text-cyan-400 border border-cyan-600'
            }`}
          >
            <MapIcon size={14} />
            {showMap ? 'HIDE MAP' : 'SHOW MAP'}
          </button>

          {/* Share Button */}
          <button
            onClick={handleShare}
            className="px-3 py-2 rounded font-vt323 text-sm flex items-center gap-2 bg-black/30 text-cyan-400 border border-cyan-600 hover:bg-cyan-900 transition"
          >
            <ArrowRight size={14} />
            SHARE
          </button>

          {/* Print Button */}
          <button
            onClick={handlePrint}
            className="px-3 py-2 rounded font-vt323 text-sm flex items-center gap-2 bg-black/30 text-cyan-400 border border-cyan-600 hover:bg-cyan-900 transition"
          >
            <Settings size={14} />
            PRINT
          </button>

          {/* Last Refresh Time */}
          {lastRefresh && (
            <span className="text-xs text-cyan-600 ml-auto">
              Updated: {lastRefresh.toLocaleTimeString()}
            </span>
          )}
        </div>
      )}

      {/* Embedded Route Map with Highlighted Route */}
      {routeData && showMap && (
        <div className="mb-4 rounded-lg overflow-hidden border-2 border-cyan-700">
          <RouteMap
            routeCoordinates={routeData.coordinates}
            waypoints={waypointWeather.length > 0 ? waypointWeather : routeData.waypoints}
            startName={location.name}
            endName={destination.name}
            alternativeRoutes={allRoutes}
            selectedRouteIndex={selectedRouteIndex}
            onSelectRoute={selectRoute}
          />
          <div className="bg-black/50 p-2 text-center text-xs text-cyan-500 flex flex-wrap items-center justify-center gap-4">
            <span className="flex items-center gap-1">
              <span className="w-3 h-3 rounded-full bg-green-500 inline-block"></span> Start
            </span>
            <span className="flex items-center gap-1">
              <span className="w-3 h-3 rounded-full bg-cyan-400 inline-block"></span> Waypoints
            </span>
            <span className="flex items-center gap-1">
              <span className="w-3 h-3 rounded-full bg-red-500 inline-block"></span> Destination
            </span>
            {allRoutes.length > 1 && (
              <span className="flex items-center gap-1">
                <span className="w-4 h-0.5 bg-gray-500 inline-block" style={{borderBottom: '2px dashed #666'}}></span> Alt Routes
              </span>
            )}
            <span className="text-cyan-600">| Click markers for weather</span>
          </div>
        </div>
      )}

      {/* Loading Weather */}
      {isLoadingWeather && <LoadingIndicator />}

      {/* Waypoint Weather Timeline */}
      {waypointWeather.length > 0 && !isLoadingWeather && (
        <div className="space-y-3">
          {waypointWeather.map((wp, idx) => (
            <div key={idx}
                 className={`rounded-lg border-2 overflow-hidden ${
                   idx === 0 ? 'border-green-500 bg-green-900/20' :
                   idx === waypointWeather.length - 1 ? 'border-red-500 bg-red-900/20' :
                   'border-cyan-700 bg-black/30'
                 }`}>
              {/* Main Row - Clickable */}
              <button
                onClick={() => wp.weather && toggleWaypoint(idx)}
                className={`w-full p-4 flex flex-wrap items-center gap-4 text-left ${wp.weather ? 'cursor-pointer hover:bg-white/5' : 'cursor-default'} transition`}
              >
                {/* Mile Marker & ETA */}
                <div className="text-center min-w-[100px]">
                  <p className="text-sm text-cyan-400 font-bold">{wp.label}</p>
                  {wp.distanceFromStart > 0 && wp.label !== 'Destination' && (
                    <p className="text-xs text-cyan-600">{wp.distanceFromStart} mi</p>
                  )}
                  {wp.etaTime && (
                    <p className="text-xs text-yellow-400 mt-1 flex items-center justify-center gap-1">
                      <Clock size={10} />
                      {new Date(wp.etaTime).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                    </p>
                  )}
                </div>

                {/* Location Name */}
                <div className="flex-grow min-w-[150px]">
                  <p className="text-white font-bold text-lg">{wp.locationName}</p>
                  {wp.weather?.isForecast && (
                    <p className="text-xs text-yellow-500">Forecast for arrival</p>
                  )}
                </div>

                {/* Weather Data */}
                {wp.weather ? (
                  <div className="flex items-center gap-4 text-center">
                    <div>
                      <AnimatedWeatherIcon code={wp.weather.weather_code} night={false} size={34} />
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-white">{Math.round(wp.weather.temperature_2m)}°F</p>
                      <p className="text-xs text-cyan-400">{getWeatherDescription(wp.weather.weather_code)}</p>
                    </div>
                    <div className="text-xs text-cyan-400">
                      <p className="flex items-center gap-1"><Wind size={12} />{Math.round(wp.weather.wind_speed_10m)} mph</p>
                      <p className="flex items-center gap-1"><Droplets size={12} />{wp.weather.relative_humidity_2m}%</p>
                    </div>
                    {/* Expand/Collapse Indicator */}
                    <div className={`transition-transform duration-200 ${expandedWaypoint === idx ? 'rotate-180' : ''}`}>
                      <ChevronDown size={20} className="text-cyan-400" />
                    </div>
                  </div>
                ) : (
                  <p className="text-cyan-500 text-sm">Weather unavailable</p>
                )}
              </button>

              {/* Expanded Details */}
              {expandedWaypoint === idx && wp.weather && (
                <div className="px-4 pb-4 pt-2 border-t border-cyan-800/50 bg-black/20">
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                    {/* Feels Like */}
                    <div className="bg-black/30 rounded p-3 text-center">
                      <p className="text-xs text-cyan-500 mb-1 flex items-center justify-center gap-1">
                        <Thermometer size={12} /> FEELS LIKE
                      </p>
                      <p className="text-xl font-bold text-white">{Math.round(wp.weather.apparent_temperature)}°F</p>
                    </div>

                    {/* Wind Direction */}
                    <div className="bg-black/30 rounded p-3 text-center flex flex-col items-center">
                      <WindCompass degrees={wp.weather.wind_direction_10m} size={36} />
                      <p className="text-sm font-bold text-white mt-1">{degreeToCardinal(wp.weather.wind_direction_10m)}</p>
                      <p className="text-xs text-cyan-600">{Math.round(wp.weather.wind_direction_10m)}°</p>
                    </div>

                    {/* Wind Gusts */}
                    <div className="bg-black/30 rounded p-3 text-center">
                      <p className="text-xs text-cyan-500 mb-1 flex items-center justify-center gap-1">
                        <Wind size={12} /> GUSTS
                      </p>
                      <p className="text-xl font-bold text-white">{Math.round(wp.weather.wind_gusts_10m)} mph</p>
                    </div>

                    {/* Humidity */}
                    <div className="bg-black/30 rounded p-3 text-center">
                      <p className="text-xs text-cyan-500 mb-1 flex items-center justify-center gap-1">
                        <Droplets size={12} /> HUMIDITY
                      </p>
                      <p className="text-xl font-bold text-white">{wp.weather.relative_humidity_2m}%</p>
                    </div>

                    {/* Precipitation */}
                    <div className="bg-black/30 rounded p-3 text-center">
                      <p className="text-xs text-cyan-500 mb-1 flex items-center justify-center gap-1">
                        <CloudRain size={12} /> PRECIP
                      </p>
                      <p className="text-xl font-bold text-white">{wp.weather.precipitation} in</p>
                    </div>

                    {/* Pressure */}
                    <div className="bg-black/30 rounded p-3 text-center">
                      <p className="text-xs text-cyan-500 mb-1 flex items-center justify-center gap-1">
                        <Gauge size={12} /> PRESSURE
                      </p>
                      <p className="text-xl font-bold text-white">{(wp.weather.pressure_msl * 0.02953).toFixed(2)} in</p>
                    </div>

                    {/* Coordinates */}
                    <div className="bg-black/30 rounded p-3 text-center col-span-2 sm:col-span-1 md:col-span-2">
                      <p className="text-xs text-cyan-500 mb-1 flex items-center justify-center gap-1">
                        <MapPin size={12} /> COORDINATES
                      </p>
                      <p className="text-sm font-bold text-white">{wp.lat.toFixed(4)}, {wp.lon.toFixed(4)}</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Empty State */}
      {!destination && !routeData && (
        <div className="text-center py-12">
          <ArrowRight size={48} className="mx-auto mb-4 text-cyan-600" />
          <p className="text-xl text-cyan-300">Enter a destination above to see weather along your route</p>
          <p className="text-sm text-cyan-500 mt-2">Weather will be shown approximately every 50 miles</p>
        </div>
      )}
    </TabPanel>
  );
};

export default TripWeatherTab;
