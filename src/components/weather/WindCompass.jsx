import React from 'react';
import { Navigation2 } from 'lucide-react';

const WindCompass = ({ degrees, windSpeed = 0, size = 48 }) => {
  const fontSize = Math.max(8, size * 0.18);

  // Outer dashed ring spins faster with higher wind speed
  let spinStyle = {};
  if (windSpeed >= 25) {
    spinStyle = { animation: 'spin 1s linear infinite' };
  } else if (windSpeed >= 15) {
    spinStyle = { animation: 'spin 2s linear infinite' };
  } else if (windSpeed >= 5) {
    spinStyle = { animation: 'spin 5s linear infinite' };
  } else if (windSpeed > 0) {
    spinStyle = { animation: 'spin 10s linear infinite' };
  }

  return (
    <div className="relative" style={{ width: size, height: size }}>
      {/* Spinning dashed ring — speed reflects wind speed */}
      <div
        className="absolute inset-0 rounded-full"
        style={{
          border: '2px dashed rgba(0,255,255,0.5)',
          ...spinStyle,
        }}
      />

      {/* Static compass body */}
      <div className="absolute inset-1 rounded-full border border-cyan-800 bg-black/40">
        {/* Cardinal markers */}
        <span
          className="absolute top-0 left-1/2 -translate-x-1/2 text-cyan-400 font-bold leading-none"
          style={{ fontSize }}
        >N</span>
        <span
          className="absolute bottom-0 left-1/2 -translate-x-1/2 text-cyan-800 leading-none"
          style={{ fontSize: fontSize * 0.85 }}
        >S</span>
        <span
          className="absolute left-0 top-1/2 -translate-y-1/2 text-cyan-800 leading-none"
          style={{ fontSize: fontSize * 0.85 }}
        >W</span>
        <span
          className="absolute right-0 top-1/2 -translate-y-1/2 text-cyan-800 leading-none"
          style={{ fontSize: fontSize * 0.85 }}
        >E</span>

        {/* Rotating arrow — smoothly transitions to new direction */}
        <div
          className="absolute inset-0 flex items-center justify-center"
          style={{
            transform: `rotate(${degrees}deg)`,
            transition: 'transform 1.5s ease-in-out',
          }}
        >
          <Navigation2
            size={size * 0.45}
            className="text-cyan-400 fill-cyan-400"
            style={{ filter: 'drop-shadow(0 0 3px cyan)' }}
          />
        </div>
      </div>
    </div>
  );
};

export default WindCompass;
