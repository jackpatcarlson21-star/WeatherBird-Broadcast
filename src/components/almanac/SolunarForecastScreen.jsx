import React, { useState, useEffect } from 'react';
import { Crosshair, Fish, ArrowLeft, Star, Moon, Wind, Cloud } from 'lucide-react';
import TabPanel from '../layout/TabPanel';
import LoadingIndicator from '../common/LoadingIndicator';
import { BRIGHT_CYAN, MID_BLUE } from '../../utils/constants';
import { formatTime, getMoonPhase } from '../../utils/helpers';
import { getSolunarPeriods, getSunTimes, getDailyPressureTrends, getDailyCloudCover, getDayRating } from '../../utils/solunar';

const parseLocalDate = (str) => {
  const [y, m, d] = str.split('-').map(Number);
  return new Date(y, m - 1, d);
};

const localDateStr = (date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

const StarRating = ({ stars, plus }) => (
  <span className="flex items-center gap-0.5">
    {[1, 2, 3, 4, 5].map((i) => (
      <Star key={i} size={16} className={i <= stars ? 'text-yellow-400' : 'text-gray-600'} fill={i <= stars ? 'currentColor' : 'none'} />
    ))}
    {plus && <span className="text-yellow-300 font-bold ml-0.5 text-sm">+</span>}
  </span>
);

// Position within a 24hr local-time span, clamped to [0, 100]%
const pctOfDay = (d) => {
  if (!d) return null;
  const dt = new Date(d);
  return Math.min(100, Math.max(0, ((dt.getHours() * 60 + dt.getMinutes()) / (24 * 60)) * 100));
};

const DayTimeline = ({ periods, sunrise, sunset }) => {
  const sunriseP = pctOfDay(sunrise);
  const sunsetP = pctOfDay(sunset);

  const renderBlock = (p, i, colorClass) => {
    const left = pctOfDay(p.start);
    const right = pctOfDay(p.end);
    if (left == null || right == null || right <= left) return null;
    return (
      <div
        key={i}
        title={p.label}
        className={`absolute top-0 h-full ${colorClass}`}
        style={{ left: `${left}%`, width: `${right - left}%` }}
      />
    );
  };

  return (
    <div className="relative h-5 rounded overflow-hidden bg-slate-900/70 border border-cyan-900">
      {sunriseP != null && sunsetP != null && sunsetP > sunriseP && (
        <div
          className="absolute top-0 h-full bg-yellow-400/15"
          style={{ left: `${sunriseP}%`, width: `${sunsetP - sunriseP}%` }}
        />
      )}
      {periods.minors.map((p, i) => renderBlock(p, `min-${i}`, 'bg-cyan-400/60'))}
      {periods.majors.map((p, i) => renderBlock(p, `maj-${i}`, 'bg-amber-400/85'))}
      {[6, 12, 18].map((h) => (
        <div key={h} className="absolute top-0 h-full border-l border-cyan-700/40" style={{ left: `${(h / 24) * 100}%` }} />
      ))}
    </div>
  );
};

const DayCard = ({ day, activityType, isToday }) => (
  <div className="p-3 rounded-lg" style={{ border: `2px solid ${BRIGHT_CYAN}`, backgroundColor: `${MID_BLUE}4D` }}>
    <div className="flex items-center justify-between flex-wrap gap-2 mb-2">
      <div className="flex items-center gap-2">
        <span className="text-white font-bold">
          {day.date.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })}
        </span>
        {isToday && <span className="text-xs bg-cyan-700 text-white px-1.5 py-0.5 rounded">TODAY</span>}
        {day.isSeasonsBest && <span className="text-xs bg-yellow-500 text-black font-bold px-1.5 py-0.5 rounded">SEASON'S BEST</span>}
      </div>
      <StarRating stars={day.rating.stars} plus={day.isSeasonsBest} />
    </div>

    <DayTimeline periods={day.periods} sunrise={day.sunrise} sunset={day.sunset} />
    <div className="flex justify-between text-[10px] text-cyan-600 mt-0.5 mb-2">
      <span>12am</span><span>6am</span><span>12pm</span><span>6pm</span><span>12am</span>
    </div>

    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm mb-2">
      <div>
        <p className="text-xs text-cyan-400 font-bold mb-1">MAJOR (~2hr)</p>
        {day.periods.majors.map((p, i) => (
          <div key={i} className="flex justify-between text-cyan-200">
            <span>{p.label}</span>
            <span className="text-white">{formatTime(p.start)}–{formatTime(p.end)}</span>
          </div>
        ))}
      </div>
      <div>
        <p className="text-xs text-cyan-400 font-bold mb-1">MINOR (~1hr)</p>
        {day.periods.minors.length > 0 ? day.periods.minors.map((p, i) => (
          <div key={i} className="flex justify-between text-cyan-200">
            <span>{p.label}</span>
            <span className="text-white">{formatTime(p.start)}–{formatTime(p.end)}</span>
          </div>
        )) : <p className="text-cyan-500 text-xs">No moonrise/set today</p>}
      </div>
    </div>

    <div className="flex items-center justify-between flex-wrap gap-2 text-xs text-cyan-400">
      <span className="flex items-center gap-1"><Moon size={12} /> {day.moonData.phaseName} ({day.moonData.illumination}%)</span>
      {activityType === 'hunting' && day.windMax != null && (
        <span className="flex items-center gap-1"><Wind size={12} /> {Math.round(day.windMax)} mph max</span>
      )}
      {activityType === 'fishing' && day.cloudCoverMean != null && (
        <span className="flex items-center gap-1"><Cloud size={12} /> {Math.round(day.cloudCoverMean)}% cloud cover</span>
      )}
    </div>

    {day.rating.reasons.length > 0 && (
      <ul className="list-disc list-inside text-xs text-cyan-300 mt-1 space-y-0.5">
        {day.rating.reasons.map((r, i) => <li key={i}>{r}</li>)}
      </ul>
    )}
  </div>
);

const SolunarForecastScreen = ({ location, activityType, onBack }) => {
  const [days, setDays] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(false);

  const isHunting = activityType === 'hunting';
  const Icon = isHunting ? Crosshair : Fish;
  const title = isHunting ? 'HUNTING FORECAST' : 'FISHING FORECAST';
  const today = localDateStr(new Date());

  useEffect(() => {
    const controller = new AbortController();

    const fetchForecast = async () => {
      setIsLoading(true);
      setError(false);
      try {
        const url = `https://api.open-meteo.com/v1/forecast?latitude=${location.lat}&longitude=${location.lon}&daily=wind_speed_10m_max&hourly=pressure_msl,cloud_cover&past_hours=24&forecast_days=7&timezone=auto&wind_speed_unit=mph`;
        const res = await fetch(url, { signal: controller.signal });
        if (!res.ok) throw new Error('Forecast fetch failed');
        const json = await res.json();

        const pressureTrends = getDailyPressureTrends(json.hourly);
        const cloudCoverMeans = getDailyCloudCover(json.hourly);
        const dateStrs = json.daily?.time || [];

        const builtDays = dateStrs.map((dateStr, i) => {
          const date = parseLocalDate(dateStr);
          const periods = getSolunarPeriods(date, location.lat, location.lon);
          const moonData = getMoonPhase(date);
          const sunTimes = getSunTimes(date, location.lat, location.lon);
          const windMax = json.daily?.wind_speed_10m_max?.[i] ?? null;
          const cloudCoverMean = !isHunting ? cloudCoverMeans[dateStr] : null;
          const rating = getDayRating({
            periods,
            illumination: moonData.illumination,
            pressureTrend: pressureTrends[dateStr] || 'steady',
            sunrise: sunTimes.sunrise,
            sunset: sunTimes.sunset,
            windSpeedMax: isHunting ? windMax : null,
            cloudCoverMean,
            activityType,
          });
          return { dateStr, date, periods, moonData, windMax, cloudCoverMean, sunrise: sunTimes.sunrise, sunset: sunTimes.sunset, rating };
        });

        const maxScore = Math.max(...builtDays.map((d) => d.rating.score));
        builtDays.forEach((d) => {
          d.isSeasonsBest = maxScore >= 75 && d.rating.score === maxScore;
        });

        setDays(builtDays);
      } catch (e) {
        if (e.name !== 'AbortError') {
          console.error('Solunar forecast fetch error:', e);
          setError(true);
        }
      } finally {
        if (!controller.signal.aborted) setIsLoading(false);
      }
    };

    if (location.lat && location.lon) fetchForecast();
    return () => controller.abort();
  }, [location.lat, location.lon, activityType, isHunting]);

  return (
    <TabPanel title={title}>
      <div className="space-y-4">
        <button onClick={onBack} className="flex items-center gap-1 text-cyan-300 hover:text-white text-sm">
          <ArrowLeft size={16} /> Back to Almanac
        </button>

        <div className="flex items-center gap-2 text-cyan-400">
          <Icon size={18} />
          <p className="text-xs">
            7-day solunar outlook — a traditional folklore method combining moon position/phase, barometric pressure trend{isHunting ? ', and wind' : ', and cloud cover'}. Not scientifically validated.
          </p>
        </div>

        <div className="flex items-center gap-4 text-xs text-cyan-400 flex-wrap">
          <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded-sm bg-amber-400/85" /> Major period</span>
          <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded-sm bg-cyan-400/60" /> Minor period</span>
          <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded-sm bg-yellow-400/15 border border-cyan-800" /> Daylight</span>
        </div>

        {isLoading && <LoadingIndicator />}
        {!isLoading && error && <p className="text-red-400 text-sm">Could not load forecast data.</p>}
        {!isLoading && !error && days && (
          <div className="space-y-3">
            {days.map((day) => (
              <DayCard key={day.dateStr} day={day} activityType={activityType} isToday={day.dateStr === today} />
            ))}
          </div>
        )}
      </div>
    </TabPanel>
  );
};

export default SolunarForecastScreen;
