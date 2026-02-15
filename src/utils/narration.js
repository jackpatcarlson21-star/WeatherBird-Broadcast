import { SCREENS } from './constants';
import { getWeatherDescription, degreeToCardinal } from './helpers';

/**
 * Generate spoken narration text for each tab.
 */
export const getNarrationText = (screen, data) => {
  const { weatherData, alerts, location, aqiData } = data || {};
  const current = weatherData?.current;
  const daily = weatherData?.daily;
  const hourly = weatherData?.hourly;

  switch (screen) {
    case SCREENS.CONDITIONS: {
      if (!current) return 'Loading current conditions.';
      const temp = Math.round(current.temperature_2m || 0);
      const feelsLike = Math.round(current.apparent_temperature || temp);
      const humidity = Math.round(current.relative_humidity_2m || 0);
      const wind = Math.round(current.wind_speed_10m || 0);
      const dir = degreeToCardinal(current.wind_direction_10m || 0);
      const desc = getWeatherDescription(current.weather_code);
      let text = `Current conditions for ${location?.name || 'your location'}. ${desc}. Temperature ${temp} degrees`;
      if (Math.abs(temp - feelsLike) >= 3) {
        text += `, feels like ${feelsLike}`;
      }
      text += `. Humidity ${humidity} percent. Winds ${dir} at ${wind} miles per hour.`;
      if (daily) {
        const high = Math.round(daily.temperature_2m_max?.[0] || 0);
        const low = Math.round(daily.temperature_2m_min?.[0] || 0);
        text += ` Today's high ${high}, low ${low}.`;
      }
      return text;
    }

    case SCREENS.HOURLY: {
      if (!hourly) return 'Loading hourly forecast.';
      const temps = hourly.temperature_2m?.slice(0, 6) || [];
      const avg = temps.length ? Math.round(temps.reduce((a, b) => a + b, 0) / temps.length) : 0;
      const maxPrecip = Math.max(...(hourly.precipitation_probability?.slice(0, 6) || [0]));
      return `Twelve hour forecast. Average temperature around ${avg} degrees over the next 6 hours. Maximum precipitation chance ${maxPrecip} percent.`;
    }

    case SCREENS.DAILY: {
      if (!daily) return 'Loading 7 day outlook.';
      const high = Math.round(daily.temperature_2m_max?.[0] || 0);
      const low = Math.round(daily.temperature_2m_min?.[0] || 0);
      const high2 = Math.round(daily.temperature_2m_max?.[1] || 0);
      const low2 = Math.round(daily.temperature_2m_min?.[1] || 0);
      return `7 day outlook. Today, high of ${high} and low of ${low}. Tomorrow, high of ${high2} and low of ${low2}.`;
    }

    case SCREENS.RADAR:
      return 'Radar view. Displaying current regional radar imagery.';

    case SCREENS.PRECIP:
      return 'Precipitation graph showing rainfall and snowfall projections for the next 48 hours.';

    case SCREENS.DASHBOARD:
      return 'Location dashboard. Manage your saved weather locations.';

    case SCREENS.ALERTS: {
      if (!alerts || alerts.length === 0) return 'No active weather alerts for your area.';
      const count = alerts.length;
      const types = [...new Set(alerts.map(a => a.properties?.event).filter(Boolean))];
      return `${count} active weather ${count === 1 ? 'alert' : 'alerts'}. ${types.join(', ')}.`;
    }

    case SCREENS.WWA:
      return 'National Watch Warning Advisory map from the National Weather Service.';

    case SCREENS.SPC:
      return 'Storm Prediction Center convective outlook for today.';

    case SCREENS.TRIP_WEATHER:
      return 'Trip weather planner. Check weather conditions for your travel destination.';

    case SCREENS.ALMANAC:
      return 'Weather almanac with astronomical data and historical records.';

    case SCREENS.HURRICANE:
      return 'Hurricane tracker. Showing the latest tropical outlook from the National Hurricane Center.';

    default:
      return '';
  }
};

/**
 * Speak narration text using the Web Speech API.
 * Returns the utterance so it can be cancelled.
 */
export const speakNarration = (text) => {
  if (!text || !window.speechSynthesis) return null;

  // Cancel any ongoing speech
  window.speechSynthesis.cancel();

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = 1.0;
  utterance.pitch = 1.0;
  utterance.volume = 0.8;

  // Try to pick a good English voice
  const voices = window.speechSynthesis.getVoices();
  const preferred = voices.find(v => v.lang.startsWith('en') && v.name.includes('Google')) ||
                    voices.find(v => v.lang.startsWith('en-US')) ||
                    voices.find(v => v.lang.startsWith('en'));
  if (preferred) {
    utterance.voice = preferred;
  }

  window.speechSynthesis.speak(utterance);
  return utterance;
};

/**
 * Cancel any ongoing speech synthesis.
 */
export const cancelNarration = () => {
  if (window.speechSynthesis) {
    window.speechSynthesis.cancel();
  }
};
