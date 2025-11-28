import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Play, Pause, Thermometer, Wind, Droplets, ArrowRight, Sun, CloudRain, MapPin, X, Volume2, VolumeX, Volume1, Menu, Clock, Calendar, Radio, AlertTriangle, Settings, Zap, Home, ChevronRight, Sunrise, Sunset, Maximize, Minimize, ShieldAlert, Map as MapIcon, CloudRainWind, Moon } from 'lucide-react';

// --- Firebase ---
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, doc, setDoc, onSnapshot } from 'firebase/firestore';

// --- Config ---
// Fallback location until user's location is loaded from Firestore
const INITIAL_LOCATION = { name: "Lawrenceburg, KY", lat: 37.8393, lon: -84.2700 };

// Music URL - Smooth jazz for that classic weather channel vibe
const MUSIC_URL = "https://stream.zeno.fm/0r0xa792kwzuv";

const REFRESH_RATE_MS = 60000; // 60 seconds

// --- Screens (Tabs) ---
const SCREENS = {
    CONDITIONS: 'CONDITIONS',
    HOURLY: 'HOURLY',
    DAILY: 'DAILY',
    RADAR: 'RADAR',
    ALERTS: 'ALERTS',
    WWA: 'WWA',
    SPC: 'SPC',
    ALMANAC: 'ALMANAC',
};

// --- Colors ---
const DARK_BLUE = '#003366';
const NAVY_BLUE = '#001122';
const BRIGHT_CYAN = '#00FFFF';
const MID_BLUE = '#0055AA';

// --- APIs & Live Imagery ---
// Added &forecast_days=8 to ensure we have enough data for a 7-day outlook excluding today
const getWeatherApiUrl = (lat, lon) =>
  `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,apparent_temperature,relative_humidity_2m,weather_code,wind_speed_10m,wind_direction_10m,wind_gusts_10m,precipitation,pressure_msl&hourly=temperature_2m,precipitation_probability,weather_code,wind_speed_10m&daily=weather_code,temperature_2m_max,temperature_2m_min,sunrise,sunset,precipitation_probability_max,wind_speed_10m_max&temperature_unit=fahrenheit&wind_speed_unit=mph&precipitation_unit=inch&timezone=auto&forecast_days=8`;

// NWS Alerts API
const getNWSAlertsUrl = (lat, lon) => `https://api.weather.gov/alerts/active?point=${lat},${lon}`;

// Live Imagery URLs
const RADAR_URL = "https://radar.weather.gov/ridge/standard/CONUS_loop.gif";
const SPC_OUTLOOK_URL = "https://www.spc.noaa.gov/products/outlook/day1otlk.gif";
// Switched to the main NWS hazards map which is often more reliable
const NWS_WWA_MAP_URL = "https://forecast.weather.gov/wwamap/png/US.png";
const PLACEHOLDER_IMG = "https://placehold.co/800x400/003366/00ffff?text=UNABLE+TO+LOAD+EXTERNAL+IMAGE+FEED";

// --- Helpers ---
const isNight = (now, sunrise, sunset) => {
  if (!sunrise || !sunset) return false;
  const sunriseTime = new Date(sunrise).getTime();
  const sunsetTime = new Date(sunset).getTime();
  const nowTime = now.getTime();
  return nowTime < sunriseTime || nowTime > sunsetTime;
};

const degreeToCardinal = (deg) => {
  const dirs = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
  return dirs[Math.round(deg / 45) % 8] || "VRB";
};

const getWeatherIcon = (code, night) => {
  if (code === 0) return night ? "🌙" : "☀️";
  if (code <= 3) return night ? "☁️" : "⛅";
  if (code <= 48) return "🌫️"; // Fog
  if (code <= 57) return "🌧️"; // Drizzle
  if (code <= 67) return "🌧️"; // Rain
  if (code <= 77) return "❄️"; // Snow (71-77)
  if (code <= 82) return "🌧️"; // Rain showers
  if (code <= 86) return "🌨️"; // Snow showers (85-86)
  if (code >= 95) return "⛈️"; // Thunderstorm
  return "❓";
};

const getWeatherDescription = (code) => {
  const map = {
    0: "CLEAR SKY", 1: "MAINLY CLEAR", 2: "PARTLY CLOUDY", 3: "OVERCAST",
    45: "FOG", 48: "FREEZING FOG",
    51: "LIGHT DRIZZLE", 53: "DRIZZLE", 55: "HEAVY DRIZZLE",
    56: "FREEZING DRIZZLE", 57: "HEAVY FREEZING DRIZZLE",
    61: "LIGHT RAIN", 63: "RAIN", 65: "HEAVY RAIN",
    66: "FREEZING RAIN", 67: "HEAVY FREEZING RAIN",
    71: "LIGHT SNOW", 73: "SNOW", 75: "HEAVY SNOW", 77: "SNOW GRAINS",
    80: "RAIN SHOWERS", 81: "MODERATE SHOWERS", 82: "VIOLENT SHOWERS",
    85: "LIGHT SNOW SHOWERS", 86: "HEAVY SNOW SHOWERS",
    95: "THUNDERSTORM", 96: "THUNDERSTORM W/ HAIL", 99: "SEVERE THUNDERSTORM"
  };
  return map[code] || "UNKNOWN";
};

const formatTime = (iso) => iso ? new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : "--:--";
const formatDate = (iso) => iso ? new Date(iso).toLocaleDateString([], { month: 'short', day: 'numeric' }) : "--/--";

// Moon phase calculation
const getMoonPhase = (date = new Date()) => {
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const day = date.getDate();

    // Calculate days since known new moon (Jan 6, 2000)
    const lp = 2551443; // Lunar period in seconds
    const newMoon = new Date(2000, 0, 6, 18, 14, 0);
    const phase = ((date.getTime() - newMoon.getTime()) / 1000) % lp;
    const phaseDay = Math.floor(phase / (24 * 3600));

    // Moon cycle is ~29.53 days
    const phasePct = phaseDay / 29.53;

    let phaseName, icon;
    if (phasePct < 0.0625) {
        phaseName = "New Moon";
        icon = "🌑";
    } else if (phasePct < 0.1875) {
        phaseName = "Waxing Crescent";
        icon = "🌒";
    } else if (phasePct < 0.3125) {
        phaseName = "First Quarter";
        icon = "🌓";
    } else if (phasePct < 0.4375) {
        phaseName = "Waxing Gibbous";
        icon = "🌔";
    } else if (phasePct < 0.5625) {
        phaseName = "Full Moon";
        icon = "🌕";
    } else if (phasePct < 0.6875) {
        phaseName = "Waning Gibbous";
        icon = "🌖";
    } else if (phasePct < 0.8125) {
        phaseName = "Last Quarter";
        icon = "🌗";
    } else if (phasePct < 0.9375) {
        phaseName = "Waning Crescent";
        icon = "🌘";
    } else {
        phaseName = "New Moon";
        icon = "🌑";
    }

    const illumination = Math.round(Math.abs(Math.cos(phasePct * 2 * Math.PI)) * 100);

    return { phaseName, icon, illumination, phaseDay };
};

// --- Components ---

const Scanlines = () => (
  <div className="pointer-events-none absolute inset-0 z-50 opacity-30">
    <div className="absolute inset-0 bg-gradient-to-b from-transparent via-cyan-900/10 to-transparent" />
    <div className="absolute inset-0 bg-[linear-gradient(transparent_50%,rgba(0,0,0,0.1)_50%)] bg-[length:100%_8px]" />
  </div>
);

const Header = ({ time, locationName, onLocationClick, timezone, isPlaying, toggleMusic, volume, setVolume }) => {
  const timeOptions = { hour: 'numeric', minute: '2-digit', second: '2-digit' };
  const dateOptions = { weekday: 'short', month: 'short', day: 'numeric' };

  if (timezone) {
    timeOptions.timeZone = timezone;
    dateOptions.timeZone = timezone;
  }

  return (
  <header className="p-4 flex justify-between items-center h-20 shrink-0 shadow-neon-lg z-10" style={{ background: `linear-gradient(to bottom, ${DARK_BLUE}, ${NAVY_BLUE})`, borderBottom: `4px solid ${BRIGHT_CYAN}` }}>
    <div className="flex flex-col">
      <h1 className="text-3xl sm:text-4xl font-bold text-white tracking-widest font-vt323">WEATHERBIRD</h1>
      <div className="flex items-center gap-2 text-cyan-300 font-vt323 text-lg">
        <MapPin size={16} /> <span className="truncate max-w-56">{locationName}</span>
      </div>
    </div>
    <div className="flex items-center gap-3 sm:gap-5">
      {/* Music Controls */}
      <div className="flex items-center gap-2 px-3 py-2 rounded-full bg-black/30" style={{ border: `1px solid ${BRIGHT_CYAN}` }}>
        <button
          onClick={toggleMusic}
          className="text-cyan-400 hover:text-white transition"
          title={isPlaying ? 'Pause Music' : 'Play Music'}
        >
          {isPlaying ? <Pause size={18} /> : <Play size={18} />}
        </button>
        <div className="hidden sm:flex items-center gap-2">
          <VolumeX size={14} className="text-cyan-600" />
          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={volume}
            onChange={(e) => setVolume(parseFloat(e.target.value))}
            className="w-16 h-1.5 bg-cyan-900 rounded-lg appearance-none cursor-pointer"
            style={{ accentColor: BRIGHT_CYAN }}
          />
          <Volume2 size={14} className="text-cyan-400" />
        </div>
      </div>

      {/* Location Button */}
      <button onClick={onLocationClick} className="p-2 sm:p-3 bg-white/10 rounded-full hover:bg-white/20 transition shadow-md" style={{ border: `1px solid ${BRIGHT_CYAN}`, color: BRIGHT_CYAN }}>
        <MapPin size={20} style={{ color: BRIGHT_CYAN }} />
      </button>

      {/* Clock */}
      <div className="text-right hidden sm:block">
        <div className="text-3xl font-bold text-white font-vt323 tracking-widest">
            {time.toLocaleTimeString([], timeOptions)}
        </div>
        <div className="text-sm text-white font-vt323">{time.toLocaleDateString([], dateOptions)}</div>
      </div>
    </div>
  </header>
  );
};

const Footer = ({ current, locationName, alerts }) => {
    const temp = current ? Math.round(current.temperature_2m) : '--';
    const cond = current ? getWeatherDescription(current.weather_code) : 'LOADING';
    const wind = current ? `${Math.round(current.wind_speed_10m)} MPH` : '--';

    // Construct Alerts Text
    let alertText = "";
    if (alerts && alerts.length > 0) {
        alertText = alerts.map(a => ` ⚠️ ${a.properties.headline.toUpperCase()} ⚠️ `).join(" ::: ");
        alertText += " ::: "; // Spacer
    }

    // Ticker Text Construction
    const baseText = `CURRENTLY IN ${locationName.toUpperCase()}: ${temp}°F ${cond} - WIND: ${wind} ::: CAW CAW! ::: THANK YOU FOR USING WEATHERBIRD! ::: `;

    // If alerts exist, put them FIRST
    const tickerText = alertText ? `${alertText} ${baseText}` : baseText;

    return (
        <footer className="h-12 shrink-0 flex items-center relative overflow-hidden" style={{ background: `linear-gradient(to top, ${NAVY_BLUE}, ${DARK_BLUE})`, borderTop: `4px solid ${BRIGHT_CYAN}` }}>

            {/* Scrolling Ticker - Full Width */}
            <div className="w-full relative h-full flex items-center overflow-hidden bg-black/20">
                <div className={`whitespace-nowrap animate-marquee font-vt323 text-xl px-4 tracking-widest absolute ${alerts && alerts.length > 0 ? 'text-red-300 font-bold' : 'text-cyan-300'}`}>
                    {tickerText.repeat(5)}
                </div>
            </div>

            <style>{`
                @keyframes marquee {
                    0% { transform: translateX(0); }
                    100% { transform: translateX(-50%); }
                }
                .animate-marquee {
                    animation: marquee 45s linear infinite;
                    will-change: transform;
                }
            `}</style>
        </footer>
    );
};

const TabNavigation = ({ currentTab, setTab }) => {
    const tabs = [
        { id: SCREENS.CONDITIONS, name: 'CURRENT' },
        { id: SCREENS.HOURLY, name: '12HR' },
        { id: SCREENS.DAILY, name: '7-DAY' },
        { id: SCREENS.ALERTS, name: 'ALERTS' },
        { id: SCREENS.RADAR, name: 'RADAR' },
        { id: SCREENS.WWA, name: 'WWA MAP' },
        { id: SCREENS.SPC, name: 'SPC' },
        { id: SCREENS.ALMANAC, name: 'ALMANAC' },
    ];

    return (
        <div className="md:w-72 shrink-0 md:border-r-4 border-b-4 md:border-b-0 shadow-neon-md p-2" style={{ backgroundColor: DARK_BLUE, borderColor: BRIGHT_CYAN }}>
            <div className="flex md:flex-col overflow-x-auto md:overflow-y-auto whitespace-nowrap md:whitespace-normal h-full gap-2">
                {tabs.map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setTab(tab.id)}
                        className={`inline-block md:block w-full py-4 px-4 text-3xl font-vt323 transition-all text-left rounded-lg border-2 text-white
                            ${currentTab === tab.id
                                ? 'font-bold shadow-inner-neon'
                                : 'border-cyan-800 hover:border-cyan-500 hover:bg-white/10'
                            }`}
                        style={currentTab === tab.id ? { borderColor: BRIGHT_CYAN, backgroundColor: MID_BLUE } : {}}
                    >
                        {tab.name}
                    </button>
                ))}
            </div>
        </div>
    );
};

const LocationModal = ({ location, onSave, onClose }) => {
  const [temp, setTemp] = useState({ ...location, error: null });
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  const debounceRef = useRef(null);

  // Auto-search as user types (with debounce)
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
        console.error("Autocomplete error:", e);
      } finally {
        setIsSearching(false);
      }
    }, 300); // Wait 300ms after user stops typing

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [searchQuery]);

  const handleSave = () => {
    const lat = parseFloat(temp.lat);
    const lon = parseFloat(temp.lon);

    if (!temp.name.trim()) {
      setTemp(t => ({ ...t, error: "City name cannot be empty." }));
      return;
    }
    if (isNaN(lat) || isNaN(lon) || lat < -90 || lat > 90 || lon < -180 || lon > 180) {
      setTemp(t => ({ ...t, error: "Invalid coordinates! Lat: -90 to 90, Lon: -180 to 180." }));
      return;
    }

    setTemp(t => ({ ...t, error: null }));
    onSave({ name: temp.name.trim(), lat, lon });
  };

  const handleInputChange = (e, key) => {
    setTemp(t => ({ ...t, [key]: e.target.value, error: null }));
  };

  // Select a search result
  const selectResult = (result) => {
    const displayName = result.admin1
      ? `${result.name}, ${result.admin1}`
      : result.name;
    setTemp({
      name: displayName,
      lat: result.latitude,
      lon: result.longitude,
      error: null
    });
    setSearchResults([]);
    setSearchQuery('');
  };

  // Auto-detect location using browser geolocation
  const handleAutoDetect = () => {
    if (!navigator.geolocation) {
      setTemp(t => ({ ...t, error: "Geolocation is not supported by your browser." }));
      return;
    }
    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        // Reverse geocode to get city name
        try {
          const res = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=&count=1&language=en&format=json`);
          // Open-Meteo doesn't support reverse geocoding, so we'll use a fallback
          // Use nominatim for reverse geocoding
          const nominatimRes = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json`);
          const nominatimData = await nominatimRes.json();
          const cityName = nominatimData.address?.city || nominatimData.address?.town || nominatimData.address?.village || nominatimData.address?.county || 'My Location';
          const stateName = nominatimData.address?.state || '';
          const displayName = stateName ? `${cityName}, ${stateName}` : cityName;
          setTemp({
            name: displayName,
            lat: latitude.toFixed(4),
            lon: longitude.toFixed(4),
            error: null
          });
        } catch (e) {
          // Fallback if reverse geocoding fails
          setTemp({
            name: 'My Location',
            lat: latitude.toFixed(4),
            lon: longitude.toFixed(4),
            error: null
          });
        }
        setIsLocating(false);
      },
      (error) => {
        console.error("Geolocation error:", error);
        setTemp(t => ({ ...t, error: "Unable to get your location. Please check permissions." }));
        setIsLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  return (
    <div className="fixed inset-0 bg-black/95 z-50 flex items-center justify-center p-4 font-vt323">
      <div className="rounded-xl p-6 sm:p-8 w-full max-w-md shadow-neon-lg" style={{ backgroundColor: NAVY_BLUE, border: `4px solid ${BRIGHT_CYAN}` }}>
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-3xl text-white font-bold">SET LOCATION</h2>
          <button onClick={onClose} className="text-cyan-400 p-1 hover:text-wb-cyan transition">
            <X size={32} />
          </button>
        </div>

        {/* Auto-detect button */}
        <button
          onClick={handleAutoDetect}
          disabled={isLocating}
          className="w-full p-3 mb-4 text-lg font-bold rounded flex items-center justify-center gap-2 transition-all hover:bg-cyan-900 disabled:opacity-50"
          style={{ backgroundColor: MID_BLUE, border: `2px solid ${BRIGHT_CYAN}`, color: BRIGHT_CYAN }}
        >
          <MapPin size={20} />
          {isLocating ? 'DETECTING...' : 'USE MY CURRENT LOCATION'}
        </button>

        {/* City search */}
        <div className="mb-4 relative">
          <div className="relative">
            <input
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Start typing a city name..."
              className="w-full p-3 text-white text-xl rounded outline-none"
              style={{ backgroundColor: DARK_BLUE, border: `2px solid ${BRIGHT_CYAN}` }}
            />
            {isSearching && (
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                <div className="w-5 h-5 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin"></div>
              </div>
            )}
          </div>

          {/* Autocomplete dropdown */}
          {searchResults.length > 0 && (
            <div className="absolute z-10 w-full mt-1 rounded border-2 overflow-hidden shadow-lg max-h-60 overflow-y-auto" style={{ borderColor: BRIGHT_CYAN, backgroundColor: DARK_BLUE }}>
              {searchResults.map((result, idx) => (
                <button
                  key={idx}
                  onClick={() => selectResult(result)}
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

        <div className="border-t border-cyan-700 pt-4 mt-2">
          <p className="text-sm text-cyan-400 mb-3">Or enter coordinates manually:</p>
          <div className="space-y-3">
            <input
              value={temp.name}
              onChange={e => handleInputChange(e, 'name')}
              placeholder="City Name"
              className="w-full p-3 text-white text-xl rounded outline-none"
              style={{ backgroundColor: DARK_BLUE, border: `2px solid ${BRIGHT_CYAN}` }}
            />
            <div className="flex gap-3">
              <input
                type="number" step="0.0001"
                value={temp.lat}
                onChange={e => handleInputChange(e, 'lat')}
                placeholder="Latitude"
                className="w-1/2 p-3 text-white text-xl rounded outline-none"
                style={{ backgroundColor: DARK_BLUE, border: `2px solid ${BRIGHT_CYAN}` }}
              />
              <input
                type="number" step="0.0001"
                value={temp.lon}
                onChange={e => handleInputChange(e, 'lon')}
                placeholder="Longitude"
                className="w-1/2 p-3 text-white text-xl rounded outline-none"
                style={{ backgroundColor: DARK_BLUE, border: `2px solid ${BRIGHT_CYAN}` }}
              />
            </div>
          </div>
        </div>

        {temp.error && (
          <div className="bg-red-900/50 border border-red-400 p-2 rounded flex items-center gap-2 mt-4">
            <AlertTriangle size={20} className="text-red-400" />
            <p className="text-red-300 text-sm">{temp.error}</p>
          </div>
        )}

        <button
          onClick={handleSave}
          className="mt-6 w-full p-4 text-black text-2xl font-bold rounded shadow-neon-md hover:bg-cyan-300 transition-all active:translate-y-0.5"
          style={{ backgroundColor: BRIGHT_CYAN }}
        >
          SAVE & REBOOT
        </button>
      </div>
    </div>
  );
};

const TabPanel = ({ title, children }) => (
    <div className="flex-grow p-4 sm:p-6 rounded-xl shadow-neon-md min-h-[400px] overflow-auto" style={{ border: `4px solid ${BRIGHT_CYAN}`, background: `linear-gradient(to bottom right, ${DARK_BLUE}, ${NAVY_BLUE})` }}>
        <h2 className="text-3xl text-white font-bold mb-4 border-b border-cyan-700 pb-2">{title}</h2>
        {children}
    </div>
);

const LoadingIndicator = () => (
    <div className="flex items-center justify-center h-full min-h-[300px] text-center">
        <div className="animate-pulse">
            <Zap size={48} className="mx-auto mb-2" style={{ color: BRIGHT_CYAN }} />
            <span className="text-2xl text-cyan-400 font-vt323">ACCESSING DATA STREAM...</span>
        </div>
    </div>
);

// --- Tab Components ---

const AlertsTab = ({ alerts }) => {
    // Alerts are now passed down from App to avoid double fetching
    if (!alerts) return <TabPanel title="ACTIVE ALERTS"><LoadingIndicator /></TabPanel>;

    return (
        <TabPanel title="ACTIVE ALERTS">
            {alerts.length === 0 && (
                <div className="flex flex-col items-center justify-center h-64 text-center">
                    <ShieldAlert size={64} className="text-green-500 mb-4" />
                    <h3 className="text-2xl text-green-400 font-bold">NO ACTIVE ALERTS</h3>
                    <p className="text-cyan-300">There are currently no active watches, warnings, or advisories for this location.</p>
                </div>
            )}
            <div className="space-y-4">
                {alerts.map((alert, idx) => (
                    <div key={idx} className={`p-4 border-l-8 bg-black/30 rounded ${
                        alert.properties.severity === 'Severe' ? 'border-red-500 bg-red-900/20' :
                        alert.properties.severity === 'Moderate' ? 'border-orange-500 bg-orange-900/20' :
                        'border-yellow-500 bg-yellow-900/20'
                    }`}>
                        <div className="flex justify-between items-start mb-2">
                            <h3 className="text-xl font-bold text-white">{alert.properties.headline}</h3>
                            <span className="text-xs bg-black/50 px-2 py-1 rounded text-cyan-300">{alert.properties.severity.toUpperCase()}</span>
                        </div>
                        <p className="text-sm text-gray-300 mb-2 font-vt323">Effective: {new Date(alert.properties.effective).toLocaleString()}</p>
                        <p className="text-sm text-cyan-100 font-vt323 whitespace-pre-wrap">{alert.properties.description}</p>
                        {alert.properties.instruction && (
                            <div className="mt-2 pt-2 border-t border-white/10">
                                <p className="text-xs text-yellow-300 font-bold">INSTRUCTION:</p>
                                <p className="text-xs text-yellow-100 italic">{alert.properties.instruction}</p>
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </TabPanel>
    );
};

const WWADisplayTab = () => (
    <TabPanel title="NATIONAL WATCH / WARNING MAP">
        <div className="text-center space-y-4">
            <div className="flex justify-between items-center mb-2">
                <h3 className="text-2xl text-cyan-300">NWS NATIONAL HAZARDS</h3>
                <a
                    href="https://www.weather.gov/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 px-3 py-1 bg-cyan-900/50 text-cyan-300 rounded border border-cyan-500 hover:bg-cyan-800 hover:text-white transition font-vt323"
                >
                    <MapIcon size={16} /> FULL MAP
                </a>
            </div>

            <div className="relative">
                <img
                    src={NWS_WWA_MAP_URL}
                    alt="National WWA Map"
                    className="w-full h-auto rounded-lg border-4 border-cyan-500 mx-auto max-w-4xl bg-white"
                    onError={(e) => {
                      e.target.onerror = null;
                      e.target.src = PLACEHOLDER_IMG;
                      e.target.nextSibling.style.display = 'flex'; // Show the fallback message container
                    }}
                />
                {/* Fallback container, hidden by default */}
                <div className="hidden absolute inset-0 bg-black/80 items-center justify-center flex-col p-6 text-center">
                    <AlertTriangle size={48} className="text-red-500 mb-2" />
                    <h3 className="text-xl text-red-400 font-bold">IMAGE FEED BLOCKED</h3>
                    <p className="text-cyan-300 mb-4">The National Weather Service server is blocking this image from loading in this specific window.</p>
                </div>
            </div>

            {/* Common Hazards Key */}
            <div className="mt-6 p-4 bg-black/20 border-2 border-cyan-700 rounded-lg">
                <h4 className="text-xl text-white font-bold mb-3 border-b border-cyan-800 pb-1">COMMON HAZARDS KEY</h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-left">
                    <div className="flex items-center gap-2">
                        <div className="w-6 h-6 bg-[#FF0000] border border-white"></div>
                        <span className="text-sm text-cyan-100 font-vt323">Tornado Warning</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-6 h-6 bg-[#FFA500] border border-white"></div>
                        <span className="text-sm text-cyan-100 font-vt323">Severe T-Storm</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-6 h-6 bg-[#00FF00] border border-white"></div>
                        <span className="text-sm text-cyan-100 font-vt323">Flood Warning</span>
                    </div>
                     <div className="flex items-center gap-2">
                        <div className="w-6 h-6 bg-[#8B0000] border border-white"></div>
                        <span className="text-sm text-cyan-100 font-vt323">Flash Flood</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-6 h-6 bg-[#FF69B4] border border-white"></div>
                        <span className="text-sm text-cyan-100 font-vt323">Winter Storm</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-6 h-6 bg-[#DA70D6] border border-white"></div>
                        <span className="text-sm text-cyan-100 font-vt323">Winter Weather Adv</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-6 h-6 bg-[#FF1493] border border-white"></div>
                        <span className="text-sm text-cyan-100 font-vt323">Red Flag Warning</span>
                    </div>
                     <div className="flex items-center gap-2">
                        <div className="w-6 h-6 bg-[#D2B48C] border border-white"></div>
                        <span className="text-sm text-cyan-100 font-vt323">Wind Advisory</span>
                    </div>
                </div>
                <p className="text-xs text-gray-400 mt-3 italic">Note: NWS uses many colors. Refer to weather.gov for full legend.</p>
            </div>
        </div>
    </TabPanel>
);

// Generate a brief weather description based on conditions
const generateWeatherSummary = (current, daily, night) => {
    if (!current || !daily) return "Weather data loading...";

    const temp = Math.round(current.temperature_2m || 0);
    const feelsLike = Math.round(current.apparent_temperature || temp);
    const humidity = current.relative_humidity_2m || 0;
    const windSpeed = Math.round(current.wind_speed_10m || 0);
    const weatherCode = current.weather_code || 0;
    const high = Math.round(daily.temperature_2m_max?.[0] || 0);
    const low = Math.round(daily.temperature_2m_min?.[0] || 0);
    const pop = Math.round(daily.precipitation_probability_max?.[0] || 0);

    let summary = "";

    // Temperature feel
    if (temp <= 32) {
        summary += "Cold conditions with temperatures at or below freezing. ";
    } else if (temp <= 50) {
        summary += "Cool conditions expected. ";
    } else if (temp <= 70) {
        summary += "Mild and comfortable temperatures. ";
    } else if (temp <= 85) {
        summary += "Warm conditions today. ";
    } else {
        summary += "Hot conditions - stay hydrated. ";
    }

    // Wind chill / heat index note
    if (Math.abs(temp - feelsLike) >= 5) {
        if (feelsLike < temp) {
            summary += `Wind chill makes it feel like ${feelsLike}°F. `;
        } else {
            summary += `Heat index makes it feel like ${feelsLike}°F. `;
        }
    }

    // Sky conditions
    if (weatherCode === 0) {
        summary += night ? "Clear skies overnight. " : "Expect sunny skies. ";
    } else if (weatherCode <= 3) {
        summary += "Partly cloudy skies. ";
    } else if (weatherCode <= 48) {
        summary += "Foggy or hazy conditions possible. ";
    } else if (weatherCode <= 67) {
        summary += "Rain expected - grab an umbrella. ";
    } else if (weatherCode <= 82) {
        summary += "Showers and storms possible. ";
    } else if (weatherCode >= 95) {
        summary += "Thunderstorms in the forecast - stay weather aware. ";
    }

    // Precipitation chance
    if (pop >= 70) {
        summary += `High chance of precipitation (${pop}%). `;
    } else if (pop >= 40) {
        summary += `Moderate chance of precipitation (${pop}%). `;
    }

    // Wind
    if (windSpeed >= 25) {
        summary += "Strong winds expected. ";
    } else if (windSpeed >= 15) {
        summary += "Breezy conditions. ";
    }

    // High/Low
    summary += `Today's high near ${high}°F with a low of ${low}°F.`;

    return summary;
};

const CurrentConditionsTab = ({ current, daily, night, isWeatherLoading }) => {
    if (isWeatherLoading) return <LoadingIndicator />;

    const currentData = current || {};
    const dailyData = daily?.time?.[0] ? {
        max: daily.temperature_2m_max[0],
        min: daily.temperature_2m_min[0],
        sunrise: daily.sunrise[0],
        sunset: daily.sunset[0],
    } : {};

    const weatherSummary = generateWeatherSummary(current, daily, night);

    return (
        <TabPanel title="CURRENT CONDITIONS">
            {/* Weather Summary Box */}
            <div className="mb-6 p-4 rounded-lg border-2 border-cyan-600 bg-black/30">
                <h3 className="text-lg text-cyan-300 font-bold mb-2 flex items-center gap-2">
                    <Radio size={18} /> FORECAST SUMMARY
                </h3>
                <p className="text-white text-lg leading-relaxed">{weatherSummary}</p>
            </div>

            <div className="flex flex-col sm:flex-row justify-between items-center sm:items-start mb-8 border-b border-cyan-800 pb-4">
                <div className="text-center sm:text-left mb-4 sm:mb-0">
                    <p className="text-8xl sm:text-[120px] text-white">
                        {Math.round(currentData.temperature_2m || 0)}°F
                    </p>
                    <p className="text-2xl font-vt323 mt-[-10px]" style={{ color: BRIGHT_CYAN }}>
                        {getWeatherDescription(currentData.weather_code)}
                    </p>
                </div>
                <div className="text-9xl sm:text-[150px] text-white/90">
                    {getWeatherIcon(currentData.weather_code, night)}
                </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-white font-vt323 text-lg">
                <div className="p-3 bg-black/20 rounded-lg border border-cyan-700 flex flex-col items-center">
                    <Thermometer size={20} className="text-cyan-400" />
                    <span className="text-sm text-cyan-300">FEELS LIKE</span>
                    <span className="font-bold">{Math.round(currentData.apparent_temperature || currentData.temperature_2m || 0)}°F</span>
                </div>
                <div className="p-3 bg-black/20 rounded-lg border border-cyan-700 flex flex-col items-center">
                    <Wind size={20} className="text-cyan-400" />
                    <span className="text-sm text-cyan-300">WIND</span>
                    <span className="font-bold">{Math.round(currentData.wind_speed_10m || 0)} mph {degreeToCardinal(currentData.wind_direction_10m || 0)}</span>
                </div>
                <div className="p-3 bg-black/20 rounded-lg border border-cyan-700 flex flex-col items-center">
                    <Zap size={20} className="text-cyan-400" />
                    <span className="text-sm text-cyan-300">WIND GUSTS</span>
                    <span className="font-bold">{Math.round(currentData.wind_gusts_10m || 0)} mph</span>
                </div>
                <div className="p-3 bg-black/20 rounded-lg border border-cyan-700 flex flex-col items-center">
                    <Droplets size={20} className="text-cyan-400" />
                    <span className="text-sm text-cyan-300">HUMIDITY</span>
                    <span className="font-bold">{Math.round(currentData.relative_humidity_2m || 0)}%</span>
                </div>
                <div className="p-3 bg-black/20 rounded-lg border border-cyan-700 flex flex-col items-center">
                    <Sunrise size={20} className="text-cyan-400" />
                    <span className="text-sm text-cyan-300">SUNRISE</span>
                    <span className="font-bold">{formatTime(dailyData.sunrise)}</span>
                </div>
                <div className="p-3 bg-black/20 rounded-lg border border-cyan-700 flex flex-col items-center">
                    <Sunset size={20} className="text-cyan-400" />
                    <span className="text-sm text-cyan-300">SUNSET</span>
                    <span className="font-bold">{formatTime(dailyData.sunset)}</span>
                </div>
                <div className="p-3 bg-black/20 rounded-lg border border-cyan-700 flex flex-col items-center">
                    <Maximize size={20} className="text-cyan-400" />
                    <span className="text-sm text-cyan-300">HIGH / LOW</span>
                    <span className="font-bold">{Math.round(dailyData.max || 0)}°F / {Math.round(dailyData.min || 0)}°F</span>
                </div>
                <div className="p-3 bg-black/20 rounded-lg border border-cyan-700 flex flex-col items-center">
                    <Maximize size={20} className="text-cyan-400" />
                    <span className="text-sm text-cyan-300">PRESSURE</span>
                    <span className="font-bold">{(currentData.pressure_msl || 1010).toFixed(1)} hPa</span>
                </div>
            </div>
        </TabPanel>
    );
};

const HourlyForecastTab = ({ hourly, night, isWeatherLoading }) => {
    if (isWeatherLoading) return <LoadingIndicator />;

    const data = hourly?.time ? hourly.time.slice(0, 12).map((time, i) => ({
        time: formatTime(time),
        temp: Math.round(hourly.temperature_2m[i]),
        pop: Math.round(hourly.precipitation_probability[i]),
        code: hourly.weather_code[i],
        wind: Math.round(hourly.wind_speed_10m[i]),
        isNight: isNight(new Date(time), hourly.time[i], hourly.time[i])
    })) : [];

    return (
        <TabPanel title="NEXT 12 HOUR FORECAST">
            <div className="grid grid-cols-4 sm:grid-cols-6 lg:grid-cols-12 gap-3 text-center overflow-x-auto pb-2">
                {data.map((h, index) => (
                    <div key={index} className={`flex flex-col items-center p-3 rounded-lg transition min-w-[70px]
                        ${index === 0 ? '' : 'bg-black/20'}`}
                        style={index === 0 ? { backgroundColor: MID_BLUE, border: `1px solid ${BRIGHT_CYAN}` } : {}}>
                        <p className="text-xs text-cyan-300 font-vt323 mb-1">{h.time}</p>
                        <p className="text-3xl mt-1">{getWeatherIcon(h.code, night)}</p>
                        <p className="text-xl font-bold text-white font-vt323">{h.temp}°F</p>
                        <div className="flex items-center text-xs text-cyan-400 mt-1">
                            <Droplets size={12} className="mr-1" /> {h.pop}%
                        </div>
                        <div className="flex items-center text-xs text-cyan-400 mt-1">
                            <Wind size={12} className="mr-1" /> {h.wind} mph
                        </div>
                    </div>
                ))}
            </div>
        </TabPanel>
    );
};

const DailyOutlookTab = ({ daily, isWeatherLoading }) => {
    if (isWeatherLoading) return <LoadingIndicator />;

    // With 8 forecast days, slice(1, 8) gives indices 1 through 7 (7 days total)
    const data = daily?.time ? daily.time.slice(1, 8).map((time, i) => ({
        day: new Date(time).toLocaleDateString([], { weekday: 'short' }),
        date: formatDate(time),
        max: Math.round(daily.temperature_2m_max[i + 1]),
        min: Math.round(daily.temperature_2m_min[i + 1]),
        pop: Math.round(daily.precipitation_probability_max[i + 1]),
        wind: Math.round(daily.wind_speed_10m_max[i + 1]),
        code: daily.weather_code[i + 1],
    })) : [];

    return (
        <TabPanel title="NEXT 7-DAY OUTLOOK">
            <div className="space-y-3">
                {data.map((d, index) => (
                    <div key={index} className={`flex items-center p-3 rounded-lg border-2 ${index % 2 === 0 ? 'bg-black/20 border-cyan-900' : 'bg-black/40 border-cyan-800'}`}>
                        <div className="w-1/6 text-left">
                            <p className="text-lg font-bold text-cyan-300 font-vt323">{d.day}</p>
                            <p className="text-xs text-cyan-400">{d.date}</p>
                        </div>
                        <div className="w-1/6 text-4xl text-center">{getWeatherIcon(d.code, false)}</div>
                        <div className="w-2/6 text-center">
                            <span className="text-2xl font-vt323 text-white">{d.max}°</span>
                            <span className="text-xl text-cyan-400"> / {d.min}°</span>
                        </div>
                        <div className="w-1/6 text-sm text-center flex flex-col items-center">
                            <Droplets size={16} className="text-cyan-400" />
                            <span className="text-white">{d.pop}%</span>
                        </div>
                        <div className="w-1/6 text-sm text-center flex flex-col items-center">
                            <Wind size={16} className="text-cyan-400" />
                            <span className="text-white">{d.wind} mph</span>
                        </div>
                    </div>
                ))}
            </div>
        </TabPanel>
    );
};

const RadarTab = ({ location }) => (
    <TabPanel title="DOPPLER RADAR">
        <div className="text-center space-y-4">
            <h3 className="text-2xl text-cyan-300">INTERACTIVE RADAR</h3>
            <div className="relative w-full rounded-lg border-4 border-cyan-500 overflow-hidden" style={{ height: '500px' }}>
                <iframe
                    src={`https://embed.windy.com/embed2.html?lat=${location.lat}&lon=${location.lon}&detailLat=${location.lat}&detailLon=${location.lon}&width=650&height=500&zoom=7&level=surface&overlay=radar&product=radar&menu=&message=true&marker=&calendar=now&pressure=&type=map&location=coordinates&detail=&metricWind=mph&metricTemp=%C2%B0F&radarRange=-1`}
                    width="100%"
                    height="100%"
                    frameBorder="0"
                    style={{ border: 0 }}
                    allowFullScreen
                    title="Windy Weather Radar"
                />
            </div>
            <p className="text-xs text-cyan-400">Source: Windy.com - Interactive radar with animation controls</p>
        </div>
    </TabPanel>
);

const SPCOutlookTab = () => (
    <TabPanel title="SPC OUTLOOK (SEVERE WEATHER)">
        <div className="text-center space-y-4">
            <h3 className="text-2xl text-red-400">SEVERE WEATHER THREAT LEVEL (DAY 1)</h3>
            <img
                src={SPC_OUTLOOK_URL}
                alt="SPC Outlook"
                className="w-full h-auto rounded-lg border-4 border-red-500 mx-auto max-w-md bg-white"
                onError={(e) => {
                  e.target.onerror = null;
                  e.target.src = PLACEHOLDER_IMG;
                  e.target.nextSibling.style.display = 'block';
                }}
            />
            <div className="hidden mt-6 p-4 bg-red-900/40 border-l-4 border-red-500 text-left">
                <p className="text-lg text-red-400 font-bold mb-2 flex items-center gap-2"><AlertTriangle size={20}/> CONNECTION FAILED</p>
                <p className="text-sm text-red-300">
                   Unable to load the Storm Prediction Center outlook. Your browser or network environment is blocking this external asset.
                </p>
            </div>
            <p className="text-xs text-cyan-400">Source: NOAA/NWS Storm Prediction Center</p>
        </div>
    </TabPanel>
);

const AlmanacTab = ({ location, userId }) => {
    const today = new Date();
    const [almanacData, setAlmanacData] = useState(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchAlmanacData = async () => {
            setIsLoading(true);
            try {
                // Get today's month and day for historical comparison
                const month = String(today.getMonth() + 1).padStart(2, '0');
                const day = String(today.getDate()).padStart(2, '0');
                const currentYear = today.getFullYear();

                // Fetch historical data for this date across multiple years (last 30 years)
                const startYear = currentYear - 30;
                const historicalPromises = [];

                // Get data for this specific date across past years
                for (let year = startYear; year < currentYear; year++) {
                    const dateStr = `${year}-${month}-${day}`;
                    historicalPromises.push(
                        fetch(`https://archive-api.open-meteo.com/v1/archive?latitude=${location.lat}&longitude=${location.lon}&start_date=${dateStr}&end_date=${dateStr}&daily=temperature_2m_max,temperature_2m_min,precipitation_sum&temperature_unit=fahrenheit&precipitation_unit=inch&timezone=auto`)
                            .then(res => res.ok ? res.json() : null)
                            .catch(() => null)
                    );
                }

                // Fetch YTD precipitation (Jan 1 to today)
                const ytdStartDate = `${currentYear}-01-01`;
                const ytdEndDate = `${currentYear}-${month}-${day}`;
                const ytdPromise = fetch(`https://archive-api.open-meteo.com/v1/archive?latitude=${location.lat}&longitude=${location.lon}&start_date=${ytdStartDate}&end_date=${ytdEndDate}&daily=precipitation_sum&precipitation_unit=inch&timezone=auto`)
                    .then(res => res.ok ? res.json() : null)
                    .catch(() => null);

                // Fetch monthly averages (this month across years)
                const monthStart = `${currentYear - 10}-${month}-01`;
                const monthEnd = `${currentYear - 1}-${month}-28`;
                const monthlyPromise = fetch(`https://archive-api.open-meteo.com/v1/archive?latitude=${location.lat}&longitude=${location.lon}&start_date=${monthStart}&end_date=${monthEnd}&daily=temperature_2m_max,temperature_2m_min&temperature_unit=fahrenheit&timezone=auto`)
                    .then(res => res.ok ? res.json() : null)
                    .catch(() => null);

                const [ytdData, monthlyData, ...historicalResults] = await Promise.all([ytdPromise, monthlyPromise, ...historicalPromises]);

                // Process historical data for this date
                let recordHigh = -999;
                let recordLow = 999;
                let recordPrecip = 0;
                let recordPrecipYear = currentYear;

                historicalResults.forEach((data, idx) => {
                    if (data?.daily) {
                        const high = data.daily.temperature_2m_max?.[0];
                        const low = data.daily.temperature_2m_min?.[0];
                        const precip = data.daily.precipitation_sum?.[0] || 0;
                        const year = startYear + idx;

                        if (high != null && high > recordHigh) recordHigh = high;
                        if (low != null && low < recordLow) recordLow = low;
                        if (precip > recordPrecip) {
                            recordPrecip = precip;
                            recordPrecipYear = year;
                        }
                    }
                });

                // Calculate YTD precipitation
                let ytdPrecip = 0;
                if (ytdData?.daily?.precipitation_sum) {
                    ytdPrecip = ytdData.daily.precipitation_sum.reduce((sum, p) => sum + (p || 0), 0);
                }

                // Calculate monthly averages
                let avgHighMonth = 0;
                let avgLowMonth = 0;
                if (monthlyData?.daily) {
                    const highs = monthlyData.daily.temperature_2m_max?.filter(t => t != null) || [];
                    const lows = monthlyData.daily.temperature_2m_min?.filter(t => t != null) || [];
                    if (highs.length > 0) avgHighMonth = highs.reduce((a, b) => a + b, 0) / highs.length;
                    if (lows.length > 0) avgLowMonth = lows.reduce((a, b) => a + b, 0) / lows.length;
                }

                setAlmanacData({
                    recordHigh: recordHigh > -999 ? Math.round(recordHigh) : '--',
                    recordLow: recordLow < 999 ? Math.round(recordLow) : '--',
                    ytdPrecip: ytdPrecip.toFixed(2),
                    avgHighMonth: avgHighMonth > 0 ? Math.round(avgHighMonth) : '--',
                    avgLowMonth: avgLowMonth > 0 ? Math.round(avgLowMonth) : '--',
                    recordPrecip: recordPrecip.toFixed(2),
                    recordPrecipYear: recordPrecip > 0 ? recordPrecipYear : '--',
                });
            } catch (e) {
                console.error("Almanac fetch error:", e);
                setAlmanacData(null);
            } finally {
                setIsLoading(false);
            }
        };

        if (location.lat && location.lon) {
            fetchAlmanacData();
        }
    }, [location.lat, location.lon]);

    if (isLoading) {
        return (
            <TabPanel title="ALMANAC & SYSTEM CONTROL">
                <LoadingIndicator />
            </TabPanel>
        );
    }

    const displayData = almanacData || {
        recordHigh: '--',
        recordLow: '--',
        ytdPrecip: '--',
        avgHighMonth: '--',
        avgLowMonth: '--',
        recordPrecip: '--',
        recordPrecipYear: '--',
    };

    return (
        <TabPanel title="ALMANAC & SYSTEM CONTROL">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                {/* Almanac Stats */}
                <div className="lg:col-span-2 p-4 rounded-lg space-y-3" style={{ border: `2px solid ${BRIGHT_CYAN}`, backgroundColor: `${MID_BLUE}4D` }}>
                    <h3 className="text-xl text-white font-bold border-b border-cyan-700 pb-2 flex items-center gap-2"><Calendar size={20}/> HISTORICAL DATA FOR {today.toLocaleDateString([], { month: 'long' }).toUpperCase()}</h3>

                    <div className="grid grid-cols-2 gap-4 text-white">
                        <AlmanacStat title="Record High Today" value={`${displayData.recordHigh}°F`} icon={Maximize} />
                        <AlmanacStat title="Record Low Today" value={`${displayData.recordLow}°F`} icon={Minimize} />
                        <AlmanacStat title="Avg High (Monthly)" value={`${displayData.avgHighMonth}°F`} icon={Thermometer} />
                        <AlmanacStat title="Avg Low (Monthly)" value={`${displayData.avgLowMonth}°F`} icon={Thermometer} />
                        <AlmanacStat title="YTD Precipitation" value={`${displayData.ytdPrecip}"`} icon={Droplets} />
                        <AlmanacStat title="System Location" value={location.name} icon={MapPin} />
                    </div>
                    <p className="text-xs text-cyan-400 pt-2">Historical data from Open-Meteo Archive (last 30 years).</p>
                </div>

                {/* Record Precipitation Box */}
                <div className="lg:col-span-1 p-4 rounded-lg space-y-3" style={{ border: `2px solid ${BRIGHT_CYAN}`, backgroundColor: `${MID_BLUE}4D` }}>
                    <h3 className="text-xl text-white font-bold border-b border-cyan-700 pb-2 flex items-center gap-2"><CloudRainWind size={20}/> RECORD PRECIPITATION</h3>
                    <div className="text-center py-4">
                        <p className="text-5xl font-bold text-white">{displayData.recordPrecip}"</p>
                        <p className="text-lg text-cyan-300 mt-2">Record for this date</p>
                        <p className="text-sm text-cyan-400">Set in {displayData.recordPrecipYear}</p>
                    </div>
                    <p className="text-xs text-cyan-400 border-t border-cyan-700 pt-2">Maximum precipitation recorded on this calendar day (last 30 years).</p>
                </div>

                {/* Moon Phase Box */}
                {(() => {
                    const moonData = getMoonPhase(today);
                    return (
                        <div className="lg:col-span-1 p-4 rounded-lg space-y-3" style={{ border: `2px solid ${BRIGHT_CYAN}`, backgroundColor: `${MID_BLUE}4D` }}>
                            <h3 className="text-xl text-white font-bold border-b border-cyan-700 pb-2 flex items-center gap-2"><Moon size={20}/> MOON PHASE</h3>
                            <div className="text-center py-2">
                                <p className="text-7xl mb-2">{moonData.icon}</p>
                                <p className="text-2xl font-bold text-white">{moonData.phaseName}</p>
                                <p className="text-lg text-cyan-300 mt-1">{moonData.illumination}% Illuminated</p>
                                <p className="text-sm text-cyan-400">Day {moonData.phaseDay} of cycle</p>
                            </div>
                        </div>
                    );
                })()}

                {/* System Controls */}
                <div className="lg:col-span-2 p-4 rounded-lg space-y-4" style={{ border: `2px solid ${BRIGHT_CYAN}`, backgroundColor: `${MID_BLUE}4D` }}>
                    <h3 className="text-xl text-white font-bold border-b border-cyan-700 pb-2 flex items-center gap-2"><Menu size={20}/> AUTH STATUS</h3>
                    <p className="text-sm text-cyan-300 font-vt323 break-all">User ID: <span className="text-white">{userId || 'Loading...'}</span></p>
                    <p className="text-xs text-cyan-400 mt-1">Data is saved persistently to your personal storage.</p>
                </div>
            </div>
        </TabPanel>
    );
};

const AlmanacStat = ({ title, value, icon: Icon }) => (
    <div className="flex flex-col p-2 bg-black/20 rounded border border-cyan-800">
        <div className="flex items-center text-cyan-400 text-sm mb-1">
            <Icon size={14} className="mr-1" /> {title}
        </div>
        <span className="text-xl font-bold">{value}</span>
    </div>
);


const AppStatus = ({ isLoading, error, isReady }) => {
  if (error) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-red-900/80 p-4 font-vt323">
        <div className="border-4 border-red-500 rounded-xl p-8 max-w-lg text-center" style={{ backgroundColor: NAVY_BLUE }}>
          <AlertTriangle size={40} className="text-red-400 mx-auto mb-4" />
          <h2 className="text-3xl text-white font-bold mb-3">SYSTEM ERROR</h2>
          <p className="text-red-300 text-lg">{error}</p>
          <p className="text-sm text-gray-400 mt-4">Check console for details and refresh.</p>
        </div>
      </div>
    );
  }
  if (!isReady || isLoading) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 p-4 font-vt323">
        <div className="text-center animate-pulse">
          <h2 className="text-4xl font-bold tracking-widest" style={{ color: BRIGHT_CYAN }}>INITIALIZING WEATHERBIRD...</h2>
          <p className="text-xl text-cyan-400 mt-2">STAND BY</p>
        </div>
      </div>
    );
  }
  return null;
};


// Main Application Component
const App = () => {
  // --- State Hooks ---
  const [db, setDb] = useState(null);
  const [userId, setUserId] = useState(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [location, setLocation] = useState(INITIAL_LOCATION);
  const [weatherData, setWeatherData] = useState(null);
  const [alerts, setAlerts] = useState([]); // State for Alerts
  const [isLoading, setIsLoading] = useState(false);
  const [appError, setAppError] = useState(null);
  const [time, setTime] = useState(new Date());
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(0.5);
  const [currentScreen, setCurrentScreen] = useState(SCREENS.CONDITIONS);

  // --- Refs ---
  const audioRef = useRef(null);
  const weatherIntervalRef = useRef(null);
  const initialLoadRef = useRef(true);

  // --- Auth and Firebase Initialization ---
  useEffect(() => {
    try {
      const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : {};

      // If no Firebase config, run in standalone mode without persistence
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
    // Clock tick
    const clockTick = setInterval(() => setTime(new Date()), 1000);

    // Audio setup
    if (!audioRef.current) {
      audioRef.current = new Audio(MUSIC_URL);
      audioRef.current.loop = true;
    }
    // Update volume whenever state changes
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
        // First load, save the initial fallback location
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

  // --- Alert Fetching Logic (Refactored to App level) ---
  useEffect(() => {
      const fetchAlerts = async () => {
          try {
              const res = await fetch(getNWSAlertsUrl(location.lat, location.lon));
              if (!res.ok) throw new Error('Failed to fetch alerts');
              const data = await res.json();
              setAlerts(data.features || []);
          } catch (err) {
              console.error("Alert fetch error:", err);
              // Don't block app on alert failure
          }
      };

      if (location.lat && location.lon && isAuthReady) {
          fetchAlerts();
      }

      // Refresh alerts every 2 minutes
      const alertInterval = setInterval(() => {
          if (location.lat && location.lon && isAuthReady) fetchAlerts();
      }, 120000);

      return () => clearInterval(alertInterval);
  }, [location, isAuthReady]);

  // --- Fetch Weather on Location Change & Set Interval ---
  useEffect(() => {
    if (!isAuthReady) return;

    // Clear existing interval
    if (weatherIntervalRef.current) {
      clearInterval(weatherIntervalRef.current);
    }

    // Immediately fetch weather for the new location
    fetchWeather(location);

    // Set up recurring fetch (UPDATED TO 60 SECONDS)
    weatherIntervalRef.current = setInterval(() => {
      fetchWeather(location);
    }, REFRESH_RATE_MS);

    // Clean up on component unmount or location change
    return () => {
      if (weatherIntervalRef.current) clearInterval(weatherIntervalRef.current);
    };
  }, [location, isAuthReady, fetchWeather]);

  // --- Location Save Handler ---
  const handleLocationSave = async (newLoc) => {
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
  };

  const current = weatherData?.current;
  const hourly = weatherData?.hourly;
  const daily = weatherData?.daily;
  const night = isNight(time, daily?.sunrise?.[0], daily?.sunset?.[0]);
  const isWeatherLoading = isLoading && !weatherData;

  const renderTabContent = () => {
    switch (currentScreen) {
      case SCREENS.CONDITIONS:
        return <CurrentConditionsTab current={current} daily={daily} night={night} isWeatherLoading={isWeatherLoading} />;
      case SCREENS.ALERTS:
        return <AlertsTab alerts={alerts} />; // Pass alerts here
      case SCREENS.HOURLY:
        return <HourlyForecastTab hourly={hourly} night={night} isWeatherLoading={isWeatherLoading} />;
      case SCREENS.DAILY:
        return <DailyOutlookTab daily={daily} isWeatherLoading={isWeatherLoading} />;
      case SCREENS.RADAR:
        return <RadarTab location={location} />;
      case SCREENS.WWA:
        return <WWADisplayTab />;
      case SCREENS.SPC:
        return <SPCOutlookTab />;
      case SCREENS.ALMANAC:
        return <AlmanacTab location={location} userId={userId} />;
      default:
        return <div>Error: Tab Not Found</div>;
    }
  };

  // Main UI Render
  return (
    <div className="h-screen text-white font-vt323 antialiased flex flex-col overflow-hidden" style={{ backgroundColor: NAVY_BLUE }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=VT323&display=swap');
        .font-vt323 { font-family: 'VT323', monospace; }
        .shadow-neon-md { box-shadow: 0 0 10px 2px rgba(0, 255, 255, 0.5), 0 0 20px 5px rgba(0, 255, 255, 0.2); }
        .shadow-neon-lg { box-shadow: 0 0 15px 3px rgba(0, 255, 255, 0.7), 0 0 30px 8px rgba(0, 255, 255, 0.4); }
        .shadow-inner-neon { box-shadow: inset 0 0 8px rgba(0, 255, 255, 0.5); }
      `}</style>

      {/* App Status Modal (Error/Loading Overlay) */}
      <AppStatus isLoading={isWeatherLoading} error={appError} isReady={isAuthReady} />

      {/* Main Header */}
      <Header time={time} locationName={location.name} onLocationClick={() => setIsModalOpen(true)} timezone={weatherData?.timezone} isPlaying={isPlaying} toggleMusic={toggleMusic} volume={volume} setVolume={setVolume} />

      {/* Main Content Area: Flex container for Sidebar and Content Panel */}
      <main className="flex-grow max-w-7xl w-full mx-auto p-4 sm:p-6 flex flex-col md:flex-row gap-6 overflow-hidden">
          <TabNavigation currentTab={currentScreen} setTab={setCurrentScreen} />
          {renderTabContent()}
      </main>

      {/* Footer Ticker */}
      <Footer
        current={current}
        locationName={location.name}
        alerts={alerts}
      />

      {/* Location Modal */}
      {isModalOpen && (
        <LocationModal
          location={location}
          onSave={handleLocationSave}
          onClose={() => setIsModalOpen(false)}
        />
      )}

      {/* Retro Scanline Overlay */}
      <Scanlines />
    </div>
  );
};

export default App;
