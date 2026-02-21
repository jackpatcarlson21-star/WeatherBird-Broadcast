import React from 'react';
import { Thermometer, Wind, Droplets, Zap, Sunrise, Sunset, Maximize, Radio } from 'lucide-react';
import TabPanel from '../layout/TabPanel';
import LoadingIndicator from '../common/LoadingIndicator';
import { WindCompass, PressureTrend, TemperatureTrend, WeatherBird, AnimatedWeatherIcon } from '../weather';
import { BRIGHT_CYAN } from '../../utils/constants';
import { formatTime, getAQIInfo, getWeatherDescription, degreeToCardinal } from '../../utils/helpers';

// Temperature color coding based on Fahrenheit
const getTemperatureColorClass = (tempF) => {
  if (tempF <= 32) return 'temp-freezing';
  if (tempF <= 50) return 'temp-cold';
  if (tempF <= 60) return 'temp-cool';
  if (tempF <= 70) return 'temp-mild';
  if (tempF <= 85) return 'temp-warm';
  if (tempF <= 95) return 'temp-hot';
  return 'temp-extreme';
};

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
      summary += `Warning: ALERT: ${uniqueAlerts[0]} in effect. `;
    } else {
      summary += `Warning: ${alertCount} ACTIVE ALERTS: ${uniqueAlerts.slice(0, 3).join(', ')}${uniqueAlerts.length > 3 ? '...' : ''}. `;
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
      summary += `Wind chill makes it feel like ${feelsLike}F. `;
    } else {
      summary += `Heat index makes it feel like ${feelsLike}F. `;
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
  summary += `Today's high near ${high}F with a low of ${low}F.`;

  return summary;
};

// Calculate feels-like breakdown details
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
          alerts={alerts}
        />
      </div>

      <div className="flex flex-col sm:flex-row justify-between items-center sm:items-start mb-8 border-b border-cyan-800 pb-4">
        <div className="text-center sm:text-left mb-4 sm:mb-0">
          <p className={`text-7xl sm:text-8xl md:text-[120px] transition-colors duration-500 ${getTemperatureColorClass(Math.round(currentData.temperature_2m || 0))}`}>
            {Math.round(currentData.temperature_2m || 0)}°F
          </p>
          <p className="text-xl sm:text-2xl font-vt323" style={{ color: BRIGHT_CYAN }}>
            {getWeatherDescription(currentData.weather_code)}
          </p>
          <TemperatureTrend dailyData={dailyData} />
        </div>
        <div className="text-white/90 flex items-center justify-center">
          <span className="hidden sm:inline"><AnimatedWeatherIcon code={currentData.weather_code} night={night} size={150} /></span>
          <span className="sm:hidden"><AnimatedWeatherIcon code={currentData.weather_code} night={night} size={100} /></span>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-white font-vt323 text-lg">
        <div className="p-3 bg-black/20 rounded-lg border border-cyan-700 flex flex-col items-center hover:border-cyan-400 hover:bg-black/30 hover:shadow-neon-md hover:scale-105 transition-all duration-300 cursor-default">
          <Thermometer size={20} className="text-cyan-400" />
          <span className="text-sm text-cyan-300">FEELS LIKE</span>
          <span className="font-bold">{Math.round(currentData.apparent_temperature || currentData.temperature_2m || 0)}°F</span>
        </div>
        <div className="p-3 bg-black/20 rounded-lg border border-cyan-700 flex flex-col items-center hover:border-cyan-400 hover:bg-black/30 hover:shadow-neon-md hover:scale-105 transition-all duration-300 cursor-default">
          <WindCompass degrees={currentData.wind_direction_10m || 0} windSpeed={Math.round(currentData.wind_speed_10m || 0)} size={40} />
          <span className="text-sm text-cyan-300 mt-1">WIND</span>
          <span className="font-bold">{Math.round(currentData.wind_speed_10m || 0)} mph {degreeToCardinal(currentData.wind_direction_10m || 0)}</span>
        </div>
        <div className="p-3 bg-black/20 rounded-lg border border-cyan-700 flex flex-col items-center hover:border-cyan-400 hover:bg-black/30 hover:shadow-neon-md hover:scale-105 transition-all duration-300 cursor-default">
          <Zap size={20} className="text-cyan-400" />
          <span className="text-sm text-cyan-300">WIND GUSTS</span>
          <span className="font-bold">{Math.round(currentData.wind_gusts_10m || 0)} mph</span>
        </div>
        <div className="p-3 bg-black/20 rounded-lg border border-cyan-700 flex flex-col items-center hover:border-cyan-400 hover:bg-black/30 hover:shadow-neon-md hover:scale-105 transition-all duration-300 cursor-default">
          <Droplets size={20} className="text-cyan-400" />
          <span className="text-sm text-cyan-300">HUMIDITY</span>
          <span className="font-bold">{Math.round(currentData.relative_humidity_2m || 0)}%</span>
        </div>
        <div className="p-3 bg-black/20 rounded-lg border border-cyan-700 flex flex-col items-center hover:border-cyan-400 hover:bg-black/30 hover:shadow-neon-md hover:scale-105 transition-all duration-300 cursor-default">
          <Thermometer size={20} className="text-cyan-400" />
          <span className="text-sm text-cyan-300">DEW POINT</span>
          <span className="font-bold">{Math.round(currentData.dew_point_2m || 0)}°F</span>
        </div>
        <div className="p-3 bg-black/20 rounded-lg border border-cyan-700 flex flex-col items-center hover:border-cyan-400 hover:bg-black/30 hover:shadow-neon-md hover:scale-105 transition-all duration-300 cursor-default">
          <Sunrise size={20} className="text-cyan-400" />
          <span className="text-sm text-cyan-300">SUNRISE</span>
          <span className="font-bold">{formatTime(dailyData.sunrise)}</span>
        </div>
        <div className="p-3 bg-black/20 rounded-lg border border-cyan-700 flex flex-col items-center hover:border-cyan-400 hover:bg-black/30 hover:shadow-neon-md hover:scale-105 transition-all duration-300 cursor-default">
          <Sunset size={20} className="text-cyan-400" />
          <span className="text-sm text-cyan-300">SUNSET</span>
          <span className="font-bold">{formatTime(dailyData.sunset)}</span>
        </div>
        <div className="p-3 bg-black/20 rounded-lg border border-cyan-700 flex flex-col items-center hover:border-cyan-400 hover:bg-black/30 hover:shadow-neon-md hover:scale-105 transition-all duration-300 cursor-default">
          <Maximize size={20} className="text-cyan-400" />
          <span className="text-sm text-cyan-300">HIGH / LOW</span>
          <span className="font-bold">{Math.round(dailyData.max || 0)}°F / {Math.round(dailyData.min || 0)}°F</span>
        </div>
        <div className="p-3 bg-black/20 rounded-lg border border-cyan-700 flex flex-col items-center hover:border-cyan-400 hover:bg-black/30 hover:shadow-neon-md hover:scale-105 transition-all duration-300 cursor-default">
          <PressureTrend hourlyData={hourly} currentPressure={currentData.pressure_msl} />
        </div>
        {/* Air Quality Index */}
        <div className={`p-3 rounded-lg border flex flex-col items-center col-span-2 hover:shadow-neon-md hover:scale-105 transition-all duration-300 cursor-default ${
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

export default CurrentConditionsTab;
