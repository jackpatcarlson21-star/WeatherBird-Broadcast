import React, { useState, useEffect } from 'react';
import { Sunrise, Sunset, Thermometer, Sun, Calendar, Clock, Droplets, Moon, Maximize, Minimize, Star } from 'lucide-react';
import TabPanel from '../layout/TabPanel';
import LoadingIndicator from '../common/LoadingIndicator';
import { BRIGHT_CYAN, MID_BLUE } from '../../utils/constants';
import { getMoonPhase } from '../../utils/helpers';

// Weather facts that rotate hourly
const WEATHER_FACTS = [
  "Lightning strikes the Earth about 8 million times per day.",
  "A hurricane can release energy equivalent to 10,000 nuclear bombs.",
  "The fastest wind speed ever recorded was 253 mph during a tornado in Oklahoma.",
  "Snowflakes can take up to an hour to fall from the cloud to the ground.",
  "The average thunderstorm is 15 miles in diameter and lasts 30 minutes.",
  "A single cloud can weigh more than 1 million pounds.",
  "The coldest temperature ever recorded was -128.6F in Antarctica.",
  "Rain contains vitamin B12, which is why plants thrive after a storm.",
  "The hottest temperature ever recorded was 134F in Death Valley, California.",
  "Fog is actually a cloud that touches the ground.",
  "A bolt of lightning is 5 times hotter than the surface of the sun.",
  "The US has more tornadoes than any other country in the world.",
  "Hailstones can fall at speeds over 100 mph.",
  "The eye of a hurricane is completely calm with clear skies.",
  "Raindrops are not teardrop-shaped - they're actually shaped like hamburger buns.",
  "Mount Waialeale in Hawaii has rain about 350 days per year.",
  "The smell after rain is called 'petrichor' and comes from oils released by plants.",
  "Crickets chirp faster when it's warmer - you can estimate temperature by counting chirps.",
  "Lake-effect snow can dump several feet of snow in just hours.",
  "The Great Blizzard of 1888 dropped 50 inches of snow on the northeastern US.",
  "Dust from the Sahara Desert can travel across the Atlantic to the Americas.",
  "Ball lightning is a rare phenomenon that scientists still don't fully understand.",
  "The wind doesn't make a sound until it blows against something.",
  "Yuma, Arizona is the sunniest place on Earth with 90% of daylight hours being sunny.",
];

// Helper component for almanac stats
const AlmanacStat = ({ title, value, subtitle, icon: Icon }) => (
  <div className="flex flex-col p-2 bg-black/20 rounded border border-cyan-800">
    <div className="flex items-center text-cyan-400 text-xs mb-1">
      <Icon size={14} className="mr-1" /> {title}
    </div>
    <span className="text-lg font-bold">{value}</span>
    {subtitle && <span className="text-xs text-cyan-500">{subtitle}</span>}
  </div>
);

// Sparkline for "On This Day" 10-year trend
const OnThisDaySparkline = ({ data }) => {
  if (!data || data.length < 2) return null;

  const W = 500, H = 90;
  const PAD = { top: 10, right: 10, bottom: 22, left: 32 };
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;

  const allTemps = data.flatMap(d => [d.high, d.low]).filter(v => v != null);
  if (!allTemps.length) return null;

  const minT = Math.min(...allTemps) - 4;
  const maxT = Math.max(...allTemps) + 4;
  const range = maxT - minT || 1;

  const xPos = (i) => PAD.left + (i / Math.max(data.length - 1, 1)) * innerW;
  const yPos = (v) => PAD.top + innerH - ((v - minT) / range) * innerH;
  const chartBottom = PAD.top + innerH;

  const highPts = data.filter(d => d.high != null).map((d, i) => `${xPos(data.indexOf(d))},${yPos(d.high)}`);
  const lowPts  = data.filter(d => d.low  != null).map((d, i) => `${xPos(data.indexOf(d))},${yPos(d.low)}`);

  // Area between high and low
  const areaTop = data.map((d, i) => `${xPos(i)},${d.high != null ? yPos(d.high) : yPos((minT + maxT) / 2)}`).join(' L ');
  const areaBot = [...data].reverse().map((d, i) => `${xPos(data.length - 1 - i)},${d.low != null ? yPos(d.low) : yPos((minT + maxT) / 2)}`).join(' L ');
  const areaPath = `M ${areaTop} L ${areaBot} Z`;

  return (
    <div className="mb-2">
      <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ fontFamily: 'VT323, monospace', overflow: 'visible' }}>
        {/* Y-axis labels */}
        <text x={PAD.left - 4} y={PAD.top + 5}      textAnchor="end" fill="rgba(0,255,255,0.45)" fontSize="13">{Math.round(maxT)}°</text>
        <text x={PAD.left - 4} y={chartBottom}       textAnchor="end" fill="rgba(0,255,255,0.45)" fontSize="13">{Math.round(minT)}°</text>

        {/* Area fill between high and low */}
        <path d={areaPath} fill="rgba(96,165,250,0.12)" />

        {/* High line */}
        <path d={`M ${highPts.join(' L ')}`} fill="none" stroke="#F87171" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        {/* Low line */}
        <path d={`M ${lowPts.join(' L ')}`}  fill="none" stroke="#60A5FA" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />

        {/* Dots on each point */}
        {data.map((d, i) => (
          <g key={i}>
            {d.high != null && <circle cx={xPos(i)} cy={yPos(d.high)} r="3" fill="#F87171"><title>{d.year}: {Math.round(d.high)}°</title></circle>}
            {d.low  != null && <circle cx={xPos(i)} cy={yPos(d.low)}  r="3" fill="#60A5FA"><title>{d.year}: {Math.round(d.low)}°</title></circle>}
          </g>
        ))}

        {/* X-axis year labels (show every other year to avoid crowding) */}
        {data.map((d, i) => (
          (i % 2 === 0 || i === data.length - 1) && (
            <text key={i} x={xPos(i)} y={H - 2} textAnchor="middle" fill="rgba(0,255,255,0.5)" fontSize="12">
              {d.year}
            </text>
          )
        ))}
      </svg>

      {/* Legend */}
      <div className="flex gap-4 text-xs mt-0.5">
        <div className="flex items-center gap-1">
          <svg width="16" height="6"><line x1="0" y1="3" x2="16" y2="3" stroke="#F87171" strokeWidth="2" /></svg>
          <span style={{ color: '#F87171' }}>High</span>
        </div>
        <div className="flex items-center gap-1">
          <svg width="16" height="6"><line x1="0" y1="3" x2="16" y2="3" stroke="#60A5FA" strokeWidth="2" /></svg>
          <span style={{ color: '#60A5FA' }}>Low</span>
        </div>
      </div>
    </div>
  );
};

const AlmanacTab = ({ location, userId }) => {
  const today = new Date();
  const [almanacData, setAlmanacData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  // Get weather fact based on current hour (changes every hour)
  const currentHour = today.getHours();
  const weatherFact = WEATHER_FACTS[currentHour % WEATHER_FACTS.length];

  useEffect(() => {
    const controller = new AbortController();
    const signal = controller.signal;

    const fetchAlmanacData = async () => {
      setIsLoading(true);
      try {
        // Get today's month and day for historical comparison
        const month = String(today.getMonth() + 1).padStart(2, '0');
        const day = String(today.getDate()).padStart(2, '0');
        const currentYear = today.getFullYear();

        // Fetch historical data for this date across multiple years (last 30 years)
        const startYear = currentYear - 30;
        const historicalPromises = [];

        // Get data for this specific date across past years
        for (let year = startYear; year < currentYear; year++) {
          const dateStr = `${year}-${month}-${day}`;
          historicalPromises.push(
            fetch(`https://archive-api.open-meteo.com/v1/archive?latitude=${location.lat}&longitude=${location.lon}&start_date=${dateStr}&end_date=${dateStr}&daily=temperature_2m_max,temperature_2m_min,precipitation_sum&temperature_unit=fahrenheit&precipitation_unit=inch&timezone=auto`, { signal })
              .then(res => res.ok ? res.json() : null)
              .catch(() => null)
          );
        }

        // Fetch YTD precipitation (Jan 1 to today)
        const ytdStartDate = `${currentYear}-01-01`;
        const ytdEndDate = `${currentYear}-${month}-${day}`;
        const ytdPromise = fetch(`https://archive-api.open-meteo.com/v1/archive?latitude=${location.lat}&longitude=${location.lon}&start_date=${ytdStartDate}&end_date=${ytdEndDate}&daily=precipitation_sum&precipitation_unit=inch&timezone=auto`, { signal })
          .then(res => res.ok ? res.json() : null)
          .catch(() => null);

        // Fetch historical YTD precip (Jan 1 through today's date across the past 10 years in one request)
        const histYtdStart = `${currentYear - 10}-01-01`;
        const histYtdEnd   = `${currentYear - 1}-${month}-${day}`;
        const histYtdPromise = fetch(`https://archive-api.open-meteo.com/v1/archive?latitude=${location.lat}&longitude=${location.lon}&start_date=${histYtdStart}&end_date=${histYtdEnd}&daily=precipitation_sum&precipitation_unit=inch&timezone=auto`, { signal })
          .then(res => res.ok ? res.json() : null)
          .catch(() => null);

        // Fetch monthly averages (this month across years)
        const monthStart = `${currentYear - 10}-${month}-01`;
        // Use day 0 of next month to get the actual last day of the target month
        const lastDay = new Date(currentYear - 1, today.getMonth() + 1, 0).getDate();
        const monthEnd = `${currentYear - 1}-${month}-${String(lastDay).padStart(2, '0')}`;
        const monthlyPromise = fetch(`https://archive-api.open-meteo.com/v1/archive?latitude=${location.lat}&longitude=${location.lon}&start_date=${monthStart}&end_date=${monthEnd}&daily=temperature_2m_max,temperature_2m_min&temperature_unit=fahrenheit&timezone=auto`, { signal })
          .then(res => res.ok ? res.json() : null)
          .catch(() => null);

        // Fetch today's forecast high/low for comparison against records
        const forecastTodayPromise = fetch(`https://api.open-meteo.com/v1/forecast?latitude=${location.lat}&longitude=${location.lon}&daily=temperature_2m_max,temperature_2m_min&temperature_unit=fahrenheit&timezone=auto&forecast_days=1`, { signal })
          .then(res => res.ok ? res.json() : null)
          .catch(() => null);

        // Fetch sunrise/sunset for today and yesterday
        const todayStr = `${currentYear}-${month}-${day}`;
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayStr = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, '0')}-${String(yesterday.getDate()).padStart(2, '0')}`;
        const sunPromise = fetch(`https://api.open-meteo.com/v1/forecast?latitude=${location.lat}&longitude=${location.lon}&daily=sunrise,sunset&timezone=auto&start_date=${yesterdayStr}&end_date=${todayStr}`, { signal })
          .then(res => res.ok ? res.json() : null)
          .catch(() => null);

        // Fetch historical data for frost date estimation (spring and fall)
        const springStart = `${currentYear - 5}-03-01`;
        const springEnd = `${currentYear - 1}-05-31`;
        const fallStart = `${currentYear - 5}-09-01`;
        const fallEnd = `${currentYear - 1}-11-30`;
        const springFrostPromise = fetch(`https://archive-api.open-meteo.com/v1/archive?latitude=${location.lat}&longitude=${location.lon}&start_date=${springStart}&end_date=${springEnd}&daily=temperature_2m_min&temperature_unit=fahrenheit&timezone=auto`, { signal })
          .then(res => res.ok ? res.json() : null)
          .catch(() => null);
        const fallFrostPromise = fetch(`https://archive-api.open-meteo.com/v1/archive?latitude=${location.lat}&longitude=${location.lon}&start_date=${fallStart}&end_date=${fallEnd}&daily=temperature_2m_min&temperature_unit=fahrenheit&timezone=auto`, { signal })
          .then(res => res.ok ? res.json() : null)
          .catch(() => null);

        const [
          ytdData, monthlyData, sunData, springFrostData, fallFrostData,
          forecastTodayData, histYtdData,
          ...historicalResults
        ] = await Promise.all([
          ytdPromise, monthlyPromise, sunPromise, springFrostPromise, fallFrostPromise,
          forecastTodayPromise, histYtdPromise,
          ...historicalPromises,
        ]);

        // Process historical data for this date
        let recordHigh = -999;
        let recordHighYear = currentYear;
        let recordLow = 999;
        let recordLowYear = currentYear;
        let recordPrecip = 0;
        let recordPrecipYear = currentYear;
        const historicalTemps = [];

        historicalResults.forEach((data, idx) => {
          if (data?.daily) {
            const high = data.daily.temperature_2m_max?.[0];
            const low = data.daily.temperature_2m_min?.[0];
            const precip = data.daily.precipitation_sum?.[0] || 0;
            const year = startYear + idx;

            if (high != null) historicalTemps.push({ year, high, low });
            if (high != null && high > recordHigh) { recordHigh = high; recordHighYear = year; }
            if (low != null && low < recordLow) { recordLow = low; recordLowYear = year; }
            if (precip > recordPrecip) {
              recordPrecip = precip;
              recordPrecipYear = year;
            }
          }
        });

        // Calculate YTD precipitation
        let ytdPrecip = 0;
        if (ytdData?.daily?.precipitation_sum) {
          ytdPrecip = ytdData.daily.precipitation_sum.reduce((sum, p) => sum + (p || 0), 0);
        }

        // Calculate historical average YTD precip from the 10-year single-request archive
        let historicalAvgYtd = null;
        if (histYtdData?.daily?.time && histYtdData?.daily?.precipitation_sum) {
          const yearTotals = {};
          histYtdData.daily.time.forEach((dateStr, i) => {
            const yr = new Date(dateStr).getFullYear();
            if (!yearTotals[yr]) yearTotals[yr] = 0;
            yearTotals[yr] += histYtdData.daily.precipitation_sum[i] || 0;
          });
          const totals = Object.values(yearTotals);
          if (totals.length > 0) {
            historicalAvgYtd = (totals.reduce((a, b) => a + b, 0) / totals.length).toFixed(2);
          }
        }

        // Calculate monthly averages
        let avgHighMonth = 0;
        let avgLowMonth = 0;
        if (monthlyData?.daily) {
          const highs = monthlyData.daily.temperature_2m_max?.filter(t => t != null) || [];
          const lows = monthlyData.daily.temperature_2m_min?.filter(t => t != null) || [];
          if (highs.length > 0) avgHighMonth = highs.reduce((a, b) => a + b, 0) / highs.length;
          if (lows.length > 0) avgLowMonth = lows.reduce((a, b) => a + b, 0) / lows.length;
        }

        // Extract today's forecast high/low
        const forecastHigh = forecastTodayData?.daily?.temperature_2m_max?.[0] != null
          ? Math.round(forecastTodayData.daily.temperature_2m_max[0]) : null;
        const forecastLow = forecastTodayData?.daily?.temperature_2m_min?.[0] != null
          ? Math.round(forecastTodayData.daily.temperature_2m_min[0]) : null;

        // Process sunrise/sunset data
        let sunrise = '--';
        let sunset = '--';
        let dayLength = '--';
        let daylightChange = '--';
        if (sunData?.daily) {
          const todaySunrise = sunData.daily.sunrise?.[1];
          const todaySunset = sunData.daily.sunset?.[1];
          const yesterdaySunrise = sunData.daily.sunrise?.[0];
          const yesterdaySunset = sunData.daily.sunset?.[0];

          if (todaySunrise && todaySunset) {
            sunrise = new Date(todaySunrise).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
            sunset = new Date(todaySunset).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
            const todayLength = (new Date(todaySunset) - new Date(todaySunrise)) / 1000 / 60; // minutes
            const hours = Math.floor(todayLength / 60);
            const mins = Math.round(todayLength % 60);
            dayLength = `${hours}h ${mins}m`;

            if (yesterdaySunrise && yesterdaySunset) {
              const yesterdayLength = (new Date(yesterdaySunset) - new Date(yesterdaySunrise)) / 1000 / 60;
              const diff = todayLength - yesterdayLength;
              const diffMins = Math.abs(Math.round(diff * 60) / 60).toFixed(1);
              daylightChange = diff > 0 ? `+${diffMins} min` : `-${diffMins} min`;
            }
          }
        }

        // Estimate frost dates from historical data
        let lastSpringFrost = '--';
        let firstFallFrost = '--';
        let lastSpringFrostDOY = null;
        let firstFallFrostDOY = null;
        if (springFrostData?.daily?.temperature_2m_min && springFrostData?.daily?.time) {
          const springFrostDates = [];
          springFrostData.daily.time.forEach((date, i) => {
            const temp = springFrostData.daily.temperature_2m_min[i];
            if (temp != null && temp <= 32) {
              const d = new Date(date);
              const dayOfYear = Math.floor((d - new Date(d.getFullYear(), 0, 0)) / 86400000);
              if (dayOfYear >= 60 && dayOfYear <= 152) { // March through May
                springFrostDates.push(dayOfYear);
              }
            }
          });
          if (springFrostDates.length > 0) {
            lastSpringFrostDOY = Math.round(springFrostDates.reduce((a, b) => Math.max(a, b), 0));
            const frostDate = new Date(currentYear, 0, lastSpringFrostDOY);
            lastSpringFrost = frostDate.toLocaleDateString([], { month: 'short', day: 'numeric' });
          }
        }
        if (fallFrostData?.daily?.temperature_2m_min && fallFrostData?.daily?.time) {
          const fallFrostDates = [];
          fallFrostData.daily.time.forEach((date, i) => {
            const temp = fallFrostData.daily.temperature_2m_min[i];
            if (temp != null && temp <= 32) {
              const d = new Date(date);
              const dayOfYear = Math.floor((d - new Date(d.getFullYear(), 0, 0)) / 86400000);
              if (dayOfYear >= 244 && dayOfYear <= 335) { // September through November
                fallFrostDates.push(dayOfYear);
              }
            }
          });
          if (fallFrostDates.length > 0) {
            firstFallFrostDOY = Math.round(fallFrostDates.reduce((a, b) => Math.min(a, b), 366));
            const frostDate = new Date(currentYear, 0, firstFallFrostDOY);
            firstFallFrost = frostDate.toLocaleDateString([], { month: 'short', day: 'numeric' });
          }
        }

        // Calculate growing season length
        let growingSeasonDays = '--';
        if (lastSpringFrostDOY && firstFallFrostDOY) {
          growingSeasonDays = firstFallFrostDOY - lastSpringFrostDOY;
        }

        setAlmanacData({
          recordHigh: recordHigh > -999 ? Math.round(recordHigh) : '--',
          recordHighYear,
          recordLow: recordLow < 999 ? Math.round(recordLow) : '--',
          recordLowYear,
          ytdPrecip: ytdPrecip.toFixed(2),
          avgHighMonth: avgHighMonth > 0 ? Math.round(avgHighMonth) : '--',
          avgLowMonth: avgLowMonth > 0 ? Math.round(avgLowMonth) : '--',
          recordPrecip: recordPrecip.toFixed(2),
          recordPrecipYear: recordPrecip > 0 ? recordPrecipYear : '--',
          sunrise,
          sunset,
          dayLength,
          daylightChange,
          growingSeasonDays,
          lastSpringFrost,
          firstFallFrost,
          historicalTemps: historicalTemps.slice(-10), // Last 10 years for "On This Day"
          forecastHigh,
          forecastLow,
          historicalAvgYtd,
        });
      } catch (e) {
        if (e.name === 'AbortError') return;
        console.error("Almanac fetch error:", e);
        setAlmanacData(null);
      } finally {
        if (!signal.aborted) setIsLoading(false);
      }
    };

    if (location.lat && location.lon) {
      fetchAlmanacData();
    }

    return () => controller.abort();
  }, [location.lat, location.lon]);

  if (isLoading) {
    return (
      <TabPanel title="RECORDS">
        <LoadingIndicator />
      </TabPanel>
    );
  }

  const displayData = almanacData || {
    recordHigh: '--',
    recordHighYear: '--',
    recordLow: '--',
    recordLowYear: '--',
    ytdPrecip: '--',
    avgHighMonth: '--',
    avgLowMonth: '--',
    recordPrecip: '--',
    recordPrecipYear: '--',
    sunrise: '--',
    sunset: '--',
    dayLength: '--',
    daylightChange: '--',
    growingSeasonDays: '--',
    lastSpringFrost: '--',
    firstFallFrost: '--',
    historicalTemps: [],
    forecastHigh: null,
    forecastLow: null,
    historicalAvgYtd: null,
  };

  return (
    <TabPanel title="RECORDS">
      <div className="space-y-4">
        {/* Weather Fact Banner */}
        <div className="p-4 rounded-lg text-center" style={{ border: `2px solid ${BRIGHT_CYAN}`, backgroundColor: `${MID_BLUE}4D` }}>
          <div className="flex items-center justify-center gap-2 mb-2">
            <Star size={18} className="text-yellow-400"/>
            <h3 className="text-lg text-white font-bold">WEATHER FACT OF THE HOUR</h3>
            <Star size={18} className="text-yellow-400"/>
          </div>
          <p className="text-cyan-200 text-lg italic">"{weatherFact}"</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

          {/* Sunrise/Sunset & Daylight Box */}
          <div className="lg:col-span-1 p-4 rounded-lg space-y-3" style={{ border: `2px solid ${BRIGHT_CYAN}`, backgroundColor: `${MID_BLUE}4D` }}>
            <h3 className="text-lg text-white font-bold border-b border-cyan-700 pb-2 flex items-center gap-2"><Sunrise size={18}/> SUN & DAYLIGHT</h3>
            <div className="grid grid-cols-2 gap-3 text-center">
              <div className="bg-black/20 rounded p-2">
                <Sunrise size={24} className="mx-auto text-yellow-400 mb-1"/>
                <p className="text-xs text-cyan-400">Sunrise</p>
                <p className="text-lg font-bold text-white">{displayData.sunrise}</p>
              </div>
              <div className="bg-black/20 rounded p-2">
                <Sunset size={24} className="mx-auto text-orange-400 mb-1"/>
                <p className="text-xs text-cyan-400">Sunset</p>
                <p className="text-lg font-bold text-white">{displayData.sunset}</p>
              </div>
            </div>
            <div className="text-center bg-black/20 rounded p-2">
              <p className="text-xs text-cyan-400">Day Length</p>
              <p className="text-2xl font-bold text-white">{displayData.dayLength}</p>
              <p className={`text-sm ${displayData.daylightChange?.startsWith('+') ? 'text-green-400' : 'text-red-400'}`}>
                {displayData.daylightChange} from yesterday
              </p>
            </div>
          </div>

          {/* Frost Dates Box */}
          <div className="lg:col-span-1 p-4 rounded-lg space-y-3" style={{ border: `2px solid ${BRIGHT_CYAN}`, backgroundColor: `${MID_BLUE}4D` }}>
            <h3 className="text-lg text-white font-bold border-b border-cyan-700 pb-2 flex items-center gap-2"><Thermometer size={18}/> FROST DATES (AVG)</h3>
            <div className="space-y-3">
              <div className="bg-black/20 rounded p-3 text-center">
                <p className="text-xs text-cyan-400">Last Spring Frost</p>
                <p className="text-2xl font-bold text-green-400">{displayData.lastSpringFrost}</p>
                <p className="text-xs text-cyan-500">Safe to plant after</p>
              </div>
              <div className="bg-black/20 rounded p-3 text-center">
                <p className="text-xs text-cyan-400">First Fall Frost</p>
                <p className="text-2xl font-bold text-blue-400">{displayData.firstFallFrost}</p>
                <p className="text-xs text-cyan-500">Protect plants before</p>
              </div>
            </div>
          </div>

          {/* Growing Season Box */}
          <div className="lg:col-span-1 p-4 rounded-lg space-y-3" style={{ border: `2px solid ${BRIGHT_CYAN}`, backgroundColor: `${MID_BLUE}4D` }}>
            <h3 className="text-lg text-white font-bold border-b border-cyan-700 pb-2 flex items-center gap-2"><Sun size={18}/> GROWING SEASON</h3>
            <div className="text-center bg-black/20 rounded p-4">
              <p className="text-xs text-cyan-400">Frost-Free Days</p>
              <p className="text-4xl font-bold text-green-400">{displayData.growingSeasonDays}</p>
              <p className="text-sm text-cyan-300 mt-2">days per year</p>
            </div>
            <div className="text-center text-xs text-cyan-400 space-y-1">
              <p>From {displayData.lastSpringFrost} to {displayData.firstFallFrost}</p>
              <p className="text-cyan-500">Based on 5-year historical data</p>
            </div>
          </div>

          {/* Historical Records + Today's Forecast Comparison */}
          <div className="lg:col-span-2 p-4 rounded-lg space-y-3" style={{ border: `2px solid ${BRIGHT_CYAN}`, backgroundColor: `${MID_BLUE}4D` }}>
            <h3 className="text-lg text-white font-bold border-b border-cyan-700 pb-2 flex items-center gap-2"><Calendar size={18}/> RECORDS FOR {today.toLocaleDateString([], { month: 'long', day: 'numeric' }).toUpperCase()}</h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-white">
              <AlmanacStat title="Record High" value={`${displayData.recordHigh}°F`} subtitle={displayData.recordHighYear} icon={Maximize} />
              <AlmanacStat title="Record Low"  value={`${displayData.recordLow}°F`}  subtitle={displayData.recordLowYear}  icon={Minimize} />
              <AlmanacStat title="Avg High"    value={`${displayData.avgHighMonth}°F`} subtitle="Monthly" icon={Thermometer} />
              <AlmanacStat title="Avg Low"     value={`${displayData.avgLowMonth}°F`}  subtitle="Monthly" icon={Thermometer} />
            </div>

            {/* Today's forecast vs. averages */}
            {(displayData.forecastHigh != null || displayData.forecastLow != null) && (
              <div className="grid grid-cols-2 gap-3 pt-1 border-t border-cyan-800/40">
                {displayData.forecastHigh != null && (
                  <div className="bg-black/20 rounded p-2 text-center border border-cyan-900">
                    <p className="text-xs text-cyan-400 mb-1">TODAY'S FORECAST HIGH</p>
                    <p className="text-2xl font-bold text-white">{displayData.forecastHigh}°F</p>
                    {typeof displayData.avgHighMonth === 'number' && (
                      <p className={`text-sm mt-0.5 ${displayData.forecastHigh > displayData.avgHighMonth ? 'text-orange-300' : 'text-cyan-300'}`}>
                        {displayData.forecastHigh > displayData.avgHighMonth ? '▲' : '▼'}{Math.abs(displayData.forecastHigh - displayData.avgHighMonth)}° vs avg
                        {typeof displayData.recordHigh === 'number' && displayData.forecastHigh >= displayData.recordHigh && (
                          <span className="text-red-400 font-bold ml-1">RECORD!</span>
                        )}
                      </p>
                    )}
                  </div>
                )}
                {displayData.forecastLow != null && (
                  <div className="bg-black/20 rounded p-2 text-center border border-cyan-900">
                    <p className="text-xs text-cyan-400 mb-1">TODAY'S FORECAST LOW</p>
                    <p className="text-2xl font-bold text-white">{displayData.forecastLow}°F</p>
                    {typeof displayData.avgLowMonth === 'number' && (
                      <p className={`text-sm mt-0.5 ${displayData.forecastLow < displayData.avgLowMonth ? 'text-blue-300' : 'text-cyan-300'}`}>
                        {displayData.forecastLow > displayData.avgLowMonth ? '▲' : '▼'}{Math.abs(displayData.forecastLow - displayData.avgLowMonth)}° vs avg
                        {typeof displayData.recordLow === 'number' && displayData.forecastLow <= displayData.recordLow && (
                          <span className="text-blue-400 font-bold ml-1">RECORD!</span>
                        )}
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Moon Phase Box */}
          {(() => {
            const moonData = getMoonPhase(today);
            return (
              <div className="lg:col-span-1 p-4 rounded-lg space-y-2" style={{ border: `2px solid ${BRIGHT_CYAN}`, backgroundColor: `${MID_BLUE}4D` }}>
                <h3 className="text-lg text-white font-bold border-b border-cyan-700 pb-2 flex items-center gap-2"><Moon size={18}/> MOON PHASE</h3>
                <div className="text-center">
                  <p className="text-5xl mb-1">{moonData.icon}</p>
                  <p className="text-xl font-bold text-white">{moonData.phaseName}</p>
                  <p className="text-sm text-cyan-300">{moonData.illumination}% Illuminated</p>
                </div>
              </div>
            );
          })()}

          {/* On This Day - Historical Weather with sparkline */}
          <div className="lg:col-span-2 p-4 rounded-lg space-y-3" style={{ border: `2px solid ${BRIGHT_CYAN}`, backgroundColor: `${MID_BLUE}4D` }}>
            <h3 className="text-lg text-white font-bold border-b border-cyan-700 pb-2 flex items-center gap-2"><Clock size={18}/> ON THIS DAY - PAST 10 YEARS</h3>
            {displayData.historicalTemps.length > 0 ? (
              <>
                <OnThisDaySparkline data={displayData.historicalTemps} />
                <div className="grid grid-cols-5 sm:grid-cols-10 gap-1 text-center">
                  {displayData.historicalTemps.map((data, i) => (
                    <div key={i} className="bg-black/20 rounded p-1">
                      <p className="text-xs text-cyan-400">{data.year}</p>
                      <p className="text-sm font-bold text-red-400">{Math.round(data.high)}°</p>
                      <p className="text-sm font-bold text-blue-400">{Math.round(data.low)}°</p>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <p className="text-cyan-400 text-sm">No historical data available</p>
            )}
            <p className="text-xs text-cyan-400">High/Low temperatures on this date in previous years</p>
          </div>

          {/* Precipitation Stats with YTD vs historical avg */}
          <div className="lg:col-span-1 p-4 rounded-lg space-y-3" style={{ border: `2px solid ${BRIGHT_CYAN}`, backgroundColor: `${MID_BLUE}4D` }}>
            <h3 className="text-lg text-white font-bold border-b border-cyan-700 pb-2 flex items-center gap-2"><Droplets size={18}/> PRECIPITATION</h3>
            <div className="text-center bg-black/20 rounded p-3">
              <p className="text-xs text-cyan-400">Year to Date</p>
              <p className="text-3xl font-bold text-white">{displayData.ytdPrecip}"</p>
              {displayData.historicalAvgYtd && (
                <div className="mt-1">
                  <p className="text-xs text-cyan-500">10-yr avg: {displayData.historicalAvgYtd}"</p>
                  <p className={`text-sm font-bold ${
                    parseFloat(displayData.ytdPrecip) >= parseFloat(displayData.historicalAvgYtd)
                      ? 'text-blue-400'
                      : 'text-orange-400'
                  }`}>
                    {parseFloat(displayData.ytdPrecip) >= parseFloat(displayData.historicalAvgYtd) ? '+' : ''}
                    {(parseFloat(displayData.ytdPrecip) - parseFloat(displayData.historicalAvgYtd)).toFixed(2)}" vs avg
                  </p>
                </div>
              )}
            </div>
            <div className="text-center bg-black/20 rounded p-3">
              <p className="text-xs text-cyan-400">Record for Today</p>
              <p className="text-2xl font-bold text-white">{displayData.recordPrecip}"</p>
              <p className="text-xs text-cyan-500">Set in {displayData.recordPrecipYear}</p>
            </div>
          </div>

        </div>
      </div>
    </TabPanel>
  );
};

export default AlmanacTab;
