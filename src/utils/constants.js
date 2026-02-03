// --- Screens (Tabs) ---
export const SCREENS = {
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

// --- Config ---
export const INITIAL_LOCATION = { name: "Lawrenceburg, KY", lat: 38.0337, lon: -84.9966 };
export const MUSIC_URL = "https://stream.zeno.fm/0r0xa792kwzuv";
export const REFRESH_RATE_MS = 60000; // 60 seconds

// --- Colors ---
export const DARK_BLUE = '#003366';
export const NAVY_BLUE = '#001122';
export const BRIGHT_CYAN = '#00FFFF';
export const MID_BLUE = '#0055AA';

// --- Live Imagery URLs ---
export const RADAR_URL = "https://radar.weather.gov/ridge/standard/CONUS_loop.gif";
export const SPC_OUTLOOK_URL = "https://www.spc.noaa.gov/products/outlook/day1otlk.gif";
export const NWS_WWA_MAP_URL = "https://forecast.weather.gov/wwamap/png/US.png";
export const PLACEHOLDER_IMG = "https://placehold.co/800x400/003366/00ffff?text=UNABLE+TO+LOAD+EXTERNAL+IMAGE+FEED";

// --- Severe Weather Keywords ---
export const SEVERE_ALERT_KEYWORDS = [
  'Severe Thunderstorm',
  'Tornado',
  'Tropical Storm',
  'Hurricane',
  'Winter Storm',
  'Blizzard',
  'Ice Storm'
];
