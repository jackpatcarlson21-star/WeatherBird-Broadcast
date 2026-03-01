import React from 'react';
import { X, Settings } from 'lucide-react';
import { BRIGHT_CYAN } from '../../utils/constants';

const SettingsModal = ({ units, onUnitsChange, onClose }) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
      <div
        className="bg-gradient-to-b from-gray-900 to-black border-2 rounded-xl p-6 max-w-sm w-full shadow-2xl"
        style={{ borderColor: BRIGHT_CYAN }}
      >
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold font-vt323 flex items-center gap-2" style={{ color: BRIGHT_CYAN }}>
            <Settings size={22} /> SETTINGS
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition">
            <X size={24} />
          </button>
        </div>

        {/* Temperature Units */}
        <div className="mb-5">
          <p className="text-cyan-400 text-sm tracking-widest mb-2 font-vt323">TEMPERATURE</p>
          <div className="flex gap-2">
            {['F', 'C'].map(unit => (
              <button
                key={unit}
                onClick={() => onUnitsChange({ ...units, temp: unit })}
                className={`flex-1 py-2 rounded border-2 font-bold text-xl font-vt323 transition-all ${
                  units.temp === unit
                    ? 'text-black'
                    : 'border-cyan-800 text-cyan-500 hover:border-cyan-500 hover:text-cyan-300'
                }`}
                style={units.temp === unit ? { borderColor: BRIGHT_CYAN, backgroundColor: BRIGHT_CYAN, color: '#000' } : {}}
              >
                °{unit}
              </button>
            ))}
          </div>
        </div>

        {/* Wind Speed Units */}
        <div className="mb-6">
          <p className="text-cyan-400 text-sm tracking-widest mb-2 font-vt323">WIND SPEED</p>
          <div className="flex gap-2">
            {[['mph', 'MPH'], ['kmh', 'KM/H']].map(([val, label]) => (
              <button
                key={val}
                onClick={() => onUnitsChange({ ...units, wind: val })}
                className={`flex-1 py-2 rounded border-2 font-bold text-xl font-vt323 transition-all ${
                  units.wind === val
                    ? 'text-black'
                    : 'border-cyan-800 text-cyan-500 hover:border-cyan-500 hover:text-cyan-300'
                }`}
                style={units.wind === val ? { borderColor: BRIGHT_CYAN, backgroundColor: BRIGHT_CYAN, color: '#000' } : {}}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <button
          onClick={onClose}
          className="w-full py-2 rounded border-2 text-xl font-bold font-vt323 transition-all border-cyan-700 text-cyan-400 hover:border-cyan-400 hover:text-white"
        >
          CLOSE
        </button>
      </div>
    </div>
  );
};

export default SettingsModal;
