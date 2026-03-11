import React, { useState } from 'react';
import TabPanel from '../layout/TabPanel';
import { PLACEHOLDER_IMG } from '../../utils/constants';

const BASE = 'https://www.spc.noaa.gov/products/outlook/';
const cb = `?v=${Math.floor(Date.now() / 3600000)}`;

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

const CascadeImage = ({ candidates, alt, className }) => {
  const [idx, setIdx] = useState(0);
  const urls = candidates.map(f => `${BASE}${f}${cb}`);
  const src = idx < urls.length ? urls[idx] : PLACEHOLDER_IMG;

  return (
    <img
      key={src}
      src={src}
      alt={alt}
      referrerPolicy="no-referrer"
      className={className}
      onError={() => setIdx(i => i + 1)}
    />
  );
};

const SPC_DAYS = [
  { day: 1, label: 'DAY 1', desc: 'Valid today through tomorrow morning' },
  { day: 2, label: 'DAY 2', desc: 'Valid tomorrow' },
  { day: 3, label: 'DAY 3', desc: 'Valid in 2 days' },
];

const WPC_FORECASTS = [
  { day: 1, label: 'TODAY',    url: `https://www.wpc.ncep.noaa.gov/noaa/noaad1.gif${cb}` },
  { day: 2, label: 'TOMORROW', url: `https://www.wpc.ncep.noaa.gov/noaa/noaad2.gif${cb}` },
  { day: 3, label: 'DAY 3',    url: `https://www.wpc.ncep.noaa.gov/noaa/noaad3.gif${cb}` },
];

const RISK_LEVELS = [
  { color: '#66A366', label: 'General Thunder' },
  { color: '#008000', label: 'Marginal (1)' },
  { color: '#FFFF00', label: 'Slight (2)' },
  { color: '#FFA500', label: 'Enhanced (3)' },
  { color: '#FF0000', label: 'Moderate (4)' },
  { color: '#FF00FF', label: 'High (5)' },
];

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

  const currentDay = SPC_DAYS.find(d => d.day === selectedDay);
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
            <div className="space-y-3">
              <p className="text-sm text-orange-300 text-center">Extended range probabilistic severe weather outlook</p>
              <div className="text-center">
                <img
                  src={`https://www.spc.noaa.gov/products/exper/day4-8/day48prob_small.gif${cb}`}
                  alt="SPC Day 4-8 Outlook"
                  referrerPolicy="no-referrer"
                  className="w-full h-auto rounded-lg border-4 border-orange-500 mx-auto max-w-2xl bg-white"
                  onError={e => { e.target.onerror = null; e.target.src = PLACEHOLDER_IMG; }}
                />
              </div>
              <p className="text-xs text-cyan-400 text-center">Source: NOAA/NWS Storm Prediction Center — Day 4–8 Experimental</p>
            </div>
          ) : (
            <div className="space-y-4">

              {/* Day selector */}
              <div className="flex justify-center gap-2 sm:gap-3">
                {SPC_DAYS.map(d => (
                  <button
                    key={d.day}
                    onClick={() => setSelectedDay(d.day)}
                    className={`px-4 sm:px-6 py-2 sm:py-3 rounded-lg font-vt323 text-lg sm:text-xl transition-all border-2 ${
                      selectedDay === d.day
                        ? 'bg-red-600 text-white border-white shadow-lg'
                        : 'bg-black/30 text-red-300 border-red-700 hover:border-red-500 hover:bg-red-900/30'
                    }`}
                  >
                    {d.label}
                  </button>
                ))}
              </div>

              {/* Product type selector */}
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

              {currentDay && (
                <p className="text-center text-sm text-red-300">
                  {currentDay.desc}
                  {isDay3Prob && ' — Day 3 shows combined severe probability'}
                </p>
              )}

              {/* Map */}
              <div className="text-center">
                <CascadeImage
                  key={`${selectedDay}-${selectedProduct}`}
                  candidates={candidates}
                  alt={`SPC Day ${selectedDay} ${selectedProduct} outlook`}
                  className="w-full h-auto rounded-lg border-4 border-red-500 mx-auto max-w-2xl bg-white"
                />
              </div>

              {/* Risk legend (categorical only) */}
              {selectedProduct === 'categorical' && (
                <div className="p-3 sm:p-4 bg-black/20 border-2 border-red-700 rounded-lg">
                  <h4 className="text-lg text-white font-bold mb-2 border-b border-red-800 pb-1">RISK LEVELS</h4>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2 text-xs sm:text-sm">
                    {RISK_LEVELS.map(r => (
                      <div key={r.label} className="flex items-center gap-2">
                        <div className="w-4 h-4 sm:w-5 sm:h-5 rounded flex-shrink-0" style={{ backgroundColor: r.color }} />
                        <span className="text-cyan-100">{r.label}</span>
                      </div>
                    ))}
                  </div>
                </div>
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
