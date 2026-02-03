import React from 'react';
import { Zap } from 'lucide-react';
import { BRIGHT_CYAN } from '../../utils/constants';

const LoadingIndicator = () => (
  <div className="flex items-center justify-center h-full min-h-[300px] text-center">
    <div className="animate-pulse">
      <Zap size={48} className="mx-auto mb-2" style={{ color: BRIGHT_CYAN }} />
      <span className="text-2xl text-cyan-400 font-vt323">ACCESSING DATA STREAM...</span>
    </div>
  </div>
);

export default LoadingIndicator;
