import React from 'react';

const getGradient = (weatherCode, night) => {
  if (night) {
    if (weatherCode >= 95) return 'from-gray-950 via-slate-900 to-gray-950';
    if (weatherCode >= 71) return 'from-slate-800 via-blue-950 to-slate-900';
    if (weatherCode >= 51) return 'from-slate-800 via-slate-900 to-blue-950';
    if (weatherCode >= 45) return 'from-slate-700 via-slate-800 to-slate-900';
    if (weatherCode >= 1)  return 'from-slate-800 via-indigo-950 to-slate-900';
    return 'from-indigo-950 via-slate-900 to-blue-950';
  }
  if (weatherCode >= 95) return 'from-slate-700 via-gray-800 to-slate-900';
  if (weatherCode >= 71) return 'from-slate-400 via-blue-200 to-slate-300';
  if (weatherCode >= 51) return 'from-slate-500 via-blue-700 to-slate-700';
  if (weatherCode >= 45) return 'from-slate-400 via-slate-500 to-slate-600';
  if (weatherCode >= 1)  return 'from-sky-400 via-blue-400 to-blue-500';
  return 'from-sky-400 via-sky-500 to-blue-600';
};

const ModernBackground = ({ weatherCode = 0, night = false }) => {
  const gradient = getGradient(weatherCode, night);
  return (
    <div
      className={`fixed inset-0 bg-gradient-to-b ${gradient} transition-all duration-1000`}
      style={{ zIndex: 0 }}
    />
  );
};

export default ModernBackground;
