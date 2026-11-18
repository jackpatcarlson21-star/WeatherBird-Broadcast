import React, { useState, useEffect, useRef, useCallback, useMemo, lazy, Suspense } from 'react';
import { AlertTriangle, X, Clock } from 'lucide-react';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

// Fix for default marker icons in Leaflet with webpack/vite — bundled locally so they work offline
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

// Firebase

// Constants and utilities
import { SCREENS, NAV_TABS, INITIAL_LOCATION, MUSIC_URL, REFRESH_RATE_MS, NAVY_BLUE, getBroadcastSeconds, buildBroadcastPlaylist } from './utils/constants';
import { getWeatherApiUrl, getAirQualityUrl, getNWSAlertsUrl, getNWSPointsUrl } from './utils/api';
import { isNight, getSevereAlertLevel, getSevereAlerts, getTornadoWarnings, getExpirationCountdown } from './utils/helpers';
import useAutoLocation from './utils/useAutoLocation';

// Components
import { Header, Footer, Scanlines, TabNavigation, CRTPowerOn } from './components/layout';
import { AppStatus, LocationModal, SettingsModal, ErrorBoundary, LoadingIndicator } from './components/common';
import { WeatherBackground } from './components/weather';
const IconTestPage = lazy(() => import('./components/weather/IconTestPage'));

// Tabs are lazy-loaded so the initial bundle stays small; each chunk is fetched on first visit
const AlertsTab = lazy(() => import('./components/tabs/AlertsTab'));
const CurrentConditionsTab = lazy(() => import('./components/tabs/CurrentConditionsTab'));
const HourlyForecastTab = lazy(() => import('./components/tabs/HourlyForecastTab'));
const DailyOutlookTab = lazy(() => import('./components/tabs/DailyOutlookTab'));
const RadarTab = lazy(() => import('./components/tabs/RadarTab'));
const WWADisplayTab = lazy(() => import('./components/tabs/WWADisplayTab'));
const SPCOutlookTab = lazy(() => import('./components/tabs/SPCOutlookTab'));
const PrecipGraphTab = lazy(() => import('./components/tabs/PrecipGraphTab'));
const AlmanacTab = lazy(() => import('./components/tabs/AlmanacTab'));
const TripWeatherTab = lazy(() => import('./components/tabs/TripWeatherTab'));
const HurricaneTab = lazy(() => import('./components/tabs/HurricaneTab'));
const ModelComparisonTab = lazy(() => import('./components/tabs/ModelComparisonTab'));
const GardenTab = lazy(() => import('./components/tabs/GardenTab'));
const SatelliteTab = lazy(() => import('./components/tabs/SatelliteTab'));


// Cached API snapshots let the app open instantly (and offline) with the last known data
const CACHE_MAX_AGE_MS = 3 * 60 * 60 * 1000;
const readCache = (key) => {
  try {
    const cached = JSON.parse(localStorage.getItem(key));
    if (!cached || Date.now() - cached.timestamp > CACHE_MAX_AGE_MS) return null;
    return cached.data;
  } catch { return null; }
};
const writeCache = (key, data) => {
  try {
    localStorage.setItem(key, JSON.stringify({ data, timestamp: Date.now() }));
  } catch { /* storage full or unavailable — cache is best-effort */ }
};

// The last location the user picked (or GPS found), so a reload doesn't snap
// back to the default town.
const LOCATION_KEY = 'weatherbird-location';
const readSavedLocation = () => {
  try {
    const saved = JSON.parse(localStorage.getItem(LOCATION_KEY));
    const lat = parseFloat(saved?.lat);
    const lon = parseFloat(saved?.lon);
    if (Number.isFinite(lat) && Number.isFinite(lon)) {
      return { name: saved.name || 'My Location', lat, lon };
    }
  } catch { /* corrupt or unavailable — fall through */ }
  return INITIAL_LOCATION;
};

// Keyboard navigation steps through the sidebar tabs in the order shown.
const NAV_ORDER = NAV_TABS.map(t => t.id);

const App = () => {
  // --- State Hooks ---
  const [location, setLocation] = useState(readSavedLocation);
  const [weatherData, setWeatherData] = useState(() => readCache('weatherbird-weather-cache'));
  const [aqiData, setAqiData] = useState(() => readCache('weatherbird-aqi-cache'));
  const [isStaleData, setIsStaleData] = useState(() => !!readCache('weatherbird-weather-cache'));
  const [alerts, setAlerts] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [appError, setAppError] = useState(null);
  const [time, setTime] = useState(new Date());
  const [isModalOpen, setIsModalOpen] = useState(() => !localStorage.getItem('weatherbird-location-set'));
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [units, setUnits] = useState(() => {
    try {
      const saved = localStorage.getItem('weatherbird-units');
      return saved ? JSON.parse(saved) : { temp: 'F', wind: 'mph' };
    } catch { return { temp: 'F', wind: 'mph' }; }
  });
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(0.5);
  const [currentScreen, setCurrentScreen] = useState(SCREENS.CONDITIONS);
  const [autoCycle, setAutoCycle] = useState(false);
  const [cycleSpeed, setCycleSpeed] = useState(1); // multiplier on BROADCAST_SECONDS
  const [dismissedAlertIds, setDismissedAlertIds] = useState(new Set());
  const [dismissedTornadoModals, setDismissedTornadoModals] = useState(new Set());
  const [showAlertFlash, setShowAlertFlash] = useState(false);

  const [crtDone, setCrtDone] = useState(false);
  const lastAlertIdsRef = useRef('');
  const autoCycleRef = useRef(autoCycle);
  autoCycleRef.current = autoCycle;

  // --- Broadcast Playlist ---
  const hasAlerts = alerts.length > 0;
  const hasWarning = getSevereAlertLevel(alerts) === 'warning';
  const broadcastPlaylist = useMemo(
    () => buildBroadcastPlaylist({ hasAlerts, hasWarning }),
    [hasAlerts, hasWarning]
  );
  const screenDurationMs = getBroadcastSeconds(currentScreen) * cycleSpeed * 1000;

  // Turning the broadcast on from a screen that isn't in the loop starts it at the top
  const setBroadcast = (on) => {
    setAutoCycle(on);
    if (on) setCurrentScreen(cur => (broadcastPlaylist.includes(cur) ? cur : broadcastPlaylist[0]));
  };

  // --- Alert Flash Timeout ---
  useEffect(() => {
    const activeAlerts = alerts.filter(a => !dismissedAlertIds.has(a.properties?.id));
    const severeLevel = getSevereAlertLevel(activeAlerts);
    const currentAlertIds = activeAlerts.map(a => a.properties?.id).sort().join(',');

    if (severeLevel && currentAlertIds !== lastAlertIdsRef.current) {
      lastAlertIdsRef.current = currentAlertIds;
      setShowAlertFlash(true);
      // A new warning interrupts the broadcast, like a real weather channel would
      if (severeLevel === 'warning' && autoCycleRef.current) setCurrentScreen(SCREENS.ALERTS);
      const timeout = setTimeout(() => setShowAlertFlash(false), 3000);
      return () => clearTimeout(timeout);
    }
  }, [alerts, dismissedAlertIds]);

  // --- Auto-Cycle Effect ---
  // Each screen gets its own time on air; a screen outside the loop (e.g. the
  // alert screens after the alerts expire) hands off to the top of the loop.
  useEffect(() => {
    if (!autoCycle) return;

    const timeout = setTimeout(() => {
      setCurrentScreen(current => {
        const i = broadcastPlaylist.indexOf(current);
        return broadcastPlaylist[(i + 1) % broadcastPlaylist.length];
      });
    }, screenDurationMs);

    return () => clearTimeout(timeout);
  }, [autoCycle, currentScreen, broadcastPlaylist, screenDurationMs]);

  // --- Keyboard Navigation ---
  //   ← / →          previous / next screen
  //   Home / End     first / last screen
  //   ↑ / ↓          scroll the current screen a little
  //   PgUp / PgDn    scroll the current screen by a page
  //   Esc            close the settings / location modal
  useEffect(() => {
    const isTypingTarget = (el) =>
      el instanceof HTMLElement &&
      (el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName));

    const goToScreen = (pick) => {
      setAutoCycle(false); // manual navigation takes over, same as clicking a tab
      setCurrentScreen(current => {
        // -1 when auto-cycle left us on a screen with no sidebar tab (PRECIP/WWA)
        const next = pick(NAV_ORDER.indexOf(current));
        if (next === SCREENS.ALERTS) setShowAlertFlash(false);
        return next;
      });
    };

    const scrollContent = (amount) => {
      contentRef.current?.scrollBy({ top: amount, behavior: 'smooth' });
    };

    const handleKeyDown = (e) => {
      if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey) return;

      if (e.key === 'Escape') {
        if (isSettingsOpen) setIsSettingsOpen(false);
        else if (isModalOpen) setIsModalOpen(false);
        return;
      }

      // Leave keys alone while a modal is open, the user is typing, or a
      // Leaflet map has focus (it uses the arrow keys to pan).
      if (isSettingsOpen || isModalOpen) return;
      if (isTypingTarget(e.target)) return;
      if (e.target instanceof Element && e.target.closest('.leaflet-container')) return;

      const n = NAV_ORDER.length;
      const page = (contentRef.current?.clientHeight ?? 400) * 0.85;

      switch (e.key) {
        case 'ArrowRight': goToScreen(i => NAV_ORDER[(i + 1) % n]); break;
        case 'ArrowLeft':  goToScreen(i => NAV_ORDER[i < 0 ? n - 1 : (i - 1 + n) % n]); break;
        case 'Home':       goToScreen(() => NAV_ORDER[0]); break;
        case 'End':        goToScreen(() => NAV_ORDER[n - 1]); break;
        case 'ArrowDown':  scrollContent(80); break;
        case 'ArrowUp':    scrollContent(-80); break;
        case 'PageDown':   scrollContent(page); break;
        case 'PageUp':     scrollContent(-page); break;
        default: return;
      }
      e.preventDefault();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isSettingsOpen, isModalOpen]);

  // --- Auto-Scroll Effect (scrolls content panel during auto-cycle) ---
  // Position is driven by elapsed time rather than per-frame steps, so it runs at
  // the same speed on 60Hz and 120Hz screens, and the scroll height is re-read
  // every frame so content that loads late (lazy tabs, images) still gets shown.
  useEffect(() => {
    if (!autoCycle) return;

    if (contentRef.current) contentRef.current.scrollTop = 0;

    const pauseMs = 2000;     // hold at the top before scrolling
    const endBufferMs = 1000; // hold at the bottom before the next screen
    const scrollMs = Math.max(1000, screenDurationMs - pauseMs - endBufferMs);
    const start = performance.now();
    let animationId;

    const scroll = (now) => {
      const progress = Math.min(1, Math.max(0, (now - start - pauseMs) / scrollMs));
      const el = contentRef.current;
      if (el) {
        const scrollable = el.scrollHeight - el.clientHeight;
        // Screens can mark one element (e.g. the radar map) with data-broadcast-focus;
        // it's held centered instead of scrolling past it. Re-centered every frame
        // so it stays put while images load in.
        const focus = el.querySelector('[data-broadcast-focus]');
        if (focus) {
          const box = el.getBoundingClientRect();
          const f = focus.getBoundingClientRect();
          const target = el.scrollTop + (f.top - box.top) - (box.height - f.height) / 2;
          el.scrollTop = Math.min(Math.max(0, target), Math.max(0, scrollable));
        } else if (scrollable > 0) {
          el.scrollTop = scrollable * progress;
        }
      }
      if (progress < 1) animationId = requestAnimationFrame(scroll);
    };
    animationId = requestAnimationFrame(scroll);

    return () => cancelAnimationFrame(animationId);
  }, [autoCycle, currentScreen, screenDurationMs]);


  const [savedLocations, setSavedLocations] = useState(() => {
    try {
      const saved = localStorage.getItem('weatherbird-saved-locations');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // --- Saved Locations Handlers ---
  const saveLocation = (loc) => {
    const exists = savedLocations.some(
      saved => Math.abs(saved.lat - loc.lat) < 0.01 && Math.abs(saved.lon - loc.lon) < 0.01
    );
    if (exists) return;

    const newSaved = [...savedLocations, { ...loc, id: Date.now() }];
    setSavedLocations(newSaved);
    localStorage.setItem('weatherbird-saved-locations', JSON.stringify(newSaved));
  };

  const deleteLocation = (id) => {
    const newSaved = savedLocations.filter(loc => loc.id !== id);
    setSavedLocations(newSaved);
    localStorage.setItem('weatherbird-saved-locations', JSON.stringify(newSaved));
  };

  // --- Auto-Location Detection ---
  const [isAutoDetecting, setIsAutoDetecting] = useState(false);

  // --- Refs ---
  const audioRef = useRef(null);
  const weatherIntervalRef = useRef(null);
  const contentRef = useRef(null);
  const hasWeatherDataRef = useRef(!!weatherData);
  const lastFetchTimeRef = useRef(0);

  // --- Clock and Music Handler ---
  useEffect(() => {
    // Slow tick (60s) - only used for isNight; Header has its own 1s clock
    const clockTick = setInterval(() => setTime(new Date()), 60000);
    return () => clearInterval(clockTick);
  }, []);

  useEffect(() => {
    if (!audioRef.current) {
      audioRef.current = new Audio(MUSIC_URL);
      audioRef.current.loop = true;
    }
    audioRef.current.volume = volume;
  }, [volume]);

  const toggleMusic = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play().catch(e => console.error("Audio playback failed:", e));
    }
    setIsPlaying(prev => !prev);
  };

  // --- Weather Fetching Logic ---
  const fetchWeather = useCallback(async (loc) => {
    if (!loc.lat || !loc.lon) return;

    setIsLoading(true);
    setAppError(null);
    try {
      const url = getWeatherApiUrl(loc.lat, loc.lon);
      const response = await fetch(url);
      if (!response.ok) throw new Error(`API returned status ${response.status}`);
      const data = await response.json();
      setWeatherData(data);
      hasWeatherDataRef.current = true;
      lastFetchTimeRef.current = Date.now();
      setIsStaleData(false);
      writeCache('weatherbird-weather-cache', data);
      console.log("Weather data fetched successfully.", data);
    } catch (error) {
      console.error("Weather fetching failed:", error);
      // Keep showing the last good data on a failed refresh; only error out if we have nothing
      if (hasWeatherDataRef.current) {
        setIsStaleData(true);
      } else {
        setAppError(`Failed to fetch weather data for ${loc.name}. Check coordinates.`);
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  // --- AQI Fetching Logic ---
  const fetchAQI = useCallback(async (loc) => {
    if (!loc.lat || !loc.lon) return;

    try {
      const url = getAirQualityUrl(loc.lat, loc.lon);
      const response = await fetch(url);
      if (!response.ok) throw new Error(`AQI API returned status ${response.status}`);
      const data = await response.json();
      setAqiData(data);
      writeCache('weatherbird-aqi-cache', data);
      console.log("AQI data fetched successfully.", data);
    } catch (error) {
      // Keep the last known AQI on a failed refresh
      console.error("AQI fetching failed:", error);
    }
  }, []);

  // --- Alert Fetching Logic ---
  const fetchAlerts = useCallback(async () => {
    if (!location.lat || !location.lon) return;

    console.log("Fetching alerts for:", location.name, location.lat, location.lon);

    try {
      const pointsRes = await fetch(getNWSPointsUrl(location.lat, location.lon), {
        headers: { 'User-Agent': 'WeatherBird App' }
      });

      if (pointsRes.ok) {
        const pointsData = await pointsRes.json();
        const county = pointsData.properties?.county;
        const forecastZone = pointsData.properties?.forecastZone;

        console.log("County:", county, "Zone:", forecastZone);

        const alertPromises = [];

        if (county) {
          const countyCode = county.split('/').pop();
          alertPromises.push(
            fetch(`https://api.weather.gov/alerts/active?zone=${countyCode}`, {
              headers: { 'User-Agent': 'WeatherBird App' }
            }).then(r => r.ok ? r.json() : { features: [] })
          );
        }

        if (forecastZone) {
          const zoneCode = forecastZone.split('/').pop();
          alertPromises.push(
            fetch(`https://api.weather.gov/alerts/active?zone=${zoneCode}`, {
              headers: { 'User-Agent': 'WeatherBird App' }
            }).then(r => r.ok ? r.json() : { features: [] })
          );
        }

        alertPromises.push(
          fetch(getNWSAlertsUrl(location.lat, location.lon), {
            headers: { 'User-Agent': 'WeatherBird App' }
          }).then(r => r.ok ? r.json() : { features: [] })
        );

        const results = await Promise.all(alertPromises);

        const allAlerts = results.flatMap(r => r.features || []);
        const uniqueAlerts = Array.from(
          new Map(allAlerts.map(a => [a.properties?.id, a])).values()
        );

        console.log("Found alerts:", uniqueAlerts.length);
        setAlerts(uniqueAlerts);
      } else {
        const res = await fetch(getNWSAlertsUrl(location.lat, location.lon));
        if (res.ok) {
          const data = await res.json();
          setAlerts(data.features || []);
        }
      }
    } catch (err) {
      console.error("Alert fetch error:", err);
    }
  }, [location.lat, location.lon, location.name]);

  useEffect(() => {
    if (location.lat && location.lon) {
      fetchAlerts();
    }

    const alertInterval = setInterval(() => {
      if (document.hidden) return; // don't poll while the tab is in the background
      if (location.lat && location.lon) fetchAlerts();
    }, 120000);

    return () => clearInterval(alertInterval);
  }, [location.lat, location.lon, fetchAlerts]);

  // --- Fetch Weather on Location Change & Set Interval ---
  useEffect(() => {
    if (weatherIntervalRef.current) {
      clearInterval(weatherIntervalRef.current);
    }

    fetchWeather(location);
    fetchAQI(location);

    weatherIntervalRef.current = setInterval(() => {
      if (document.hidden) return; // don't poll while the tab is in the background
      fetchWeather(location);
      fetchAQI(location);
    }, REFRESH_RATE_MS);

    return () => {
      if (weatherIntervalRef.current) clearInterval(weatherIntervalRef.current);
    };
  }, [location, fetchWeather, fetchAQI]);

  // --- Catch-Up Refresh on Return to Tab ---
  useEffect(() => {
    const handleVisibility = () => {
      if (document.hidden) return;
      // Skipped polls while hidden — refresh now if the data is over a minute old
      if (Date.now() - lastFetchTimeRef.current < 60000) return;
      fetchWeather(location);
      fetchAQI(location);
      fetchAlerts();
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [location, fetchWeather, fetchAQI, fetchAlerts]);

  // --- Location Save Handler ---
  const handleUnitsChange = (newUnits) => {
    setUnits(newUnits);
    localStorage.setItem('weatherbird-units', JSON.stringify(newUnits));
  };

  const handleLocationSave = useCallback((newLoc) => {
    localStorage.setItem('weatherbird-location-set', '1');
    try {
      localStorage.setItem(LOCATION_KEY, JSON.stringify(newLoc));
    } catch { /* storage unavailable — location just won't survive a reload */ }
    setIsModalOpen(false);
    setLocation(newLoc); // the location effect below refetches weather and alerts
  }, []);

  // --- Auto-Location Hook ---
  const { isTracking, trackingEnabled, setTrackingEnabled } = useAutoLocation(
    setIsAutoDetecting,
    handleLocationSave
  );

  // Icon test page: append ?icontest to URL (lazy-loaded, not in production bundle)
  if (window.location.search.includes('icontest')) {
    return <Suspense fallback={<div style={{ color: '#00FFFF', padding: 24 }}>Loading icon test...</div>}><IconTestPage /></Suspense>;
  }

  const current = weatherData?.current;
  const hourly = weatherData?.hourly;
  const daily = weatherData?.daily;
  const night = isNight(time, daily?.sunrise?.[0], daily?.sunset?.[0]);
  const isWeatherLoading = isLoading && !weatherData;

  // Open-Meteo sets code 95 when a storm cell exists anywhere in the model grid,
  // even with zero local precipitation. Downgrade to rain showers when there's
  // no measurable precipitation at the location.
  const effectiveCurrentCode = current?.weather_code >= 95 && (current?.precipitation ?? 0) < 0.1
    ? 80
    : current?.weather_code;

  const renderTabContent = () => {
    switch (currentScreen) {
      case SCREENS.CONDITIONS:
        return <CurrentConditionsTab current={current} daily={daily} hourly={hourly} night={night} isWeatherLoading={isWeatherLoading} alerts={alerts} aqiData={aqiData} location={location} units={units} />;
      case SCREENS.ALERTS:
        return <AlertsTab alerts={alerts} location={location} />;
      case SCREENS.HOURLY:
        return <HourlyForecastTab hourly={hourly} sunrise={daily?.sunrise?.[0]} sunset={daily?.sunset?.[0]} isWeatherLoading={isWeatherLoading} units={units} />;
      case SCREENS.DAILY:
        return <DailyOutlookTab location={location} daily={daily} isWeatherLoading={isWeatherLoading} units={units} />;
      case SCREENS.RADAR:
        return <RadarTab location={location} />;
      case SCREENS.WWA:
        return <WWADisplayTab />;
      case SCREENS.SPC:
        return <SPCOutlookTab />;
      case SCREENS.PRECIP:
        return <PrecipGraphTab hourly={hourly} isWeatherLoading={isWeatherLoading} />;
      case SCREENS.ALMANAC:
        return <AlmanacTab location={location} />;
      case SCREENS.TRIP_WEATHER:
        return <TripWeatherTab location={location} />;
      case SCREENS.HURRICANE:
        return <HurricaneTab />;
      case SCREENS.MODELS:
        return <ModelComparisonTab location={location} />;
      case SCREENS.GARDEN:
        return <GardenTab location={location} current={current} daily={daily} hourly={hourly} units={units} />;
      case SCREENS.SATELLITE:
        return <SatelliteTab location={location} />;
      default:
        return <div>Error: Tab Not Found</div>;
    }
  };

  return (
    <div className="h-screen text-white font-vt323 antialiased flex flex-col overflow-hidden" style={{ backgroundColor: NAVY_BLUE }}>
      <style>{`
        .shadow-neon-md { box-shadow: 0 0 10px 2px rgba(0, 255, 255, 0.5), 0 0 20px 5px rgba(0, 255, 255, 0.2); }
        .shadow-neon-lg { box-shadow: 0 0 15px 3px rgba(0, 255, 255, 0.7), 0 0 30px 8px rgba(0, 255, 255, 0.4); }
        .shadow-inner-neon { box-shadow: inset 0 0 8px rgba(0, 255, 255, 0.5); }
        @keyframes alertFlash {
          0%, 100% { opacity: 0; }
          50% { opacity: 0.3; }
        }
        .alert-flash-warning {
          animation: alertFlash 1s ease-in-out infinite;
          background-color: rgba(239, 68, 68, 1);
        }
        .alert-flash-watch {
          animation: alertFlash 1.5s ease-in-out infinite;
          background-color: rgba(249, 115, 22, 1);
        }
      `}</style>

      {/* CRT Power-On Animation */}
      {!crtDone && <CRTPowerOn onComplete={() => setCrtDone(true)} />}

      {/* Animated Weather Background Particles */}
      <WeatherBackground weatherCode={effectiveCurrentCode} night={night} />

      {/* Severe Weather Alert Flash Overlay */}
      {showAlertFlash && getSevereAlertLevel(alerts.filter(a => !dismissedAlertIds.has(a.properties?.id))) && (
        <div
          className={`fixed inset-0 pointer-events-none z-40 ${
            getSevereAlertLevel(alerts.filter(a => !dismissedAlertIds.has(a.properties?.id))) === 'warning' ? 'alert-flash-warning' : 'alert-flash-watch'
          }`}
        />
      )}

      {/* App Status Modal */}
      <AppStatus isLoading={isWeatherLoading} error={appError} isAutoDetecting={false} />

      {/* Stale Data Badge — shown when displaying cached data that couldn't be refreshed */}
      {isStaleData && weatherData && (
        <div className="fixed bottom-16 right-4 z-50 px-3 py-1 bg-yellow-900/90 border border-yellow-500 rounded text-yellow-300 text-base pointer-events-none">
          SHOWING LAST KNOWN DATA
        </div>
      )}

      {/* TORNADO WARNING Full-Screen Takeover — shows ALL active tornado warnings */}
      {(() => {
        const tornadoWarnings = getTornadoWarnings(alerts)
          .filter(alert => !dismissedTornadoModals.has(alert.properties?.id));
        if (!tornadoWarnings.length) return null;
        const dismissAll = () =>
          setDismissedTornadoModals(prev => new Set([...prev, ...tornadoWarnings.map(a => a.properties?.id)]));
        const soonestExpiry = tornadoWarnings
          .map(a => a.properties?.expires)
          .filter(Boolean)
          .sort()[0];
        return (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-red-900/95 p-4">
            <div className="bg-black border-4 border-red-500 rounded-xl p-6 md:p-8 max-w-2xl w-full shadow-2xl text-center">
              <div className="flex justify-center mb-4">
                <AlertTriangle size={80} className="text-red-500 animate-bounce" />
              </div>
              <h1 className="text-4xl md:text-6xl font-bold text-red-500 mb-4 tracking-wider">
                TORNADO WARNING{tornadoWarnings.length > 1 ? 'S' : ''}
              </h1>
              <div className="space-y-1 mb-4">
                {tornadoWarnings.map(alert => (
                  <p key={alert.properties?.id} className="text-xl md:text-2xl text-white">
                    {alert.properties?.areaDesc}
                  </p>
                ))}
              </div>
              <div className="bg-red-900/50 rounded-lg p-4 mb-6 text-left">
                <p className="text-lg text-red-200 font-bold mb-2">TAKE SHELTER IMMEDIATELY!</p>
                <ul className="text-yellow-300 space-y-1 text-sm md:text-base">
                  <li>Move to an interior room on the lowest floor</li>
                  <li>Stay away from windows, doors, and outside walls</li>
                  <li>Get under a sturdy table and cover your head</li>
                  <li>If in a mobile home, evacuate to a sturdy building</li>
                </ul>
              </div>
              {soonestExpiry && (
                <p className="text-cyan-400 mb-4">
                  <Clock size={16} className="inline mr-1" />
                  {getExpirationCountdown(soonestExpiry)}
                </p>
              )}
              <button
                onClick={dismissAll}
                className="px-8 py-3 bg-red-600 hover:bg-red-700 text-white text-xl font-bold rounded-lg transition-colors"
              >
                I UNDERSTAND - DISMISS
              </button>
            </div>
          </div>
        );
      })()}

      {/* Main Header */}
      <Header
        locationName={location.name}
        onLocationClick={() => setIsModalOpen(true)}
        onSettingsClick={() => setIsSettingsOpen(true)}
        timezone={weatherData?.timezone}
        isPlaying={isPlaying}
        toggleMusic={toggleMusic}
        volume={volume}
        setVolume={setVolume}
        autoCycle={autoCycle}
        setAutoCycle={setBroadcast}
        night={night}
        weatherCode={effectiveCurrentCode}
        sunrise={daily?.sunrise?.[0]}
        sunset={daily?.sunset?.[0]}
        isTracking={isTracking}
      />

      {/* Severe Weather Alert Banner */}
      {getSevereAlerts(alerts)
        .filter(alert => !dismissedAlertIds.has(alert.properties?.id))
        .map(alert => {
          const event = alert.properties?.event?.toLowerCase() || '';
          const isWarning = event.includes('warning');
          return (
            <div
              key={alert.properties?.id}
              onClick={() => { setCurrentScreen(SCREENS.ALERTS); setShowAlertFlash(false); }}
              className={`relative flex items-center justify-center px-4 py-3 font-bold text-white cursor-pointer hover:brightness-110 transition-all ${
                isWarning ? 'bg-red-600' : 'bg-orange-500'
              }`}
            >
              <AlertTriangle size={24} className="mr-2 flex-shrink-0" />
              <span className="text-center text-lg sm:text-xl md:text-2xl">
                {alert.properties?.event?.toUpperCase()} IN EFFECT FOR YOUR AREA. TAP FOR DETAILS.
              </span>
              <button
                onClick={(e) => { e.stopPropagation(); setDismissedAlertIds(prev => new Set([...prev, alert.properties?.id])); setShowAlertFlash(false); }}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 hover:bg-black/20 rounded transition-colors"
                aria-label="Dismiss alert"
              >
                <X size={20} />
              </button>
            </div>
          );
        })}

      {/* Main Content Area */}
      <main className="flex-grow max-w-7xl w-full mx-auto p-4 sm:p-6 flex flex-col md:flex-row gap-6 overflow-hidden">
        <TabNavigation currentTab={currentScreen} setTab={(tab) => { setAutoCycle(false); setCurrentScreen(tab); if (tab === SCREENS.ALERTS) setShowAlertFlash(false); }} alerts={alerts} />
        <div ref={contentRef} key={currentScreen} className="tab-content-enter flex-grow overflow-auto">
          <ErrorBoundary resetKey={currentScreen}>
            <Suspense fallback={<LoadingIndicator />}>
              {renderTabContent()}
            </Suspense>
          </ErrorBoundary>
        </div>
      </main>

      {/* Footer Ticker */}
      <Footer current={current} daily={daily} locationName={location.name} alerts={alerts} aqiData={aqiData} />

      {/* Settings Modal */}
      {isSettingsOpen && (
        <SettingsModal
          units={units}
          onUnitsChange={handleUnitsChange}
          cycleSpeed={cycleSpeed}
          onCycleSpeedChange={setCycleSpeed}
          onClose={() => setIsSettingsOpen(false)}
        />
      )}

      {/* Location Modal */}
      {isModalOpen && (
        <LocationModal
          location={location}
          onSave={handleLocationSave}
          onClose={() => setIsModalOpen(false)}
          savedLocations={savedLocations}
          onSaveLocation={saveLocation}
          onDeleteLocation={deleteLocation}
          trackingEnabled={trackingEnabled}
          onTrackingToggle={setTrackingEnabled}
        />
      )}

      {/* Retro Scanline Overlay */}
      <Scanlines />
    </div>
  );
};

export default App;
