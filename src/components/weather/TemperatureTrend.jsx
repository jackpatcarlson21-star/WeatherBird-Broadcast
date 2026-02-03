import React from 'react';

// Calculate temperature trend from daily forecast data
const getTemperatureTrend = (dailyData) => {
  if (!dailyData?.temperature_2m_max || dailyData.temperature_2m_max.length < 4) {
    return { trend: 'steady', change: 0 };
  }

  // Compare today's high with average of next 3 days
  const todayHigh = dailyData.temperature_2m_max[0];
  const nextThreeDaysAvg = (
    dailyData.temperature_2m_max[1] +
    dailyData.temperature_2m_max[2] +
    dailyData.temperature_2m_max[3]
  ) / 3;

  const change = nextThreeDaysAvg - todayHigh;

  // Threshold of 5°F difference is considered significant
  if (change > 5) return { trend: 'warming', change: Math.round(change) };
  if (change < -5) return { trend: 'cooling', change: Math.round(Math.abs(change)) };
  return { trend: 'steady', change: 0 };
};

const TemperatureTrend = ({ dailyData }) => {
  const { trend, change } = getTemperatureTrend(dailyData);

  const trendConfig = {
    warming: { icon: '↑', color: 'text-orange-400', label: `Warming ~${change}°F` },
    cooling: { icon: '↓', color: 'text-blue-400', label: `Cooling ~${change}°F` },
    steady: { icon: '→', color: 'text-cyan-400', label: 'Steady' }
  };

  const config = trendConfig[trend];

  return (
    <div className="text-center mt-1">
      <span className={`text-sm ${config.color} flex items-center justify-center gap-1`}>
        {config.icon} {config.label} next 3 days
      </span>
    </div>
  );
};

export default TemperatureTrend;
