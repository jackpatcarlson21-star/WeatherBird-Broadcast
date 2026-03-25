import React, { useState, useEffect, useRef, useCallback, lazy, Suspense } from 'react';
import { AlertTriangle, X, Clock } from 'lucide-react';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// Fix for default marker icons in Leaflet with webpack/vite
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

// Firebase
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, doc, setDoc, onSnapshot } from 'firebase/firestore';

// Constants and utilities
import { SCREENS, INITIAL_LOCATION, MUSIC_URL, REFRESH_RATE_MS, NAVY_BLUE } from './utils/constants';
import { getWeatherApiUrl, getAirQualityUrl, getNWSAlertsUrl, getNWSPointsUrl } from './utils/api';
import { isNight, getSevereAlertLevel, getSevereAlerts, getTornadoWarnings, getExpirationCountdown } from './utils/helpers';
import useAutoLocation from './utils/useAutoLocation';

// Components
import { Header, Footer, Scanlines, TabNavigation, CRTPowerOn } from './components/layout';
import { AppStatus, LocationModal, SettingsModal } from './components/common';
import { WeatherBackground } from './components/weather';
import { ModernBackground, ModernBottomNav, ModernHome } from './components/modern';
const IconTestPage = lazy(() => import('./components/weather/IconTestPage'));
import {
  AlertsTab,
  CurrentConditionsTab,
  HourlyForecastTab,
  DailyOutlookTab,
  RadarTab,
  WWADisplayTab,
  SPCOutlookTab,
  PrecipGraphTab,
  AlmanacTab,
  TripWeatherTab,
  HurricaneTab,
  ModelComparisonTab,
  GardenTab,
} from './components/tabs';


const App = () => {
  // --- State Hooks ---
  const [db, setDb] = useState(null);
  const [userId, setUserId] = useState(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [location, setLocation] = useState(INITIAL_LOCATION);
  const [weatherData, setWeatherData] = useState(null);
  const [aqiData, setAqiData] = useState(null);
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
  const [cycleSpeed, setCycleSpeed] = useState(10);
  const [dismissedAlertIds, setDismissedAlertIds] = useState(new Set());
  const [dismissedTornadoModals, setDismissedTornadoModals] = useState(new Set());
  const [showAlertFlash, setShowAlertFlash] = useState(false);

  const [crtDone, setCrtDone] = useState(false);
  const lastAlertIdsRef = useRef('');
  const pendingGpsLocationRef = useRef(null);

  // --- Alert Flash Timeout ---
  useEffect(() => {
    const activeAlerts = alerts.filter(a => !dismissedAlertIds.has(a.properties?.id));
    const severeLevel = getSevereAlertLevel(activeAlerts);
    const currentAlertIds = activeAlerts.map(a => a.properties?.id).sort().join(',');

    if (severeLevel && currentAlertIds !== lastAlertIdsRef.current) {
      lastAlertIdsRef.current = currentAlertIds;
      setShowAlertFlash(true);
      const timeout = setTimeout(() => setShowAlertFlash(false), 3000);
      return () => clearTimeout(timeout);
    }
  }, [alerts, dismissedAlertIds]);

  // --- Auto-Cycle Effect ---
  useEffect(() => {
    if (!autoCycle) return;

    const screenOrder = [
      SCREENS.CONDITIONS, SCREENS.HOURLY, SCREENS.DAILY, SCREENS.RADAR,
      SCREENS.PRECIP, SCREENS.ALERTS, SCREENS.WWA,
      SCREENS.SPC, SCREENS.TRIP_WEATHER, SCREENS.ALMANAC,
      SCREENS.HURRICANE, SCREENS.MODELS,
    ];

    const interval = setInterval(() => {
      setCurrentScreen(current => {
        const currentIndex = screenOrder.indexOf(current);
        const nextIndex = (currentIndex + 1) % screenOrder.length;
        return screenOrder[nextIndex];
      });
    }, cycleSpeed * 1000);

    return () => clearInterval(interval);
  }, [autoCycle, cycleSpeed]);

  // --- Auto-Scroll Effect (scrolls content panel during auto-cycle) ---
  useEffect(() => {
    if (!autoCycle) return;

    // Reset scroll to top when screen changes
    if (contentRef.current) {
      contentRef.current.scrollTop = 0;
    }

    let animationId;
    let scrollPos = 0;
    let pixelsPerFrame = 0.3;
    const pauseMs = 2000;

    const scroll = () => {
      if (contentRef.current) {
        const { scrollHeight, clientHeight } = contentRef.current;
        const scrollable = scrollHeight - clientHeight;

        // Calculate speed based on content length and remaining time
        if (scrollable > 0 && pixelsPerFrame === 0.3) {
          const scrollTimeMs = (cycleSpeed * 1000) - pauseMs - 1000; // leave 1s buffer at bottom
          const framesAvailable = (scrollTimeMs / 1000) * 60; // ~60fps
          pixelsPerFrame = Math.max(0.3, scrollable / framesAvailable);
        }

        if (scrollPos < scrollable) {
          scrollPos += pixelsPerFrame;
          contentRef.current.scrollTop = scrollPos;
        }
      }
      animationId = requestAnimationFrame(scroll);
    };

    // 2 second pause before scrolling starts
    const timeout = setTimeout(() => {
      animationId = requestAnimationFrame(scroll);
    }, pauseMs);

    return () => {
      clearTimeout(timeout);
      cancelAnimationFrame(animationId);
    };
  }, [autoCycle, currentScreen, cycleSpeed]);


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
  const initialLoadRef = useRef(true);
  const contentRef = useRef(null);

  // --- Auth and Firebase Initialization ---
  useEffect(() => {
    try {
      const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : {};

      if (!Object.keys(firebaseConfig).length) {
        console.log("Running in standalone mode (no Firebase)");
        setUserId(crypto.randomUUID());
        setIsAuthReady(true);
        return;
      }

      const app = initializeApp(firebaseConfig);
      const newAuth = getAuth(app);
      const newDb = getFirestore(app);

      setDb(newDb);

      const unsubscribe = onAuthStateChanged(newAuth, async (user) => {
        if (!user) {
          try {
            const token = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null;
            if (token) {
              await signInWithCustomToken(newAuth, token);
            } else {
              await signInAnonymously(newAuth);
            }
          } catch (e) {
            console.error("Firebase sign-in failed:", e);
            setAppError("Authentication failed. Cannot load app.");
          }
        }
        setUserId(newAuth.currentUser?.uid || crypto.randomUUID());
        setIsAuthReady(true);
      });

      return () => unsubscribe();
    } catch (e) {
      console.error("Firebase Initialization Error:", e);
      setAppError("Application failed to initialize. See console for details.");
    }
  }, []);

  // --- Clock and Music Handler ---
  useEffect(() => {
    // Slow tick (60s) - only used for isNight; Header has its own 1s clock
    const clockTick = setInterval(() => setTime(new Date()), 60000);

    if (!audioRef.current) {
      audioRef.current = new Audio(MUSIC_URL);
      audioRef.current.loop = true;
    }
    if (audioRef.current) {
      audioRef.current.volume = volume;
    }

    return () => clearInterval(clockTick);
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

  // --- Location Listener (Firestore) ---
  useEffect(() => {
    if (!db || !userId) return;

    const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
    const locationDocRef = doc(db, `artifacts/${appId}/users/${userId}/location_config`, 'current_location');

    const unsubscribe = onSnapshot(locationDocRef, (docSnap) => {
      // If GPS fired before Firebase was ready, save that location now instead of
      // restoring the old Firestore location (which would overwrite the GPS fix).
      if (pendingGpsLocationRef.current) {
        const gpsLoc = pendingGpsLocationRef.current;
        pendingGpsLocationRef.current = null;
        console.log("Saving pending GPS location to Firestore:", gpsLoc.name);
        setDoc(locationDocRef, gpsLoc).catch(e => console.error("Failed to save GPS location:", e));
        return; // Don't overwrite state; snapshot will re-fire with the GPS location
      }

      if (docSnap.exists()) {
        const savedLoc = docSnap.data();
        setLocation({
          name: savedLoc.name || INITIAL_LOCATION.name,
          lat: parseFloat(savedLoc.lat) || INITIAL_LOCATION.lat,
          lon: parseFloat(savedLoc.lon) || INITIAL_LOCATION.lon,
        });
        console.log("Location loaded from Firestore.");
      } else if (initialLoadRef.current) {
        console.log("No saved location found. Saving initial location to Firestore.");
        setDoc(locationDocRef, INITIAL_LOCATION).catch(e => console.error("Failed to set initial location:", e));
      }
      initialLoadRef.current = false;
    }, (error) => {
      console.error("Error listening to location:", error);
      setAppError("Failed to sync location data with server.");
    });

    return () => unsubscribe();
  }, [db, userId]);

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
      console.log("Weather data fetched successfully.", data);
    } catch (error) {
      console.error("Weather fetching failed:", error);
      setAppError(`Failed to fetch weather data for ${loc.name}. Check coordinates.`);
      setWeatherData(null);
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
      console.log("AQI data fetched successfully.", data);
    } catch (error) {
      console.error("AQI fetching failed:", error);
      setAqiData(null);
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
    if (location.lat && location.lon && isAuthReady) {
      fetchAlerts();
    }

    const alertInterval = setInterval(() => {
      if (location.lat && location.lon && isAuthReady) fetchAlerts();
    }, 120000);

    return () => clearInterval(alertInterval);
  }, [location.lat, location.lon, isAuthReady, fetchAlerts]);

  // --- Fetch Weather on Location Change & Set Interval ---
  useEffect(() => {
    if (!isAuthReady) return;

    if (weatherIntervalRef.current) {
      clearInterval(weatherIntervalRef.current);
    }

    fetchWeather(location);
    fetchAQI(location);

    weatherIntervalRef.current = setInterval(() => {
      fetchWeather(location);
      fetchAQI(location);
    }, REFRESH_RATE_MS);

    return () => {
      if (weatherIntervalRef.current) clearInterval(weatherIntervalRef.current);
    };
  }, [location, isAuthReady, fetchWeather, fetchAQI]);

  // --- Location Save Handler ---
  const handleUnitsChange = (newUnits) => {
    setUnits(newUnits);
    localStorage.setItem('weatherbird-units', JSON.stringify(newUnits));
  };

  const handleLocationSave = useCallback(async (newLoc) => {
    localStorage.setItem('weatherbird-location-set', '1');
    setIsModalOpen(false);
    if (db && userId) {
      const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
      const locationDocRef = doc(db, `artifacts/${appId}/users/${userId}/location_config`, 'current_location');
      try {
        await setDoc(locationDocRef, newLoc);
        console.log("New location saved to Firestore.");
      } catch (e) {
        console.error("Failed to save new location:", e);
        setAppError("Failed to save location to the database.");
      }
    } else {
      // Firebase not ready yet — set state immediately and store for when Firestore attaches
      pendingGpsLocationRef.current = newLoc;
      setLocation(newLoc);
      fetchWeather(newLoc);
    }
  }, [db, userId, fetchWeather]);

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
        return <AlmanacTab location={location} userId={userId} />;
      case SCREENS.TRIP_WEATHER:
        return <TripWeatherTab location={location} />;
      case SCREENS.HURRICANE:
        return <HurricaneTab />;
      case SCREENS.MODELS:
        return <ModelComparisonTab location={location} />;
      case SCREENS.GARDEN:
        return <GardenTab location={location} current={current} daily={daily} hourly={hourly} units={units} />;
      default:
        return <div>Error: Tab Not Found</div>;
    }
  };

  const activeAlerts = alerts.filter(a => !dismissedAlertIds.has(a.properties?.id));

  return (
    <div className="h-screen overflow-hidden relative" style={{ fontFamily: "'Inter', sans-serif" }}>
      <style>{`
        @keyframes alertFlash {
          0%, 100% { opacity: 0; }
          50% { opacity: 0.3; }
        }
        .alert-flash-warning { animation: alertFlash 1s ease-in-out infinite; background-color: rgba(239,68,68,1); }
        .alert-flash-watch   { animation: alertFlash 1.5s ease-in-out infinite; background-color: rgba(249,115,22,1); }

        /* Modern theme overrides — strip retro styling from legacy tab components */
        .modern-tabs .font-vt323 { font-family: 'Inter', sans-serif !important; letter-spacing: normal !important; }
        .modern-tabs [class*="border-cyan"] { border-color: rgba(255,255,255,0.12) !important; }
        .modern-tabs [class*="text-cyan"] { color: rgba(255,255,255,0.7) !important; }
        .modern-tabs [class*="bg-black\\/20"] { background-color: rgba(255,255,255,0.06) !important; }
        .modern-tabs [class*="bg-black\\/30"] { background-color: rgba(255,255,255,0.08) !important; }
        .modern-tabs [class*="bg-cyan"] { background-color: rgba(255,255,255,0.15) !important; }
        .modern-tabs [class*="shadow-neon"] { box-shadow: none !important; }
        .modern-tabs button[class*="border-cyan"] { border-color: rgba(255,255,255,0.2) !important; }
        .modern-tabs button[class*="border-cyan"]:hover { border-color: rgba(255,255,255,0.4) !important; }
      `}</style>

      {/* Dynamic gradient background */}
      <ModernBackground weatherCode={current?.weather_code} night={night} />

      {/* Alert flash overlay */}
      {showAlertFlash && getSevereAlertLevel(activeAlerts) && (
        <div className={`fixed inset-0 pointer-events-none z-40 ${
          getSevereAlertLevel(activeAlerts) === 'warning' ? 'alert-flash-warning' : 'alert-flash-watch'
        }`} />
      )}

      {/* App status */}
      <AppStatus isLoading={isWeatherLoading} error={appError} isReady={isAuthReady} isAutoDetecting={false} />

      {/* Tornado warning takeover */}
      {(() => {
        const tornadoWarnings = getTornadoWarnings(alerts).filter(a => !dismissedTornadoModals.has(a.properties?.id));
        if (!tornadoWarnings.length) return null;
        const dismissAll = () => setDismissedTornadoModals(prev => new Set([...prev, ...tornadoWarnings.map(a => a.properties?.id)]));
        const soonestExpiry = tornadoWarnings.map(a => a.properties?.expires).filter(Boolean).sort()[0];
        return (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-red-900/95 p-4">
            <div className="bg-black border-4 border-red-500 rounded-xl p-6 md:p-8 max-w-2xl w-full shadow-2xl text-center">
              <AlertTriangle size={80} className="text-red-500 animate-bounce mx-auto mb-4" />
              <h1 className="text-4xl md:text-6xl font-bold text-red-500 mb-4">TORNADO WARNING{tornadoWarnings.length > 1 ? 'S' : ''}</h1>
              {tornadoWarnings.map(a => <p key={a.properties?.id} className="text-xl text-white">{a.properties?.areaDesc}</p>)}
              <div className="bg-red-900/50 rounded-lg p-4 my-4 text-left">
                <p className="text-red-200 font-bold mb-2">TAKE SHELTER IMMEDIATELY!</p>
                <ul className="text-yellow-300 space-y-1 text-sm">
                  <li>Move to an interior room on the lowest floor</li>
                  <li>Stay away from windows, doors, and outside walls</li>
                  <li>Get under a sturdy table and cover your head</li>
                </ul>
              </div>
              {soonestExpiry && <p className="text-white/70 mb-4 text-sm">{getExpirationCountdown(soonestExpiry)}</p>}
              <button onClick={dismissAll} className="px-8 py-3 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl transition-colors">
                I UNDERSTAND - DISMISS
              </button>
            </div>
          </div>
        );
      })()}

      {/* Scrollable content area */}
      <div className="relative z-10 h-full flex flex-col">

        {/* Top bar */}
        <div className="flex items-center justify-between px-5 pt-safe pt-4 pb-2">
          <button
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-1.5 text-white font-semibold text-lg hover:text-white/80 transition-colors"
          >
            <span>📍</span>
            <span>{location.name?.split(',')[0] ?? 'Select Location'}</span>
          </button>
          <div className="flex items-center gap-3">
            {isWeatherLoading && (
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            )}
            <button
              onClick={() => setIsSettingsOpen(true)}
              className="text-white/70 hover:text-white transition-colors p-1"
            >
              ⚙️
            </button>
          </div>
        </div>

        {/* Severe alert banner */}
        {activeAlerts.filter(a => getSevereAlerts([a]).length > 0).slice(0, 1).map(alert => {
          const isWarning = alert.properties?.event?.toLowerCase().includes('warning');
          return (
            <div
              key={alert.properties?.id}
              onClick={() => setCurrentScreen(SCREENS.ALERTS)}
              className={`relative flex items-center justify-between px-4 py-2.5 cursor-pointer text-white text-sm font-medium ${isWarning ? 'bg-red-500/90' : 'bg-orange-500/90'}`}
            >
              <div className="flex items-center gap-2">
                <AlertTriangle size={16} />
                <span>{alert.properties?.event?.toUpperCase()} IN EFFECT — TAP FOR DETAILS</span>
              </div>
              <button onClick={e => { e.stopPropagation(); setDismissedAlertIds(prev => new Set([...prev, alert.properties?.id])); }}>
                <X size={16} />
              </button>
            </div>
          );
        })}

        {/* Main scrollable content */}
        <div ref={contentRef} className="flex-1 overflow-y-auto pb-20">
          {currentScreen === SCREENS.CONDITIONS ? (
            <ModernHome
              current={current}
              daily={daily}
              hourly={hourly}
              night={night}
              alerts={activeAlerts}
              aqiData={aqiData}
              location={location}
              units={units}
            />
          ) : (
            <div className="p-4 modern-tabs">
              {renderTabContent()}
            </div>
          )}
        </div>
      </div>

      {/* Bottom navigation */}
      <ModernBottomNav
        currentScreen={currentScreen}
        setScreen={(tab) => { setAutoCycle(false); setCurrentScreen(tab); }}
        alerts={activeAlerts}
      />

      {/* Settings Modal */}
      {isSettingsOpen && (
        <SettingsModal units={units} onUnitsChange={handleUnitsChange} onClose={() => setIsSettingsOpen(false)} />
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
    </div>
  );
};

export default App;
