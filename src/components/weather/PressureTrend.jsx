import React from 'react';
import { Gauge } from 'lucide-react';

// Calculate pressure trend from hourly data
const getPressureTrend = (hourlyData) => {
  if (!hourlyData?.pressure_msl || !hourlyData?.time) return { trend: 'steady', change: 0 };

  const now = new Date();
  let currentIndex = -1;
  let pastIndex = -1;

  // Find current hour and 3 hours ago
  for (let i = 0; i < hourlyData.time.length; i++) {
    const hourTime = new Date(hourlyData.time[i]);
    if (hourTime <= now) {
      currentIndex = i;
    }
    const threeHoursAgo = new Date(now.getTime() - 3 * 60 * 60 * 1000);
    if (hourTime <= threeHoursAgo) {
      pastIndex = i;
    }
  }

  if (currentIndex < 0 || pastIndex < 0 || currentIndex === pastIndex) {
    return { trend: 'steady', change: 0 };
  }

  const currentPressure = hourlyData.pressure_msl[currentIndex];
  const pastPressure = hourlyData.pressure_msl[pastIndex];
  const change = currentPressure - pastPressure;

  // Threshold of 1 hPa (~0.03 in) over 3 hours is considered significant
  if (change > 1) return { trend: 'rising', change };
  if (change < -1) return { trend: 'falling', change };
  return { trend: 'steady', change };
};

const PressureTrend = ({ hourlyData, currentPressure }) => {
  const { trend } = getPressureTrend(hourlyData);

  const trendConfig = {
    rising: { icon: '↑', color: 'text-green-400', label: 'Rising' },
    falling: { icon: '↓', color: 'text-red-400', label: 'Falling' },
    steady: { icon: '→', color: 'text-cyan-400', label: 'Steady' }
  };

  const config = trendConfig[trend];

  return (
    <div className="flex flex-col items-center">
      <div className="flex items-center gap-1">
        <Gauge size={20} className="text-cyan-400" />
        <span className={`text-xl font-bold ${config.color}`}>{config.icon}</span>
      </div>
      <span className="text-sm text-cyan-300">PRESSURE</span>
      <span className="font-bold">{((currentPressure || 1010) * 0.02953).toFixed(2)} in</span>
      <span className={`text-xs ${config.color}`}>{config.label}</span>
    </div>
  );
};

export default PressureTrend;
