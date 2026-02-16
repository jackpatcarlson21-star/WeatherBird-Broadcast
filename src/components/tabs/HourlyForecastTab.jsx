import React from 'react';
import TabPanel from '../layout/TabPanel';
import LoadingIndicator from '../common/LoadingIndicator';
import { formatTime } from '../../utils/helpers';
import { AnimatedWeatherIcon } from '../weather';

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
      feelsLike: Math.round(hourly.apparent_temperature?.[idx] || hourly.temperature_2m[idx]),
      pop: Math.round(hourly.precipitation_probability[idx]),
      code: hourly.weather_code[idx],
      wind: Math.round(hourly.wind_speed_10m[idx]),
      humidity: Math.round(hourly.relative_humidity_2m?.[idx] || 0),
    };
  }) : [];

  // Find min/max temps for the temperature bar visualization
  const temps = data.map(h => h.temp);
  const minTemp = Math.min(...temps);
  const maxTemp = Math.max(...temps);
  const tempRange = maxTemp - minTemp || 1;

  return (
    <TabPanel title="12-HOUR FORECAST">
      {/* Header row */}
      <div className="flex items-center px-3 py-2 text-xs text-cyan-500 border-b border-cyan-800/50 mb-1">
        <div className="w-16 sm:w-20">TIME</div>
        <div className="w-12 sm:w-16 text-center"></div>
        <div className="flex-1 text-center">TEMP</div>
        <div className="w-14 sm:w-16 text-center">RAIN</div>
        <div className="w-14 sm:w-16 text-center">WIND</div>
      </div>

      <div className="space-y-0.5">
        {data.map((h, index) => (
          <div
            key={index}
            className={`flex items-center px-3 py-2.5 rounded-md transition-colors
              ${index === 0
                ? 'bg-cyan-900/50 border border-cyan-500/50'
                : index % 2 === 0 ? 'bg-black/20' : 'bg-black/10'}`}
          >
            {/* Time */}
            <div className="w-16 sm:w-20">
              <p className={`text-sm sm:text-base font-bold font-vt323 ${index === 0 ? 'text-cyan-300' : 'text-cyan-400'}`}>
                {index === 0 ? 'NOW' : h.time}
              </p>
            </div>

            {/* Icon */}
            <div className="w-12 sm:w-16 flex justify-center">
              <AnimatedWeatherIcon code={h.code} night={night} size={28} />
            </div>

            {/* Temperature */}
            <div className="flex-1 text-center">
              <span className="text-xl sm:text-2xl font-bold text-white">{h.temp}°F</span>
              {h.feelsLike !== h.temp && (
                <span className="text-xs text-gray-400 ml-2">({h.feelsLike}°)</span>
              )}
            </div>

            {/* Precip */}
            <div className="w-14 sm:w-16 text-center">
              <span className={`text-sm sm:text-base font-bold ${h.pop >= 50 ? 'text-blue-400' : h.pop >= 20 ? 'text-blue-300' : 'text-gray-400'}`}>
                {h.pop}%
              </span>
            </div>

            {/* Wind */}
            <div className="w-14 sm:w-16 text-center">
              <span className="text-sm sm:text-base text-gray-300">{h.wind} mph</span>
            </div>
          </div>
        ))}
      </div>
    </TabPanel>
  );
};

export default HourlyForecastTab;
