import React, { useState } from 'react';
import { Thermometer, Wind, Droplets, Zap, Sunrise, Sunset, Maximize, Radio, ChevronDown, ChevronUp } from 'lucide-react';
import TabPanel from '../layout/TabPanel';
import LoadingIndicator from '../common/LoadingIndicator';
import { WindCompass, PressureTrend, TemperatureTrend, WeatherBird } from '../weather';
import { BRIGHT_CYAN } from '../../utils/constants';
import { formatTime, getAQIInfo, getWeatherIcon, getWeatherDescription, degreeToCardinal } from '../../utils/helpers';

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
const calculateFeelsLikeBreakdown = (currentData) => {
  const temp = currentData.temperature_2m;
  const wind = currentData.wind_speed_10m || 0;
  const humidity = currentData.relative_humidity_2m || 0;
  const feelsLike = currentData.apparent_temperature;

  if (temp === undefined || feelsLike === undefined) return null;

  const tempR = Math.round(temp);
  const feelsR = Math.round(feelsLike);
  const diff = feelsR - tempR;

  // Wind Chill applies when temp ≤ 50°F and wind > 3 mph
  if (temp <= 50 && wind > 3) {
    return {
      type: 'WIND CHILL',
      formula: '35.74 + 0.6215T - 35.75V^0.16 + 0.4275TV^0.16',
      factors: [
        { label: 'Air Temperature', value: `${tempR}°F` },
        { label: 'Wind Speed', value: `${Math.round(wind)} mph` },
        { label: 'Wind Contribution', value: `${diff > 0 ? '+' : ''}${diff}°F` },
      ],
      result: feelsR,
      actual: tempR,
      diff,
      color: 'text-blue-400',
      borderColor: 'border-blue-500',
      bgColor: 'bg-blue-900/30',
    };
  }

  // Heat Index applies when temp ≥ 80°F and humidity ≥ 40%
  if (temp >= 80 && humidity >= 40) {
    return {
      type: 'HEAT INDEX',
      formula: 'Rothfusz regression (NWS)',
      factors: [
        { label: 'Air Temperature', value: `${tempR}°F` },
        { label: 'Humidity', value: `${Math.round(humidity)}%` },
        { label: 'Heat Contribution', value: `+${Math.abs(diff)}°F` },
      ],
      result: feelsR,
      actual: tempR,
      diff,
      color: 'text-orange-400',
      borderColor: 'border-orange-500',
      bgColor: 'bg-orange-900/30',
    };
  }

  // No significant feels-like adjustment
  if (Math.abs(diff) < 3) return null;

  return {
    type: diff < 0 ? 'WIND CHILL EFFECT' : 'HUMIDITY EFFECT',
    formula: 'NWS apparent temperature',
    factors: [
      { label: 'Air Temperature', value: `${tempR}°F` },
      { label: 'Wind Speed', value: `${Math.round(wind)} mph` },
      { label: 'Humidity', value: `${Math.round(humidity)}%` },
      { label: 'Net Effect', value: `${diff > 0 ? '+' : ''}${diff}°F` },
    ],
    result: feelsR,
    actual: tempR,
    diff,
    color: diff < 0 ? 'text-blue-400' : 'text-orange-400',
    borderColor: diff < 0 ? 'border-blue-500' : 'border-orange-500',
    bgColor: diff < 0 ? 'bg-blue-900/30' : 'bg-orange-900/30',
  };
};

const CurrentConditionsTab = ({ current, daily, hourly, night, isWeatherLoading, alerts, aqiData }) => {
  const [feelsLikeOpen, setFeelsLikeOpen] = useState(false);

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
          <p className={`text-8xl sm:text-[120px] transition-colors duration-500 ${getTemperatureColorClass(Math.round(currentData.temperature_2m || 0))}`}>
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
        <div className="p-3 bg-black/20 rounded-lg border border-cyan-700 flex flex-col items-center hover:border-cyan-400 hover:bg-black/30 hover:shadow-neon-md hover:scale-105 transition-all duration-300 cursor-default">
          <Thermometer size={20} className="text-cyan-400" />
          <span className="text-sm text-cyan-300">FEELS LIKE</span>
          <span className="font-bold">{Math.round(currentData.apparent_temperature || currentData.temperature_2m || 0)}°F</span>
        </div>
        <div className="p-3 bg-black/20 rounded-lg border border-cyan-700 flex flex-col items-center hover:border-cyan-400 hover:bg-black/30 hover:shadow-neon-md hover:scale-105 transition-all duration-300 cursor-default">
          <WindCompass degrees={currentData.wind_direction_10m || 0} size={40} />
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

      {/* Feels Like Breakdown - Collapsible */}
      {(() => {
        const breakdown = calculateFeelsLikeBreakdown(currentData);
        if (!breakdown) return null;

        const barWidth = Math.min(Math.abs(breakdown.diff) * 5, 100);

        return (
          <div className="mt-6 bg-black/20 border-2 border-cyan-700 rounded-lg">
            <button
              onClick={() => setFeelsLikeOpen(!feelsLikeOpen)}
              className="w-full flex items-center justify-between p-3 sm:p-4 text-left hover:bg-white/5 transition rounded-lg"
            >
              <div className="flex items-center gap-2">
                <Thermometer size={20} className={breakdown.color} />
                <h4 className="text-lg sm:text-xl text-white font-bold">FEELS LIKE BREAKDOWN</h4>
                <span className={`ml-2 px-2 py-0.5 text-xs rounded ${breakdown.bgColor} ${breakdown.borderColor} border ${breakdown.color}`}>
                  {breakdown.type}
                </span>
              </div>
              {feelsLikeOpen
                ? <ChevronUp size={22} className="text-cyan-400 shrink-0" />
                : <ChevronDown size={22} className="text-cyan-400 shrink-0" />
              }
            </button>

            {feelsLikeOpen && (
              <div className="px-3 sm:px-4 pb-3 sm:pb-4 space-y-4">
                {/* Formula Badge */}
                <div className="inline-block px-3 py-1 bg-black/40 rounded border border-cyan-600 text-xs text-cyan-300 font-mono">
                  {breakdown.formula}
                </div>

                {/* Factor List */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {breakdown.factors.map((factor, idx) => (
                    <div key={idx} className="flex justify-between items-center p-2 bg-black/30 rounded border border-cyan-800">
                      <span className="text-sm text-cyan-300">{factor.label}</span>
                      <span className="text-sm font-bold text-white">{factor.value}</span>
                    </div>
                  ))}
                </div>

                {/* Result */}
                <div className={`p-3 rounded border-2 ${breakdown.borderColor} ${breakdown.bgColor}`}>
                  <div className="flex justify-between items-center">
                    <span className="text-cyan-300">RESULT</span>
                    <span className={`text-2xl font-bold ${breakdown.color}`}>{breakdown.result}°F</span>
                  </div>
                </div>

                {/* Visual Comparison Bar */}
                <div className="space-y-2">
                  <div className="flex justify-between text-xs text-gray-400">
                    <span>ACTUAL: {breakdown.actual}°F</span>
                    <span>FEELS LIKE: {breakdown.result}°F</span>
                  </div>
                  <div className="relative h-4 bg-black/40 rounded-full border border-cyan-800 overflow-hidden">
                    <div className="absolute inset-y-0 left-0 bg-cyan-600/50 rounded-full" style={{ width: '50%' }} />
                    <div
                      className={`absolute inset-y-0 rounded-full transition-all duration-500 ${
                        breakdown.diff < 0 ? 'bg-blue-500/70 right-1/2' : 'bg-orange-500/70 left-1/2'
                      }`}
                      style={{ width: `${barWidth / 2}%` }}
                    />
                    <div className="absolute inset-y-0 left-1/2 w-0.5 bg-white/60" />
                  </div>
                  <p className="text-xs text-center text-gray-400">
                    {breakdown.diff < 0
                      ? `Wind makes it feel ${Math.abs(breakdown.diff)}° colder`
                      : `Humidity makes it feel ${Math.abs(breakdown.diff)}° warmer`
                    }
                  </p>
                </div>
              </div>
            )}
          </div>
        );
      })()}
    </TabPanel>
  );
};

export default CurrentConditionsTab;
