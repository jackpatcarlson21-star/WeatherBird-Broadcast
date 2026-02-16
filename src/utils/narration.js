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

  // Only narrate current conditions, hourly, and daily tabs
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

    default:
      return '';
  }
};

/**
 * Speak narration text using the Web Speech API.
 * Returns the utterance so it can be cancelled.
 */
// Cache the best voice once found
let cachedVoice = null;

const findBestVoice = () => {
  if (cachedVoice) return cachedVoice;

  const voices = window.speechSynthesis.getVoices();
  if (!voices.length) return null;

  const googleVoices = voices.filter(v => v.name.includes('Google') && v.lang.startsWith('en'));

  // Prefer Google US English
  const usVoice = googleVoices.find(v => v.lang === 'en-US');
  if (usVoice) { cachedVoice = usVoice; return usVoice; }

  // Fall back to any Google English voice
  if (googleVoices.length) { cachedVoice = googleVoices[0]; return googleVoices[0]; }

  return null;
};

// Ensure voices are loaded (they load async in some browsers)
if (window.speechSynthesis) {
  window.speechSynthesis.onvoiceschanged = () => { cachedVoice = null; };
}

export const speakNarration = (text) => {
  if (!text || !window.speechSynthesis) return null;

  // Cancel any ongoing speech
  window.speechSynthesis.cancel();

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = 0.95;
  utterance.pitch = 1.0;
  utterance.volume = 0.85;

  const voice = findBestVoice();
  if (voice) {
    utterance.voice = voice;
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
