import React, { useState, useEffect, useMemo } from 'react';
import { MapPin, Star } from 'lucide-react';
import TabPanel from '../layout/TabPanel';
import LoadingIndicator from '../common/LoadingIndicator';
import { getWeatherDescription } from '../../utils/helpers';
import { AnimatedWeatherIcon } from '../weather';

const DashboardTab = ({ currentLocation, savedLocations, onSelectLocation }) => {
  const [locationWeather, setLocationWeather] = useState({});
  const [isLoading, setIsLoading] = useState(false);

  // Combine current location with saved locations
  const allLocations = useMemo(() => {
    const locations = [{ ...currentLocation, id: 'current', isCurrent: true }];
    savedLocations.forEach(loc => {
      // Don't duplicate if current location is in saved
      const isDuplicate = Math.abs(loc.lat - currentLocation.lat) < 0.01 &&
                         Math.abs(loc.lon - currentLocation.lon) < 0.01;
      if (!isDuplicate) {
        locations.push(loc);
      }
    });
    return locations;
  }, [currentLocation, savedLocations]);

  // Fetch weather for all locations
  useEffect(() => {
    const fetchAllWeather = async () => {
      setIsLoading(true);
      const weatherData = {};

      await Promise.all(allLocations.map(async (loc) => {
        try {
          const url = `https://api.open-meteo.com/v1/forecast?latitude=${loc.lat}&longitude=${loc.lon}&current=temperature_2m,weather_code,wind_speed_10m&daily=temperature_2m_max,temperature_2m_min&temperature_unit=fahrenheit&wind_speed_unit=mph&timezone=auto&forecast_days=1`;
          const res = await fetch(url);
          if (res.ok) {
            const data = await res.json();
            weatherData[loc.id] = {
              temp: Math.round(data.current?.temperature_2m || 0),
              code: data.current?.weather_code || 0,
              wind: Math.round(data.current?.wind_speed_10m || 0),
              high: Math.round(data.daily?.temperature_2m_max?.[0] || 0),
              low: Math.round(data.daily?.temperature_2m_min?.[0] || 0),
            };
          }
        } catch (e) {
          console.error(`Failed to fetch weather for ${loc.name}:`, e);
        }
      }));

      setLocationWeather(weatherData);
      setIsLoading(false);
    };

    fetchAllWeather();
    // Refresh every 10 minutes
    const interval = setInterval(fetchAllWeather, 10 * 60 * 1000);
    return () => clearInterval(interval);
  }, [allLocations]);

  if (isLoading && Object.keys(locationWeather).length === 0) {
    return <TabPanel title="LOCATION DASHBOARD"><LoadingIndicator /></TabPanel>;
  }

  return (
    <TabPanel title="LOCATION DASHBOARD">
      <p className="text-cyan-400 mb-4">Weather at a glance for all your saved locations. Click a location to view details.</p>

      {allLocations.length <= 1 && savedLocations.length === 0 && (
        <div className="text-center py-8 border border-cyan-700 rounded-lg bg-black/20">
          <Star size={48} className="mx-auto mb-4 text-cyan-600" />
          <p className="text-xl text-cyan-300 mb-2">No saved locations yet</p>
          <p className="text-cyan-500">Click the location in the header to add favorites</p>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {allLocations.map((loc) => {
          const weather = locationWeather[loc.id];
          return (
            <button
              key={loc.id}
              onClick={() => onSelectLocation(loc)}
              className={`p-4 rounded-lg border-2 text-left transition-all hover:scale-[1.02] ${
                loc.isCurrent
                  ? 'border-cyan-400 bg-cyan-900/30'
                  : 'border-cyan-700 bg-black/30 hover:border-cyan-500'
              }`}
            >
              <div className="flex justify-between items-start mb-2">
                <div className="flex-1 min-w-0">
                  <p className="text-lg font-bold text-white truncate">{loc.name}</p>
                  {loc.isCurrent && (
                    <span className="text-xs text-cyan-400 flex items-center gap-1">
                      <MapPin size={10} /> Current Location
                    </span>
                  )}
                </div>
                <span className="ml-2">{weather ? <AnimatedWeatherIcon code={weather.code} night={false} size={40} /> : '...'}</span>
              </div>

              {weather ? (
                <>
                  <p className="text-4xl font-bold text-white">{weather.temp}°F</p>
                  <p className="text-sm text-cyan-300">{getWeatherDescription(weather.code)}</p>
                  <div className="flex gap-4 mt-2 text-sm">
                    <span className="text-cyan-400">H: {weather.high}°</span>
                    <span className="text-cyan-400">L: {weather.low}°</span>
                    <span className="text-cyan-500">Wind: {weather.wind} mph</span>
                  </div>
                </>
              ) : (
                <p className="text-cyan-500">Loading...</p>
              )}
            </button>
          );
        })}
      </div>

      <p className="text-xs text-cyan-600 mt-4 text-center">Auto-refreshes every 10 minutes</p>
    </TabPanel>
  );
};

export default DashboardTab;
