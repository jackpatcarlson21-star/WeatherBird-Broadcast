import React from 'react';
import { Navigation } from 'lucide-react';

const WindCompass = ({ degrees, size = 48 }) => {
  const rotation = degrees;

  return (
    <div
      className="relative rounded-full border-2 border-cyan-600 bg-black/40"
      style={{ width: size, height: size }}
    >
      {/* Cardinal direction markers */}
      <span className="absolute top-0.5 left-1/2 -translate-x-1/2 text-xs text-cyan-500 font-bold">N</span>
      <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 text-xs text-cyan-700">S</span>
      <span className="absolute left-1 top-1/2 -translate-y-1/2 text-xs text-cyan-700">W</span>
      <span className="absolute right-1 top-1/2 -translate-y-1/2 text-xs text-cyan-700">E</span>

      {/* Arrow */}
      <div
        className="absolute inset-0 flex items-center justify-center transition-transform duration-300"
        style={{ transform: `rotate(${rotation}deg)` }}
      >
        <Navigation
          size={size * 0.5}
          className="text-cyan-400 fill-cyan-400"
          style={{ transform: 'rotate(0deg)' }}
        />
      </div>
    </div>
  );
};

export default WindCompass;
