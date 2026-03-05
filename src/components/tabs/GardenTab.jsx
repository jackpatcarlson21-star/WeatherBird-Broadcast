import React, { useState, useEffect } from 'react';
import { AlertTriangle, Thermometer, Droplets, Moon, Sun, Calendar, Sprout, Info } from 'lucide-react';
import TabPanel from '../layout/TabPanel';
import LoadingIndicator from '../common/LoadingIndicator';
import { getMoonPhase } from '../../utils/helpers';

// USDA Hardiness Zone thresholds (avg annual minimum °F → zone string)
const USDA_ZONES = [
  [-60, '1a'], [-55, '1b'], [-50, '2a'], [-45, '2b'],
  [-40, '3a'], [-35, '3b'], [-30, '4a'], [-25, '4b'],
  [-20, '5a'], [-15, '5b'], [-10, '6a'], [-5,  '6b'],
  [0,   '7a'], [5,   '7b'], [10,  '8a'], [15,  '8b'],
  [20,  '9a'], [25,  '9b'], [30, '10a'], [35, '10b'],
  [40, '11a'], [45, '11b'], [50, '12a'], [55, '12b'], [60, '13a'],
];

const getHardinessZone = (avgMinTemp) => {
  for (const [threshold, zone] of USDA_ZONES) {
    if (avgMinTemp < threshold) return zone;
  }
  return '13b';
};

const getMoistureLabel = (value, isSurface) => {
  if (value == null) return { label: '--', color: 'text-gray-400' };
  const dryThreshold = isSurface ? 0.1 : 0.15;
  const wetThreshold = isSurface ? 0.3 : 0.4;
  if (value < dryThreshold) return { label: 'DRY', color: 'text-orange-400' };
  if (value > wetThreshold) return { label: 'SATURATED', color: 'text-blue-400' };
  return { label: 'OK', color: 'text-green-400' };
};

const GDD_MILESTONES = [
  { label: 'Cool crops safe to sow',    gddVal: 50  },
  { label: 'Tomatoes & peppers out',    gddVal: 250 },
  { label: 'Beans & squash direct sow', gddVal: 350 },
  { label: 'First tomato harvest',      gddVal: 700 },
];

// Plant timing data — weeks relative to last frost (negative = before frost)
const PLANTS = [
  // Vegetables
  { name: 'Tomatoes',    icon: '🍅', type: 'vegetable', minZone: 3, maxZone: 10, indoor: { start: -8,  end: -6  }, direct: null,                  note: 'Transplant after last frost' },
  { name: 'Peppers',     icon: '🌶️', type: 'vegetable', minZone: 4, maxZone: 11, indoor: { start: -10, end: -6  }, direct: null,                  note: 'Needs warm soil; transplant after frost' },
  { name: 'Eggplant',    icon: '🍆', type: 'vegetable', minZone: 5, maxZone: 11, indoor: { start: -8,  end: -6  }, direct: null,                  note: 'Transplant when soil is warm' },
  { name: 'Broccoli',    icon: '🥦', type: 'vegetable', minZone: 3, maxZone: 9,  indoor: { start: -8,  end: -6  }, direct: { start: -4, end: 0  }, note: 'Transplant 2–4 wks before last frost' },
  { name: 'Cabbage',     icon: '🥬', type: 'vegetable', minZone: 3, maxZone: 9,  indoor: { start: -8,  end: -6  }, direct: { start: -4, end: 0  }, note: 'Cool-season; tolerates light frost' },
  { name: 'Cauliflower', icon: '🌿', type: 'vegetable', minZone: 3, maxZone: 9,  indoor: { start: -8,  end: -6  }, direct: { start: -4, end: 0  }, note: 'Transplant 2–4 wks before last frost' },
  { name: 'Kale',        icon: '🥬', type: 'vegetable', minZone: 3, maxZone: 10, indoor: { start: -8,  end: -6  }, direct: { start: -4, end: 2  }, note: 'Frost tolerant; great for fall & spring' },
  { name: 'Swiss Chard', icon: '🌿', type: 'vegetable', minZone: 3, maxZone: 10, indoor: null,                    direct: { start: -4, end: 2  }, note: 'Frost tolerant; sow when soil workable' },
  { name: 'Spinach',     icon: '🌿', type: 'vegetable', minZone: 3, maxZone: 9,  indoor: null,                    direct: { start: -8, end: -2 }, note: 'Frost tolerant; prefers cool soil' },
  { name: 'Lettuce',     icon: '🥗', type: 'vegetable', minZone: 3, maxZone: 10, indoor: null,                    direct: { start: -6, end: 4  }, note: 'Sow every 2 wks for continuous harvest' },
  { name: 'Peas',        icon: '🫛', type: 'vegetable', minZone: 3, maxZone: 9,  indoor: null,                    direct: { start: -6, end: -1 }, note: 'Sow as soon as soil is workable' },
  { name: 'Radishes',    icon: '🌰', type: 'vegetable', minZone: 3, maxZone: 10, indoor: null,                    direct: { start: -4, end: 6  }, note: 'Fast-growing; sow every 2 weeks' },
  { name: 'Beets',       icon: '🟣', type: 'vegetable', minZone: 3, maxZone: 10, indoor: null,                    direct: { start: -4, end: 6  }, note: 'Sow 4 wks before last frost' },
  { name: 'Carrots',     icon: '🥕', type: 'vegetable', minZone: 3, maxZone: 10, indoor: null,                    direct: { start: -2, end: 4  }, note: 'Sow in loose, deep soil' },
  { name: 'Onions',      icon: '🧅', type: 'vegetable', minZone: 3, maxZone: 9,  indoor: { start: -12, end: -10 }, direct: { start: -4, end: 0 }, note: 'Start early indoors for best bulb size' },
  { name: 'Leeks',       icon: '🌿', type: 'vegetable', minZone: 3, maxZone: 9,  indoor: { start: -14, end: -10 }, direct: null,                  note: 'Start very early; slow growing' },
  { name: 'Cucumbers',   icon: '🥒', type: 'vegetable', minZone: 4, maxZone: 11, indoor: { start: -4,  end: -3  }, direct: { start: 1,  end: 6  }, note: 'Direct sow after last frost' },
  { name: 'Zucchini',    icon: '🥒', type: 'vegetable', minZone: 4, maxZone: 11, indoor: { start: -4,  end: -3  }, direct: { start: 1,  end: 6  }, note: 'Direct sow after last frost' },
  { name: 'Squash',      icon: '🎃', type: 'vegetable', minZone: 4, maxZone: 11, indoor: { start: -4,  end: -3  }, direct: { start: 1,  end: 6  }, note: 'Plant after danger of frost passes' },
  { name: 'Pumpkin',     icon: '🎃', type: 'vegetable', minZone: 4, maxZone: 11, indoor: { start: -4,  end: -3  }, direct: { start: 1,  end: 6  }, note: 'Plant after last frost; needs space' },
  { name: 'Watermelon',  icon: '🍉', type: 'vegetable', minZone: 5, maxZone: 11, indoor: { start: -4,  end: -3  }, direct: { start: 2,  end: 6  }, note: 'Needs long warm season' },
  { name: 'Corn',        icon: '🌽', type: 'vegetable', minZone: 4, maxZone: 11, indoor: null,                    direct: { start: 1,  end: 6  }, note: 'Direct sow after last frost' },
  { name: 'Beans',       icon: '🫘', type: 'vegetable', minZone: 3, maxZone: 11, indoor: null,                    direct: { start: 1,  end: 6  }, note: 'Direct sow after last frost' },
  { name: 'Sweet Potato',icon: '🍠', type: 'vegetable', minZone: 5, maxZone: 11, indoor: { start: -6,  end: -4  }, direct: null,                  note: 'Start slips indoors; needs heat' },
  // Herbs
  { name: 'Basil',       icon: '🌿', type: 'herb',      minZone: 4, maxZone: 11, indoor: { start: -6,  end: -4  }, direct: { start: 1,  end: 4  }, note: 'Very frost sensitive; start indoors first' },
  { name: 'Parsley',     icon: '🌿', type: 'herb',      minZone: 3, maxZone: 10, indoor: null,                    direct: { start: -4, end: 4  }, note: 'Slow to germinate; sow early' },
  { name: 'Cilantro',    icon: '🌿', type: 'herb',      minZone: 3, maxZone: 10, indoor: null,                    direct: { start: -4, end: 4  }, note: 'Cool-season; bolts in heat' },
  { name: 'Dill',        icon: '🌿', type: 'herb',      minZone: 3, maxZone: 10, indoor: null,                    direct: { start: -4, end: 4  }, note: 'Direct sow; does not transplant well' },
  // Flowers
  { name: 'Marigolds',   icon: '🌼', type: 'flower',    minZone: 3, maxZone: 11, indoor: { start: -6,  end: -4  }, direct: { start: 1,  end: 4  }, note: 'Great companion plant for veggies' },
  { name: 'Zinnias',     icon: '🌸', type: 'flower',    minZone: 3, maxZone: 11, indoor: { start: -6,  end: -4  }, direct: { start: 1,  end: 4  }, note: 'Direct sow after last frost' },
  { name: 'Sunflowers',  icon: '🌻', type: 'flower',    minZone: 3, maxZone: 11, indoor: null,                    direct: { start: 0,  end: 4  }, note: 'Direct sow around last frost date' },
  { name: 'Nasturtiums', icon: '🌸', type: 'flower',    minZone: 3, maxZone: 11, indoor: null,                    direct: { start: 0,  end: 4  }, note: 'Edible flowers; sow after last frost' },
];

// Average last spring frost DOY (day-of-year) by USDA zone integer
const LAST_FROST_DOY = {
  1: 180, 2: 165, 3: 152, 4: 135, 5: 121,
  6: 105, 7: 91,  8: 74,  9: 46,  10: 15,
  11: 1,  12: 1,  13: 1,
};

const getDOY = (date) =>
  Math.floor((date - new Date(date.getFullYear(), 0, 0)) / 86400000);

const getSuggestions = (zoneNum, todayDOY) => {
  const lastFrostDOY = LAST_FROST_DOY[zoneNum] ?? 105;
  const indoorNow = [];
  const outdoorNow = [];
  const soon = [];

  for (const plant of PLANTS) {
    if (zoneNum < plant.minZone || zoneNum > plant.maxZone) continue;

    if (plant.indoor) {
      const winStart = lastFrostDOY + plant.indoor.start * 7;
      const winEnd   = lastFrostDOY + plant.indoor.end   * 7;
      if (todayDOY >= winStart && todayDOY <= winEnd) {
        indoorNow.push(plant);
      } else if (winStart > todayDOY && winStart - todayDOY <= 21) {
        soon.push({ ...plant, mode: 'indoor', daysUntil: winStart - todayDOY });
      }
    }

    if (plant.direct) {
      const winStart = lastFrostDOY + plant.direct.start * 7;
      const winEnd   = lastFrostDOY + plant.direct.end   * 7;
      if (todayDOY >= winStart && todayDOY <= winEnd) {
        outdoorNow.push(plant);
      } else if (winStart > todayDOY && winStart - todayDOY <= 21) {
        soon.push({ ...plant, mode: 'direct', daysUntil: winStart - todayDOY });
      }
    }
  }

  soon.sort((a, b) => a.daysUntil - b.daysUntil);
  return { indoorNow, outdoorNow, soon };
};

const GardenTab = ({ location, daily, units }) => {
  const today = new Date();

  const [gardenData, setGardenData]     = useState(null);
  const [gdd, setGdd]                   = useState(null);
  const [hardinessZone, setHardinessZone] = useState(null);
  const [isLoading, setIsLoading]       = useState(true);
  const [activeInfo, setActiveInfo]     = useState(null);

  useEffect(() => {
    if (!location?.lat || !location?.lon) return;

    const controller = new AbortController();
    const { signal } = controller;

    const fetchAll = async () => {
      setIsLoading(true);
      try {
        const year  = today.getFullYear();
        const month = String(today.getMonth() + 1).padStart(2, '0');
        const day   = String(today.getDate()).padStart(2, '0');

        const soilUrl = [
          `https://api.open-meteo.com/v1/forecast`,
          `?latitude=${location.lat}&longitude=${location.lon}`,
          `&hourly=soil_temperature_0cm,soil_temperature_6cm,soil_temperature_18cm`,
          `,soil_moisture_0_to_1cm,soil_moisture_1_to_3cm,evapotranspiration,temperature_2m,relative_humidity_2m`,
          `&daily=temperature_2m_min,temperature_2m_max,precipitation_sum,et0_fao_evapotranspiration`,
          `&temperature_unit=fahrenheit&precipitation_unit=inch&timezone=auto&forecast_days=7`,
        ].join('');

        const gddUrl = [
          `https://archive-api.open-meteo.com/v1/archive`,
          `?latitude=${location.lat}&longitude=${location.lon}`,
          `&start_date=${year}-01-01&end_date=${year}-${month}-${day}`,
          `&daily=temperature_2m_max,temperature_2m_min&temperature_unit=fahrenheit&timezone=auto`,
        ].join('');

        const hardinessUrl = [
          `https://archive-api.open-meteo.com/v1/archive`,
          `?latitude=${location.lat}&longitude=${location.lon}`,
          `&start_date=${year - 10}-01-01&end_date=${year - 1}-12-31`,
          `&daily=temperature_2m_min&temperature_unit=fahrenheit&timezone=auto`,
        ].join('');

        const [soilData, gddData, hardinessData] = await Promise.all([
          fetch(soilUrl,     { signal }).then(r => r.ok ? r.json() : null).catch(() => null),
          fetch(gddUrl,      { signal }).then(r => r.ok ? r.json() : null).catch(() => null),
          fetch(hardinessUrl,{ signal }).then(r => r.ok ? r.json() : null).catch(() => null),
        ]);

        setGardenData(soilData);

        // Accumulate GDD base-50 from Jan 1 → today
        if (gddData?.daily) {
          const highs = gddData.daily.temperature_2m_max || [];
          const lows  = gddData.daily.temperature_2m_min || [];
          let total = 0;
          for (let i = 0; i < highs.length; i++) {
            if (highs[i] != null && lows[i] != null) {
              total += Math.max(0, (highs[i] + lows[i]) / 2 - 50);
            }
          }
          setGdd(Math.round(total));
        }

        // Derive hardiness zone from 10-year annual minimums
        if (hardinessData?.daily?.temperature_2m_min && hardinessData?.daily?.time) {
          const { time, temperature_2m_min: mins } = hardinessData.daily;
          const yearMins = {};
          time.forEach((dateStr, i) => {
            const yr = new Date(dateStr).getFullYear();
            if (mins[i] != null && (yearMins[yr] === undefined || mins[i] < yearMins[yr])) {
              yearMins[yr] = mins[i];
            }
          });
          const annualMins = Object.values(yearMins);
          if (annualMins.length > 0) {
            const avgMin = annualMins.reduce((a, b) => a + b, 0) / annualMins.length;
            setHardinessZone({ zone: getHardinessZone(avgMin), avgMin: Math.round(avgMin) });
          }
        }
      } catch (e) {
        if (e.name !== 'AbortError') console.error('Garden fetch error:', e);
      } finally {
        if (!signal.aborted) setIsLoading(false);
      }
    };

    fetchAll();
    return () => controller.abort();
  }, [location.lat, location.lon]);

  if (isLoading) {
    return (
      <TabPanel title="GARDEN">
        <LoadingIndicator />
      </TabPanel>
    );
  }

  // --- Derived values ---
  const h = gardenData?.hourly;
  const d = gardenData?.daily;
  const currentHour = today.getHours();
  const dayTimes = d?.time || [];

  // Soil conditions (current hour)
  const soilTemp0  = h?.soil_temperature_0cm?.[currentHour];
  const soilTemp6  = h?.soil_temperature_6cm?.[currentHour];
  const soilTemp18 = h?.soil_temperature_18cm?.[currentHour];
  const soilMoist01 = h?.soil_moisture_0_to_1cm?.[currentHour];
  const soilMoist13 = h?.soil_moisture_1_to_3cm?.[currentHour];
  const airTemp     = h?.temperature_2m?.[currentHour];
  const humidity    = h?.relative_humidity_2m?.[currentHour];

  // Water needs (today = index 0, both already in inches due to precipitation_unit=inch)
  const etToday   = d?.et0_fao_evapotranspiration?.[0];
  const rainToday = d?.precipitation_sum?.[0];
  const precipProbToday = daily?.precipitation_probability_max?.[0];

  const getIrrigationRec = () => {
    if (precipProbToday > 60) return { text: 'SKIP — RAIN EXPECTED', color: 'text-blue-400' };
    if (soilMoist01 != null && soilMoist01 > 0.4) return { text: 'SKIP — SOIL SATURATED', color: 'text-blue-400' };
    const deficit = (etToday || 0) - (rainToday || 0);
    if (deficit < 0.1) return { text: 'LIGHT WATERING', color: 'text-yellow-400' };
    return { text: 'WATER TODAY', color: 'text-orange-400' };
  };
  const irrigationRec = getIrrigationRec();

  // Frost alert: next 3 days using gardenData daily (has time array)
  const frostMins = d?.temperature_2m_min || [];
  const frostDays = [];
  for (let i = 0; i < 3 && i < frostMins.length; i++) {
    if (frostMins[i] != null && frostMins[i] <= 36) {
      frostDays.push({ temp: frostMins[i], date: dayTimes[i] });
    }
  }
  const frostSeverity = frostDays.some(f => f.temp <= 28) ? 'hard'
    : frostDays.some(f => f.temp <= 32) ? 'freeze' : 'frost';
  const FROST_STYLES = {
    hard:   'border-red-500 bg-red-900/20 text-red-300',
    freeze: 'border-orange-500 bg-orange-900/20 text-orange-300',
    frost:  'border-yellow-500 bg-yellow-900/20 text-yellow-300',
  };
  const FROST_LABELS = {
    hard:   'HARD FREEZE WARNING (≤28°F)',
    freeze: 'FREEZE WARNING (≤32°F)',
    frost:  'FROST WARNING (≤36°F)',
  };

  // Moon phase
  const moonData = getMoonPhase(today);
  const isWaxing = moonData.phaseName.includes('New') || moonData.phaseName.includes('Waxing');

  // 7-day planting score
  const plantingDays = Array.from({ length: 7 }, (_, i) => {
    let score = 0;
    const minT     = d?.temperature_2m_min?.[i];
    const maxT     = d?.temperature_2m_max?.[i];
    const soilNoon = h?.soil_temperature_0cm?.[i * 24 + 12];
    const precip   = daily?.precipitation_probability_max?.[i];
    const dateStr  = dayTimes[i];

    if (minT != null && minT > 36)                score += 40;
    if (soilNoon != null && soilNoon > 50)        score += 30;
    if (precip != null && precip < 40)            score += 20;
    if (maxT != null && maxT >= 55 && maxT <= 85) score += 10;

    const label = dateStr
      ? new Date(dateStr + 'T12:00:00').toLocaleDateString([], { weekday: 'short' })
      : `D${i + 1}`;
    return { score, label, minT, maxT };
  });

  const fmt    = (v) => v != null ? `${Math.round(v)}°F` : '--';
  const fmtIn  = (v) => v != null ? `${Number(v).toFixed(2)}"` : '--';
  const fmtPct = (v) => v != null ? `${v}%` : '--';

  // Daily headline
  const headline = (() => {
    if (frostDays.some(f => f.temp <= 28)) return { icon: '🧊', label: 'HARD FREEZE TONIGHT', sub: 'Bring all plants indoors', color: 'border-red-500 bg-red-900/20 text-red-300' };
    if (frostDays.some(f => f.temp <= 32)) return { icon: '❄️', label: 'FREEZE TONIGHT', sub: 'Cover tender plants now', color: 'border-orange-500 bg-orange-900/20 text-orange-300' };
    if (frostDays.length > 0)              return { icon: '🌡️', label: 'FROST RISK TONIGHT', sub: 'Protect frost-sensitive plants', color: 'border-yellow-500 bg-yellow-900/20 text-yellow-300' };
    const score = plantingDays[0]?.score ?? 0;
    if (score >= 80) return { icon: '🌱', label: 'GREAT DAY TO GARDEN', sub: 'Conditions are ideal for planting', color: 'border-green-500 bg-green-900/20 text-green-300' };
    if (score >= 50) return { icon: '🌤️', label: 'DECENT DAY TO GARDEN', sub: 'Conditions are reasonable outside', color: 'border-yellow-500 bg-yellow-900/20 text-yellow-300' };
    if (precipProbToday > 60) return { icon: '🌧️', label: 'RAIN EXPECTED TODAY', sub: 'Skip watering — nature handles it', color: 'border-blue-500 bg-blue-900/20 text-blue-300' };
    return { icon: '😐', label: 'CHALLENGING CONDITIONS', sub: 'Consider waiting for a better day', color: 'border-gray-600 bg-gray-900/20 text-gray-400' };
  })();

  // Pest & disease risks
  const pestRisks = (() => {
    const risks = [];
    if (humidity != null && airTemp != null) {
      if (humidity > 80 && airTemp > 60)      risks.push({ label: 'Fungal disease', detail: 'High humidity favors powdery mildew & blight', level: 'high' });
      else if (humidity > 65 && airTemp > 50) risks.push({ label: 'Fungal disease', detail: 'Monitor leaves for early signs of mildew', level: 'moderate' });
      if (airTemp > 85 && humidity < 40)      risks.push({ label: 'Spider mites', detail: 'Hot dry conditions stress plants', level: 'high' });
      else if (airTemp > 75 && humidity < 50) risks.push({ label: 'Spider mites', detail: 'Check undersides of leaves', level: 'moderate' });
    }
    if (soilMoist01 != null && soilMoist01 > 0.35 && (airTemp ?? 50) > 45)
      risks.push({ label: 'Slugs & snails', detail: 'Saturated soil; check near seedlings at dusk', level: 'moderate' });
    if (risks.length === 0)
      risks.push({ label: 'Low pest/disease risk', detail: 'Current conditions are unfavorable for most common pests', level: 'low' });
    return risks;
  })();

  return (
    <TabPanel title="GARDEN">
      <div className="space-y-4">

        {/* DAILY HEADLINE */}
        <div className={`p-4 rounded-lg border-2 ${headline.color}`}>
          <div className="flex items-center gap-3">
            <span className="text-3xl">{headline.icon}</span>
            <div>
              <p className="text-xl font-vt323 tracking-wider">{headline.label}</p>
              <p className="text-base opacity-75">{headline.sub}</p>
            </div>
          </div>
        </div>

        {/* 1. FROST ALERT BANNER (conditional) */}
        {frostDays.length > 0 && (
          <div className={`border-l-8 p-4 rounded ${FROST_STYLES[frostSeverity]}`}>
            <div className="flex items-center gap-2 mb-1">
              <AlertTriangle size={20} />
              <span className="text-lg font-bold font-vt323 tracking-wider">
                {FROST_LABELS[frostSeverity]}
              </span>
              <button onClick={() => setActiveInfo(activeInfo === 'frost' ? null : 'frost')} className="ml-auto text-current opacity-60 hover:opacity-100 transition-opacity flex-shrink-0" aria-label="Learn more">
                <Info size={13} />
              </button>
            </div>
            {activeInfo === 'frost' && (
              <p className="text-sm opacity-80 mb-1 p-2 bg-black/20 rounded leading-relaxed">
                Alerts when the forecast low drops to frost (≤36°F), freeze (≤32°F), or hard freeze (≤28°F) territory. Each threshold causes progressively more damage to garden plants.
              </p>
            )}
            <p className="text-base">
              {frostDays.map((fd, i) => {
                const label = fd.date
                  ? new Date(fd.date + 'T12:00:00').toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })
                  : `Night ${i + 1}`;
                return `${label}: ${Math.round(fd.temp)}°F`;
              }).join(' · ')}
            </p>
            <p className="text-sm mt-1 opacity-75">Protect tender plants and cover sensitive crops.</p>
          </div>
        )}

        {/* 2. SOIL CONDITIONS */}
        <div className="p-3 bg-black/20 rounded-lg border border-cyan-700 hover:border-cyan-400">
          <h3 className="text-base text-cyan-400 font-vt323 tracking-wider mb-2 flex items-center gap-1">
            <Thermometer size={14} /> SOIL CONDITIONS
            <button onClick={() => setActiveInfo(activeInfo === 'soil' ? null : 'soil')} className="ml-auto text-cyan-600 hover:text-cyan-300 transition-colors flex-shrink-0" aria-label="Learn more">
              <Info size={13} />
            </button>
          </h3>
          {activeInfo === 'soil' && (
            <p className="text-sm text-cyan-500 mb-2 p-2 bg-black/30 rounded leading-relaxed">
              Real-time soil temperature at the surface and root zone, plus moisture levels in the top layers. Seeds germinate best when soil exceeds 50°F. Moisture status helps you decide whether the ground needs water before planting.
            </p>
          )}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {/* Soil temperatures */}
            <div className="text-center p-2 bg-black/20 rounded">
              <p className="text-sm text-cyan-400">Surface (0cm)</p>
              <p className="text-2xl text-white font-vt323">{fmt(soilTemp0)}</p>
              {soilTemp0 != null && (
                <p className="text-sm text-cyan-500">
                  {soilTemp0 > 50 ? 'Warm' : soilTemp0 > 40 ? 'Cool' : 'Cold'}
                </p>
              )}
            </div>
            <div className="text-center p-2 bg-black/20 rounded">
              <p className="text-sm text-cyan-400">Root Zone (18cm)</p>
              <p className="text-2xl text-white font-vt323">{fmt(soilTemp18)}</p>
            </div>

            {/* Soil moisture */}
            {(() => {
              const ml01 = getMoistureLabel(soilMoist01, true);
              const ml13 = getMoistureLabel(soilMoist13, false);
              return (
                <>
                  <div className="text-center p-2 bg-black/20 rounded">
                    <p className="text-sm text-cyan-400">Surface Moisture</p>
                    <p className={`text-xl font-vt323 ${ml01.color}`}>{ml01.label}</p>
                    <p className="text-sm text-cyan-500">0–1cm</p>
                  </div>
                  <div className="text-center p-2 bg-black/20 rounded">
                    <p className="text-sm text-cyan-400">Root Moisture</p>
                    <p className={`text-xl font-vt323 ${ml13.color}`}>{ml13.label}</p>
                    <p className="text-sm text-cyan-500">1–3cm</p>
                  </div>
                  <div className="text-center p-2 bg-black/20 rounded">
                    <p className="text-sm text-cyan-400">ET Today</p>
                    <p className="text-2xl text-white font-vt323">{fmtIn(etToday)}</p>
                    <p className="text-sm text-cyan-500">Evapotrans.</p>
                  </div>
                </>
              );
            })()}
          </div>
        </div>

        {/* 3. WATER NEEDS */}
        <div className="p-3 bg-black/20 rounded-lg border border-cyan-700 hover:border-cyan-400">
          <h3 className="text-base text-cyan-400 font-vt323 tracking-wider mb-2 flex items-center gap-1">
            <Droplets size={14} /> WATER NEEDS
            <button onClick={() => setActiveInfo(activeInfo === 'water' ? null : 'water')} className="ml-auto text-cyan-600 hover:text-cyan-300 transition-colors flex-shrink-0" aria-label="Learn more">
              <Info size={13} />
            </button>
          </h3>
          {activeInfo === 'water' && (
            <p className="text-sm text-cyan-500 mb-2 p-2 bg-black/30 rounded leading-relaxed">
              Compares today's evapotranspiration (how much water plants lose to the air) against expected rainfall and soil moisture to recommend whether irrigation is needed.
            </p>
          )}
          <div className="grid grid-cols-3 gap-2 mb-3">
            <div className="text-center p-2 bg-black/20 rounded">
              <p className="text-sm text-cyan-400">Today ET</p>
              <p className="text-2xl text-white font-vt323">{fmtIn(etToday)}</p>
            </div>
            <div className="text-center p-2 bg-black/20 rounded">
              <p className="text-sm text-cyan-400">Today Rain</p>
              <p className="text-2xl text-white font-vt323">{fmtIn(rainToday)}</p>
            </div>
            <div className="text-center p-2 bg-black/20 rounded">
              <p className="text-sm text-cyan-400">Rain Chance</p>
              <p className="text-2xl text-white font-vt323">{fmtPct(precipProbToday)}</p>
            </div>
          </div>
          <div className={`text-center p-3 rounded font-vt323 text-xl bg-black/30 border ${irrigationRec.color}`}
            style={{ borderColor: 'currentColor' }}>
            {irrigationRec.text}
          </div>
        </div>

        {/* PEST & DISEASE RISK */}
        <div className="p-3 bg-black/20 rounded-lg border border-cyan-700 hover:border-cyan-400">
          <h3 className="text-base text-cyan-400 font-vt323 tracking-wider mb-2 flex items-center gap-1">
            🐛 PEST & DISEASE RISK
            <button onClick={() => setActiveInfo(activeInfo === 'pest' ? null : 'pest')} className="ml-auto text-cyan-600 hover:text-cyan-300 transition-colors flex-shrink-0" aria-label="Learn more">
              <Info size={13} />
            </button>
          </h3>
          {activeInfo === 'pest' && (
            <p className="text-sm text-cyan-500 mb-2 p-2 bg-black/30 rounded leading-relaxed">
              Risk levels based on current air temperature, humidity, and soil moisture. High humidity + warmth favors fungal disease; hot + dry conditions bring spider mites; wet soil attracts slugs.
            </p>
          )}
          <div className="space-y-1">
            {pestRisks.map((risk, i) => (
              <div key={i} className={`flex items-baseline gap-2 p-2 rounded border text-sm ${
                risk.level === 'high'     ? 'border-red-700 bg-red-900/20 text-red-300' :
                risk.level === 'moderate' ? 'border-yellow-700 bg-yellow-900/20 text-yellow-300' :
                                            'border-green-800 bg-green-900/20 text-green-400'
              }`}>
                <span className="font-bold flex-shrink-0">{risk.label}</span>
                <span className="opacity-70">— {risk.detail}</span>
              </div>
            ))}
            {humidity != null && (
              <p className="text-sm text-cyan-600 mt-1">Humidity: {humidity}% · Air temp: {airTemp != null ? Math.round(airTemp) : '--'}°F</p>
            )}
          </div>
        </div>

        {/* 4 & 5: GDD + Moon Phase side by side */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

          {/* 4. GROWING DEGREE DAYS */}
          <div className="p-3 bg-black/20 rounded-lg border border-cyan-700 hover:border-cyan-400">
            <h3 className="text-base text-cyan-400 font-vt323 tracking-wider mb-2 flex items-center gap-1">
              <Sun size={14} /> GROWING DEGREE DAYS
              <button onClick={() => setActiveInfo(activeInfo === 'gdd' ? null : 'gdd')} className="ml-auto text-cyan-600 hover:text-cyan-300 transition-colors flex-shrink-0" aria-label="Learn more">
                <Info size={13} />
              </button>
            </h3>
            {activeInfo === 'gdd' && (
              <p className="text-sm text-cyan-500 mb-2 p-2 bg-black/30 rounded leading-relaxed">
                Accumulated heat units since Jan 1 using a base of 50°F. Plants need a fixed number of GDD to reach key stages like germination, flowering, and maturity — useful for predicting harvest timing.
              </p>
            )}
            <div className="text-center p-3 bg-black/20 rounded mb-2">
              <p className="text-sm text-cyan-400">Accumulated Since Jan 1 (Base 50°F)</p>
              <p className="text-4xl text-green-400 font-vt323">{gdd ?? '--'}</p>
              <p className="text-sm text-cyan-500">GDD</p>
            </div>
            <div className="space-y-1 text-sm">
              {GDD_MILESTONES.map(({ label, gddVal }) => (
                <div key={label} className="flex justify-between items-center">
                  <span className="text-cyan-300">{label}</span>
                  <span className={gdd != null && gdd >= gddVal ? 'text-green-400' : 'text-gray-500'}>
                    ~{gddVal} GDD{gdd != null && gdd >= gddVal ? ' ✓' : ''}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* 5. MOON PHASE */}
          <div className="p-3 bg-black/20 rounded-lg border border-cyan-700 hover:border-cyan-400">
            <h3 className="text-base text-cyan-400 font-vt323 tracking-wider mb-2 flex items-center gap-1">
              <Moon size={14} /> MOON PHASE
              <button onClick={() => setActiveInfo(activeInfo === 'moon' ? null : 'moon')} className="ml-auto text-cyan-600 hover:text-cyan-300 transition-colors flex-shrink-0" aria-label="Learn more">
                <Info size={13} />
              </button>
            </h3>
            {activeInfo === 'moon' && (
              <p className="text-sm text-cyan-500 mb-2 p-2 bg-black/30 rounded leading-relaxed">
                Traditional planting lore links the lunar cycle to moisture in soil and plants. Waxing phases (new → full moon) are associated with above-ground crops; waning phases favor roots and harvesting.
              </p>
            )}
            <div className="flex items-center gap-3 py-1">
              <span className="text-3xl">{moonData.icon}</span>
              <div>
                <p className="text-white font-vt323 text-lg leading-tight">{moonData.phaseName}</p>
                <p className="text-sm text-cyan-400">{moonData.illumination}% illuminated · Day {moonData.phaseDay}/29.5</p>
              </div>
              <span className={`ml-auto text-sm px-2 py-1 rounded flex-shrink-0 ${isWaxing ? 'text-green-300 bg-green-900/20' : 'text-cyan-400 bg-black/20'}`}>
                {isWaxing ? '🌱 Above-ground' : '🥕 Root crops'}
              </span>
            </div>
          </div>
        </div>

        {/* 6. BEST DAYS TO PLANT THIS WEEK */}
        <div className="p-3 bg-black/20 rounded-lg border border-cyan-700 hover:border-cyan-400">
          <h3 className="text-base text-cyan-400 font-vt323 tracking-wider mb-2 flex items-center gap-1">
            <Calendar size={14} /> BEST DAYS TO PLANT THIS WEEK
            <button onClick={() => setActiveInfo(activeInfo === 'days' ? null : 'days')} className="ml-auto text-cyan-600 hover:text-cyan-300 transition-colors flex-shrink-0" aria-label="Learn more">
              <Info size={13} />
            </button>
          </h3>
          {activeInfo === 'days' && (
            <p className="text-sm text-cyan-500 mb-2 p-2 bg-black/30 rounded leading-relaxed">
              A daily 0–100 score built from four factors: no frost risk that night (+40 pts), soil above 50°F (+30 pts), rain chance below 40% (+20 pts), and a comfortable high between 55–85°F (+10 pts).
            </p>
          )}
          <div className="grid grid-cols-7 gap-1">
            {plantingDays.map((day, i) => (
              <div
                key={i}
                className={`text-center p-2 rounded border ${
                  day.score >= 80 ? 'border-green-500 bg-green-900/20' :
                  day.score >= 50 ? 'border-yellow-500 bg-yellow-900/20' :
                                    'border-red-500 bg-red-900/20'
                }`}
              >
                <p className="text-sm text-cyan-300">{day.label}</p>
                <p className={`text-lg font-vt323 ${
                  day.score >= 80 ? 'text-green-400' :
                  day.score >= 50 ? 'text-yellow-400' : 'text-red-400'
                }`}>{day.score}</p>
                <p className="text-sm text-cyan-500">
                  {day.minT != null ? `${Math.round(day.minT)}°` : '--'}
                </p>
              </div>
            ))}
          </div>
          <p className="text-sm text-cyan-500 mt-2">
            Score: 80+ Great · 50–79 OK · &lt;50 Poor
          </p>
        </div>

        {/* 7. PLANT HARDINESS ZONE */}
        <div className="p-3 bg-black/20 rounded-lg border border-cyan-700 hover:border-cyan-400">
          <h3 className="text-base text-cyan-400 font-vt323 tracking-wider mb-2 flex items-center gap-1">
            <Sprout size={14} /> PLANT HARDINESS ZONE
            <button onClick={() => setActiveInfo(activeInfo === 'zone' ? null : 'zone')} className="ml-auto text-cyan-600 hover:text-cyan-300 transition-colors flex-shrink-0" aria-label="Learn more">
              <Info size={13} />
            </button>
          </h3>
          {activeInfo === 'zone' && (
            <p className="text-sm text-cyan-500 mb-2 p-2 bg-black/30 rounded leading-relaxed">
              Your USDA Hardiness Zone is derived from 5 years of historical winter minimums. It indicates which plants can survive your coldest nights — choose plants rated for your zone or lower.
            </p>
          )}
          {hardinessZone ? (
            <div className="flex flex-col sm:flex-row items-center gap-4">
              <div className="text-center">
                <p className="text-5xl text-green-400 font-vt323">Zone {hardinessZone.zone}</p>
                <p className="text-sm text-cyan-400 mt-1">USDA Hardiness Zone</p>
              </div>
              <div className="text-sm text-cyan-300 space-y-1">
                <p>Avg annual minimum: <span className="text-white font-bold">{hardinessZone.avgMin}°F</span></p>
                <p className="text-sm text-cyan-500">Based on 10 years of historical data</p>
                {(() => {
                  const zoneNum = parseInt(hardinessZone.zone, 10);
                  const frostDOY = LAST_FROST_DOY[zoneNum] ?? 105;
                  const todayDOY = getDOY(today);
                  const diff = frostDOY - todayDOY;
                  return diff > 0
                    ? <p className="text-sm text-yellow-300 font-bold">~{diff} days until last frost</p>
                    : <p className="text-sm text-green-300 font-bold">~{Math.abs(diff)} days since last frost</p>;
                })()}
              </div>
            </div>
          ) : (
            <p className="text-cyan-400 text-sm">Calculating zone from historical data...</p>
          )}
        </div>

        {/* 8. WHAT TO PLANT NOW */}
        {hardinessZone && (() => {
          const zoneNum = parseInt(hardinessZone.zone, 10);
          const todayDOY = getDOY(today);
          const { indoorNow, outdoorNow, soon } = getSuggestions(zoneNum, todayDOY);
          const hasAnything = indoorNow.length > 0 || outdoorNow.length > 0 || soon.length > 0;
          return (
            <div className="p-3 bg-black/20 rounded-lg border border-cyan-700 hover:border-cyan-400">
              <h3 className="text-base text-cyan-400 font-vt323 tracking-wider mb-3 flex items-center gap-1">
                <Sprout size={14} /> WHAT TO PLANT NOW — ZONE {hardinessZone.zone.toUpperCase()}
                <button onClick={() => setActiveInfo(activeInfo === 'plant-now' ? null : 'plant-now')} className="ml-auto text-cyan-600 hover:text-cyan-300 transition-colors flex-shrink-0" aria-label="Learn more">
                  <Info size={13} />
                </button>
              </h3>
              {activeInfo === 'plant-now' && (
                <p className="text-sm text-cyan-500 mb-2 p-2 bg-black/30 rounded leading-relaxed">
                  Timing windows keyed to your zone's average last frost date. Negative weeks = before frost; positive = after. Indoor starts go under grow lights; direct sow means straight into garden soil.
                </p>
              )}
              {!hasAnything ? (
                <p className="text-cyan-400 text-sm">No specific planting actions right now.</p>
              ) : (
                <div className="space-y-3">
                  {indoorNow.length > 0 && (
                    <div>
                      <p className="text-sm text-yellow-400 font-vt323 tracking-wider mb-1">🏠 START INDOORS NOW</p>
                      <div className="space-y-1">
                        {indoorNow.map(plant => (
                          <div key={`i-${plant.name}`} className="p-2 rounded border border-yellow-800 bg-yellow-900/20">
                            <div className="flex items-center gap-2">
                              <span>{plant.icon}</span>
                              <span className="text-white text-base font-bold">{plant.name}</span>
                              <span className="text-sm text-yellow-600 bg-yellow-900/40 px-1 rounded">{plant.type}</span>
                            </div>
                            {plant.note && <p className="text-sm text-yellow-300/70 mt-0.5 ml-6">{plant.note}</p>}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {outdoorNow.length > 0 && (
                    <div>
                      <p className="text-sm text-green-400 font-vt323 tracking-wider mb-1">🌱 DIRECT SOW OUTDOORS NOW</p>
                      <div className="space-y-1">
                        {outdoorNow.map(plant => (
                          <div key={`d-${plant.name}`} className="p-2 rounded border border-green-800 bg-green-900/20">
                            <div className="flex items-center gap-2">
                              <span>{plant.icon}</span>
                              <span className="text-white text-base font-bold">{plant.name}</span>
                              <span className="text-sm text-green-600 bg-green-900/40 px-1 rounded">{plant.type}</span>
                            </div>
                            {plant.note && <p className="text-sm text-green-300/70 mt-0.5 ml-6">{plant.note}</p>}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {soon.length > 0 && (
                    <div>
                      <p className="text-sm text-cyan-400 font-vt323 tracking-wider mb-1">⏱ COMING UP (WITHIN 3 WEEKS)</p>
                      <div className="flex flex-wrap gap-1">
                        {soon.map((plant, idx) => (
                          <span key={idx} className="text-sm px-2 py-1 rounded bg-cyan-900/30 border border-cyan-700 text-cyan-300">
                            {plant.icon} {plant.name} {plant.mode === 'indoor' ? 'indoors' : 'direct'}, {plant.daysUntil}d
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
              <p className="text-sm text-cyan-600 mt-2">
                Based on Zone {hardinessZone.zone} last frost estimate
              </p>
            </div>
          );
        })()}

      </div>
    </TabPanel>
  );
};

export default GardenTab;
