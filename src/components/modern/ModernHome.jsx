import React, { useMemo } from 'react';
import { Thermometer, Wind, Droplets, Sun, CloudRain, Eye, Gauge } from 'lucide-react';
import { AnimatedWeatherIcon } from '../weather';
import { getWeatherDescription, fmtTemp, fmtWind, degreeToCardinal, getAQIInfo } from '../../utils/helpers';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const formatHour = (isoStr) => {
  const d = new Date(isoStr);
  const h = d.getHours();
  if (h === 0) return '12am';
  if (h === 12) return '12pm';
  return h > 12 ? `${h - 12}pm` : `${h}am`;
};

const formatDay = (dateStr, index) => {
  if (index === 0) return 'Today';
  const d = new Date(dateStr + 'T12:00:00');
  return DAYS[d.getDay()];
};

const getUVLabel = (uv) => {
  if (uv == null) return { label: '--', color: 'text-white' };
  if (uv <= 2)  return { label: 'Low', color: 'text-green-300' };
  if (uv <= 5)  return { label: 'Moderate', color: 'text-yellow-300' };
  if (uv <= 7)  return { label: 'High', color: 'text-orange-300' };
  if (uv <= 10) return { label: 'Very High', color: 'text-red-300' };
  return { label: 'Extreme', color: 'text-purple-300' };
};

const Card = ({ children, className = '' }) => (
  <div className={`bg-white/10 backdrop-blur-md rounded-2xl border border-white/10 ${className}`}>
    {children}
  </div>
);

const CardLabel = ({ children }) => (
  <p className="text-xs font-semibold uppercase tracking-widest text-white/50 mb-3">{children}</p>
);

const ModernHome = ({ current, daily, hourly, night, alerts, aqiData, location, units }) => {
  const temp = Math.round(current?.temperature_2m ?? 0);
  const feelsLike = Math.round(current?.apparent_temperature ?? temp);
  const high = Math.round(daily?.temperature_2m_max?.[0] ?? 0);
  const low = Math.round(daily?.temperature_2m_min?.[0] ?? 0);
  const weatherCode = current?.weather_code ?? 0;
  const condition = getWeatherDescription(weatherCode);
  const humidity = Math.round(current?.relative_humidity_2m ?? 0);
  const windSpeed = Math.round(current?.wind_speed_10m ?? 0);
  const windDir = degreeToCardinal(current?.wind_direction_10m ?? 0);
  const windGusts = Math.round(current?.wind_gusts_10m ?? 0);
  const uvIndex = daily?.uv_index_max?.[0] ?? null;
  const uvInfo = getUVLabel(uvIndex != null ? Math.round(uvIndex) : null);
  const pop = Math.round(daily?.precipitation_probability_max?.[0] ?? 0);
  const aqi = aqiData?.current?.us_aqi;
  const aqiInfo = getAQIInfo(aqi);

  // Hourly: show next 24 hours starting from current hour
  const hourlyItems = useMemo(() => {
    if (!hourly?.time) return [];
    const now = new Date();
    const items = [];
    for (let i = 0; i < hourly.time.length && items.length < 24; i++) {
      const t = new Date(hourly.time[i]);
      if (t >= now) {
        items.push({
          time: i === 0 ? 'Now' : formatHour(hourly.time[i]),
          temp: Math.round(hourly.temperature_2m?.[i] ?? 0),
          code: hourly.weather_code?.[i] ?? 0,
          pop: Math.round(hourly.precipitation_probability?.[i] ?? 0),
        });
      }
    }
    return items;
  }, [hourly]);

  // Daily: all 7-8 days
  const dailyItems = useMemo(() => {
    if (!daily?.time) return [];
    // Find min/max across all days for the temp bar
    const allHighs = daily.temperature_2m_max || [];
    const allLows = daily.temperature_2m_min || [];
    const absMin = Math.min(...allLows);
    const absMax = Math.max(...allHighs);
    return daily.time.map((date, i) => ({
      label: formatDay(date, i),
      code: daily.weather_code?.[i] ?? 0,
      high: Math.round(allHighs[i] ?? 0),
      low: Math.round(allLows[i] ?? 0),
      pop: Math.round(daily.precipitation_probability_max?.[i] ?? 0),
      barLeft: ((allLows[i] - absMin) / (absMax - absMin)) * 100,
      barWidth: ((allHighs[i] - allLows[i]) / (absMax - absMin)) * 100,
    }));
  }, [daily]);

  return (
    <div className="px-4 pt-2 pb-6 space-y-3 max-w-lg mx-auto">

      {/* Hero */}
      <div className="text-center py-6">
        <div className="flex justify-center mb-2">
          <AnimatedWeatherIcon code={weatherCode} night={night} size={80} />
        </div>
        <p className="text-8xl font-thin tracking-tighter text-white drop-shadow-lg">
          {fmtTemp(temp, units)}
        </p>
        <p className="text-xl text-white/80 mt-1">{condition}</p>
        <p className="text-sm text-white/60 mt-1">
          H:{fmtTemp(high, units)} · L:{fmtTemp(low, units)} · Feels like {fmtTemp(feelsLike, units)}
        </p>
        {alerts.length > 0 && (
          <div className="inline-flex items-center gap-1 mt-3 px-3 py-1 bg-red-500/80 rounded-full text-sm font-medium text-white">
            ⚠ {alerts.length} active alert{alerts.length > 1 ? 's' : ''}
          </div>
        )}
      </div>

      {/* Hourly strip */}
      <Card className="p-4">
        <CardLabel>Hourly Forecast</CardLabel>
        <div className="flex gap-4 overflow-x-auto pb-1 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
          {hourlyItems.map((h, i) => (
            <div key={i} className="flex flex-col items-center gap-1 min-w-[48px]">
              <span className="text-xs text-white/60">{h.time}</span>
              <AnimatedWeatherIcon code={h.code} night={false} size={24} />
              {h.pop >= 20 && <span className="text-[10px] text-blue-300">{h.pop}%</span>}
              <span className="text-sm font-medium text-white">{fmtTemp(h.temp, units)}</span>
            </div>
          ))}
        </div>
      </Card>

      {/* 7-day */}
      <Card className="p-4">
        <CardLabel>7-Day Forecast</CardLabel>
        <div className="space-y-2">
          {dailyItems.map((d, i) => (
            <div key={i} className="flex items-center gap-3">
              <span className="text-sm text-white/80 w-10 shrink-0">{d.label}</span>
              <AnimatedWeatherIcon code={d.code} night={false} size={20} />
              {d.pop >= 20 && <span className="text-[10px] text-blue-300 w-7">{d.pop}%</span>}
              {d.pop < 20 && <span className="w-7" />}
              <span className="text-sm text-white/50 w-8 text-right">{fmtTemp(d.low, units)}</span>
              <div className="flex-1 h-1.5 bg-white/10 rounded-full relative mx-1">
                <div
                  className="absolute top-0 h-full rounded-full bg-gradient-to-r from-blue-300 to-orange-300"
                  style={{ left: `${d.barLeft}%`, width: `${Math.max(d.barWidth, 5)}%` }}
                />
              </div>
              <span className="text-sm text-white w-8">{fmtTemp(d.high, units)}</span>
            </div>
          ))}
        </div>
      </Card>

      {/* Detail cards grid */}
      <div className="grid grid-cols-2 gap-3">
        <Card className="p-4">
          <CardLabel>Feels Like</CardLabel>
          <p className="text-3xl font-light text-white">{fmtTemp(feelsLike, units)}</p>
          <p className="text-xs text-white/50 mt-1">
            {feelsLike < temp ? 'Wind makes it colder' : feelsLike > temp ? 'Humidity makes it warmer' : 'Similar to actual temp'}
          </p>
        </Card>

        <Card className="p-4">
          <CardLabel>Humidity</CardLabel>
          <p className="text-3xl font-light text-white">{humidity}%</p>
          <div className="mt-2 h-1.5 bg-white/10 rounded-full">
            <div className="h-full bg-blue-400 rounded-full transition-all" style={{ width: `${humidity}%` }} />
          </div>
        </Card>

        <Card className="p-4">
          <CardLabel>Wind</CardLabel>
          <p className="text-3xl font-light text-white">{fmtWind(windSpeed, units)}</p>
          <p className="text-xs text-white/50 mt-1">{windDir} · Gusts {fmtWind(windGusts, units)}</p>
        </Card>

        <Card className="p-4">
          <CardLabel>UV Index</CardLabel>
          <p className={`text-3xl font-light ${uvInfo.color}`}>
            {uvIndex != null ? Math.round(uvIndex) : '--'}
          </p>
          <p className={`text-xs mt-1 ${uvInfo.color}`}>{uvInfo.label}</p>
        </Card>

        <Card className="p-4">
          <CardLabel>Precipitation</CardLabel>
          <p className="text-3xl font-light text-white">{pop}%</p>
          <p className="text-xs text-white/50 mt-1">Chance today</p>
        </Card>

        <Card className="p-4">
          <CardLabel>Air Quality</CardLabel>
          <p className={`text-3xl font-light ${aqiInfo?.textColor ?? 'text-white'}`}>
            {aqi ?? '--'}
          </p>
          <p className={`text-xs mt-1 ${aqiInfo?.textColor ?? 'text-white/50'}`}>
            {aqiInfo?.level ?? 'Loading...'}
          </p>
        </Card>
      </div>
    </div>
  );
};

export default ModernHome;
