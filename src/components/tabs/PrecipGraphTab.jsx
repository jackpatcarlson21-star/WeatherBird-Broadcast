import React from 'react';
import { Droplets, CloudRain } from 'lucide-react';
import TabPanel from '../layout/TabPanel';
import LoadingIndicator from '../common/LoadingIndicator';

const PrecipGraphTab = ({ hourly, isWeatherLoading }) => {
  if (isWeatherLoading) return <LoadingIndicator />;

  // Find the current hour index in the hourly data
  // The API returns hourly data starting from midnight, so we need to find which index matches "now"
  const now = new Date();
  let startIndex = 0;

  if (hourly?.time) {
    // Find the first hour that is >= current time
    for (let i = 0; i < hourly.time.length; i++) {
      const hourTime = new Date(hourly.time[i]);
      if (hourTime >= now) {
        startIndex = i;
        break;
      }
      // If we've passed all times, use the last available
      if (i === hourly.time.length - 1) {
        startIndex = i;
      }
    }
  }

  // Get next 12 hours of precipitation data starting from current hour (rain + snow)
  // Note: Open-Meteo's "precipitation" already includes rain + snow water equivalent
  // "snowfall" is the actual snow accumulation in cm (converted to inches by API since we use precipitation_unit=inch)
  const data = hourly?.time ? hourly.time.slice(startIndex, startIndex + 12).map((time, i) => {
    const idx = startIndex + i;
    const rainAmount = hourly.rain?.[idx] || 0; // Rain only (excludes snow)
    const snowfall = hourly.snowfall?.[idx] || 0; // Snow accumulation in inches
    const hasSnow = snowfall > 0;
    const hasRain = rainAmount > 0;

    return {
      time: new Date(time).toLocaleTimeString([], { hour: 'numeric' }),
      probability: Math.round(hourly.precipitation_probability?.[idx] || 0),
      rain: rainAmount,
      snow: snowfall,
      // Show both rain and snow amounts when mixed precipitation occurs
      amount: hasSnow ? snowfall : rainAmount,
      hasSnow,
      hasRain,
    };
  }) : [];

  // Find the max amount for scaling the second graph
  const maxAmount = Math.max(...data.map(d => d.amount), 0.1);

  // Calculate totals
  const totalRain = data.reduce((sum, d) => sum + d.rain, 0);
  const totalSnow = data.reduce((sum, d) => sum + d.snow, 0);
  // Total precip: for display, sum rain + snow accumulation
  const totalPrecip = data.reduce((sum, d) => sum + d.amount, 0);
  const avgProb = data.length > 0
    ? Math.round(data.reduce((sum, d) => sum + d.probability, 0) / data.length)
    : 0;
  const maxProbHour = data.reduce((max, d) => d.probability > max.probability ? d : max, { probability: 0, time: '--' });
  const maxAmountHour = data.reduce((max, d) => d.amount > max.amount ? d : max, { amount: 0, time: '--', hasSnow: false });

  // Reusable bar component for both graphs
  const PrecipBar = ({ value, maxValue, label, time, type, hasSnow, hasRain }) => {
    const heightPercent = type === 'chance'
      ? (value / 100) * 100
      : (maxValue > 0 ? (value / maxValue) * 100 : 0);

    let barColor;
    if (type === 'chance') {
      barColor = 'bg-cyan-800';
      if (value >= 70) barColor = 'bg-blue-500';
      else if (value >= 50) barColor = 'bg-cyan-500';
      else if (value >= 30) barColor = 'bg-cyan-600';
    } else if (hasSnow) {
      // Snow colors - white/purple theme
      barColor = 'bg-purple-400';
      if (value >= 0.5) barColor = 'bg-purple-300';
      else if (value >= 0.25) barColor = 'bg-purple-400';
      else if (value >= 0.1) barColor = 'bg-purple-500';
      else if (value > 0) barColor = 'bg-purple-600';
    } else {
      // Rain colors - green/blue theme
      barColor = 'bg-green-800';
      if (value >= 0.5) barColor = 'bg-blue-600';
      else if (value >= 0.25) barColor = 'bg-blue-500';
      else if (value >= 0.1) barColor = 'bg-green-500';
      else if (value > 0) barColor = 'bg-green-600';
    }

    const glowStyle = type === 'chance'
      ? (value >= 50 ? '0 0 10px rgba(0, 255, 255, 0.5)' : 'none')
      : hasSnow && value >= 0.1
        ? '0 0 10px rgba(200, 150, 255, 0.5)'
        : (value >= 0.25 ? '0 0 10px rgba(0, 200, 100, 0.5)' : 'none');

    return (
      <div className="flex flex-col items-center justify-end h-full min-w-[40px] sm:min-w-0 sm:flex-1">
        <span className="text-[10px] sm:text-xs text-white mb-1 font-bold whitespace-nowrap">
          {label}
        </span>
        <div
          className={`w-full max-w-[30px] sm:max-w-none ${barColor} rounded-t transition-all duration-300 min-h-[4px]`}
          style={{
            height: `${Math.max(heightPercent, type === 'amount' && value > 0 ? 5 : 2)}%`,
            boxShadow: glowStyle
          }}
        />
        {/* Show snow/rain icon below bar */}
        {type === 'amount' && (hasSnow || hasRain) && (
          <span className="text-[10px] mt-0.5">{hasSnow ? '❄️' : '🌧️'}</span>
        )}
        <span className="text-[10px] sm:text-xs text-cyan-300 mt-1 sm:mt-2 font-vt323">
          {time}
        </span>
      </div>
    );
  };

  return (
    <TabPanel title="12-HOUR PRECIPITATION FORECAST">
      <div className="space-y-4 sm:space-y-6">
        {/* Summary Stats - Moved to top for mobile */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
          <div className="p-2 sm:p-3 bg-black/20 rounded-lg border border-cyan-700 text-center">
            <p className="text-[10px] sm:text-xs text-cyan-400 mb-1">AVG CHANCE</p>
            <p className="text-xl sm:text-2xl font-bold text-white">{avgProb}%</p>
          </div>
          <div className="p-2 sm:p-3 bg-black/20 rounded-lg border border-cyan-700 text-center">
            <p className="text-[10px] sm:text-xs text-cyan-400 mb-1">PEAK CHANCE</p>
            <p className="text-xl sm:text-2xl font-bold text-white">{maxProbHour.probability}%</p>
            <p className="text-[10px] sm:text-xs text-cyan-300">{maxProbHour.time}</p>
          </div>
          <div className="p-2 sm:p-3 bg-black/20 rounded-lg border border-cyan-700 text-center">
            <p className="text-[10px] sm:text-xs text-cyan-400 mb-1">12HR TOTAL</p>
            <p className="text-xl sm:text-2xl font-bold text-white">{totalPrecip.toFixed(2)}"</p>
            {totalSnow > 0 && <p className="text-[10px] text-purple-300">❄️ {totalSnow.toFixed(2)}" snow</p>}
          </div>
          <div className="p-2 sm:p-3 bg-black/20 rounded-lg border border-cyan-700 text-center">
            <p className="text-[10px] sm:text-xs text-cyan-400 mb-1">PEAK AMOUNT</p>
            <p className="text-xl sm:text-2xl font-bold text-white">{maxAmountHour.amount.toFixed(2)}"</p>
            <p className="text-[10px] sm:text-xs text-cyan-300">{maxAmountHour.time} {maxAmountHour.hasSnow ? '❄️' : ''}</p>
          </div>
        </div>

        {/* Probability Graph */}
        <div>
          <div className="flex items-center gap-2 text-cyan-300 mb-2">
            <Droplets size={18} className="shrink-0" />
            <span className="text-sm sm:text-lg">CHANCE OF PRECIPITATION</span>
          </div>
          <div className="bg-black/30 rounded-lg border-2 border-cyan-700 p-2 sm:p-4">
            <div className="overflow-x-auto pb-2 -mx-2 px-2 sm:overflow-visible sm:mx-0 sm:px-0">
              <div className="flex items-end gap-1 sm:gap-2 h-32 sm:h-40 min-w-[480px] sm:min-w-0">
                {data.map((hour, index) => (
                  <PrecipBar
                    key={index}
                    value={hour.probability}
                    maxValue={100}
                    label={`${hour.probability}%`}
                    time={hour.time}
                    type="chance"
                  />
                ))}
              </div>
            </div>
            <p className="text-[10px] text-cyan-500 mt-2 sm:hidden text-center">Swipe to see all hours</p>
          </div>
        </div>

        {/* Amount Graph */}
        <div>
          <div className="flex items-center gap-2 text-cyan-300 mb-2">
            <CloudRain size={18} className="shrink-0" />
            <span className="text-sm sm:text-lg">EXPECTED AMOUNT (INCHES)</span>
          </div>
          <div className="bg-black/30 rounded-lg border-2 border-cyan-700 p-2 sm:p-4">
            <div className="overflow-x-auto pb-2 -mx-2 px-2 sm:overflow-visible sm:mx-0 sm:px-0">
              <div className="flex items-end gap-1 sm:gap-2 h-32 sm:h-40 min-w-[480px] sm:min-w-0">
                {data.map((hour, index) => (
                  <PrecipBar
                    key={index}
                    value={hour.amount}
                    maxValue={maxAmount}
                    label={hour.amount > 0 ? hour.amount.toFixed(2) : '0'}
                    time={hour.time}
                    type="amount"
                    hasSnow={hour.hasSnow}
                    hasRain={hour.hasRain}
                  />
                ))}
              </div>
            </div>
            <p className="text-[10px] text-cyan-500 mt-2 sm:hidden text-center">Swipe to see all hours</p>
          </div>
        </div>

        {/* Combined Legend - More compact on mobile */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-4">
          <div className="bg-black/20 rounded-lg border border-cyan-700 p-2 sm:p-3">
            <p className="text-[10px] sm:text-xs text-cyan-400 mb-1 sm:mb-2 font-bold">CHANCE LEGEND</p>
            <div className="flex flex-wrap gap-x-3 gap-y-1 text-[10px] sm:text-xs">
              <div className="flex items-center gap-1">
                <div className="w-2.5 h-2.5 sm:w-3 sm:h-3 bg-cyan-800 rounded"></div>
                <span className="text-cyan-300">0-29%</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-2.5 h-2.5 sm:w-3 sm:h-3 bg-cyan-600 rounded"></div>
                <span className="text-cyan-300">30-49%</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-2.5 h-2.5 sm:w-3 sm:h-3 bg-cyan-500 rounded"></div>
                <span className="text-cyan-300">50-69%</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-2.5 h-2.5 sm:w-3 sm:h-3 bg-blue-500 rounded"></div>
                <span className="text-cyan-300">70%+</span>
              </div>
            </div>
          </div>
          <div className="bg-black/20 rounded-lg border border-cyan-700 p-2 sm:p-3">
            <p className="text-[10px] sm:text-xs text-cyan-400 mb-1 sm:mb-2 font-bold">AMOUNT LEGEND</p>
            <div className="flex flex-wrap gap-x-3 gap-y-1 text-[10px] sm:text-xs">
              <div className="flex items-center gap-1">
                <div className="w-2.5 h-2.5 sm:w-3 sm:h-3 bg-green-600 rounded"></div>
                <span className="text-cyan-300">Rain</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-2.5 h-2.5 sm:w-3 sm:h-3 bg-blue-500 rounded"></div>
                <span className="text-cyan-300">Heavy</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-2.5 h-2.5 sm:w-3 sm:h-3 bg-purple-500 rounded"></div>
                <span className="text-cyan-300">Snow</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-2.5 h-2.5 sm:w-3 sm:h-3 bg-purple-300 rounded"></div>
                <span className="text-cyan-300">Heavy</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </TabPanel>
  );
};

export default PrecipGraphTab;
