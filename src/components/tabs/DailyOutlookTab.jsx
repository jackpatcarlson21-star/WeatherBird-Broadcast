import React, { useState, useEffect } from 'react';
import { Droplets, Wind, ChevronRight } from 'lucide-react';
import TabPanel from '../layout/TabPanel';
import LoadingIndicator from '../common/LoadingIndicator';
import { getNWSPointsUrl } from '../../utils/api';
import { getWeatherDescription } from '../../utils/helpers';
import { AnimatedWeatherIcon } from '../weather';

const DailyOutlookTab = ({ location, daily, isWeatherLoading }) => {
  const [nwsForecast, setNwsForecast] = useState(null);
  const [nwsLoading, setNwsLoading] = useState(true);
  const [nwsError, setNwsError] = useState(false);
  const [selectedDay, setSelectedDay] = useState(null);

  // Fetch NWS forecast for more accurate US weather data
  useEffect(() => {
    const fetchNWSForecast = async () => {
      if (!location?.lat || !location?.lon) return;

      setNwsLoading(true);
      setNwsError(false);

      try {
        // First get the forecast URL from the points endpoint
        const pointsRes = await fetch(getNWSPointsUrl(location.lat, location.lon), {
          headers: { 'User-Agent': 'WeatherBird App' }
        });
        if (!pointsRes.ok) throw new Error('Points fetch failed');
        const pointsData = await pointsRes.json();
        const forecastUrl = pointsData.properties?.forecast;

        if (!forecastUrl) throw new Error('No forecast URL');

        // Now fetch the actual forecast
        const forecastRes = await fetch(forecastUrl, {
          headers: { 'User-Agent': 'WeatherBird App' }
        });
        if (!forecastRes.ok) throw new Error('Forecast fetch failed');
        const forecastData = await forecastRes.json();

        setNwsForecast(forecastData.properties?.periods || []);
      } catch (err) {
        console.error('NWS forecast error:', err);
        setNwsError(true);
      } finally {
        setNwsLoading(false);
      }
    };

    fetchNWSForecast();
  }, [location?.lat, location?.lon]);

  if (isWeatherLoading && nwsLoading) return <LoadingIndicator />;

  // Process NWS data - periods come as day/night pairs
  // We need to combine them into daily high/low
  let data = [];

  if (nwsForecast && nwsForecast.length > 0 && !nwsError) {
    // NWS returns periods like "Tonight", "Saturday", "Saturday Night", etc.
    // Group them into days
    const days = [];
    let currentDay = null;

    for (const period of nwsForecast) {
      const periodDate = new Date(period.startTime);
      const dateKey = periodDate.toLocaleDateString([], { month: 'short', day: 'numeric' });

      if (period.isDaytime) {
        // Start a new day
        currentDay = {
          name: period.name,
          date: dateKey,
          max: period.temperature,
          min: null,
          pop: period.probabilityOfPrecipitation?.value || 0,
          wind: period.windSpeed,
          shortForecast: period.shortForecast,
          detailedForecast: period.detailedForecast,
          icon: period.icon,
        };
        days.push(currentDay);
      } else if (currentDay && currentDay.min === null) {
        // This is the night following the day
        currentDay.min = period.temperature;
        // Use higher precip chance
        const nightPop = period.probabilityOfPrecipitation?.value || 0;
        if (nightPop > currentDay.pop) currentDay.pop = nightPop;
        // Add night forecast info
        currentDay.nightForecast = period.detailedForecast;
      } else if (!currentDay) {
        // Starts with tonight - create a partial day
        currentDay = {
          name: 'Tonight',
          date: dateKey,
          max: null,
          min: period.temperature,
          pop: period.probabilityOfPrecipitation?.value || 0,
          wind: period.windSpeed,
          shortForecast: period.shortForecast,
          detailedForecast: period.detailedForecast,
          icon: period.icon,
        };
        days.push(currentDay);
      }
    }

    // Convert to our display format (limit to 7 days)
    data = days.slice(0, 7).map((d, idx) => ({
      day: idx === 0 ? (d.name === 'Tonight' ? 'Tonight' : 'Today') : d.name,
      date: d.date,
      max: d.max,
      min: d.min,
      pop: d.pop || 0,
      wind: d.wind || '--',
      shortForecast: d.shortForecast,
      detailedForecast: d.detailedForecast,
      nightForecast: d.nightForecast,
      isToday: idx === 0,
      isNightOnly: d.max === null,
    }));
  } else {
    // Fallback to Open-Meteo data
    data = daily?.time ? daily.time.slice(0, 7).map((timeStr, idx) => {
      const [year, month, day] = timeStr.split('-').map(Number);
      const date = new Date(year, month - 1, day);
      const code = daily.weather_code[idx] ?? 0;
      const high = Math.round(daily.temperature_2m_max[idx] ?? 0);
      const low = Math.round(daily.temperature_2m_min[idx] ?? 0);
      const pop = Math.round(daily.precipitation_probability_max[idx] ?? 0);
      const windSpeed = Math.round(daily.wind_speed_10m_max[idx] ?? 0);

      // Generate a brief description for Open-Meteo fallback
      const condition = getWeatherDescription(code);
      const description = `${condition}. High of ${high}°F, low of ${low}°F. ${pop > 0 ? `${pop}% chance of precipitation. ` : ''}Winds up to ${windSpeed} mph.`;

      return {
        day: idx === 0 ? 'Today' : date.toLocaleDateString([], { weekday: 'short' }),
        date: date.toLocaleDateString([], { month: 'short', day: 'numeric' }),
        max: high,
        min: low,
        pop: pop,
        wind: `${windSpeed} mph`,
        code: code,
        shortForecast: condition,
        detailedForecast: description,
        isToday: idx === 0,
        isNightOnly: false,
      };
    }) : [];
  }

  // Convert NWS forecast text to WMO code for AnimatedWeatherIcon
  const getForecastCode = (shortForecast, nwsIcon) => {
    const f = (shortForecast || '').toLowerCase();
    if (f.includes('thunder') || f.includes('storm')) return 95;
    if (f.includes('sleet') || f.includes('ice') || f.includes('freezing rain')) return 66;
    if (f.includes('freezing drizzle')) return 56;
    if (f.includes('snow') || f.includes('blizzard') || f.includes('flurr')) return 73;
    if (f.includes('rain') || f.includes('shower')) return 63;
    if (f.includes('drizzle')) return 53;
    if (f.includes('fog') || f.includes('haze') || f.includes('mist')) return 45;
    if (f.includes('overcast') || f.includes('mostly cloudy')) return 3;
    if (f.includes('cloud') || f.includes('partly') || f.includes('mostly sunny') || f.includes('mostly clear')) return 2;
    if (f.includes('sunny') || f.includes('clear')) return 0;
    if (nwsIcon?.includes('night')) return 0;
    return 0;
  };

  const isForecastNight = (nwsIcon) => !!(nwsIcon?.includes('night'));

  return (
    <TabPanel title="7-DAY FORECAST">
      {nwsError && (
        <p className="text-xs text-yellow-400 mb-2 text-center">Using backup forecast data</p>
      )}
      <div className="space-y-3">
        {data.map((d, index) => (
          <div
            key={index}
            className={`rounded-lg border-2 cursor-pointer transition-all duration-200 hover:border-cyan-400 ${
              d.isToday
                ? 'bg-cyan-900/30 border-cyan-500'
                : index % 2 === 0
                  ? 'bg-black/20 border-cyan-900'
                  : 'bg-black/40 border-cyan-800'
            } ${selectedDay === index ? 'ring-2 ring-cyan-400' : ''}`}
            onClick={() => setSelectedDay(selectedDay === index ? null : index)}
          >
            <div className="flex items-center p-3">
              <div className="w-1/6 text-left">
                <p className={`text-lg font-bold font-vt323 ${d.isToday ? 'text-cyan-200' : 'text-cyan-300'}`}>{d.day}</p>
                <p className="text-xs text-cyan-400">{d.date}</p>
              </div>
              <div className="w-1/6 flex justify-center">
                <AnimatedWeatherIcon
                  code={d.shortForecast ? getForecastCode(d.shortForecast, d.icon) : (d.code || 0)}
                  night={d.shortForecast ? isForecastNight(d.icon) : false}
                  size={40}
                />
              </div>
              <div className="w-2/6 text-center">
                {d.isNightOnly ? (
                  <span className="text-xl text-cyan-400">Low: {d.min}°</span>
                ) : (
                  <>
                    <span className="text-2xl font-vt323 text-white">{d.max}°</span>
                    <span className="text-xl text-cyan-400"> / {d.min !== null ? `${d.min}°` : '--'}</span>
                  </>
                )}
              </div>
              <div className="w-1/6 text-sm text-center flex flex-col items-center">
                <Droplets size={16} className="text-cyan-400" />
                <span className="text-white">{d.pop}%</span>
              </div>
              <div className="w-1/6 text-sm text-center flex flex-col items-center">
                <Wind size={16} className="text-cyan-400" />
                <span className="text-white">{d.wind}</span>
              </div>
              <div className="w-8 flex justify-center">
                <ChevronRight
                  size={20}
                  className={`text-cyan-400 transition-transform duration-200 ${selectedDay === index ? 'rotate-90' : ''}`}
                />
              </div>
            </div>
            {selectedDay === index && d.detailedForecast && (
              <div className="px-4 pb-3 pt-1 border-t border-cyan-800/50">
                <p className="text-sm text-cyan-100 leading-relaxed">{d.detailedForecast}</p>
                {d.nightForecast && (
                  <p className="text-sm text-cyan-300 mt-2 leading-relaxed">
                    <span className="text-cyan-400 font-bold">{d.day === 'Today' || d.day === 'Tonight' ? 'Tonight' : `${d.day} Night`}: </span>{d.nightForecast}
                  </p>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </TabPanel>
  );
};

export default DailyOutlookTab;
