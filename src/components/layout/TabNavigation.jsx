import React from 'react';
import { SCREENS, DARK_BLUE, BRIGHT_CYAN, MID_BLUE } from '../../utils/constants';

const TabNavigation = ({ currentTab, setTab, alerts = [] }) => {

  const tabs = [
    { id: SCREENS.CONDITIONS,   name: 'CURRENT'   },
    { id: SCREENS.HOURLY,       name: 'HOURLY'    },
    { id: SCREENS.DAILY,        name: '7-DAY'     },
    { id: SCREENS.RADAR,        name: 'RADAR'     },
    { id: SCREENS.ALERTS,       name: 'ALERTS'    },
    { id: SCREENS.TRIP_WEATHER, name: 'TRIP'      },
    { id: SCREENS.ALMANAC,      name: 'RECORDS'   },
    { id: SCREENS.MODELS,       name: 'MODELS'    },
    { id: SCREENS.SPC,          name: 'SEVERE'    },
    { id: SCREENS.HURRICANE,    name: 'HURRICANE' },
  ];

  const renderTab = (tab) => {
    const hasAlertBadge = tab.id === SCREENS.ALERTS && alerts.length > 0;
    return (
      <button
        key={tab.id}
        onClick={() => setTab(tab.id)}
        className={`relative inline-block md:block w-full py-2 md:py-4 px-3 md:px-4 text-xl md:text-3xl font-vt323 transition-all text-left rounded-lg border-2 text-white snap-start
          ${currentTab === tab.id
            ? 'font-bold shadow-inner-neon'
            : 'border-cyan-800 hover:border-cyan-500 hover:bg-white/10'
          }`}
        style={currentTab === tab.id ? { borderColor: BRIGHT_CYAN, backgroundColor: MID_BLUE } : {}}
      >
        {tab.name}
        {hasAlertBadge && (
          <span className="absolute top-1 right-1 md:top-2 md:right-2 min-w-[18px] h-[18px] bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center px-1 animate-pulse">
            {alerts.length}
          </span>
        )}
      </button>
    );
  };

  return (
    <div
      className="md:w-72 shrink-0 md:border-r-4 border-b-4 md:border-b-0 shadow-neon-md p-2"
      style={{ backgroundColor: DARK_BLUE, borderColor: BRIGHT_CYAN }}
    >
      <div className="flex md:flex-col overflow-x-auto md:overflow-y-auto whitespace-nowrap md:whitespace-normal h-full gap-1.5 md:gap-2 snap-x snap-mandatory md:snap-none [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
        {tabs.map(renderTab)}
      </div>
    </div>
  );
};

export default TabNavigation;
