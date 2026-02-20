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
import { AppStatus, LocationModal } from './components/common';
import { WeatherBackground } from './components/weather';
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
  DashboardTab,
  TripWeatherTab,
  HurricaneTab,
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
  const [isModalOpen, setIsModalOpen] = useState(false);
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
      SCREENS.PRECIP, SCREENS.DASHBOARD, SCREENS.ALERTS, SCREENS.WWA,
      SCREENS.SPC, SCREENS.TRIP_WEATHER, SCREENS.ALMANAC,
      SCREENS.HURRICANE,
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
  const handleLocationSave = useCallback(async (newLoc) => {
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
      case SCREENS.DASHBOARD:
        return <DashboardTab currentLocation={location} savedLocations={savedLocations} onSelectLocation={(loc) => {
          setLocation({ name: loc.name, lat: loc.lat, lon: loc.lon });
          setCurrentScreen(SCREENS.CONDITIONS);
        }} />;
      case SCREENS.CONDITIONS:
        return <CurrentConditionsTab current={current} daily={daily} hourly={hourly} night={night} isWeatherLoading={isWeatherLoading} alerts={alerts} aqiData={aqiData} />;
      case SCREENS.ALERTS:
        return <AlertsTab alerts={alerts} location={location} />;
      case SCREENS.HOURLY:
        return <HourlyForecastTab hourly={hourly} sunrise={daily?.sunrise?.[0]} sunset={daily?.sunset?.[0]} isWeatherLoading={isWeatherLoading} />;
      case SCREENS.DAILY:
        return <DailyOutlookTab location={location} daily={daily} isWeatherLoading={isWeatherLoading} />;
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
      default:
        return <div>Error: Tab Not Found</div>;
    }
  };

  return (
    <div className="h-screen text-white font-vt323 antialiased flex flex-col overflow-hidden" style={{ backgroundColor: NAVY_BLUE }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=VT323&display=swap');
        .font-vt323 { font-family: 'VT323', monospace; }
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
      <WeatherBackground weatherCode={current?.weather_code} night={night} />

      {/* Severe Weather Alert Flash Overlay */}
      {showAlertFlash && getSevereAlertLevel(alerts.filter(a => !dismissedAlertIds.has(a.properties?.id))) && (
        <div
          className={`fixed inset-0 pointer-events-none z-40 ${
            getSevereAlertLevel(alerts.filter(a => !dismissedAlertIds.has(a.properties?.id))) === 'warning' ? 'alert-flash-warning' : 'alert-flash-watch'
          }`}
        />
      )}

      {/* App Status Modal */}
      <AppStatus isLoading={isWeatherLoading} error={appError} isReady={isAuthReady} isAutoDetecting={false} />

      {/* TORNADO WARNING Full-Screen Takeover */}
      {getTornadoWarnings(alerts)
        .filter(alert => !dismissedTornadoModals.has(alert.properties?.id))
        .slice(0, 1)
        .map(alert => (
          <div
            key={alert.properties?.id}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-red-900/95 p-4"
          >
            <div className="bg-black border-4 border-red-500 rounded-xl p-6 md:p-8 max-w-2xl w-full shadow-2xl text-center">
              <div className="flex justify-center mb-4">
                <AlertTriangle size={80} className="text-red-500 animate-bounce" />
              </div>
              <h1 className="text-4xl md:text-6xl font-bold text-red-500 mb-4 tracking-wider">
                TORNADO WARNING
              </h1>
              <p className="text-2xl md:text-3xl text-white mb-4">
                {alert.properties?.areaDesc}
              </p>
              <div className="bg-red-900/50 rounded-lg p-4 mb-6 text-left">
                <p className="text-lg text-red-200 font-bold mb-2">TAKE SHELTER IMMEDIATELY!</p>
                <ul className="text-yellow-300 space-y-1 text-sm md:text-base">
                  <li>Move to an interior room on the lowest floor</li>
                  <li>Stay away from windows, doors, and outside walls</li>
                  <li>Get under a sturdy table and cover your head</li>
                  <li>If in a mobile home, evacuate to a sturdy building</li>
                </ul>
              </div>
              {alert.properties?.expires && (
                <p className="text-cyan-400 mb-4">
                  <Clock size={16} className="inline mr-1" />
                  {getExpirationCountdown(alert.properties.expires)}
                </p>
              )}
              <button
                onClick={() => setDismissedTornadoModals(prev => new Set([...prev, alert.properties?.id]))}
                className="px-8 py-3 bg-red-600 hover:bg-red-700 text-white text-xl font-bold rounded-lg transition-colors"
              >
                I UNDERSTAND - DISMISS
              </button>
            </div>
          </div>
        ))}

      {/* Main Header */}
      <Header
        locationName={location.name}
        onLocationClick={() => setIsModalOpen(true)}
        timezone={weatherData?.timezone}
        isPlaying={isPlaying}
        toggleMusic={toggleMusic}
        volume={volume}
        setVolume={setVolume}
        autoCycle={autoCycle}
        setAutoCycle={setAutoCycle}
        night={night}
        weatherCode={current?.weather_code}
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
              onClick={() => setCurrentScreen(SCREENS.ALERTS)}
              className={`relative flex items-center justify-center px-4 py-3 font-bold text-white cursor-pointer hover:brightness-110 transition-all ${
                isWarning ? 'bg-red-600' : 'bg-orange-500'
              }`}
            >
              <AlertTriangle size={24} className="mr-2 flex-shrink-0" />
              <span className="text-center text-lg sm:text-xl md:text-2xl">
                {alert.properties?.event?.toUpperCase()} IN EFFECT FOR YOUR AREA. TAP FOR DETAILS.
              </span>
              <button
                onClick={(e) => { e.stopPropagation(); setDismissedAlertIds(prev => new Set([...prev, alert.properties?.id])); }}
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
        <TabNavigation currentTab={currentScreen} setTab={(tab) => { setAutoCycle(false); setCurrentScreen(tab); }} />
        <div ref={contentRef} key={currentScreen} className="tab-content-enter flex-grow overflow-auto">
          {renderTabContent()}
        </div>
      </main>

      {/* Footer Ticker */}
      <Footer current={current} daily={daily} locationName={location.name} alerts={alerts} />

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
