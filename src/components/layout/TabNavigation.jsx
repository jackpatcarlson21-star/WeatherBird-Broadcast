import React from 'react';
import { SCREENS, DARK_BLUE, BRIGHT_CYAN, MID_BLUE } from '../../utils/constants';

const TabNavigation = ({ currentTab, setTab }) => {
  const tabs = [
    { id: SCREENS.CONDITIONS, name: 'CURRENT' },
    { id: SCREENS.HOURLY, name: '12HR' },
    { id: SCREENS.DAILY, name: '7-DAY' },
    { id: SCREENS.RADAR, name: 'RADAR' },
    { id: SCREENS.PRECIP, name: 'PRECIP' },
    { id: SCREENS.ALERTS, name: 'ALERTS' },
    { id: SCREENS.WWA, name: 'WWA MAP' },
    { id: SCREENS.SPC, name: 'SPC' },
    { id: SCREENS.TRIP_WEATHER, name: 'TRIP' },
    { id: SCREENS.ALMANAC, name: 'ALMANAC' },
    { id: SCREENS.HURRICANE, name: 'HURRICANE' },
    { id: SCREENS.MODELS, name: 'MODELS' },
  ];

  return (
    <div
      className="md:w-72 shrink-0 md:border-r-4 border-b-4 md:border-b-0 shadow-neon-md p-2"
      style={{ backgroundColor: DARK_BLUE, borderColor: BRIGHT_CYAN }}
    >
      <div className="flex md:flex-col overflow-x-auto md:overflow-y-auto whitespace-nowrap md:whitespace-normal h-full gap-1.5 md:gap-2 snap-x snap-mandatory md:snap-none [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setTab(tab.id)}
            className={`inline-block md:block w-full py-2 md:py-4 px-3 md:px-4 text-xl md:text-3xl font-vt323 transition-all text-left rounded-lg border-2 text-white snap-start
              ${currentTab === tab.id
                ? 'font-bold shadow-inner-neon'
                : 'border-cyan-800 hover:border-cyan-500 hover:bg-white/10'
              }`}
            style={currentTab === tab.id ? { borderColor: BRIGHT_CYAN, backgroundColor: MID_BLUE } : {}}
          >
            {tab.name}
          </button>
        ))}
      </div>
    </div>
  );
};

export default TabNavigation;
