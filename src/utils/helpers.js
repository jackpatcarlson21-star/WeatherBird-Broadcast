import { SEVERE_ALERT_KEYWORDS } from './constants';

// --- Time/Date Helpers ---
export const isNight = (now, sunrise, sunset) => {
  if (!sunrise || !sunset) return false;
  const sunriseTime = new Date(sunrise).getTime();
  const sunsetTime = new Date(sunset).getTime();
  const nowTime = now.getTime();
  return nowTime < sunriseTime || nowTime > sunsetTime;
};

export const formatTime = (iso) =>
  iso ? new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : "--:--";

export const formatDate = (iso) =>
  iso ? new Date(iso).toLocaleDateString([], { month: 'short', day: 'numeric' }) : "--/--";

export const degreeToCardinal = (deg) => {
  const dirs = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
  return dirs[Math.round(deg / 45) % 8] || "VRB";
};

// --- AQI Helpers ---
export const getAQIInfo = (aqi) => {
  if (aqi === null || aqi === undefined) return { level: 'Unknown', color: 'gray', bgColor: 'bg-gray-500', textColor: 'text-gray-300', description: 'Data unavailable' };
  if (aqi <= 50) return { level: 'Good', color: '#00e400', bgColor: 'bg-green-500', textColor: 'text-green-400', description: 'Air quality is satisfactory' };
  if (aqi <= 100) return { level: 'Moderate', color: '#ffff00', bgColor: 'bg-yellow-500', textColor: 'text-yellow-400', description: 'Acceptable; moderate concern for sensitive people' };
  if (aqi <= 150) return { level: 'Unhealthy for Sensitive Groups', color: '#ff7e00', bgColor: 'bg-orange-500', textColor: 'text-orange-400', description: 'Sensitive groups may experience health effects' };
  if (aqi <= 200) return { level: 'Unhealthy', color: '#ff0000', bgColor: 'bg-red-500', textColor: 'text-red-400', description: 'Everyone may experience health effects' };
  if (aqi <= 300) return { level: 'Very Unhealthy', color: '#8f3f97', bgColor: 'bg-purple-500', textColor: 'text-purple-400', description: 'Health alert: everyone may experience serious effects' };
  return { level: 'Hazardous', color: '#7e0023', bgColor: 'bg-red-900', textColor: 'text-red-300', description: 'Health emergency: everyone is affected' };
};

// --- Alert Helpers ---
export const getSevereAlertLevel = (alerts) => {
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

export const getSevereAlerts = (alerts) => {
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

export const getTornadoWarnings = (alerts) => {
  if (!alerts || alerts.length === 0) return [];
  return alerts.filter(alert => {
    const event = alert.properties?.event?.toLowerCase() || '';
    return event.includes('tornado') && event.includes('warning');
  });
};

export const getExpirationCountdown = (expiresTime) => {
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

// --- Geo Helpers ---
export const haversineDistance = (lat1, lon1, lat2, lon2) => {
  const R = 3959; // Earth radius in miles
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
};

// --- Weather Helpers ---
export const getWeatherDescription = (code) => {
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

// --- Moon Phase ---
export const getMoonPhase = (date = new Date()) => {
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
