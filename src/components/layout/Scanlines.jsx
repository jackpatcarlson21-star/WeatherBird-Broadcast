import React from 'react';

const Scanlines = () => (
  <div className="pointer-events-none absolute inset-0 z-50 opacity-30">
    <div className="absolute inset-0 bg-gradient-to-b from-transparent via-cyan-900/10 to-transparent" />
    <div className="absolute inset-0 bg-[linear-gradient(transparent_50%,rgba(0,0,0,0.1)_50%)] bg-[length:100%_8px]" />
  </div>
);

export default Scanlines;
