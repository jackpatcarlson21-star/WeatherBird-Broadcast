import React from 'react';

const LoadingIndicator = () => (
  <div className="flex items-center justify-center py-20">
    <div className="flex flex-col items-center gap-3">
      <div className="w-10 h-10 border-2 border-white/20 border-t-white rounded-full animate-spin" />
      <span className="text-white/50 text-sm">Loading...</span>
    </div>
  </div>
);

export default LoadingIndicator;
