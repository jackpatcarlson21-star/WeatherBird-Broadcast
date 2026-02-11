import React from 'react';

const LoadingIndicator = () => (
  <div className="flex-grow p-4 sm:p-6 overflow-auto font-vt323">
    {/* Title Bar Skeleton */}
    <div className="skeleton h-10 w-64 mb-6" />

    {/* Summary + Bird Row */}
    <div className="flex flex-col sm:flex-row gap-4 mb-6">
      <div className="flex-grow skeleton h-28" />
      <div className="skeleton h-28 w-32 shrink-0" />
    </div>

    {/* Large Temperature Display */}
    <div className="flex flex-col sm:flex-row justify-between items-center mb-8 border-b border-cyan-800/30 pb-4">
      <div className="text-center sm:text-left mb-4 sm:mb-0">
        <div className="skeleton h-24 w-56 mb-2" />
        <div className="skeleton h-6 w-40" />
      </div>
      {/* Weather Icon Skeleton (circle) */}
      <div className="skeleton h-32 w-32 rounded-full" />
    </div>

    {/* 2x4 Stat Card Grid */}
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      <div className="skeleton h-20" />
      <div className="skeleton h-20" />
      <div className="skeleton h-20" />
      <div className="skeleton h-20" />
      <div className="skeleton h-20" />
      <div className="skeleton h-20" />
      <div className="skeleton h-20" />
      <div className="skeleton h-20" />
      <div className="skeleton h-20" />
      {/* AQI Card (col-span-2) */}
      <div className="skeleton h-20 col-span-2" />
    </div>

    {/* Pulsing Status Text */}
    <div className="text-center mt-8">
      <span className="text-2xl text-cyan-400 font-vt323 animate-pulse">ACCESSING DATA STREAM...</span>
    </div>
  </div>
);

export default LoadingIndicator;
