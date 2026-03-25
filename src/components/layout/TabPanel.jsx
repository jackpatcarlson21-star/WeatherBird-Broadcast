import React from 'react';

const TabPanel = ({ title, children }) => (
  <div className="flex-grow p-4 sm:p-6 rounded-2xl sm:min-h-[400px] bg-white/10 backdrop-blur-md border border-white/10">
    <h2 className="text-2xl font-semibold text-white mb-4 pb-3 border-b border-white/10">{title}</h2>
    {children}
  </div>
);

export default TabPanel;
