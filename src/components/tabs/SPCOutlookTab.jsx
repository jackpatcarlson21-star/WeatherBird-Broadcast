import React, { useState } from 'react';
import TabPanel from '../layout/TabPanel';
import { PLACEHOLDER_IMG } from '../../utils/constants';

const SPCOutlookTab = () => {
  const [selectedDay, setSelectedDay] = useState(1);

  const outlookMaps = [
    { day: 1, name: 'DAY 1', url: 'https://www.spc.noaa.gov/products/outlook/day1otlk.gif' },
    { day: 2, name: 'DAY 2', url: 'https://www.spc.noaa.gov/products/outlook/day2otlk.gif' },
    { day: 3, name: 'DAY 3', url: 'https://www.spc.noaa.gov/products/outlook/day3otlk.gif' },
  ];

  const currentMap = outlookMaps.find(m => m.day === selectedDay);

  return (
    <TabPanel title="SPC OUTLOOK (SEVERE WEATHER)">
      <div className="space-y-4">
        {/* Day Selector */}
        <div className="flex justify-center gap-2 sm:gap-4">
          {outlookMaps.map(outlook => (
            <button
              key={outlook.day}
              onClick={() => setSelectedDay(outlook.day)}
              className={`px-4 sm:px-6 py-2 sm:py-3 rounded-lg font-vt323 text-lg sm:text-xl transition-all ${
                selectedDay === outlook.day
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
          <h3 className="text-xl sm:text-2xl text-red-400 mb-3">
            SEVERE WEATHER THREAT LEVEL ({currentMap?.name})
          </h3>
          <img
            key={selectedDay}
            src={currentMap?.url}
            alt={`SPC ${currentMap?.name} Outlook`}
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
    </TabPanel>
  );
};

export default SPCOutlookTab;
