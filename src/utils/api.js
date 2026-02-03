// --- API URL Generators ---

// Weather API (Open-Meteo)
export const getWeatherApiUrl = (lat, lon) =>
  `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,apparent_temperature,relative_humidity_2m,weather_code,wind_speed_10m,wind_direction_10m,wind_gusts_10m,precipitation,pressure_msl,dew_point_2m&hourly=temperature_2m,precipitation_probability,precipitation,snowfall,weather_code,wind_speed_10m,pressure_msl&daily=weather_code,temperature_2m_max,temperature_2m_min,sunrise,sunset,precipitation_probability_max,wind_speed_10m_max&temperature_unit=fahrenheit&wind_speed_unit=mph&precipitation_unit=inch&timezone=auto&forecast_days=8&past_hours=6`;

// Air Quality API (Open-Meteo)
export const getAirQualityUrl = (lat, lon) =>
  `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat}&longitude=${lon}&current=us_aqi,pm10,pm2_5,carbon_monoxide,nitrogen_dioxide,ozone&timezone=auto`;

// NWS Alerts API
export const getNWSAlertsUrl = (lat, lon) => `https://api.weather.gov/alerts/active?point=${lat},${lon}`;

// NWS Points API (to get forecast URL for a location)
export const getNWSPointsUrl = (lat, lon) => `https://api.weather.gov/points/${lat},${lon}`;
