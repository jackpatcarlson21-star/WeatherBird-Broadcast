import React, { useState, useMemo, useEffect } from 'react';
import TabPanel from '../layout/TabPanel';
import { PLACEHOLDER_IMG } from '../../utils/constants';

const BASE = 'https://www.spc.noaa.gov/products/outlook/';
const BASE48 = 'https://www.spc.noaa.gov/products/exper/day4-8/';

const getDay48Maps = (key) => [
  { id: 'all', label: 'D4–8', url: `${BASE48}day48prob.gif?v=${key}`, desc: 'Combined Day 4–8 severe probability' },
  { id: 'd4',  label: 'DAY 4', url: `${BASE48}day4prob.gif?v=${key}`,  desc: 'Day 4 severe probability' },
  { id: 'd5',  label: 'DAY 5', url: `${BASE48}day5prob.gif?v=${key}`,  desc: 'Day 5 severe probability' },
  { id: 'd6',  label: 'DAY 6', url: `${BASE48}day6prob.gif?v=${key}`,  desc: 'Day 6 severe probability' },
  { id: 'd7',  label: 'DAY 7', url: `${BASE48}day7prob.gif?v=${key}`,  desc: 'Day 7 severe probability' },
  { id: 'd8',  label: 'DAY 8', url: `${BASE48}day8prob.gif?v=${key}`,  desc: 'Day 8 severe probability' },
];

// Full-size image candidates per day and product type, tried in order
const SPC_CANDIDATES = {
  categorical: {
    1: ['day1otlk_2000.png', 'day1otlk_1630.png', 'day1otlk_1300.png', 'day1otlk_1200.png', 'day1otlk_0100.png', 'day1otlk_sm.png'],
    2: ['day2otlk_1730.png', 'day2otlk_0600.png', 'day2otlk_sm.png'],
    3: ['day3otlk_1930.png', 'day3otlk_0730.png', 'day3otlk_sm.png'],
  },
  tornado: {
    1: ['day1probotlk_2000_torn.png', 'day1probotlk_1630_torn.png', 'day1probotlk_1300_torn.png', 'day1probotlk_1200_torn.png'],
    2: ['day2probotlk_1730_torn.png', 'day2probotlk_0600_torn.png'],
    3: ['day3prob_1930.png', 'day3prob_0730.png'], // Day 3 has combined prob only
  },
  wind: {
    1: ['day1probotlk_2000_wind.png', 'day1probotlk_1630_wind.png', 'day1probotlk_1300_wind.png', 'day1probotlk_1200_wind.png'],
    2: ['day2probotlk_1730_wind.png', 'day2probotlk_0600_wind.png'],
    3: ['day3prob_1930.png', 'day3prob_0730.png'],
  },
  hail: {
    1: ['day1probotlk_2000_hail.png', 'day1probotlk_1630_hail.png', 'day1probotlk_1300_hail.png', 'day1probotlk_1200_hail.png'],
    2: ['day2probotlk_1730_hail.png', 'day2probotlk_0600_hail.png'],
    3: ['day3prob_1930.png', 'day3prob_0730.png'],
  },
};

const PRODUCTS = [
  { id: 'categorical', label: 'CATEGORICAL', color: 'red' },
  { id: 'tornado',     label: 'TORNADO',     color: 'rose' },
  { id: 'wind',        label: 'WIND',         color: 'amber' },
  { id: 'hail',        label: 'HAIL',         color: 'green' },
];

const CascadeImage = ({ candidates, cacheKey, alt, className }) => {
  const [idx, setIdx] = useState(0);
  const [loading, setLoading] = useState(true);
  const urls = candidates.map(f => `${BASE}${f}?v=${cacheKey}`);
  const src = idx < urls.length ? urls[idx] : PLACEHOLDER_IMG;

  return (
    <div className="relative">
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-lg z-10" style={{ minHeight: 200 }}>
          <div className="flex flex-col items-center gap-2">
            <div className="w-8 h-8 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
            <span className="text-cyan-400 text-sm font-vt323">LOADING MAP...</span>
          </div>
        </div>
      )}
      <img
        key={src}
        src={src}
        alt={alt}
        referrerPolicy="no-referrer"
        className={className}
        style={loading ? { opacity: 0 } : {}}
        onLoad={() => setLoading(false)}
        onError={() => { setLoading(true); setIdx(i => i + 1); }}
      />
    </div>
  );
};

const getSPCDays = () => {
  const now = new Date();
  return [1, 2, 3].map(offset => {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + (offset - 1));
    const date = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    return {
      day: offset,
      label: `DAY ${offset}`,
      date,
      desc: offset === 1
        ? `Valid ${date} through tomorrow morning`
        : `Valid ${date}`,
    };
  });
};

const WPC_BASE_URLS = [
  { day: 1, label: 'TODAY',    base: 'https://www.wpc.ncep.noaa.gov/noaa/noaad1.gif' },
  { day: 2, label: 'TOMORROW', base: 'https://www.wpc.ncep.noaa.gov/noaa/noaad2.gif' },
  { day: 3, label: 'DAY 3',    base: 'https://www.wpc.ncep.noaa.gov/noaa/noaad3.gif' },
];

const RISK_LEVELS = [
  { color: '#66A366', label: 'General Thunder' },
  { color: '#008000', label: 'Marginal (1)' },
  { color: '#FFFF00', label: 'Slight (2)' },
  { color: '#FFA500', label: 'Enhanced (3)' },
  { color: '#FF0000', label: 'Moderate (4)' },
  { color: '#FF00FF', label: 'High (5)' },
];

// Tornado: 2%, 5%, 10%, 15%, 30%, 45%, 60%
const PROB_LEVELS_TORNADO = [
  { color: '#008B00', label: '2%' },
  { color: '#8B4513', label: '5%' },
  { color: '#FFFF00', label: '10%' },
  { color: '#FFA500', label: '15%' },
  { color: '#FF0000', label: '30%' },
  { color: '#FF00FF', label: '45%' },
  { color: '#C896C8', label: '60%' },
];

const PROB_LEVELS_WIND = [
  { color: '#8B4513', label: '5%' },
  { color: '#FFFF00', label: '15%' },
  { color: '#FF0000', label: '30%' },
  { color: '#FF00FF', label: '45%' },
  { color: '#800080', label: '60%' },
  { color: '#00008B', label: '75%' },
  { color: '#89CFF0', label: '90%' },
];

const PROB_LEVELS_HAIL = [
  { color: '#8B4513', label: '5%' },
  { color: '#FFFF00', label: '15%' },
  { color: '#8B0000', label: '30%' },
  { color: '#FF00FF', label: '45%' },
  { color: '#C896C8', label: '60%' },
];

// Day 4-8 only uses 15% and 30% contours
const PROB_LEVELS_48 = [
  { color: '#FFFF00', label: '15%' },
  { color: '#FF0000', label: '30%+' },
];

const Legend = ({ title, levels, borderColor }) => (
  <div className={`p-3 sm:p-4 bg-black/20 border-2 rounded-lg`} style={{ borderColor }}>
    <h4 className="text-lg text-white font-bold mb-2 border-b pb-1" style={{ borderColor }}>{title}</h4>
    <div className="flex flex-wrap gap-x-4 gap-y-2 text-xs sm:text-sm">
      {levels.map(l => (
        <div key={l.label} className="flex items-center gap-2">
          <div className="w-4 h-4 sm:w-5 sm:h-5 rounded flex-shrink-0 border border-white/20" style={{ backgroundColor: l.color }} />
          <span className="text-cyan-100">{l.label}</span>
        </div>
      ))}
    </div>
  </div>
);

const btnBase = 'px-3 py-1.5 rounded font-vt323 text-base sm:text-lg transition-all border-2';

const productBtn = (active, colorKey) => {
  const styles = {
    red:   { on: 'bg-red-600 text-white border-white',   off: 'bg-black/30 text-red-300 border-red-700 hover:border-red-400' },
    rose:  { on: 'bg-rose-600 text-white border-white',  off: 'bg-black/30 text-rose-300 border-rose-700 hover:border-rose-400' },
    amber: { on: 'bg-amber-600 text-white border-white', off: 'bg-black/30 text-amber-300 border-amber-700 hover:border-amber-400' },
    green: { on: 'bg-green-600 text-white border-white', off: 'bg-black/30 text-green-300 border-green-700 hover:border-green-400' },
  };
  return `${btnBase} ${active ? styles[colorKey].on : styles[colorKey].off}`;
};

const SPCOutlookTab = () => {
  const [selectedDay, setSelectedDay] = useState(1);
  const [selectedProduct, setSelectedProduct] = useState('categorical');
  const [selectedWPCDay, setSelectedWPCDay] = useState(1);
  const [showDay48, setShowDay48] = useState(false);
  const [selected48, setSelected48] = useState('all');

  const [refreshKey, setRefreshKey] = useState(() => Date.now());
  useEffect(() => {
    const interval = setInterval(() => setRefreshKey(Date.now()), 30 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);
  const DAY48_MAPS = useMemo(() => getDay48Maps(refreshKey), [refreshKey]);
  const SPC_DAYS = getSPCDays();
  const currentDay = SPC_DAYS.find(d => d.day === selectedDay);
  const WPC_FORECASTS = useMemo(() => WPC_BASE_URLS.map(f => ({ ...f, url: `${f.base}?v=${refreshKey}` })), [refreshKey]);
  const currentWPC = WPC_FORECASTS.find(f => f.day === selectedWPCDay);
  const candidates = SPC_CANDIDATES[selectedProduct]?.[selectedDay] ?? [];

  const isDay3Prob = selectedDay === 3 && selectedProduct !== 'categorical';

  return (
    <TabPanel title="SPC OUTLOOK / NATIONAL FORECAST">
      <div className="space-y-8">

        {/* === SPC SEVERE WEATHER SECTION === */}
        <div className="space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2 border-b-2 border-red-700 pb-2">
            <h3 className="text-2xl sm:text-3xl text-red-400 font-bold">SPC SEVERE WEATHER OUTLOOK</h3>
            <button
              onClick={() => setShowDay48(v => !v)}
              className={`${btnBase} ${showDay48 ? 'bg-orange-600 text-white border-white' : 'bg-black/30 text-orange-300 border-orange-700 hover:border-orange-400'}`}
            >
              DAY 4–8
            </button>
          </div>

          {showDay48 ? (
            <div className="space-y-4">
              {/* Day 4-8 selector */}
              <div className="flex flex-wrap justify-center gap-2">
                {DAY48_MAPS.map(m => (
                  <button
                    key={m.id}
                    onClick={() => setSelected48(m.id)}
                    className={`px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg font-vt323 text-base sm:text-lg transition-all border-2 ${
                      selected48 === m.id
                        ? 'bg-orange-600 text-white border-white shadow-lg'
                        : 'bg-black/30 text-orange-300 border-orange-700 hover:border-orange-400 hover:bg-orange-900/30'
                    }`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>

              <p className="text-sm text-orange-300 text-center">
                {DAY48_MAPS.find(m => m.id === selected48)?.desc} — 15%+ probability of severe within 25 mi
              </p>

              <div className="text-center">
                <img
                  key={selected48}
                  src={DAY48_MAPS.find(m => m.id === selected48)?.url}
                  alt={`SPC ${selected48} Outlook`}
                  referrerPolicy="no-referrer"
                  className="w-full h-auto rounded-lg border-4 border-orange-500 mx-auto max-w-2xl bg-white"
                  onError={e => { e.target.onerror = null; e.target.src = PLACEHOLDER_IMG; }}
                />
              </div>

              <Legend title="PROBABILITY WITHIN 25 MI OF A POINT" levels={PROB_LEVELS_48} borderColor="#c2410c" />

              <p className="text-xs text-cyan-400 text-center">Source: NOAA/NWS Storm Prediction Center — Day 4–8 Experimental</p>
            </div>
          ) : (
            <div className="space-y-4">

              {/* Day selector */}
              <div className="flex justify-center gap-2 sm:gap-3">
                {SPC_DAYS.map(d => (
                  <button
                    key={d.day}
                    onClick={() => { setSelectedDay(d.day); if (d.day === 3) setSelectedProduct('categorical'); }}
                    className={`px-4 sm:px-6 py-2 sm:py-3 rounded-lg font-vt323 text-lg sm:text-xl transition-all border-2 ${
                      selectedDay === d.day
                        ? 'bg-red-600 text-white border-white shadow-lg'
                        : 'bg-black/30 text-red-300 border-red-700 hover:border-red-500 hover:bg-red-900/30'
                    }`}
                  >
                    {d.label}<br/><span className="text-xs sm:text-sm opacity-80">{d.date}</span>
                  </button>
                ))}
              </div>

              {/* Product type selector — Day 3 only has combined prob */}
              {selectedDay === 3 ? (
                <p className="text-center text-sm text-orange-300 bg-orange-900/20 border border-orange-700/40 rounded-lg px-4 py-2">
                  Day 3 outlooks only include Categorical and combined severe probability — individual tornado/wind/hail maps are not issued for Day 3.
                </p>
              ) : (
                <div className="flex flex-wrap justify-center gap-2">
                  {PRODUCTS.map(p => (
                    <button
                      key={p.id}
                      onClick={() => setSelectedProduct(p.id)}
                      className={productBtn(selectedProduct === p.id, p.color)}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              )}

              {currentDay && (
                <p className="text-center text-sm text-red-300">{currentDay.desc}</p>
              )}

              {/* Map */}
              <div className="text-center">
                <CascadeImage
                  key={`${selectedDay}-${selectedProduct}`}
                  candidates={candidates}
                  cacheKey={refreshKey}
                  alt={`SPC Day ${selectedDay} ${selectedProduct} outlook`}
                  className="w-full h-auto rounded-lg border-4 border-red-500 mx-auto max-w-2xl bg-white"
                />
              </div>

              {/* Legend */}
              {selectedProduct === 'categorical' && (
                <Legend title="RISK LEVELS" levels={RISK_LEVELS} borderColor="#b91c1c" />
              )}
              {selectedProduct === 'tornado' && (
                <Legend title="TORNADO PROBABILITY WITHIN 25 MI" levels={PROB_LEVELS_TORNADO} borderColor="#be123c" />
              )}
              {selectedProduct === 'wind' && (
                <Legend title="WIND PROBABILITY WITHIN 25 MI" levels={PROB_LEVELS_WIND} borderColor="#b45309" />
              )}
              {selectedProduct === 'hail' && (
                <Legend title="HAIL PROBABILITY WITHIN 25 MI" levels={PROB_LEVELS_HAIL} borderColor="#15803d" />
              )}

              <p className="text-xs text-cyan-400 text-center">Source: NOAA/NWS Storm Prediction Center — Updated each issuance</p>
            </div>
          )}
        </div>

        {/* === WPC NATIONAL FORECAST SECTION === */}
        <div className="space-y-4">
          <h3 className="text-2xl sm:text-3xl text-cyan-300 font-bold border-b-2 border-cyan-700 pb-2">WPC NATIONAL FORECAST</h3>

          <div className="flex justify-center gap-2 sm:gap-4">
            {WPC_FORECASTS.map(f => (
              <button
                key={f.day}
                onClick={() => setSelectedWPCDay(f.day)}
                className={`px-4 sm:px-6 py-2 sm:py-3 rounded-lg font-vt323 text-lg sm:text-xl transition-all border-2 ${
                  selectedWPCDay === f.day
                    ? 'bg-cyan-600 text-white border-white shadow-lg'
                    : 'bg-black/30 text-cyan-300 border-cyan-700 hover:border-cyan-500 hover:bg-cyan-900/30'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          <div className="text-center">
            <img
              key={`wpc-${selectedWPCDay}`}
              src={currentWPC?.url}
              alt={`WPC National Forecast ${currentWPC?.label}`}
              referrerPolicy="no-referrer"
              className="w-full h-auto rounded-lg border-4 border-cyan-500 mx-auto max-w-4xl bg-white"
              onError={e => { e.target.onerror = null; e.target.src = PLACEHOLDER_IMG; }}
            />
          </div>

          <p className="text-xs text-cyan-400 text-center">Source: NOAA/NWS Weather Prediction Center — Updated daily</p>
        </div>

      </div>
    </TabPanel>
  );
};

export default SPCOutlookTab;
