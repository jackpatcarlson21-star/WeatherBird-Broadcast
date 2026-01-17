import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Play, Pause, Thermometer, Wind, Droplets, ArrowRight, Sun, CloudRain, MapPin, X, Volume2, VolumeX, Volume1, Menu, Clock, Calendar, Radio, AlertTriangle, Settings, Zap, Home, ChevronRight, ChevronDown, Sunrise, Sunset, Maximize, Minimize, ShieldAlert, Map as MapIcon, CloudRainWind, Moon, Gauge, Navigation, Star } from 'lucide-react';
import { MapContainer, TileLayer, Polyline, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix for default marker icons in Leaflet with webpack/vite
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
    iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

// --- Firebase ---
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, doc, setDoc, onSnapshot } from 'firebase/firestore';

// --- Config ---
// Fallback location until user's location is loaded from Firestore
const INITIAL_LOCATION = { name: "Lawrenceburg, KY", lat: 38.0337, lon: -84.9966 };

// Music URL - Smooth jazz for that classic weather channel vibe
const MUSIC_URL = "https://stream.zeno.fm/0r0xa792kwzuv";

const REFRESH_RATE_MS = 60000; // 60 seconds

// --- Screens (Tabs) ---
const SCREENS = {
    CONDITIONS: 'CONDITIONS',
    HOURLY: 'HOURLY',
    DAILY: 'DAILY',
    PRECIP: 'PRECIP',
    RADAR: 'RADAR',
    ALERTS: 'ALERTS',
    WWA: 'WWA',
    SPC: 'SPC',
    ALMANAC: 'ALMANAC',
    TRIP_WEATHER: 'TRIP_WEATHER',
    DASHBOARD: 'DASHBOARD',
};

// --- Colors ---
const DARK_BLUE = '#003366';
const NAVY_BLUE = '#001122';
const BRIGHT_CYAN = '#00FFFF';
const MID_BLUE = '#0055AA';

// --- APIs & Live Imagery ---
// Added &forecast_days=8 to ensure we have enough data for a 7-day outlook excluding today
const getWeatherApiUrl = (lat, lon) =>
  `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,apparent_temperature,relative_humidity_2m,weather_code,wind_speed_10m,wind_direction_10m,wind_gusts_10m,precipitation,pressure_msl,dew_point_2m&hourly=temperature_2m,precipitation_probability,precipitation,snowfall,weather_code,wind_speed_10m,pressure_msl&daily=weather_code,temperature_2m_max,temperature_2m_min,sunrise,sunset,precipitation_probability_max,wind_speed_10m_max&temperature_unit=fahrenheit&wind_speed_unit=mph&precipitation_unit=inch&timezone=auto&forecast_days=8&past_hours=6`;

// Air Quality API (Open-Meteo)
const getAirQualityUrl = (lat, lon) =>
  `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat}&longitude=${lon}&current=us_aqi,pm10,pm2_5,carbon_monoxide,nitrogen_dioxide,ozone&timezone=auto`;

// NWS Alerts API
const getNWSAlertsUrl = (lat, lon) => `https://api.weather.gov/alerts/active?point=${lat},${lon}`;

// NWS Points API (to get forecast URL for a location)
const getNWSPointsUrl = (lat, lon) => `https://api.weather.gov/points/${lat},${lon}`;

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

// AQI level info (US EPA standard)
const getAQIInfo = (aqi) => {
  if (aqi === null || aqi === undefined) return { level: 'Unknown', color: 'gray', bgColor: 'bg-gray-500', textColor: 'text-gray-300', description: 'Data unavailable' };
  if (aqi <= 50) return { level: 'Good', color: '#00e400', bgColor: 'bg-green-500', textColor: 'text-green-400', description: 'Air quality is satisfactory' };
  if (aqi <= 100) return { level: 'Moderate', color: '#ffff00', bgColor: 'bg-yellow-500', textColor: 'text-yellow-400', description: 'Acceptable; moderate concern for sensitive people' };
  if (aqi <= 150) return { level: 'Unhealthy for Sensitive Groups', color: '#ff7e00', bgColor: 'bg-orange-500', textColor: 'text-orange-400', description: 'Sensitive groups may experience health effects' };
  if (aqi <= 200) return { level: 'Unhealthy', color: '#ff0000', bgColor: 'bg-red-500', textColor: 'text-red-400', description: 'Everyone may experience health effects' };
  if (aqi <= 300) return { level: 'Very Unhealthy', color: '#8f3f97', bgColor: 'bg-purple-500', textColor: 'text-purple-400', description: 'Health alert: everyone may experience serious effects' };
  return { level: 'Hazardous', color: '#7e0023', bgColor: 'bg-red-900', textColor: 'text-red-300', description: 'Health emergency: everyone is affected' };
};

// Severe weather alert detection for screen flashing
const SEVERE_ALERT_KEYWORDS = [
  'Severe Thunderstorm',
  'Tornado',
  'Tropical Storm',
  'Hurricane',
  'Winter Storm',
  'Blizzard'
];

const getSevereAlertLevel = (alerts) => {
  if (!alerts || alerts.length === 0) return null;

  let hasWarning = false;
  let hasWatch = false;

  for (const alert of alerts) {
    const event = alert.properties?.event?.toLowerCase() || '';

    for (const keyword of SEVERE_ALERT_KEYWORDS) {
      if (event.includes(keyword.toLowerCase())) {
        if (event.includes('warning')) {
          hasWarning = true;
        } else if (event.includes('watch')) {
          hasWatch = true;
        }
      }
    }
  }

  if (hasWarning) return 'warning';
  if (hasWatch) return 'watch';
  return null;
};

// Get severe alerts for banner display
const getSevereAlerts = (alerts) => {
  if (!alerts || alerts.length === 0) return [];

  return alerts.filter(alert => {
    const event = alert.properties?.event?.toLowerCase() || '';
    for (const keyword of SEVERE_ALERT_KEYWORDS) {
      if (event.includes(keyword.toLowerCase()) &&
          (event.includes('warning') || event.includes('watch'))) {
        return true;
      }
    }
    return false;
  });
};

// Get tornado warnings specifically (for full-screen takeover)
const getTornadoWarnings = (alerts) => {
  if (!alerts || alerts.length === 0) return [];
  return alerts.filter(alert => {
    const event = alert.properties?.event?.toLowerCase() || '';
    return event.includes('tornado') && event.includes('warning');
  });
};

// Calculate time remaining until alert expires
const getExpirationCountdown = (expiresTime) => {
  if (!expiresTime) return null;
  const now = new Date();
  const expires = new Date(expiresTime);
  const diffMs = expires - now;

  if (diffMs <= 0) return 'Expired';

  const hours = Math.floor(diffMs / (1000 * 60 * 60));
  const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

  if (hours > 0) {
    return `${hours}h ${minutes}m remaining`;
  }
  return `${minutes}m remaining`;
};

const degreeToCardinal = (deg) => {
  const dirs = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
  return dirs[Math.round(deg / 45) % 8] || "VRB";
};

// Wind Compass Component - shows arrow pointing in wind direction
const WindCompass = ({ degrees, size = 48 }) => {
  // Wind direction is where wind comes FROM, arrow points that direction
  const rotation = degrees;

  return (
    <div
      className="relative rounded-full border-2 border-cyan-600 bg-black/40"
      style={{ width: size, height: size }}
    >
      {/* Cardinal direction markers */}
      <span className="absolute top-0.5 left-1/2 -translate-x-1/2 text-xs text-cyan-500 font-bold">N</span>
      <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 text-xs text-cyan-700">S</span>
      <span className="absolute left-1 top-1/2 -translate-y-1/2 text-xs text-cyan-700">W</span>
      <span className="absolute right-1 top-1/2 -translate-y-1/2 text-xs text-cyan-700">E</span>

      {/* Arrow */}
      <div
        className="absolute inset-0 flex items-center justify-center transition-transform duration-300"
        style={{ transform: `rotate(${rotation}deg)` }}
      >
        <Navigation
          size={size * 0.5}
          className="text-cyan-400 fill-cyan-400"
          style={{ transform: 'rotate(0deg)' }}
        />
      </div>
    </div>
  );
};

// Calculate pressure trend from hourly data
const getPressureTrend = (hourlyData) => {
  if (!hourlyData?.pressure_msl || !hourlyData?.time) return { trend: 'steady', change: 0 };

  const now = new Date();
  let currentIndex = -1;
  let pastIndex = -1;

  // Find current hour and 3 hours ago
  for (let i = 0; i < hourlyData.time.length; i++) {
    const hourTime = new Date(hourlyData.time[i]);
    if (hourTime <= now) {
      currentIndex = i;
    }
    const threeHoursAgo = new Date(now.getTime() - 3 * 60 * 60 * 1000);
    if (hourTime <= threeHoursAgo) {
      pastIndex = i;
    }
  }

  if (currentIndex < 0 || pastIndex < 0 || currentIndex === pastIndex) {
    return { trend: 'steady', change: 0 };
  }

  const currentPressure = hourlyData.pressure_msl[currentIndex];
  const pastPressure = hourlyData.pressure_msl[pastIndex];
  const change = currentPressure - pastPressure;

  // Threshold of 1 hPa over 3 hours is considered significant
  if (change > 1) return { trend: 'rising', change };
  if (change < -1) return { trend: 'falling', change };
  return { trend: 'steady', change };
};

// Pressure Trend Indicator Component
const PressureTrend = ({ hourlyData, currentPressure }) => {
  const { trend, change } = getPressureTrend(hourlyData);

  const trendConfig = {
    rising: { icon: '↑', color: 'text-green-400', label: 'Rising' },
    falling: { icon: '↓', color: 'text-red-400', label: 'Falling' },
    steady: { icon: '→', color: 'text-cyan-400', label: 'Steady' }
  };

  const config = trendConfig[trend];

  return (
    <div className="flex flex-col items-center">
      <div className="flex items-center gap-1">
        <Gauge size={20} className="text-cyan-400" />
        <span className={`text-xl font-bold ${config.color}`}>{config.icon}</span>
      </div>
      <span className="text-sm text-cyan-300">PRESSURE</span>
      <span className="font-bold">{(currentPressure || 1010).toFixed(1)} hPa</span>
      <span className={`text-xs ${config.color}`}>{config.label}</span>
    </div>
  );
};

// Calculate temperature trend from daily forecast data
const getTemperatureTrend = (dailyData) => {
  if (!dailyData?.temperature_2m_max || dailyData.temperature_2m_max.length < 4) {
    return { trend: 'steady', change: 0 };
  }

  // Compare today's high with average of next 3 days
  const todayHigh = dailyData.temperature_2m_max[0];
  const nextThreeDaysAvg = (
    dailyData.temperature_2m_max[1] +
    dailyData.temperature_2m_max[2] +
    dailyData.temperature_2m_max[3]
  ) / 3;

  const change = nextThreeDaysAvg - todayHigh;

  // Threshold of 5°F difference is considered significant
  if (change > 5) return { trend: 'warming', change: Math.round(change) };
  if (change < -5) return { trend: 'cooling', change: Math.round(Math.abs(change)) };
  return { trend: 'steady', change: 0 };
};

// Temperature Trend Indicator Component
const TemperatureTrend = ({ dailyData }) => {
  const { trend, change } = getTemperatureTrend(dailyData);

  const trendConfig = {
    warming: { icon: '↑', color: 'text-orange-400', label: `Warming ~${change}°F` },
    cooling: { icon: '↓', color: 'text-blue-400', label: `Cooling ~${change}°F` },
    steady: { icon: '→', color: 'text-cyan-400', label: 'Steady' }
  };

  const config = trendConfig[trend];

  return (
    <div className="text-center mt-1">
      <span className={`text-sm ${config.color} flex items-center justify-center gap-1`}>
        {config.icon} {config.label} next 3 days
      </span>
    </div>
  );
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

const Header = ({ time, locationName, onLocationClick, timezone, isPlaying, toggleMusic, volume, setVolume, autoCycle, setAutoCycle }) => {
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
    <div className="flex items-center gap-2 sm:gap-5">
      {/* Auto-Cycle Button */}
      <button
        onClick={() => setAutoCycle(!autoCycle)}
        className={`p-2 rounded-full transition shadow-md shrink-0 ${autoCycle ? 'bg-cyan-600' : 'bg-white/10 hover:bg-white/20'}`}
        style={{ border: `1px solid ${BRIGHT_CYAN}` }}
        title={autoCycle ? 'Stop Auto-Cycle' : 'Start Auto-Cycle'}
      >
        <Radio size={18} className={autoCycle ? 'text-white animate-pulse' : 'text-cyan-400'} />
      </button>

      {/* Music Controls */}
      <div className="flex items-center gap-2 px-2 sm:px-3 py-2 rounded-full bg-black/30 shrink-0" style={{ border: `1px solid ${BRIGHT_CYAN}` }}>
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
      <button onClick={onLocationClick} className="p-2 bg-white/10 rounded-full hover:bg-white/20 transition shadow-md shrink-0" style={{ border: `1px solid ${BRIGHT_CYAN}`, color: BRIGHT_CYAN }}>
        <MapPin size={18} style={{ color: BRIGHT_CYAN }} />
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
    const baseText = `CURRENTLY IN ${locationName.toUpperCase()}: ${temp}°F ${cond} - WIND: ${wind} ::: ❤️ WE LOVE YOU SHANNON! ❤️ ::: CAW CAW! ::: THANK YOU FOR USING WEATHERBIRD! ::: `;

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
                    animation: marquee 60s linear infinite;
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
        { id: SCREENS.RADAR, name: 'RADAR' },
        { id: SCREENS.PRECIP, name: 'PRECIP' },
        { id: SCREENS.DASHBOARD, name: 'DASHBOARD' },
        { id: SCREENS.ALERTS, name: 'ALERTS' },
        { id: SCREENS.WWA, name: 'WWA MAP' },
        { id: SCREENS.SPC, name: 'SPC' },
        { id: SCREENS.TRIP_WEATHER, name: 'TRIP' },
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

const LocationModal = ({ location, onSave, onClose, savedLocations = [], onSaveLocation, onDeleteLocation }) => {
  const [temp, setTemp] = useState({ ...location, error: null });
  const [showSaved, setShowSaved] = useState(false);
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

    // Check if geolocation is allowed by permissions policy
    if (navigator.permissions) {
      navigator.permissions.query({ name: 'geolocation' }).then((result) => {
        if (result.state === 'denied') {
          setTemp(t => ({ ...t, error: "Location access denied. Please use the search instead." }));
          return;
        }
      }).catch(() => {
        // Permissions API not fully supported, continue anyway
      });
    }

    setIsLocating(true);
    try {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const { latitude, longitude } = position.coords;
          // Reverse geocode to get city name
          try {
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
          let errorMsg = "Unable to get your location. Please use the search instead.";
          if (error.code === 1) {
            errorMsg = "Location access denied. Please search for your city instead.";
          } else if (error.code === 2) {
            errorMsg = "Location unavailable. Please search for your city instead.";
          } else if (error.code === 3) {
            errorMsg = "Location request timed out. Please search for your city instead.";
          }
          setTemp(t => ({ ...t, error: errorMsg }));
          setIsLocating(false);
        },
        { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 }
      );
    } catch (e) {
      console.error("Geolocation blocked:", e);
      setTemp(t => ({ ...t, error: "GPS is blocked on this site. Please search for your city instead." }));
      setIsLocating(false);
    }
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

        {/* Saved Locations Section */}
        <div className="border-t border-cyan-700 pt-4 mt-4">
          <button
            onClick={() => setShowSaved(!showSaved)}
            className="w-full flex items-center justify-between text-cyan-400 hover:text-cyan-300 transition"
          >
            <span className="flex items-center gap-2">
              <Star size={18} />
              <span className="text-lg">SAVED LOCATIONS ({savedLocations.length})</span>
            </span>
            <span className="text-xl">{showSaved ? '−' : '+'}</span>
          </button>

          {showSaved && (
            <div className="mt-3 space-y-2">
              {savedLocations.length === 0 ? (
                <p className="text-cyan-600 text-sm text-center py-2">No saved locations yet</p>
              ) : (
                savedLocations.map((saved) => (
                  <div
                    key={saved.id}
                    className="flex items-center gap-2 p-2 rounded border border-cyan-800 hover:border-cyan-600 transition"
                    style={{ backgroundColor: DARK_BLUE }}
                  >
                    <button
                      onClick={() => {
                        setTemp({ name: saved.name, lat: saved.lat, lon: saved.lon, error: null });
                        setShowSaved(false);
                      }}
                      className="flex-grow text-left text-white hover:text-cyan-400 transition flex items-center gap-2"
                    >
                      <MapPin size={16} className="text-cyan-400 shrink-0" />
                      <span className="truncate">{saved.name}</span>
                    </button>
                    <button
                      onClick={() => onDeleteLocation(saved.id)}
                      className="p-1 text-red-400 hover:text-red-300 hover:bg-red-900/30 rounded transition"
                      title="Delete location"
                    >
                      <X size={18} />
                    </button>
                  </div>
                ))
              )}

              {/* Save current location button */}
              {temp.name && temp.lat && temp.lon && (
                <button
                  onClick={() => {
                    onSaveLocation({ name: temp.name, lat: parseFloat(temp.lat), lon: parseFloat(temp.lon) });
                  }}
                  className="w-full mt-2 p-2 text-sm rounded border border-yellow-600 text-yellow-400 hover:bg-yellow-900/30 transition flex items-center justify-center gap-2"
                >
                  <Star size={16} />
                  SAVE "{temp.name}" TO FAVORITES
                </button>
              )}
            </div>
          )}
        </div>

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

const AlertsTab = ({ alerts, location }) => {
    const [showRadioModal, setShowRadioModal] = useState(false);
    const [speakingAlertId, setSpeakingAlertId] = useState(null);

    // Text-to-speech handler with toggle support
    const handleSpeak = (alert) => {
        if (!('speechSynthesis' in window)) return;

        const alertId = alert.properties?.id;

        // If already speaking this alert, stop it
        if (speakingAlertId === alertId) {
            window.speechSynthesis.cancel();
            setSpeakingAlertId(null);
            return;
        }

        // Cancel any ongoing speech
        window.speechSynthesis.cancel();

        // Build the text to speak
        const text = `${alert.properties.event}. ${alert.properties.headline}. ${alert.properties.description}. ${alert.properties.instruction || ''}`;

        const utterance = new SpeechSynthesisUtterance(text);

        // Try to find a better voice
        const voices = window.speechSynthesis.getVoices();
        const preferredVoice = voices.find(v =>
            v.name.includes('Google') ||
            v.name.includes('Microsoft') ||
            v.name.includes('Samantha') ||
            v.name.includes('Daniel')
        ) || voices.find(v => v.lang.startsWith('en'));

        if (preferredVoice) {
            utterance.voice = preferredVoice;
        }

        utterance.rate = 1.0;
        utterance.pitch = 1.0;
        utterance.volume = 1.0;

        utterance.onend = () => setSpeakingAlertId(null);
        utterance.onerror = () => setSpeakingAlertId(null);

        setSpeakingAlertId(alertId);
        window.speechSynthesis.speak(utterance);
    };

    // Cleanup speech on unmount
    useEffect(() => {
        return () => {
            if ('speechSynthesis' in window) {
                window.speechSynthesis.cancel();
            }
        };
    }, []);

    // Alerts are now passed down from App to avoid double fetching
    if (!alerts) return <TabPanel title="ACTIVE ALERTS"><LoadingIndicator /></TabPanel>;

    return (
        <TabPanel title="ACTIVE ALERTS">
            {/* NOAA Radio Button */}
            <div className="flex justify-end mb-4">
                <button
                    onClick={() => setShowRadioModal(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-red-900/50 text-red-300 rounded border border-red-500 hover:bg-red-800 hover:text-white transition font-vt323 text-lg"
                >
                    <Radio size={20} /> NOAA WEATHER RADIO
                </button>
            </div>

            {/* NOAA Radio Modal */}
            {showRadioModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
                    <div className="bg-gradient-to-b from-gray-900 to-black border-2 border-red-500 rounded-xl p-6 max-w-md w-full shadow-2xl">
                        <div className="flex justify-between items-center mb-4">
                            <h2 className="text-2xl font-bold text-red-400 flex items-center gap-2">
                                <Radio size={24} /> NOAA WEATHER RADIO
                            </h2>
                            <button
                                onClick={() => setShowRadioModal(false)}
                                className="text-gray-400 hover:text-white transition"
                            >
                                <X size={24} />
                            </button>
                        </div>

                        <p className="text-cyan-300 mb-4 text-sm">
                            Listen to live NOAA Weather Radio for emergency alerts and forecasts near <span className="text-white font-bold">{location?.name || 'your area'}</span>.
                        </p>

                        <div className="space-y-3">
                            <a
                                href="https://noaaweatherradio.org/"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center justify-center gap-2 w-full px-4 py-3 bg-red-700/50 text-white rounded border border-red-400 hover:bg-red-600 hover:text-white transition font-vt323 text-xl"
                            >
                                <Radio size={20} /> LISTEN LIVE - 131+ STATIONS
                            </a>

                            <a
                                href={`https://www.weather.gov/nwr/stations?state=${location?.name?.split(', ').pop() || ''}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center justify-center gap-2 w-full px-4 py-3 bg-blue-900/50 text-blue-300 rounded border border-blue-500 hover:bg-blue-800 hover:text-white transition font-vt323 text-lg"
                            >
                                <MapPin size={18} /> NWS STATION INFO & FREQUENCIES
                            </a>
                        </div>

                        <p className="text-gray-500 text-xs mt-4 text-center">
                            NOAA Weather Radio broadcasts 24/7 weather information directly from National Weather Service offices.
                        </p>
                        <p className="text-yellow-600 text-xs mt-2 text-center">
                            ⚠️ Online streams should not be relied upon for life safety - use a dedicated weather radio receiver.
                        </p>
                    </div>
                </div>
            )}

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
                            <div className="flex items-center gap-2">
                                {/* Text-to-Speech Button */}
                                <button
                                    onClick={() => handleSpeak(alert)}
                                    className={`p-1.5 rounded transition-colors ${
                                        speakingAlertId === alert.properties?.id
                                            ? 'bg-cyan-500 animate-pulse'
                                            : 'bg-cyan-900/50 hover:bg-cyan-700'
                                    }`}
                                    title={speakingAlertId === alert.properties?.id ? "Stop reading" : "Read alert aloud"}
                                >
                                    {speakingAlertId === alert.properties?.id ? (
                                        <VolumeX size={16} className="text-white" />
                                    ) : (
                                        <Volume2 size={16} className="text-cyan-300" />
                                    )}
                                </button>
                                <span className="text-xs bg-black/50 px-2 py-1 rounded text-cyan-300">{alert.properties.severity.toUpperCase()}</span>
                            </div>
                        </div>
                        <div className="flex flex-wrap gap-4 text-sm text-gray-300 mb-2 font-vt323">
                            <span>Effective: {new Date(alert.properties.effective).toLocaleString()}</span>
                            {alert.properties.expires && (
                                <span className="text-yellow-400">
                                    <Clock size={14} className="inline mr-1" />
                                    {getExpirationCountdown(alert.properties.expires)}
                                </span>
                            )}
                        </div>
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

            {/* Comprehensive Hazards Key */}
            <div className="mt-6 p-3 sm:p-4 bg-black/20 border-2 border-cyan-700 rounded-lg">
                <h4 className="text-lg sm:text-xl text-white font-bold mb-3 border-b border-cyan-800 pb-1">HAZARDS KEY</h4>

                {/* Warnings - Most Severe */}
                <div className="mb-4">
                    <h5 className="text-sm text-red-400 font-bold mb-2">WARNINGS (Immediate Action)</h5>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 text-left">
                        <div className="flex items-center gap-2">
                            <div className="w-5 h-5 bg-[#FF0000] border border-white shrink-0"></div>
                            <span className="text-xs text-cyan-100 font-vt323">Tornado</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-5 h-5 bg-[#FFA500] border border-white shrink-0"></div>
                            <span className="text-xs text-cyan-100 font-vt323">Severe T-Storm</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-5 h-5 bg-[#8B0000] border border-white shrink-0"></div>
                            <span className="text-xs text-cyan-100 font-vt323">Flash Flood</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-5 h-5 bg-[#00FF00] border border-white shrink-0"></div>
                            <span className="text-xs text-cyan-100 font-vt323">Flood</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-5 h-5 bg-[#FF69B4] border border-white shrink-0"></div>
                            <span className="text-xs text-cyan-100 font-vt323">Winter Storm</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-5 h-5 bg-[#FF4500] border border-white shrink-0"></div>
                            <span className="text-xs text-cyan-100 font-vt323">Ice Storm</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-5 h-5 bg-[#CD5C5C] border border-white shrink-0"></div>
                            <span className="text-xs text-cyan-100 font-vt323">Blizzard</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-5 h-5 bg-[#FF1493] border border-white shrink-0"></div>
                            <span className="text-xs text-cyan-100 font-vt323">Red Flag</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-5 h-5 bg-[#7CFC00] border border-white shrink-0"></div>
                            <span className="text-xs text-cyan-100 font-vt323">Coastal Flood</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-5 h-5 bg-[#228B22] border border-white shrink-0"></div>
                            <span className="text-xs text-cyan-100 font-vt323">River Flood</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-5 h-5 bg-[#8B4513] border border-white shrink-0"></div>
                            <span className="text-xs text-cyan-100 font-vt323">High Wind</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-5 h-5 bg-[#4169E1] border border-white shrink-0"></div>
                            <span className="text-xs text-cyan-100 font-vt323">Lake Effect Snow</span>
                        </div>
                    </div>
                </div>

                {/* Watches */}
                <div className="mb-4">
                    <h5 className="text-sm text-yellow-400 font-bold mb-2">WATCHES (Be Prepared)</h5>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 text-left">
                        <div className="flex items-center gap-2">
                            <div className="w-5 h-5 bg-[#FFFF00] border border-white shrink-0"></div>
                            <span className="text-xs text-cyan-100 font-vt323">Tornado</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-5 h-5 bg-[#DB7093] border border-white shrink-0"></div>
                            <span className="text-xs text-cyan-100 font-vt323">Severe T-Storm</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-5 h-5 bg-[#2E8B57] border border-white shrink-0"></div>
                            <span className="text-xs text-cyan-100 font-vt323">Flash Flood</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-5 h-5 bg-[#2E8B57] border border-white shrink-0"></div>
                            <span className="text-xs text-cyan-100 font-vt323">Flood</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-5 h-5 bg-[#4682B4] border border-white shrink-0"></div>
                            <span className="text-xs text-cyan-100 font-vt323">Winter Storm</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-5 h-5 bg-[#B8860B] border border-white shrink-0"></div>
                            <span className="text-xs text-cyan-100 font-vt323">High Wind</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-5 h-5 bg-[#FFE4B5] border border-white shrink-0"></div>
                            <span className="text-xs text-cyan-100 font-vt323">Fire Weather</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-5 h-5 bg-[#48D1CC] border border-white shrink-0"></div>
                            <span className="text-xs text-cyan-100 font-vt323">Freeze</span>
                        </div>
                    </div>
                </div>

                {/* Advisories */}
                <div className="mb-4">
                    <h5 className="text-sm text-cyan-400 font-bold mb-2">ADVISORIES (Be Aware)</h5>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 text-left">
                        <div className="flex items-center gap-2">
                            <div className="w-5 h-5 bg-[#D2B48C] border border-white shrink-0"></div>
                            <span className="text-xs text-cyan-100 font-vt323">Wind</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-5 h-5 bg-[#7B68EE] border border-white shrink-0"></div>
                            <span className="text-xs text-cyan-100 font-vt323">Winter Weather</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-5 h-5 bg-[#6495ED] border border-white shrink-0"></div>
                            <span className="text-xs text-cyan-100 font-vt323">Lake Wind</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-5 h-5 bg-[#00CED1] border border-white shrink-0"></div>
                            <span className="text-xs text-cyan-100 font-vt323">Frost</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-5 h-5 bg-[#008080] border border-white shrink-0"></div>
                            <span className="text-xs text-cyan-100 font-vt323">Coastal Flood</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-5 h-5 bg-[#AFEEEE] border border-white shrink-0"></div>
                            <span className="text-xs text-cyan-100 font-vt323">Wind Chill</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-5 h-5 bg-[#F0E68C] border border-white shrink-0"></div>
                            <span className="text-xs text-cyan-100 font-vt323">Dense Fog</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-5 h-5 bg-[#FF7F50] border border-white shrink-0"></div>
                            <span className="text-xs text-cyan-100 font-vt323">Heat</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-5 h-5 bg-[#808080] border border-white shrink-0"></div>
                            <span className="text-xs text-cyan-100 font-vt323">Air Quality</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-5 h-5 bg-[#BDB76B] border border-white shrink-0"></div>
                            <span className="text-xs text-cyan-100 font-vt323">Dust</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-5 h-5 bg-[#EE82EE] border border-white shrink-0"></div>
                            <span className="text-xs text-cyan-100 font-vt323">Freezing Rain</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-5 h-5 bg-[#C71585] border border-white shrink-0"></div>
                            <span className="text-xs text-cyan-100 font-vt323">Extreme Cold</span>
                        </div>
                    </div>
                </div>

                {/* Special */}
                <div>
                    <h5 className="text-sm text-purple-400 font-bold mb-2">SPECIAL STATEMENTS</h5>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 text-left">
                        <div className="flex items-center gap-2">
                            <div className="w-5 h-5 bg-[#FFE4C4] border border-white shrink-0"></div>
                            <span className="text-xs text-cyan-100 font-vt323">Special Weather</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-5 h-5 bg-[#C0C0C0] border border-white shrink-0"></div>
                            <span className="text-xs text-cyan-100 font-vt323">Marine Weather</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-5 h-5 bg-[#FF8C00] border border-white shrink-0"></div>
                            <span className="text-xs text-cyan-100 font-vt323">Excessive Heat</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-5 h-5 bg-[#40E0D0] border border-white shrink-0"></div>
                            <span className="text-xs text-cyan-100 font-vt323">Rip Current</span>
                        </div>
                    </div>
                </div>

                <p className="text-xs text-gray-400 mt-3 italic text-center">Colors match official NWS hazard map. Visit weather.gov for complete details.</p>
            </div>
        </div>
    </TabPanel>
);

// Generate a brief weather description based on conditions
const generateWeatherSummary = (current, daily, night, alerts) => {
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

    // Active weather alerts - show at the beginning for visibility
    if (alerts && alerts.length > 0) {
        const alertCount = alerts.length;
        const alertTypes = alerts.map(a => a.properties?.event).filter(Boolean);
        const uniqueAlerts = [...new Set(alertTypes)];

        if (alertCount === 1) {
            summary += `⚠️ ALERT: ${uniqueAlerts[0]} in effect. `;
        } else {
            summary += `⚠️ ${alertCount} ACTIVE ALERTS: ${uniqueAlerts.slice(0, 3).join(', ')}${uniqueAlerts.length > 3 ? '...' : ''}. `;
        }
    }

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
    } else if (weatherCode <= 57) {
        summary += "Drizzle expected. ";
    } else if (weatherCode <= 67) {
        summary += "Rain expected - grab an umbrella. ";
    } else if (weatherCode <= 77) {
        // Snow codes: 71=light snow, 73=snow, 75=heavy snow, 77=snow grains
        summary += "Snow expected - bundle up! ";
    } else if (weatherCode <= 82) {
        summary += "Rain showers possible. ";
    } else if (weatherCode <= 86) {
        // Snow showers: 85=light snow showers, 86=heavy snow showers
        summary += "Snow showers in the forecast. ";
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

// Bird mascot that reacts to weather
const WeatherBird = ({ temp, weatherCode, windSpeed, night }) => {
    let bird = "🐦";
    let message = "";
    let animation = "";
    let accessory = "";

    // Determine bird state based on conditions
    if (weatherCode >= 95) {
        // Thunderstorm
        bird = "🐦";
        accessory = "⚡";
        message = "YIKES! Stay safe inside!";
        animation = "animate-bounce";
    } else if (weatherCode >= 71 && weatherCode <= 77) {
        // Snow
        bird = "🐦";
        accessory = "❄️";
        message = "Brrr! Bundle up out there!";
        animation = "animate-pulse";
    } else if (weatherCode >= 51 && weatherCode <= 67) {
        // Rain
        bird = "🐦";
        accessory = "☔";
        message = "Don't forget your umbrella!";
        animation = "";
    } else if (windSpeed >= 25) {
        // Very windy
        bird = "🐦";
        accessory = "💨";
        message = "Hold onto your feathers!";
        animation = "animate-wiggle";
    } else if (temp <= 32) {
        // Freezing
        bird = "🥶";
        accessory = "🧣";
        message = "It's freezing! Stay warm!";
        animation = "animate-shiver";
    } else if (temp >= 90) {
        // Hot
        bird = "🐦";
        accessory = "😎";
        message = "Whew! It's a hot one!";
        animation = "animate-pulse";
    } else if (weatherCode === 0 && !night) {
        // Clear and sunny
        bird = "🐦";
        accessory = "☀️";
        message = "Beautiful day! Get outside!";
        animation = "animate-happy";
    } else if (night && weatherCode === 0) {
        // Clear night
        bird = "🦉";
        accessory = "🌙";
        message = "What a lovely night!";
        animation = "";
    } else if (weatherCode <= 3) {
        // Partly cloudy
        bird = "🐦";
        accessory = "⛅";
        message = "Looking pretty nice today!";
        animation = "";
    } else {
        // Default
        bird = "🐦";
        accessory = "";
        message = "CAW CAW!";
        animation = "";
    }

    return (
        <div className="flex flex-col items-center p-4 rounded-lg border-2 border-cyan-600 bg-black/30">
            <style>{`
                @keyframes wiggle {
                    0%, 100% { transform: rotate(-5deg); }
                    50% { transform: rotate(5deg); }
                }
                @keyframes shiver {
                    0%, 100% { transform: translateX(0); }
                    25% { transform: translateX(-2px); }
                    75% { transform: translateX(2px); }
                }
                @keyframes happy {
                    0%, 100% { transform: translateY(0); }
                    50% { transform: translateY(-5px); }
                }
                .animate-wiggle { animation: wiggle 0.3s ease-in-out infinite; }
                .animate-shiver { animation: shiver 0.1s ease-in-out infinite; }
                .animate-happy { animation: happy 0.5s ease-in-out infinite; }
            `}</style>
            <div className={`text-6xl ${animation}`}>
                <span className="relative">
                    {bird}
                    {accessory && <span className="absolute -top-2 -right-4 text-3xl">{accessory}</span>}
                </span>
            </div>
            <p className="text-cyan-300 font-vt323 text-lg mt-2 text-center">{message}</p>
        </div>
    );
};

const CurrentConditionsTab = ({ current, daily, hourly, night, isWeatherLoading, alerts, aqiData }) => {
    if (isWeatherLoading) return <LoadingIndicator />;

    const currentData = current || {};
    const dailyData = daily?.time?.[0] ? {
        max: daily.temperature_2m_max[0],
        min: daily.temperature_2m_min[0],
        sunrise: daily.sunrise[0],
        sunset: daily.sunset[0],
    } : {};

    const aqi = aqiData?.current?.us_aqi;
    const aqiInfo = getAQIInfo(aqi);

    const weatherSummary = generateWeatherSummary(current, daily, night, alerts);

    return (
        <TabPanel title="CURRENT CONDITIONS">
            {/* Weather Summary and Bird Mascot */}
            <div className="flex flex-col sm:flex-row gap-4 mb-6">
                <div className="flex-grow p-4 rounded-lg border-2 border-cyan-600 bg-black/30">
                    <h3 className="text-lg text-cyan-300 font-bold mb-2 flex items-center gap-2">
                        <Radio size={18} /> FORECAST SUMMARY
                    </h3>
                    <p className="text-white text-lg leading-relaxed">{weatherSummary}</p>
                </div>
                <WeatherBird
                    temp={Math.round(currentData.temperature_2m || 0)}
                    weatherCode={currentData.weather_code || 0}
                    windSpeed={Math.round(currentData.wind_speed_10m || 0)}
                    night={night}
                />
            </div>

            <div className="flex flex-col sm:flex-row justify-between items-center sm:items-start mb-8 border-b border-cyan-800 pb-4">
                <div className="text-center sm:text-left mb-4 sm:mb-0">
                    <p className="text-8xl sm:text-[120px] text-white">
                        {Math.round(currentData.temperature_2m || 0)}°F
                    </p>
                    <p className="text-2xl font-vt323 mt-[-10px]" style={{ color: BRIGHT_CYAN }}>
                        {getWeatherDescription(currentData.weather_code)}
                    </p>
                    <TemperatureTrend dailyData={dailyData} />
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
                    <WindCompass degrees={currentData.wind_direction_10m || 0} size={40} />
                    <span className="text-sm text-cyan-300 mt-1">WIND</span>
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
                    <Thermometer size={20} className="text-cyan-400" />
                    <span className="text-sm text-cyan-300">DEW POINT</span>
                    <span className="font-bold">{Math.round(currentData.dew_point_2m || 0)}°F</span>
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
                    <PressureTrend hourlyData={hourly} currentPressure={currentData.pressure_msl} />
                </div>
                {/* Air Quality Index */}
                <div className={`p-3 rounded-lg border flex flex-col items-center col-span-2 ${
                    aqi <= 50 ? 'border-green-500 bg-green-900/20' :
                    aqi <= 100 ? 'border-yellow-500 bg-yellow-900/20' :
                    aqi <= 150 ? 'border-orange-500 bg-orange-900/20' :
                    aqi <= 200 ? 'border-red-500 bg-red-900/20' :
                    aqi <= 300 ? 'border-purple-500 bg-purple-900/20' :
                    'border-red-900 bg-red-950/30'
                }`}>
                    <div className="flex items-center gap-2">
                        <Wind size={20} className={aqiInfo.textColor} />
                        <span className="text-sm text-cyan-300">AIR QUALITY INDEX</span>
                    </div>
                    <div className="flex items-center gap-3 mt-1">
                        <span className={`text-3xl font-bold ${aqiInfo.textColor}`}>{aqi ?? '--'}</span>
                        <div className="text-left">
                            <span className={`font-bold ${aqiInfo.textColor}`}>{aqiInfo.level}</span>
                            <p className="text-xs text-gray-400">{aqiInfo.description}</p>
                        </div>
                    </div>
                </div>
            </div>
        </TabPanel>
    );
};

const HourlyForecastTab = ({ hourly, night, isWeatherLoading }) => {
    if (isWeatherLoading) return <LoadingIndicator />;

    // Find the current hour index in the hourly data
    const now = new Date();
    let startIndex = 0;

    if (hourly?.time) {
        for (let i = 0; i < hourly.time.length; i++) {
            const hourTime = new Date(hourly.time[i]);
            if (hourTime >= now) {
                startIndex = i;
                break;
            }
            if (i === hourly.time.length - 1) {
                startIndex = i;
            }
        }
    }

    // Get next 12 hours starting from current hour
    const data = hourly?.time ? hourly.time.slice(startIndex, startIndex + 12).map((time, i) => {
        const idx = startIndex + i;
        return {
            time: formatTime(time),
            temp: Math.round(hourly.temperature_2m[idx]),
            pop: Math.round(hourly.precipitation_probability[idx]),
            code: hourly.weather_code[idx],
            wind: Math.round(hourly.wind_speed_10m[idx]),
        };
    }) : [];

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

const DailyOutlookTab = ({ location, daily, isWeatherLoading }) => {
    const [nwsForecast, setNwsForecast] = useState(null);
    const [nwsLoading, setNwsLoading] = useState(true);
    const [nwsError, setNwsError] = useState(false);
    const [selectedDay, setSelectedDay] = useState(null);

    // Fetch NWS forecast for more accurate US weather data
    useEffect(() => {
        const fetchNWSForecast = async () => {
            if (!location?.lat || !location?.lon) return;

            setNwsLoading(true);
            setNwsError(false);

            try {
                // First get the forecast URL from the points endpoint
                const pointsRes = await fetch(getNWSPointsUrl(location.lat, location.lon), {
                    headers: { 'User-Agent': 'WeatherBird App' }
                });
                if (!pointsRes.ok) throw new Error('Points fetch failed');
                const pointsData = await pointsRes.json();
                const forecastUrl = pointsData.properties?.forecast;

                if (!forecastUrl) throw new Error('No forecast URL');

                // Now fetch the actual forecast
                const forecastRes = await fetch(forecastUrl, {
                    headers: { 'User-Agent': 'WeatherBird App' }
                });
                if (!forecastRes.ok) throw new Error('Forecast fetch failed');
                const forecastData = await forecastRes.json();

                setNwsForecast(forecastData.properties?.periods || []);
            } catch (err) {
                console.error('NWS forecast error:', err);
                setNwsError(true);
            } finally {
                setNwsLoading(false);
            }
        };

        fetchNWSForecast();
    }, [location?.lat, location?.lon]);

    if (isWeatherLoading && nwsLoading) return <LoadingIndicator />;

    // Process NWS data - periods come as day/night pairs
    // We need to combine them into daily high/low
    let data = [];

    if (nwsForecast && nwsForecast.length > 0 && !nwsError) {
        // NWS returns periods like "Tonight", "Saturday", "Saturday Night", etc.
        // Group them into days
        const days = [];
        let currentDay = null;

        for (const period of nwsForecast) {
            const periodDate = new Date(period.startTime);
            const dateKey = periodDate.toLocaleDateString([], { month: 'short', day: 'numeric' });

            if (period.isDaytime) {
                // Start a new day
                currentDay = {
                    name: period.name,
                    date: dateKey,
                    max: period.temperature,
                    min: null,
                    pop: period.probabilityOfPrecipitation?.value || 0,
                    wind: period.windSpeed,
                    shortForecast: period.shortForecast,
                    detailedForecast: period.detailedForecast,
                    icon: period.icon,
                };
                days.push(currentDay);
            } else if (currentDay && currentDay.min === null) {
                // This is the night following the day
                currentDay.min = period.temperature;
                // Use higher precip chance
                const nightPop = period.probabilityOfPrecipitation?.value || 0;
                if (nightPop > currentDay.pop) currentDay.pop = nightPop;
                // Add night forecast info
                currentDay.nightForecast = period.detailedForecast;
            } else if (!currentDay) {
                // Starts with tonight - create a partial day
                currentDay = {
                    name: 'Tonight',
                    date: dateKey,
                    max: null,
                    min: period.temperature,
                    pop: period.probabilityOfPrecipitation?.value || 0,
                    wind: period.windSpeed,
                    shortForecast: period.shortForecast,
                    detailedForecast: period.detailedForecast,
                    icon: period.icon,
                };
                days.push(currentDay);
            }
        }

        // Convert to our display format (limit to 7 days)
        data = days.slice(0, 7).map((d, idx) => ({
            day: idx === 0 ? (d.name === 'Tonight' ? 'Tonight' : 'Today') : d.name,
            date: d.date,
            max: d.max,
            min: d.min,
            pop: d.pop || 0,
            wind: d.wind || '--',
            shortForecast: d.shortForecast,
            detailedForecast: d.detailedForecast,
            nightForecast: d.nightForecast,
            isToday: idx === 0,
            isNightOnly: d.max === null,
        }));
    } else {
        // Fallback to Open-Meteo data
        data = daily?.time ? daily.time.slice(0, 7).map((timeStr, idx) => {
            const [year, month, day] = timeStr.split('-').map(Number);
            const date = new Date(year, month - 1, day);
            const code = daily.weather_code[idx] ?? 0;
            const high = Math.round(daily.temperature_2m_max[idx] ?? 0);
            const low = Math.round(daily.temperature_2m_min[idx] ?? 0);
            const pop = Math.round(daily.precipitation_probability_max[idx] ?? 0);
            const windSpeed = Math.round(daily.wind_speed_10m_max[idx] ?? 0);

            // Generate a brief description for Open-Meteo fallback
            const condition = getWeatherDescription(code);
            const description = `${condition}. High of ${high}°F, low of ${low}°F. ${pop > 0 ? `${pop}% chance of precipitation. ` : ''}Winds up to ${windSpeed} mph.`;

            return {
                day: idx === 0 ? 'Today' : date.toLocaleDateString([], { weekday: 'short' }),
                date: date.toLocaleDateString([], { month: 'short', day: 'numeric' }),
                max: high,
                min: low,
                pop: pop,
                wind: `${windSpeed} mph`,
                code: code,
                shortForecast: condition,
                detailedForecast: description,
                isToday: idx === 0,
                isNightOnly: false,
            };
        }) : [];
    }

    // Helper to get icon from NWS forecast text
    const getForecastIcon = (shortForecast, nwsIcon) => {
        const forecast = (shortForecast || '').toLowerCase();
        if (forecast.includes('snow')) return '❄️';
        if (forecast.includes('rain') || forecast.includes('shower')) return '🌧️';
        if (forecast.includes('thunder') || forecast.includes('storm')) return '⛈️';
        if (forecast.includes('cloud') || forecast.includes('overcast')) return '☁️';
        if (forecast.includes('partly') || forecast.includes('mostly sunny')) return '⛅';
        if (forecast.includes('fog')) return '🌫️';
        if (forecast.includes('sunny') || forecast.includes('clear')) return '☀️';
        if (nwsIcon?.includes('night')) return '🌙';
        return '☀️';
    };

    return (
        <TabPanel title="7-DAY FORECAST">
            {nwsError && (
                <p className="text-xs text-yellow-400 mb-2 text-center">Using backup forecast data</p>
            )}
            <div className="space-y-3">
                {data.map((d, index) => (
                    <div
                        key={index}
                        className={`rounded-lg border-2 cursor-pointer transition-all duration-200 hover:border-cyan-400 ${
                            d.isToday
                                ? 'bg-cyan-900/30 border-cyan-500'
                                : index % 2 === 0
                                    ? 'bg-black/20 border-cyan-900'
                                    : 'bg-black/40 border-cyan-800'
                        } ${selectedDay === index ? 'ring-2 ring-cyan-400' : ''}`}
                        onClick={() => setSelectedDay(selectedDay === index ? null : index)}
                    >
                        <div className="flex items-center p-3">
                            <div className="w-1/6 text-left">
                                <p className={`text-lg font-bold font-vt323 ${d.isToday ? 'text-cyan-200' : 'text-cyan-300'}`}>{d.day}</p>
                                <p className="text-xs text-cyan-400">{d.date}</p>
                            </div>
                            <div className="w-1/6 text-4xl text-center">
                                {d.shortForecast ? getForecastIcon(d.shortForecast, d.icon) : getWeatherIcon(d.code, false)}
                            </div>
                            <div className="w-2/6 text-center">
                                {d.isNightOnly ? (
                                    <span className="text-xl text-cyan-400">Low: {d.min}°</span>
                                ) : (
                                    <>
                                        <span className="text-2xl font-vt323 text-white">{d.max}°</span>
                                        <span className="text-xl text-cyan-400"> / {d.min !== null ? `${d.min}°` : '--'}</span>
                                    </>
                                )}
                            </div>
                            <div className="w-1/6 text-sm text-center flex flex-col items-center">
                                <Droplets size={16} className="text-cyan-400" />
                                <span className="text-white">{d.pop}%</span>
                            </div>
                            <div className="w-1/6 text-sm text-center flex flex-col items-center">
                                <Wind size={16} className="text-cyan-400" />
                                <span className="text-white">{d.wind}</span>
                            </div>
                            <div className="w-8 flex justify-center">
                                <ChevronRight
                                    size={20}
                                    className={`text-cyan-400 transition-transform duration-200 ${selectedDay === index ? 'rotate-90' : ''}`}
                                />
                            </div>
                        </div>
                        {selectedDay === index && d.detailedForecast && (
                            <div className="px-4 pb-3 pt-1 border-t border-cyan-800/50">
                                <p className="text-sm text-cyan-100 leading-relaxed">{d.detailedForecast}</p>
                                {d.nightForecast && (
                                    <p className="text-sm text-cyan-300 mt-2 leading-relaxed">
                                        <span className="text-cyan-400 font-bold">{d.day === 'Today' || d.day === 'Tonight' ? 'Tonight' : `${d.day} Night`}: </span>{d.nightForecast}
                                    </p>
                                )}
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </TabPanel>
    );
};

// NEXRAD Radar Stations with coordinates (decimal degrees)
const NEXRAD_STATIONS = [
  { id: 'KABR', name: 'Aberdeen, SD', lat: 45.456, lon: -98.413 },
  { id: 'KENX', name: 'Albany, NY', lat: 42.586, lon: -74.064 },
  { id: 'KABX', name: 'Albuquerque, NM', lat: 35.150, lon: -106.824 },
  { id: 'KAMA', name: 'Amarillo, TX', lat: 35.233, lon: -101.709 },
  { id: 'KFFC', name: 'Atlanta, GA', lat: 33.364, lon: -84.566 },
  { id: 'KEWX', name: 'Austin/San Antonio, TX', lat: 29.704, lon: -98.028 },
  { id: 'KBBX', name: 'Beale AFB, CA', lat: 39.496, lon: -121.632 },
  { id: 'KBGM', name: 'Binghamton, NY', lat: 42.200, lon: -75.985 },
  { id: 'KBMX', name: 'Birmingham, AL', lat: 33.172, lon: -86.770 },
  { id: 'KBIS', name: 'Bismarck, ND', lat: 46.771, lon: -100.760 },
  { id: 'KBOX', name: 'Boston, MA', lat: 41.956, lon: -71.137 },
  { id: 'KBRO', name: 'Brownsville, TX', lat: 25.916, lon: -97.419 },
  { id: 'KBUF', name: 'Buffalo, NY', lat: 42.949, lon: -78.737 },
  { id: 'KCXX', name: 'Burlington, VT', lat: 44.511, lon: -73.167 },
  { id: 'KCAE', name: 'Columbia, SC', lat: 33.949, lon: -81.118 },
  { id: 'KCLX', name: 'Charleston, SC', lat: 32.656, lon: -81.042 },
  { id: 'KRLX', name: 'Charleston, WV', lat: 38.311, lon: -81.723 },
  { id: 'KCYS', name: 'Cheyenne, WY', lat: 41.152, lon: -104.806 },
  { id: 'KLOT', name: 'Chicago, IL', lat: 41.605, lon: -88.085 },
  { id: 'KILN', name: 'Cincinnati, OH', lat: 39.420, lon: -83.822 },
  { id: 'KCLE', name: 'Cleveland, OH', lat: 41.413, lon: -81.860 },
  { id: 'KCRP', name: 'Corpus Christi, TX', lat: 27.784, lon: -97.511 },
  { id: 'KFWS', name: 'Dallas/Fort Worth, TX', lat: 32.573, lon: -97.303 },
  { id: 'KDVN', name: 'Davenport, IA', lat: 41.612, lon: -90.581 },
  { id: 'KFTG', name: 'Denver, CO', lat: 39.787, lon: -104.546 },
  { id: 'KDMX', name: 'Des Moines, IA', lat: 41.731, lon: -93.723 },
  { id: 'KDTX', name: 'Detroit, MI', lat: 42.700, lon: -83.472 },
  { id: 'KDDC', name: 'Dodge City, KS', lat: 37.761, lon: -99.969 },
  { id: 'KDLH', name: 'Duluth, MN', lat: 46.837, lon: -92.210 },
  { id: 'KEPZ', name: 'El Paso, TX', lat: 31.873, lon: -106.698 },
  { id: 'KEOX', name: 'Fort Rucker, AL', lat: 31.461, lon: -85.459 },
  { id: 'KAPX', name: 'Gaylord, MI', lat: 44.907, lon: -84.720 },
  { id: 'KGGW', name: 'Glasgow, MT', lat: 48.206, lon: -106.625 },
  { id: 'KGLD', name: 'Goodland, KS', lat: 39.367, lon: -101.700 },
  { id: 'KMVX', name: 'Grand Forks, ND', lat: 47.528, lon: -97.325 },
  { id: 'KGJX', name: 'Grand Junction, CO', lat: 39.062, lon: -108.214 },
  { id: 'KGRR', name: 'Grand Rapids, MI', lat: 42.894, lon: -85.545 },
  { id: 'KTFX', name: 'Great Falls, MT', lat: 47.460, lon: -111.385 },
  { id: 'KGRB', name: 'Green Bay, WI', lat: 44.499, lon: -88.111 },
  { id: 'KGSP', name: 'Greenville/Spartanburg, SC', lat: 34.883, lon: -82.220 },
  { id: 'KUEX', name: 'Hastings, NE', lat: 40.321, lon: -98.442 },
  { id: 'KHGX', name: 'Houston, TX', lat: 29.472, lon: -95.079 },
  { id: 'KIND', name: 'Indianapolis, IN', lat: 39.708, lon: -86.280 },
  { id: 'KJKL', name: 'Jackson, KY', lat: 37.591, lon: -83.313 },
  { id: 'KJAN', name: 'Jackson, MS', lat: 32.318, lon: -90.080 },
  { id: 'KJAX', name: 'Jacksonville, FL', lat: 30.485, lon: -81.702 },
  { id: 'KEAX', name: 'Kansas City, MO', lat: 38.810, lon: -94.264 },
  { id: 'KBYX', name: 'Key West, FL', lat: 24.598, lon: -81.703 },
  { id: 'KMRX', name: 'Knoxville, TN', lat: 36.169, lon: -83.402 },
  { id: 'KARX', name: 'La Crosse, WI', lat: 43.823, lon: -91.191 },
  { id: 'KLCH', name: 'Lake Charles, LA', lat: 30.125, lon: -93.216 },
  { id: 'KESX', name: 'Las Vegas, NV', lat: 35.701, lon: -114.891 },
  { id: 'KDFX', name: 'Laughlin AFB, TX', lat: 29.273, lon: -100.281 },
  { id: 'KILX', name: 'Lincoln, IL', lat: 40.151, lon: -89.337 },
  { id: 'KLZK', name: 'Little Rock, AR', lat: 34.836, lon: -92.262 },
  { id: 'KVTX', name: 'Los Angeles, CA', lat: 34.412, lon: -119.179 },
  { id: 'KLVX', name: 'Louisville, KY', lat: 37.975, lon: -85.944 },
  { id: 'KLBB', name: 'Lubbock, TX', lat: 33.654, lon: -101.814 },
  { id: 'KMQT', name: 'Marquette, MI', lat: 46.531, lon: -87.548 },
  { id: 'KMLB', name: 'Melbourne, FL', lat: 28.113, lon: -80.654 },
  { id: 'KNQA', name: 'Memphis, TN', lat: 35.345, lon: -89.873 },
  { id: 'KAMX', name: 'Miami, FL', lat: 25.611, lon: -80.413 },
  { id: 'KMAF', name: 'Midland, TX', lat: 31.943, lon: -102.189 },
  { id: 'KMKX', name: 'Milwaukee, WI', lat: 42.968, lon: -88.551 },
  { id: 'KMPX', name: 'Minneapolis, MN', lat: 44.849, lon: -93.566 },
  { id: 'KMBX', name: 'Minot, ND', lat: 48.393, lon: -100.865 },
  { id: 'KMOB', name: 'Mobile, AL', lat: 30.679, lon: -88.240 },
  { id: 'KVAX', name: 'Moody AFB, GA', lat: 30.890, lon: -83.002 },
  { id: 'KMHX', name: 'Morehead City, NC', lat: 34.776, lon: -76.876 },
  { id: 'KOHX', name: 'Nashville, TN', lat: 36.247, lon: -86.563 },
  { id: 'KLIX', name: 'New Orleans, LA', lat: 30.337, lon: -89.826 },
  { id: 'KOKX', name: 'New York City, NY', lat: 40.866, lon: -72.864 },
  { id: 'KAKQ', name: 'Norfolk, VA', lat: 36.984, lon: -77.008 },
  { id: 'KLNX', name: 'North Platte, NE', lat: 41.958, lon: -100.576 },
  { id: 'KTLX', name: 'Oklahoma City, OK', lat: 35.333, lon: -97.278 },
  { id: 'KOAX', name: 'Omaha, NE', lat: 41.320, lon: -96.367 },
  { id: 'KPAH', name: 'Paducah, KY', lat: 37.068, lon: -88.772 },
  { id: 'KPDT', name: 'Pendleton, OR', lat: 45.691, lon: -118.853 },
  { id: 'KDIX', name: 'Philadelphia, PA', lat: 39.947, lon: -74.411 },
  { id: 'KIWA', name: 'Phoenix, AZ', lat: 33.289, lon: -111.670 },
  { id: 'KPBZ', name: 'Pittsburgh, PA', lat: 40.532, lon: -80.218 },
  { id: 'KGYX', name: 'Portland, ME', lat: 43.891, lon: -70.256 },
  { id: 'KRTX', name: 'Portland, OR', lat: 45.715, lon: -122.966 },
  { id: 'KPUX', name: 'Pueblo, CO', lat: 38.460, lon: -104.181 },
  { id: 'KRAX', name: 'Raleigh, NC', lat: 35.666, lon: -78.490 },
  { id: 'KUDX', name: 'Rapid City, SD', lat: 44.125, lon: -102.830 },
  { id: 'KRGX', name: 'Reno, NV', lat: 39.754, lon: -119.462 },
  { id: 'KRIW', name: 'Riverton, WY', lat: 43.066, lon: -108.477 },
  { id: 'KFCX', name: 'Roanoke, VA', lat: 37.024, lon: -80.274 },
  { id: 'KJGX', name: 'Robins AFB, GA', lat: 32.675, lon: -83.351 },
  { id: 'KDAX', name: 'Sacramento, CA', lat: 38.501, lon: -121.678 },
  { id: 'KLSX', name: 'St. Louis, MO', lat: 38.699, lon: -90.683 },
  { id: 'KMTX', name: 'Salt Lake City, UT', lat: 41.263, lon: -112.448 },
  { id: 'KSJT', name: 'San Angelo, TX', lat: 31.371, lon: -100.493 },
  { id: 'KNKX', name: 'San Diego, CA', lat: 32.919, lon: -117.042 },
  { id: 'KMUX', name: 'San Francisco, CA', lat: 37.155, lon: -121.898 },
  { id: 'KHNX', name: 'San Joaquin Valley, CA', lat: 36.314, lon: -119.632 },
  { id: 'KSOX', name: 'Santa Ana Mountains, CA', lat: 33.818, lon: -117.636 },
  { id: 'KATX', name: 'Seattle, WA', lat: 48.195, lon: -122.496 },
  { id: 'KSHV', name: 'Shreveport, LA', lat: 32.451, lon: -93.841 },
  { id: 'KFSD', name: 'Sioux Falls, SD', lat: 43.588, lon: -96.729 },
  { id: 'KOTX', name: 'Spokane, WA', lat: 47.680, lon: -117.627 },
  { id: 'KSGF', name: 'Springfield, MO', lat: 37.235, lon: -93.400 },
  { id: 'KCCX', name: 'State College, PA', lat: 40.923, lon: -78.004 },
  { id: 'KLWX', name: 'Sterling, VA (DC)', lat: 38.976, lon: -77.478 },
  { id: 'KTLH', name: 'Tallahassee, FL', lat: 30.398, lon: -84.329 },
  { id: 'KTBW', name: 'Tampa, FL', lat: 27.706, lon: -82.402 },
  { id: 'KTWX', name: 'Topeka, KS', lat: 38.997, lon: -96.233 },
  { id: 'KEMX', name: 'Tucson, AZ', lat: 31.894, lon: -110.630 },
  { id: 'KINX', name: 'Tulsa, OK', lat: 36.175, lon: -95.565 },
  { id: 'KVNX', name: 'Vance AFB, OK', lat: 36.741, lon: -98.128 },
  { id: 'KICT', name: 'Wichita, KS', lat: 37.655, lon: -97.443 },
  { id: 'KLTX', name: 'Wilmington, NC', lat: 33.989, lon: -78.429 },
];

// Find nearest radar station to a given location
const findNearestRadar = (lat, lon) => {
  let nearest = NEXRAD_STATIONS[0];
  let minDist = Infinity;

  for (const station of NEXRAD_STATIONS) {
    const dLat = station.lat - lat;
    const dLon = station.lon - lon;
    const dist = dLat * dLat + dLon * dLon;
    if (dist < minDist) {
      minDist = dist;
      nearest = station;
    }
  }
  return nearest;
};

const RadarTab = ({ location }) => {
  const nearestRadar = useMemo(() => findNearestRadar(location.lat, location.lon), [location.lat, location.lon]);
  const radarUrl = `https://radar.weather.gov/ridge/standard/${nearestRadar.id}_loop.gif`;

  return (
    <TabPanel title="DOPPLER RADAR">
      <div className="text-center space-y-4">
        <h3 className="text-xl sm:text-2xl text-cyan-300">NEXRAD RADAR - {nearestRadar.id}</h3>
        <p className="text-sm text-cyan-400">{nearestRadar.name}</p>
        <div className="relative w-full rounded-lg border-4 border-cyan-500 overflow-hidden bg-black flex items-center justify-center" style={{ minHeight: '500px' }}>
          <img
            src={radarUrl}
            alt={`NEXRAD Radar ${nearestRadar.id}`}
            className="max-w-full max-h-full"
            style={{ imageRendering: 'pixelated' }}
          />
        </div>
        <p className="text-xs text-cyan-400">Source: NOAA/NWS RIDGE Radar - Auto-refreshes every few minutes</p>
      </div>
    </TabPanel>
  );
};

const SPCOutlookTab = () => {
    const [selectedDay, setSelectedDay] = useState(1);

    const outlookMaps = [
        { day: 1, name: 'DAY 1', url: 'https://www.spc.noaa.gov/products/outlook/day1otlk.gif' },
        { day: 2, name: 'DAY 2', url: 'https://www.spc.noaa.gov/products/outlook/day2otlk.gif' },
        { day: 3, name: 'DAY 3', url: 'https://www.spc.noaa.gov/products/outlook/day3otlk.gif' },
    ];

    const currentMap = outlookMaps.find(m => m.day === selectedDay);

    return (
        <TabPanel title="SPC OUTLOOK (SEVERE WEATHER)">
            <div className="space-y-4">
                {/* Day Selector */}
                <div className="flex justify-center gap-2 sm:gap-4">
                    {outlookMaps.map(outlook => (
                        <button
                            key={outlook.day}
                            onClick={() => setSelectedDay(outlook.day)}
                            className={`px-4 sm:px-6 py-2 sm:py-3 rounded-lg font-vt323 text-lg sm:text-xl transition-all ${
                                selectedDay === outlook.day
                                    ? 'bg-red-600 text-white border-2 border-white shadow-lg'
                                    : 'bg-black/30 text-red-300 border-2 border-red-700 hover:border-red-500 hover:bg-red-900/30'
                            }`}
                        >
                            {outlook.name}
                        </button>
                    ))}
                </div>

                {/* Map Display */}
                <div className="text-center">
                    <h3 className="text-xl sm:text-2xl text-red-400 mb-3">
                        SEVERE WEATHER THREAT LEVEL ({currentMap?.name})
                    </h3>
                    <img
                        key={selectedDay}
                        src={currentMap?.url}
                        alt={`SPC ${currentMap?.name} Outlook`}
                        className="w-full h-auto rounded-lg border-4 border-red-500 mx-auto max-w-lg bg-white"
                        onError={(e) => {
                            e.target.onerror = null;
                            e.target.src = PLACEHOLDER_IMG;
                        }}
                    />
                </div>

                {/* Risk Level Legend */}
                <div className="p-3 sm:p-4 bg-black/20 border-2 border-red-700 rounded-lg">
                    <h4 className="text-lg text-white font-bold mb-2 border-b border-red-800 pb-1">RISK LEVELS</h4>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2 text-xs sm:text-sm">
                        <div className="flex items-center gap-2">
                            <div className="w-4 h-4 sm:w-5 sm:h-5 rounded" style={{ backgroundColor: '#66A366' }}></div>
                            <span className="text-cyan-100">Thunderstorm</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-4 h-4 sm:w-5 sm:h-5 rounded" style={{ backgroundColor: '#008000' }}></div>
                            <span className="text-cyan-100">Marginal (1)</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-4 h-4 sm:w-5 sm:h-5 rounded" style={{ backgroundColor: '#FFFF00' }}></div>
                            <span className="text-cyan-100">Slight (2)</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-4 h-4 sm:w-5 sm:h-5 rounded" style={{ backgroundColor: '#FFA500' }}></div>
                            <span className="text-cyan-100">Enhanced (3)</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-4 h-4 sm:w-5 sm:h-5 rounded" style={{ backgroundColor: '#FF0000' }}></div>
                            <span className="text-cyan-100">Moderate (4)</span>
                        </div>
                        <div className="flex items-center gap-2 sm:col-span-3 md:col-span-5 justify-center">
                            <div className="w-4 h-4 sm:w-5 sm:h-5 rounded" style={{ backgroundColor: '#FF00FF' }}></div>
                            <span className="text-cyan-100">High (5)</span>
                        </div>
                    </div>
                </div>

                <p className="text-xs text-cyan-400 text-center">Source: NOAA/NWS Storm Prediction Center</p>
            </div>
        </TabPanel>
    );
};

const PrecipGraphTab = ({ hourly, isWeatherLoading }) => {
    if (isWeatherLoading) return <LoadingIndicator />;

    // Find the current hour index in the hourly data
    // The API returns hourly data starting from midnight, so we need to find which index matches "now"
    const now = new Date();
    let startIndex = 0;

    if (hourly?.time) {
        // Find the first hour that is >= current time
        for (let i = 0; i < hourly.time.length; i++) {
            const hourTime = new Date(hourly.time[i]);
            if (hourTime >= now) {
                startIndex = i;
                break;
            }
            // If we've passed all times, use the last available
            if (i === hourly.time.length - 1) {
                startIndex = i;
            }
        }
    }

    // Get next 12 hours of precipitation data starting from current hour (rain + snow)
    // Note: Open-Meteo's "precipitation" already includes rain + snow water equivalent
    // "snowfall" is the actual snow accumulation in cm (converted to inches by API since we use precipitation_unit=inch)
    const data = hourly?.time ? hourly.time.slice(startIndex, startIndex + 12).map((time, i) => {
        const idx = startIndex + i;
        const totalPrecip = hourly.precipitation?.[idx] || 0; // Total precip (rain + snow water equiv)
        const snowfall = hourly.snowfall?.[idx] || 0; // Snow accumulation in inches
        const hasSnow = snowfall > 0;
        // If there's snowfall, show snow. Otherwise if there's precip, it's rain
        const hasRain = totalPrecip > 0 && !hasSnow;

        return {
            time: new Date(time).toLocaleTimeString([], { hour: 'numeric' }),
            probability: Math.round(hourly.precipitation_probability?.[idx] || 0),
            rain: hasRain ? totalPrecip : 0,
            snow: snowfall,
            // For amount, show snowfall if snowing, otherwise show precip (rain)
            amount: hasSnow ? snowfall : totalPrecip,
            hasSnow,
            hasRain,
        };
    }) : [];

    // Find the max amount for scaling the second graph
    const maxAmount = Math.max(...data.map(d => d.amount), 0.1);

    // Calculate totals
    const totalRain = data.reduce((sum, d) => sum + d.rain, 0);
    const totalSnow = data.reduce((sum, d) => sum + d.snow, 0);
    // Total precip: for display, sum rain + snow accumulation
    const totalPrecip = data.reduce((sum, d) => sum + d.amount, 0);
    const avgProb = data.length > 0
        ? Math.round(data.reduce((sum, d) => sum + d.probability, 0) / data.length)
        : 0;
    const maxProbHour = data.reduce((max, d) => d.probability > max.probability ? d : max, { probability: 0, time: '--' });
    const maxAmountHour = data.reduce((max, d) => d.amount > max.amount ? d : max, { amount: 0, time: '--', hasSnow: false });

    // Reusable bar component for both graphs
    const PrecipBar = ({ value, maxValue, label, time, type, hasSnow, hasRain }) => {
        const heightPercent = type === 'chance'
            ? (value / 100) * 100
            : (maxValue > 0 ? (value / maxValue) * 100 : 0);

        let barColor;
        if (type === 'chance') {
            barColor = 'bg-cyan-800';
            if (value >= 70) barColor = 'bg-blue-500';
            else if (value >= 50) barColor = 'bg-cyan-500';
            else if (value >= 30) barColor = 'bg-cyan-600';
        } else if (hasSnow) {
            // Snow colors - white/purple theme
            barColor = 'bg-purple-400';
            if (value >= 0.5) barColor = 'bg-purple-300';
            else if (value >= 0.25) barColor = 'bg-purple-400';
            else if (value >= 0.1) barColor = 'bg-purple-500';
            else if (value > 0) barColor = 'bg-purple-600';
        } else {
            // Rain colors - green/blue theme
            barColor = 'bg-green-800';
            if (value >= 0.5) barColor = 'bg-blue-600';
            else if (value >= 0.25) barColor = 'bg-blue-500';
            else if (value >= 0.1) barColor = 'bg-green-500';
            else if (value > 0) barColor = 'bg-green-600';
        }

        const glowStyle = type === 'chance'
            ? (value >= 50 ? '0 0 10px rgba(0, 255, 255, 0.5)' : 'none')
            : hasSnow && value >= 0.1
                ? '0 0 10px rgba(200, 150, 255, 0.5)'
                : (value >= 0.25 ? '0 0 10px rgba(0, 200, 100, 0.5)' : 'none');

        return (
            <div className="flex flex-col items-center justify-end h-full min-w-[40px] sm:min-w-0 sm:flex-1">
                <span className="text-[10px] sm:text-xs text-white mb-1 font-bold whitespace-nowrap">
                    {label}
                </span>
                <div
                    className={`w-full max-w-[30px] sm:max-w-none ${barColor} rounded-t transition-all duration-300 min-h-[4px]`}
                    style={{
                        height: `${Math.max(heightPercent, type === 'amount' && value > 0 ? 5 : 2)}%`,
                        boxShadow: glowStyle
                    }}
                />
                {/* Show snow/rain icon below bar */}
                {type === 'amount' && (hasSnow || hasRain) && (
                    <span className="text-[10px] mt-0.5">{hasSnow ? '❄️' : '🌧️'}</span>
                )}
                <span className="text-[10px] sm:text-xs text-cyan-300 mt-1 sm:mt-2 font-vt323">
                    {time}
                </span>
            </div>
        );
    };

    return (
        <TabPanel title="12-HOUR PRECIPITATION FORECAST">
            <div className="space-y-4 sm:space-y-6">
                {/* Summary Stats - Moved to top for mobile */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
                    <div className="p-2 sm:p-3 bg-black/20 rounded-lg border border-cyan-700 text-center">
                        <p className="text-[10px] sm:text-xs text-cyan-400 mb-1">AVG CHANCE</p>
                        <p className="text-xl sm:text-2xl font-bold text-white">{avgProb}%</p>
                    </div>
                    <div className="p-2 sm:p-3 bg-black/20 rounded-lg border border-cyan-700 text-center">
                        <p className="text-[10px] sm:text-xs text-cyan-400 mb-1">PEAK CHANCE</p>
                        <p className="text-xl sm:text-2xl font-bold text-white">{maxProbHour.probability}%</p>
                        <p className="text-[10px] sm:text-xs text-cyan-300">{maxProbHour.time}</p>
                    </div>
                    <div className="p-2 sm:p-3 bg-black/20 rounded-lg border border-cyan-700 text-center">
                        <p className="text-[10px] sm:text-xs text-cyan-400 mb-1">12HR TOTAL</p>
                        <p className="text-xl sm:text-2xl font-bold text-white">{totalPrecip.toFixed(2)}"</p>
                        {totalSnow > 0 && <p className="text-[10px] text-purple-300">❄️ {totalSnow.toFixed(2)}" snow</p>}
                    </div>
                    <div className="p-2 sm:p-3 bg-black/20 rounded-lg border border-cyan-700 text-center">
                        <p className="text-[10px] sm:text-xs text-cyan-400 mb-1">PEAK AMOUNT</p>
                        <p className="text-xl sm:text-2xl font-bold text-white">{maxAmountHour.amount.toFixed(2)}"</p>
                        <p className="text-[10px] sm:text-xs text-cyan-300">{maxAmountHour.time} {maxAmountHour.hasSnow ? '❄️' : ''}</p>
                    </div>
                </div>

                {/* Probability Graph */}
                <div>
                    <div className="flex items-center gap-2 text-cyan-300 mb-2">
                        <Droplets size={18} className="shrink-0" />
                        <span className="text-sm sm:text-lg">CHANCE OF PRECIPITATION</span>
                    </div>
                    <div className="bg-black/30 rounded-lg border-2 border-cyan-700 p-2 sm:p-4">
                        <div className="overflow-x-auto pb-2 -mx-2 px-2 sm:overflow-visible sm:mx-0 sm:px-0">
                            <div className="flex items-end gap-1 sm:gap-2 h-32 sm:h-40 min-w-[480px] sm:min-w-0">
                                {data.map((hour, index) => (
                                    <PrecipBar
                                        key={index}
                                        value={hour.probability}
                                        maxValue={100}
                                        label={`${hour.probability}%`}
                                        time={hour.time}
                                        type="chance"
                                    />
                                ))}
                            </div>
                        </div>
                        <p className="text-[10px] text-cyan-500 mt-2 sm:hidden text-center">← Swipe to see all hours →</p>
                    </div>
                </div>

                {/* Amount Graph */}
                <div>
                    <div className="flex items-center gap-2 text-cyan-300 mb-2">
                        <CloudRain size={18} className="shrink-0" />
                        <span className="text-sm sm:text-lg">EXPECTED AMOUNT (INCHES)</span>
                    </div>
                    <div className="bg-black/30 rounded-lg border-2 border-cyan-700 p-2 sm:p-4">
                        <div className="overflow-x-auto pb-2 -mx-2 px-2 sm:overflow-visible sm:mx-0 sm:px-0">
                            <div className="flex items-end gap-1 sm:gap-2 h-32 sm:h-40 min-w-[480px] sm:min-w-0">
                                {data.map((hour, index) => (
                                    <PrecipBar
                                        key={index}
                                        value={hour.amount}
                                        maxValue={maxAmount}
                                        label={hour.amount > 0 ? hour.amount.toFixed(2) : '0'}
                                        time={hour.time}
                                        type="amount"
                                        hasSnow={hour.hasSnow}
                                        hasRain={hour.hasRain}
                                    />
                                ))}
                            </div>
                        </div>
                        <p className="text-[10px] text-cyan-500 mt-2 sm:hidden text-center">← Swipe to see all hours →</p>
                    </div>
                </div>

                {/* Combined Legend - More compact on mobile */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-4">
                    <div className="bg-black/20 rounded-lg border border-cyan-700 p-2 sm:p-3">
                        <p className="text-[10px] sm:text-xs text-cyan-400 mb-1 sm:mb-2 font-bold">CHANCE LEGEND</p>
                        <div className="flex flex-wrap gap-x-3 gap-y-1 text-[10px] sm:text-xs">
                            <div className="flex items-center gap-1">
                                <div className="w-2.5 h-2.5 sm:w-3 sm:h-3 bg-cyan-800 rounded"></div>
                                <span className="text-cyan-300">0-29%</span>
                            </div>
                            <div className="flex items-center gap-1">
                                <div className="w-2.5 h-2.5 sm:w-3 sm:h-3 bg-cyan-600 rounded"></div>
                                <span className="text-cyan-300">30-49%</span>
                            </div>
                            <div className="flex items-center gap-1">
                                <div className="w-2.5 h-2.5 sm:w-3 sm:h-3 bg-cyan-500 rounded"></div>
                                <span className="text-cyan-300">50-69%</span>
                            </div>
                            <div className="flex items-center gap-1">
                                <div className="w-2.5 h-2.5 sm:w-3 sm:h-3 bg-blue-500 rounded"></div>
                                <span className="text-cyan-300">70%+</span>
                            </div>
                        </div>
                    </div>
                    <div className="bg-black/20 rounded-lg border border-cyan-700 p-2 sm:p-3">
                        <p className="text-[10px] sm:text-xs text-cyan-400 mb-1 sm:mb-2 font-bold">AMOUNT LEGEND</p>
                        <div className="flex flex-wrap gap-x-3 gap-y-1 text-[10px] sm:text-xs">
                            <div className="flex items-center gap-1">
                                <div className="w-2.5 h-2.5 sm:w-3 sm:h-3 bg-green-600 rounded"></div>
                                <span className="text-cyan-300">🌧️ Rain</span>
                            </div>
                            <div className="flex items-center gap-1">
                                <div className="w-2.5 h-2.5 sm:w-3 sm:h-3 bg-blue-500 rounded"></div>
                                <span className="text-cyan-300">🌧️ Heavy</span>
                            </div>
                            <div className="flex items-center gap-1">
                                <div className="w-2.5 h-2.5 sm:w-3 sm:h-3 bg-purple-500 rounded"></div>
                                <span className="text-cyan-300">❄️ Snow</span>
                            </div>
                            <div className="flex items-center gap-1">
                                <div className="w-2.5 h-2.5 sm:w-3 sm:h-3 bg-purple-300 rounded"></div>
                                <span className="text-cyan-300">❄️ Heavy</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </TabPanel>
    );
};

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

// Multi-Location Dashboard Component
const DashboardTab = ({ currentLocation, savedLocations, onSelectLocation }) => {
    const [locationWeather, setLocationWeather] = useState({});
    const [isLoading, setIsLoading] = useState(false);

    // Combine current location with saved locations
    const allLocations = useMemo(() => {
        const locations = [{ ...currentLocation, id: 'current', isCurrent: true }];
        savedLocations.forEach(loc => {
            // Don't duplicate if current location is in saved
            const isDuplicate = Math.abs(loc.lat - currentLocation.lat) < 0.01 &&
                               Math.abs(loc.lon - currentLocation.lon) < 0.01;
            if (!isDuplicate) {
                locations.push(loc);
            }
        });
        return locations;
    }, [currentLocation, savedLocations]);

    // Fetch weather for all locations
    useEffect(() => {
        const fetchAllWeather = async () => {
            setIsLoading(true);
            const weatherData = {};

            await Promise.all(allLocations.map(async (loc) => {
                try {
                    const url = `https://api.open-meteo.com/v1/forecast?latitude=${loc.lat}&longitude=${loc.lon}&current=temperature_2m,weather_code,wind_speed_10m&daily=temperature_2m_max,temperature_2m_min&temperature_unit=fahrenheit&wind_speed_unit=mph&timezone=auto&forecast_days=1`;
                    const res = await fetch(url);
                    if (res.ok) {
                        const data = await res.json();
                        weatherData[loc.id] = {
                            temp: Math.round(data.current?.temperature_2m || 0),
                            code: data.current?.weather_code || 0,
                            wind: Math.round(data.current?.wind_speed_10m || 0),
                            high: Math.round(data.daily?.temperature_2m_max?.[0] || 0),
                            low: Math.round(data.daily?.temperature_2m_min?.[0] || 0),
                        };
                    }
                } catch (e) {
                    console.error(`Failed to fetch weather for ${loc.name}:`, e);
                }
            }));

            setLocationWeather(weatherData);
            setIsLoading(false);
        };

        fetchAllWeather();
        // Refresh every 10 minutes
        const interval = setInterval(fetchAllWeather, 10 * 60 * 1000);
        return () => clearInterval(interval);
    }, [allLocations]);

    if (isLoading && Object.keys(locationWeather).length === 0) {
        return <TabPanel title="LOCATION DASHBOARD"><LoadingIndicator /></TabPanel>;
    }

    return (
        <TabPanel title="LOCATION DASHBOARD">
            <p className="text-cyan-400 mb-4">Weather at a glance for all your saved locations. Click a location to view details.</p>

            {allLocations.length <= 1 && savedLocations.length === 0 && (
                <div className="text-center py-8 border border-cyan-700 rounded-lg bg-black/20">
                    <Star size={48} className="mx-auto mb-4 text-cyan-600" />
                    <p className="text-xl text-cyan-300 mb-2">No saved locations yet</p>
                    <p className="text-cyan-500">Click the location in the header to add favorites</p>
                </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {allLocations.map((loc) => {
                    const weather = locationWeather[loc.id];
                    return (
                        <button
                            key={loc.id}
                            onClick={() => onSelectLocation(loc)}
                            className={`p-4 rounded-lg border-2 text-left transition-all hover:scale-[1.02] ${
                                loc.isCurrent
                                    ? 'border-cyan-400 bg-cyan-900/30'
                                    : 'border-cyan-700 bg-black/30 hover:border-cyan-500'
                            }`}
                        >
                            <div className="flex justify-between items-start mb-2">
                                <div className="flex-1 min-w-0">
                                    <p className="text-lg font-bold text-white truncate">{loc.name}</p>
                                    {loc.isCurrent && (
                                        <span className="text-xs text-cyan-400 flex items-center gap-1">
                                            <MapPin size={10} /> Current Location
                                        </span>
                                    )}
                                </div>
                                <span className="text-4xl ml-2">{weather ? getWeatherIcon(weather.code, false) : '...'}</span>
                            </div>

                            {weather ? (
                                <>
                                    <p className="text-4xl font-bold text-white">{weather.temp}°F</p>
                                    <p className="text-sm text-cyan-300">{getWeatherDescription(weather.code)}</p>
                                    <div className="flex gap-4 mt-2 text-sm">
                                        <span className="text-cyan-400">H: {weather.high}°</span>
                                        <span className="text-cyan-400">L: {weather.low}°</span>
                                        <span className="text-cyan-500">Wind: {weather.wind} mph</span>
                                    </div>
                                </>
                            ) : (
                                <p className="text-cyan-500">Loading...</p>
                            )}
                        </button>
                    );
                })}
            </div>

            <p className="text-xs text-cyan-600 mt-4 text-center">Auto-refreshes every 10 minutes</p>
        </TabPanel>
    );
};

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
- Temp Range: ${tripSummary.minTemp}°F to ${tripSummary.maxTemp}°F
- Max Wind: ${tripSummary.maxWind} mph at ${tripSummary.maxWindLocation}
${tripSummary.hasPrecip ? `- Precipitation at ${tripSummary.precipCount} location(s)` : '- No precipitation expected'}
${tripSummary.hasSnow ? `- Snow at ${tripSummary.snowCount} location(s)` : ''}
${tripSummary.hasSevere ? `- SEVERE WEATHER at ${tripSummary.severeCount} location(s)!` : ''}

Waypoints:
${waypointWeather.map(wp => `${wp.label} (${wp.locationName}): ${wp.weather ? `${Math.round(wp.weather.temperature_2m)}°F, ${getWeatherDescription(wp.weather.weather_code)}` : 'N/A'}`).join('\n')}

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
            <div className="mb-6 p-4 rounded-lg" style={{ border: `2px solid ${BRIGHT_CYAN}`, backgroundColor: `${MID_BLUE}33` }} ref={tripContainerRef}>
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
                                    {Math.round(route.distance * 0.000621371)} mi • {Math.floor((route.duration / SPEED_CORRECTION) / 3600)}h {Math.round(((route.duration / SPEED_CORRECTION) % 3600) / 60)}m
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
                                            <p className="text-3xl">{getWeatherIcon(wp.weather.weather_code, false)}</p>
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
                                            <p className="text-xl font-bold text-white">{Math.round(wp.weather.pressure_msl)} mb</p>
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

const AppStatus = ({ isLoading, error, isReady, isAutoDetecting }) => {
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
  if (isAutoDetecting) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 p-4 font-vt323">
        <div className="text-center animate-pulse">
          <MapPin size={48} className="mx-auto mb-4" style={{ color: BRIGHT_CYAN }} />
          <h2 className="text-4xl font-bold tracking-widest" style={{ color: BRIGHT_CYAN }}>DETECTING YOUR LOCATION...</h2>
          <p className="text-xl text-cyan-400 mt-2">PLEASE ALLOW LOCATION ACCESS</p>
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
  const [aqiData, setAqiData] = useState(null); // Air Quality Index data
  const [alerts, setAlerts] = useState([]); // State for Alerts
  const [isLoading, setIsLoading] = useState(false);
  const [appError, setAppError] = useState(null);
  const [time, setTime] = useState(new Date());
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(0.5);
  const [currentScreen, setCurrentScreen] = useState(SCREENS.CONDITIONS);
  const [autoCycle, setAutoCycle] = useState(false);
  const [cycleSpeed, setCycleSpeed] = useState(10); // seconds per screen
  const [dismissedAlertIds, setDismissedAlertIds] = useState(new Set()); // Track dismissed alert banners
  const [dismissedTornadoModals, setDismissedTornadoModals] = useState(new Set()); // Track dismissed tornado warning modals
  const [showAlertFlash, setShowAlertFlash] = useState(false); // Controls the flash overlay
  const lastAlertIdsRef = useRef(''); // Track alert IDs to detect new alerts

  // --- Alert Flash Timeout (flash for 3 seconds when new severe alerts arrive) ---
  useEffect(() => {
    const activeAlerts = alerts.filter(a => !dismissedAlertIds.has(a.properties?.id));
    const severeLevel = getSevereAlertLevel(activeAlerts);
    const currentAlertIds = activeAlerts.map(a => a.properties?.id).sort().join(',');

    // Only trigger flash if there are severe alerts AND they're new
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
      SCREENS.CONDITIONS,
      SCREENS.HOURLY,
      SCREENS.DAILY,
      SCREENS.RADAR,
      SCREENS.PRECIP,
      SCREENS.DASHBOARD,
      SCREENS.ALERTS,
      SCREENS.WWA,
      SCREENS.SPC,
      SCREENS.TRIP_WEATHER,
      SCREENS.ALMANAC,
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
    // Check if location already exists (by coordinates)
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

  // --- First Visit Auto-Detection ---
  const [isAutoDetecting, setIsAutoDetecting] = useState(false);
  const hasVisitedBefore = useRef(localStorage.getItem('weatherbird-has-visited') === 'true');

  useEffect(() => {
    // Skip if not first visit or already detecting
    if (hasVisitedBefore.current || isAutoDetecting) return;

    // Mark as visited
    localStorage.setItem('weatherbird-has-visited', 'true');
    hasVisitedBefore.current = true;

    // Try to auto-detect location
    if (!navigator.geolocation) {
      setIsModalOpen(true);
      return;
    }

    setIsAutoDetecting(true);

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        try {
          // Reverse geocode to get city name
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json`,
            { headers: { 'User-Agent': 'WeatherBird-App' } }
          );
          const data = await res.json();
          const addr = data.address || {};
          const cityName = addr.city || addr.town || addr.village || addr.county || 'My Location';
          const stateName = addr.state || '';
          const displayName = stateName ? `${cityName}, ${stateName}` : cityName;

          setLocation({
            name: displayName,
            lat: latitude,
            lon: longitude
          });
        } catch {
          // Fallback if reverse geocoding fails
          setLocation({
            name: 'My Location',
            lat: latitude,
            lon: longitude
          });
        }
        setIsAutoDetecting(false);
      },
      () => {
        // Geolocation failed or denied - show modal
        setIsAutoDetecting(false);
        setIsModalOpen(true);
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 }
    );
  }, []);

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

  // --- Alert Fetching Logic (Refactored to App level) ---
  const fetchAlerts = useCallback(async () => {
      if (!location.lat || !location.lon) return;

      console.log("Fetching alerts for:", location.name, location.lat, location.lon);

      try {
          // First, get the zone/county info from NWS points API
          const pointsRes = await fetch(getNWSPointsUrl(location.lat, location.lon), {
              headers: { 'User-Agent': 'WeatherBird App' }
          });

          if (pointsRes.ok) {
              const pointsData = await pointsRes.json();
              const county = pointsData.properties?.county;
              const forecastZone = pointsData.properties?.forecastZone;

              console.log("County:", county, "Zone:", forecastZone);

              // Fetch alerts for both the county and forecast zone for better coverage
              const alertPromises = [];

              if (county) {
                  // County URL looks like: https://api.weather.gov/zones/county/KYC001
                  const countyCode = county.split('/').pop();
                  alertPromises.push(
                      fetch(`https://api.weather.gov/alerts/active?zone=${countyCode}`, {
                          headers: { 'User-Agent': 'WeatherBird App' }
                      }).then(r => r.ok ? r.json() : { features: [] })
                  );
              }

              if (forecastZone) {
                  // Forecast zone URL looks like: https://api.weather.gov/zones/forecast/KYZ051
                  const zoneCode = forecastZone.split('/').pop();
                  alertPromises.push(
                      fetch(`https://api.weather.gov/alerts/active?zone=${zoneCode}`, {
                          headers: { 'User-Agent': 'WeatherBird App' }
                      }).then(r => r.ok ? r.json() : { features: [] })
                  );
              }

              // Also fetch point-based alerts as fallback
              alertPromises.push(
                  fetch(getNWSAlertsUrl(location.lat, location.lon), {
                      headers: { 'User-Agent': 'WeatherBird App' }
                  }).then(r => r.ok ? r.json() : { features: [] })
              );

              const results = await Promise.all(alertPromises);

              // Combine and deduplicate alerts by ID
              const allAlerts = results.flatMap(r => r.features || []);
              const uniqueAlerts = Array.from(
                  new Map(allAlerts.map(a => [a.properties?.id, a])).values()
              );

              console.log("Found alerts:", uniqueAlerts.length);

              setAlerts(uniqueAlerts);
          } else {
              // Fallback to point-based if points API fails
              const res = await fetch(getNWSAlertsUrl(location.lat, location.lon));
              if (res.ok) {
                  const data = await res.json();
                  setAlerts(data.features || []);
              }
          }
      } catch (err) {
          console.error("Alert fetch error:", err);
          // Don't block app on alert failure
      }
  }, [location.lat, location.lon, location.name]);

  useEffect(() => {
      if (location.lat && location.lon && isAuthReady) {
          fetchAlerts();
      }

      // Refresh alerts every 2 minutes
      const alertInterval = setInterval(() => {
          if (location.lat && location.lon && isAuthReady) fetchAlerts();
      }, 120000);

      return () => clearInterval(alertInterval);
  }, [location.lat, location.lon, isAuthReady, fetchAlerts]);

  // --- Fetch Weather on Location Change & Set Interval ---
  useEffect(() => {
    if (!isAuthReady) return;

    // Clear existing interval
    if (weatherIntervalRef.current) {
      clearInterval(weatherIntervalRef.current);
    }

    // Immediately fetch weather and AQI for the new location
    fetchWeather(location);
    fetchAQI(location);

    // Set up recurring fetch (UPDATED TO 60 SECONDS)
    weatherIntervalRef.current = setInterval(() => {
      fetchWeather(location);
      fetchAQI(location);
    }, REFRESH_RATE_MS);

    // Clean up on component unmount or location change
    return () => {
      if (weatherIntervalRef.current) clearInterval(weatherIntervalRef.current);
    };
  }, [location, isAuthReady, fetchWeather, fetchAQI]);

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
        return <HourlyForecastTab hourly={hourly} night={night} isWeatherLoading={isWeatherLoading} />;
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

      {/* Severe Weather Alert Flash Overlay (auto-stops after 3 seconds) */}
      {showAlertFlash && getSevereAlertLevel(alerts.filter(a => !dismissedAlertIds.has(a.properties?.id))) && (
        <div
          className={`fixed inset-0 pointer-events-none z-40 ${
            getSevereAlertLevel(alerts.filter(a => !dismissedAlertIds.has(a.properties?.id))) === 'warning' ? 'alert-flash-warning' : 'alert-flash-watch'
          }`}
        />
      )}

      {/* App Status Modal (Error/Loading Overlay) */}
      <AppStatus isLoading={isWeatherLoading} error={appError} isReady={isAuthReady} isAutoDetecting={isAutoDetecting} />

      {/* TORNADO WARNING Full-Screen Takeover */}
      {getTornadoWarnings(alerts)
        .filter(alert => !dismissedTornadoModals.has(alert.properties?.id))
        .slice(0, 1) // Only show one at a time
        .map(alert => (
          <div
            key={alert.properties?.id}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-red-900/95 p-4 animate-pulse"
          >
            <div className="bg-black border-4 border-red-500 rounded-xl p-6 md:p-8 max-w-2xl w-full shadow-2xl text-center">
              <div className="flex justify-center mb-4">
                <AlertTriangle size={80} className="text-red-500 animate-bounce" />
              </div>
              <h1 className="text-4xl md:text-6xl font-bold text-red-500 mb-4 tracking-wider">
                ⚠️ TORNADO WARNING ⚠️
              </h1>
              <p className="text-2xl md:text-3xl text-white mb-4">
                {alert.properties?.areaDesc}
              </p>
              <div className="bg-red-900/50 rounded-lg p-4 mb-6 text-left">
                <p className="text-lg text-red-200 font-bold mb-2">TAKE SHELTER IMMEDIATELY!</p>
                <ul className="text-yellow-300 space-y-1 text-sm md:text-base">
                  <li>• Move to an interior room on the lowest floor</li>
                  <li>• Stay away from windows, doors, and outside walls</li>
                  <li>• Get under a sturdy table and cover your head</li>
                  <li>• If in a mobile home, evacuate to a sturdy building</li>
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
      <Header time={time} locationName={location.name} onLocationClick={() => setIsModalOpen(true)} timezone={weatherData?.timezone} isPlaying={isPlaying} toggleMusic={toggleMusic} volume={volume} setVolume={setVolume} autoCycle={autoCycle} setAutoCycle={setAutoCycle} />

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
                ⚠️ {alert.properties?.event?.toUpperCase()} IN EFFECT - {alert.properties?.areaDesc}
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
          savedLocations={savedLocations}
          onSaveLocation={saveLocation}
          onDeleteLocation={deleteLocation}
        />
      )}

      {/* Retro Scanline Overlay */}
      <Scanlines />
    </div>
  );
};

export default App;
