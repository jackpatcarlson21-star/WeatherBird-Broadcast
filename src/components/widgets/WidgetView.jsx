import React from 'react';
import { MapPin, Maximize } from 'lucide-react';
import { NAVY_BLUE } from '../../utils/constants';
import { getWeatherIcon, getWeatherDescription, getAQIInfo } from '../../utils/helpers';

const WidgetView = ({ current, daily, aqiData, locationName, night, onExpand }) => {
  const currentData = current || {};
  const aqi = aqiData?.current?.us_aqi;
  const aqiInfo = getAQIInfo(aqi);

  return (
    <div
      className="h-screen w-full flex items-center justify-center p-4 font-vt323"
      style={{ backgroundColor: NAVY_BLUE }}
    >
      <div className="bg-black/40 border-2 border-cyan-500 rounded-2xl p-6 max-w-sm w-full shadow-neon-md">
        {/* Location */}
        <div className="text-center mb-4">
          <p className="text-cyan-400 text-lg flex items-center justify-center gap-2">
            <MapPin size={16} /> {locationName}
          </p>
        </div>

        {/* Main Weather Display */}
        <div className="flex items-center justify-center gap-4 mb-4">
          <span className="text-7xl">
            {getWeatherIcon(currentData.weather_code, night)}
          </span>
          <div className="text-center">
            <p className="text-6xl text-white font-bold">
              {Math.round(currentData.temperature_2m || 0)}°
            </p>
            <p className="text-cyan-300 text-xl">
              {getWeatherDescription(currentData.weather_code)}
            </p>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-3 gap-2 mb-4 text-center">
          <div className="bg-black/30 rounded-lg p-2">
            <p className="text-xs text-cyan-500">FEELS LIKE</p>
            <p className="text-white font-bold">{Math.round(currentData.apparent_temperature || 0)}°</p>
          </div>
          <div className="bg-black/30 rounded-lg p-2">
            <p className="text-xs text-cyan-500">WIND</p>
            <p className="text-white font-bold">{Math.round(currentData.wind_speed_10m || 0)} mph</p>
          </div>
          <div className="bg-black/30 rounded-lg p-2">
            <p className="text-xs text-cyan-500">HUMIDITY</p>
            <p className="text-white font-bold">{Math.round(currentData.relative_humidity_2m || 0)}%</p>
          </div>
        </div>

        {/* AQI */}
        <div className={`rounded-lg p-2 mb-4 text-center ${
          aqi <= 50 ? 'bg-green-900/30 border border-green-500' :
          aqi <= 100 ? 'bg-yellow-900/30 border border-yellow-500' :
          aqi <= 150 ? 'bg-orange-900/30 border border-orange-500' :
          'bg-red-900/30 border border-red-500'
        }`}>
          <p className="text-xs text-cyan-500">AIR QUALITY</p>
          <p className={`font-bold ${aqiInfo.textColor}`}>{aqi ?? '--'} - {aqiInfo.level}</p>
        </div>

        {/* High/Low */}
        {daily?.temperature_2m_max && (
          <div className="text-center mb-4 text-cyan-300">
            <span className="text-red-400">↑ {Math.round(daily.temperature_2m_max[0])}°</span>
            <span className="mx-2">/</span>
            <span className="text-blue-400">↓ {Math.round(daily.temperature_2m_min[0])}°</span>
          </div>
        )}

        {/* Expand Button */}
        <button
          onClick={onExpand}
          className="w-full py-2 bg-cyan-900/50 hover:bg-cyan-800 text-cyan-300 rounded-lg border border-cyan-500 transition-colors flex items-center justify-center gap-2"
        >
          <Maximize size={16} /> EXPAND FULL VIEW
        </button>
      </div>
    </div>
  );
};

export default WidgetView;
