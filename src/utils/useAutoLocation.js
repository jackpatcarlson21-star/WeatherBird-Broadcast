import { useState, useEffect, useRef, useCallback } from 'react';
import { haversineDistance } from './helpers';

const GPS_KEY = 'weatherbird-last-gps';
const TRACKING_KEY = 'weatherbird-auto-location';
const MOVE_THRESHOLD_MILES = 3;

const useAutoLocation = (setIsAutoDetecting, onLocationUpdate) => {
  const [trackingEnabled, setTrackingEnabled] = useState(() => {
    const stored = localStorage.getItem(TRACKING_KEY);
    return stored === null ? true : stored === 'true';
  });
  const [isTracking, setIsTracking] = useState(false);
  const inFlightRef = useRef(false);

  // Persist preference
  useEffect(() => {
    localStorage.setItem(TRACKING_KEY, String(trackingEnabled));
  }, [trackingEnabled]);

  const runCheck = useCallback(() => {
    if (!trackingEnabled || inFlightRef.current) return;
    if (!navigator.geolocation) return;

    inFlightRef.current = true;
    setIsTracking(true);
    setIsAutoDetecting(true);

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        try {
          const lastRaw = localStorage.getItem(GPS_KEY);
          const lastGps = lastRaw ? JSON.parse(lastRaw) : null;

          const moved = !lastGps ||
            haversineDistance(lastGps.lat, lastGps.lon, latitude, longitude) > MOVE_THRESHOLD_MILES;

          if (moved) {
            // Save new GPS fix
            localStorage.setItem(GPS_KEY, JSON.stringify({ lat: latitude, lon: longitude }));

            // Reverse-geocode via Nominatim
            const res = await fetch(
              `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json`,
              { headers: { 'User-Agent': 'WeatherBird-App' } }
            );
            const data = await res.json();
            const addr = data.address || {};
            const cityName = addr.city || addr.town || addr.village || addr.county || 'My Location';
            const stateName = addr.state || '';
            const displayName = stateName ? `${cityName}, ${stateName}` : cityName;

            onLocationUpdate({ name: displayName, lat: latitude, lon: longitude });
          }
        } catch (err) {
          console.error('Auto-location update failed:', err);
        } finally {
          inFlightRef.current = false;
          setIsTracking(false);
          setIsAutoDetecting(false);
        }
      },
      () => {
        // Geolocation denied/unavailable — silently fail
        inFlightRef.current = false;
        setIsTracking(false);
        setIsAutoDetecting(false);
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 }
    );
  }, [trackingEnabled, setIsAutoDetecting, onLocationUpdate]);

  // On mount — run check
  useEffect(() => {
    runCheck();
  }, [runCheck]);

  // On visibility change — run check when tab becomes visible
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        runCheck();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [runCheck]);

  return { isTracking, trackingEnabled, setTrackingEnabled };
};

export default useAutoLocation;
