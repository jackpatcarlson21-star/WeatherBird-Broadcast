import React from 'react';
import { AlertTriangle, MapPin } from 'lucide-react';
import { NAVY_BLUE, BRIGHT_CYAN } from '../../utils/constants';

const AppStatus = ({ isLoading, error, isReady, isAutoDetecting }) => {
  if (error) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-red-900/80 p-4 font-vt323">
        <div className="border-4 border-red-500 rounded-xl p-8 max-w-lg text-center" style={{ backgroundColor: NAVY_BLUE }}>
          <AlertTriangle size={40} className="text-red-400 mx-auto mb-4" />
          <h2 className="text-3xl text-white font-bold mb-3">SYSTEM ERROR</h2>
          <p className="text-red-300 text-lg">{error}</p>
          <p className="text-sm text-gray-400 mt-4">Check console for details and refresh.</p>
        </div>
      </div>
    );
  }
  if (isAutoDetecting) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 p-4 font-vt323">
        <div className="text-center animate-pulse">
          <MapPin size={48} className="mx-auto mb-4" style={{ color: BRIGHT_CYAN }} />
          <h2 className="text-4xl font-bold tracking-widest" style={{ color: BRIGHT_CYAN }}>DETECTING YOUR LOCATION...</h2>
          <p className="text-xl text-cyan-400 mt-2">PLEASE ALLOW LOCATION ACCESS</p>
        </div>
      </div>
    );
  }
  if (!isReady || isLoading) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 p-4 font-vt323">
        <div className="text-center animate-pulse">
          <h2 className="text-4xl font-bold tracking-widest" style={{ color: BRIGHT_CYAN }}>INITIALIZING WEATHERBIRD...</h2>
          <p className="text-xl text-cyan-400 mt-2">STAND BY</p>
        </div>
      </div>
    );
  }
  return null;
};

export default AppStatus;
