import React from 'react';
import { DARK_BLUE, NAVY_BLUE, BRIGHT_CYAN } from '../../utils/constants';

const TabPanel = ({ title, children }) => (
  <div
    className="flex-grow p-4 sm:p-6 rounded-xl shadow-neon-md min-h-[400px] overflow-auto"
    style={{ border: `4px solid ${BRIGHT_CYAN}`, background: `linear-gradient(to bottom right, ${DARK_BLUE}, ${NAVY_BLUE})` }}
  >
    <h2 className="text-3xl text-white font-bold mb-4 border-b border-cyan-700 pb-2">{title}</h2>
    {children}
  </div>
);

export default TabPanel;
