import React, { useState } from 'react';
import TabPanel from '../layout/TabPanel';
import { PLACEHOLDER_IMG } from '../../utils/constants';

const SPCOutlookTab = () => {
  const [selectedSPCDay, setSelectedSPCDay] = useState(1);
  const [selectedWPCDay, setSelectedWPCDay] = useState(1);

  const outlookMaps = [
    { day: 1, name: 'DAY 1', url: 'https://www.spc.noaa.gov/products/outlook/day1otlk.gif' },
    { day: 2, name: 'DAY 2', url: 'https://www.spc.noaa.gov/products/outlook/day2otlk.gif' },
    { day: 3, name: 'DAY 3', url: 'https://www.spc.noaa.gov/products/outlook/day3otlk.gif' },
  ];

  const forecastMaps = [
    { day: 1, name: 'TODAY', url: 'https://www.wpc.ncep.noaa.gov/noaa/noaad1.gif' },
    { day: 2, name: 'TOMORROW', url: 'https://www.wpc.ncep.noaa.gov/noaa/noaad2.gif' },
    { day: 3, name: 'DAY 3', url: 'https://www.wpc.ncep.noaa.gov/noaa/noaad3.gif' },
  ];

  const currentSPC = outlookMaps.find(m => m.day === selectedSPCDay);
  const currentWPC = forecastMaps.find(m => m.day === selectedWPCDay);

  return (
    <TabPanel title="SPC OUTLOOK / NATIONAL FORECAST">
      <div className="space-y-6">
        {/* === SPC SEVERE WEATHER SECTION === */}
        <div className="space-y-4">
          <h3 className="text-2xl sm:text-3xl text-red-400 font-bold border-b-2 border-red-700 pb-2">SPC SEVERE WEATHER OUTLOOK</h3>

          {/* Day Selector */}
          <div className="flex justify-center gap-2 sm:gap-4">
            {outlookMaps.map(outlook => (
              <button
                key={outlook.day}
                onClick={() => setSelectedSPCDay(outlook.day)}
                className={`px-4 sm:px-6 py-2 sm:py-3 rounded-lg font-vt323 text-lg sm:text-xl transition-all ${
                  selectedSPCDay === outlook.day
                    ? 'bg-red-600 text-white border-2 border-white shadow-lg'
                    : 'bg-black/30 text-red-300 border-2 border-red-700 hover:border-red-500 hover:bg-red-900/30'
                }`}
              >
                {outlook.name}
              </button>
            ))}
          </div>

          {/* Map Display */}
          <div className="text-center">
            <img
              key={`spc-${selectedSPCDay}`}
              src={currentSPC?.url}
              alt={`SPC ${currentSPC?.name} Outlook`}
              className="w-full h-auto rounded-lg border-4 border-red-500 mx-auto max-w-lg bg-white"
              onError={(e) => {
                e.target.onerror = null;
                e.target.src = PLACEHOLDER_IMG;
              }}
            />
          </div>

          {/* Risk Level Legend */}
          <div className="p-3 sm:p-4 bg-black/20 border-2 border-red-700 rounded-lg">
            <h4 className="text-lg text-white font-bold mb-2 border-b border-red-800 pb-1">RISK LEVELS</h4>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2 text-xs sm:text-sm">
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 sm:w-5 sm:h-5 rounded" style={{ backgroundColor: '#66A366' }}></div>
                <span className="text-cyan-100">Thunderstorm</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 sm:w-5 sm:h-5 rounded" style={{ backgroundColor: '#008000' }}></div>
                <span className="text-cyan-100">Marginal (1)</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 sm:w-5 sm:h-5 rounded" style={{ backgroundColor: '#FFFF00' }}></div>
                <span className="text-cyan-100">Slight (2)</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 sm:w-5 sm:h-5 rounded" style={{ backgroundColor: '#FFA500' }}></div>
                <span className="text-cyan-100">Enhanced (3)</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 sm:w-5 sm:h-5 rounded" style={{ backgroundColor: '#FF0000' }}></div>
                <span className="text-cyan-100">Moderate (4)</span>
              </div>
              <div className="flex items-center gap-2 sm:col-span-3 md:col-span-5 justify-center">
                <div className="w-4 h-4 sm:w-5 sm:h-5 rounded" style={{ backgroundColor: '#FF00FF' }}></div>
                <span className="text-cyan-100">High (5)</span>
              </div>
            </div>
          </div>

          <p className="text-xs text-cyan-400 text-center">Source: NOAA/NWS Storm Prediction Center</p>
        </div>

        {/* === WPC NATIONAL FORECAST SECTION === */}
        <div className="space-y-4">
          <h3 className="text-2xl sm:text-3xl text-cyan-300 font-bold border-b-2 border-cyan-700 pb-2">WPC NATIONAL FORECAST</h3>

          {/* Day Selector */}
          <div className="flex justify-center gap-2 sm:gap-4">
            {forecastMaps.map(forecast => (
              <button
                key={forecast.day}
                onClick={() => setSelectedWPCDay(forecast.day)}
                className={`px-4 sm:px-6 py-2 sm:py-3 rounded-lg font-vt323 text-lg sm:text-xl transition-all ${
                  selectedWPCDay === forecast.day
                    ? 'bg-cyan-600 text-white border-2 border-white shadow-lg'
                    : 'bg-black/30 text-cyan-300 border-2 border-cyan-700 hover:border-cyan-500 hover:bg-cyan-900/30'
                }`}
              >
                {forecast.name}
              </button>
            ))}
          </div>

          {/* Map Display */}
          <div className="text-center">
            <img
              key={`wpc-${selectedWPCDay}`}
              src={`${currentWPC?.url}?${Math.floor(Date.now() / 86400000)}`}
              alt={`WPC National Forecast ${currentWPC?.name}`}
              className="w-full h-auto rounded-lg border-4 border-cyan-500 mx-auto max-w-4xl bg-white"
              onError={(e) => {
                e.target.onerror = null;
                e.target.src = PLACEHOLDER_IMG;
              }}
            />
          </div>

          <p className="text-xs text-cyan-400 text-center">Source: NOAA/NWS Weather Prediction Center — Updated daily</p>
        </div>
      </div>
    </TabPanel>
  );
};

export default SPCOutlookTab;
