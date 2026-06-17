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
  HURRICANE: 'HURRICANE',
  MODELS: 'MODELS',
  SATELLITE: 'SATELLITE',
  GARDEN: 'GARDEN',
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

// --- NHC Hurricane Imagery ---
export const NHC_ATLANTIC_OUTLOOK_URL = "https://www.nhc.noaa.gov/xgtwo/two_atl_7d0.png";
export const NHC_PACIFIC_OUTLOOK_URL = "https://www.nhc.noaa.gov/xgtwo/two_pac_7d0.png";

// --- GOES Tropical Satellite Imagery (NESDIS CDN) ---
// GOES-16 replaced by GOES-19 for East; GOES-18 for West Pacific
export const GOES_ATLANTIC = {
  GEOCOLOR:   'https://cdn.star.nesdis.noaa.gov/GOES19/ABI/SECTOR/taw/GEOCOLOR/900x540.jpg',
  IR:         'https://cdn.star.nesdis.noaa.gov/GOES19/ABI/SECTOR/taw/13/900x540.jpg',
  WATERVAPOR: 'https://cdn.star.nesdis.noaa.gov/GOES19/ABI/SECTOR/taw/09/900x540.jpg',
  AIRMASS:    'https://cdn.star.nesdis.noaa.gov/GOES19/ABI/SECTOR/taw/AirMass/900x540.jpg',
};
export const GOES_PACIFIC = {
  GEOCOLOR:   'https://cdn.star.nesdis.noaa.gov/GOES18/ABI/SECTOR/eep/GEOCOLOR/900x540.jpg',
  IR:         'https://cdn.star.nesdis.noaa.gov/GOES18/ABI/SECTOR/eep/13/900x540.jpg',
  WATERVAPOR: 'https://cdn.star.nesdis.noaa.gov/GOES18/ABI/SECTOR/eep/09/900x540.jpg',
  AIRMASS:    'https://cdn.star.nesdis.noaa.gov/GOES18/ABI/SECTOR/eep/AirMass/900x540.jpg',
};

// NOAA MapServer for active tropical cyclone data (JSON queries)
// AT1-AT5 forecast points: layers 6, 32, 58, 84, 110
// EP1-EP5 forecast points: layers 136, 162, 188, 214, 240
export const NHC_MAPSERVER_BASE = "https://mapservices.weather.noaa.gov/tropical/rest/services/tropical/NHC_tropical_weather/MapServer";
export const NHC_ATLANTIC_STORM_LAYERS = [6, 32, 58, 84, 110];
export const NHC_PACIFIC_STORM_LAYERS = [136, 162, 188, 214, 240];

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
