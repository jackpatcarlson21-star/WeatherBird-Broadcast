import React, { useState } from 'react';
import TabPanel from '../layout/TabPanel';
import { PLACEHOLDER_IMG } from '../../utils/constants';

const cacheBust = `?v=${Math.floor(Date.now() / 3600000)}`; // refresh every hour

const SPC_OUTLOOKS = [
  {
    day: 1,
    label: 'DAY 1',
    url: `https://www.spc.noaa.gov/products/outlook/day1otlk_sm.png${cacheBust}`,
    desc: 'Valid today through tomorrow morning',
  },
  {
    day: 2,
    label: 'DAY 2',
    url: `https://www.spc.noaa.gov/products/outlook/day2otlk_sm.png${cacheBust}`,
    desc: 'Valid tomorrow',
  },
  {
    day: 3,
    label: 'DAY 3',
    url: `https://www.spc.noaa.gov/products/outlook/day3otlk_sm.png${cacheBust}`,
    desc: 'Valid in 2 days',
  },
];

const WPC_FORECASTS = [
  { day: 1, label: 'TODAY',    url: `https://www.wpc.ncep.noaa.gov/noaa/noaad1.gif${cacheBust}` },
  { day: 2, label: 'TOMORROW', url: `https://www.wpc.ncep.noaa.gov/noaa/noaad2.gif${cacheBust}` },
  { day: 3, label: 'DAY 3',   url: `https://www.wpc.ncep.noaa.gov/noaa/noaad3.gif${cacheBust}` },
];

const RISK_LEVELS = [
  { color: '#66A366', label: 'General Thunder' },
  { color: '#008000', label: 'Marginal (1)' },
  { color: '#FFFF00', label: 'Slight (2)' },
  { color: '#FFA500', label: 'Enhanced (3)' },
  { color: '#FF0000', label: 'Moderate (4)' },
  { color: '#FF00FF', label: 'High (5)' },
];

const SPCOutlookTab = () => {
  const [selectedSPCDay, setSelectedSPCDay] = useState(1);
  const [selectedWPCDay, setSelectedWPCDay] = useState(1);
  const [showDay48, setShowDay48] = useState(false);

  const currentSPC = SPC_OUTLOOKS.find(m => m.day === selectedSPCDay);
  const currentWPC = WPC_FORECASTS.find(m => m.day === selectedWPCDay);

  return (
    <TabPanel title="SPC OUTLOOK / NATIONAL FORECAST">
      <div className="space-y-8">

        {/* === SPC SEVERE WEATHER SECTION === */}
        <div className="space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2 border-b-2 border-red-700 pb-2">
            <h3 className="text-2xl sm:text-3xl text-red-400 font-bold">SPC SEVERE WEATHER OUTLOOK</h3>
            <button
              onClick={() => setShowDay48(v => !v)}
              className={`px-3 py-1 rounded font-vt323 text-base transition-all ${
                showDay48
                  ? 'bg-orange-600 text-white border-2 border-white'
                  : 'bg-black/30 text-orange-300 border-2 border-orange-700 hover:border-orange-500'
              }`}
            >
              DAY 4–8
            </button>
          </div>

          {showDay48 ? (
            /* Day 4-8 Outlook */
            <div className="space-y-3">
              <p className="text-sm text-orange-300 text-center">Extended range probabilistic severe weather outlook</p>
              <div className="text-center">
                <img
                  src={`https://www.spc.noaa.gov/products/exper/day4-8/day48prob_small.gif${cacheBust}`}
                  alt="SPC Day 4-8 Outlook"
                  className="w-full h-auto rounded-lg border-4 border-orange-500 mx-auto max-w-2xl bg-white"
                  onError={e => { e.target.onerror = null; e.target.src = PLACEHOLDER_IMG; }}
                />
              </div>
              <p className="text-xs text-cyan-400 text-center">Source: NOAA/NWS Storm Prediction Center — Day 4–8 Experimental</p>
            </div>
          ) : (
            /* Day 1-3 Outlook */
            <div className="space-y-4">
              {/* Day Selector */}
              <div className="flex justify-center gap-2 sm:gap-4">
                {SPC_OUTLOOKS.map(o => (
                  <button
                    key={o.day}
                    onClick={() => setSelectedSPCDay(o.day)}
                    className={`px-4 sm:px-6 py-2 sm:py-3 rounded-lg font-vt323 text-lg sm:text-xl transition-all ${
                      selectedSPCDay === o.day
                        ? 'bg-red-600 text-white border-2 border-white shadow-lg'
                        : 'bg-black/30 text-red-300 border-2 border-red-700 hover:border-red-500 hover:bg-red-900/30'
                    }`}
                  >
                    {o.label}
                  </button>
                ))}
              </div>

              {/* Validity label */}
              {currentSPC && (
                <p className="text-center text-sm text-red-300">{currentSPC.desc}</p>
              )}

              {/* Map */}
              <div className="text-center">
                <img
                  key={`spc-${selectedSPCDay}`}
                  src={currentSPC?.url}
                  alt={`SPC ${currentSPC?.label} Outlook`}
                  className="w-full h-auto rounded-lg border-4 border-red-500 mx-auto max-w-2xl bg-white"
                  onError={e => { e.target.onerror = null; e.target.src = PLACEHOLDER_IMG; }}
                />
              </div>

              {/* Risk Legend */}
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

              <p className="text-xs text-cyan-400 text-center">Source: NOAA/NWS Storm Prediction Center — Updated each issuance</p>
            </div>
          )}
        </div>

        {/* === WPC NATIONAL FORECAST SECTION === */}
        <div className="space-y-4">
          <h3 className="text-2xl sm:text-3xl text-cyan-300 font-bold border-b-2 border-cyan-700 pb-2">WPC NATIONAL FORECAST</h3>

          {/* Day Selector */}
          <div className="flex justify-center gap-2 sm:gap-4">
            {WPC_FORECASTS.map(f => (
              <button
                key={f.day}
                onClick={() => setSelectedWPCDay(f.day)}
                className={`px-4 sm:px-6 py-2 sm:py-3 rounded-lg font-vt323 text-lg sm:text-xl transition-all ${
                  selectedWPCDay === f.day
                    ? 'bg-cyan-600 text-white border-2 border-white shadow-lg'
                    : 'bg-black/30 text-cyan-300 border-2 border-cyan-700 hover:border-cyan-500 hover:bg-cyan-900/30'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* Map */}
          <div className="text-center">
            <img
              key={`wpc-${selectedWPCDay}`}
              src={currentWPC?.url}
              alt={`WPC National Forecast ${currentWPC?.label}`}
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
