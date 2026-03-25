import React, { useState } from 'react';
import { Home, Radio, AlertTriangle, Calendar, MoreHorizontal, Clock, CloudRain, Wind, Map, Compass, Umbrella } from 'lucide-react';
import { SCREENS } from '../../utils/constants';

const NAV_ITEMS = [
  { id: SCREENS.CONDITIONS, icon: Home,          label: 'Today'  },
  { id: SCREENS.HOURLY,     icon: Clock,         label: 'Hourly' },
  { id: SCREENS.RADAR,      icon: Radio,         label: 'Radar'  },
  { id: SCREENS.ALERTS,     icon: AlertTriangle, label: 'Alerts' },
  { id: 'more',             icon: MoreHorizontal,label: 'More'   },
];

const MORE_ITEMS = [
  { id: SCREENS.DAILY,        icon: Calendar,  label: '7-Day'    },
  { id: SCREENS.SPC,          icon: Wind,      label: 'Severe'   },
  { id: SCREENS.ALMANAC,      icon: Compass,   label: 'Almanac'  },
  { id: SCREENS.MODELS,       icon: Map,       label: 'Models'   },
  { id: SCREENS.HURRICANE,    icon: CloudRain, label: 'Hurricane'},
  { id: SCREENS.TRIP_WEATHER, icon: Umbrella,  label: 'Trip'     },
];

const ModernBottomNav = ({ currentScreen, setScreen, alerts = [] }) => {
  const [showMore, setShowMore] = useState(false);
  const activeAlerts = alerts.length;

  const handleNav = (id) => {
    if (id === 'more') { setShowMore(s => !s); return; }
    setShowMore(false);
    setScreen(id);
  };

  const isMoreActive = MORE_ITEMS.some(i => i.id === currentScreen);

  return (
    <>
      {/* More menu */}
      {showMore && (
        <div className="fixed bottom-16 left-0 right-0 z-50 mx-4 mb-2">
          <div className="bg-black/70 backdrop-blur-xl rounded-2xl border border-white/10 p-3 grid grid-cols-3 gap-2">
            {MORE_ITEMS.map(item => (
              <button
                key={item.id}
                onClick={() => handleNav(item.id)}
                className={`flex flex-col items-center gap-1 py-3 rounded-xl transition-all ${
                  currentScreen === item.id ? 'bg-white/20 text-white' : 'text-white/60 hover:bg-white/10 hover:text-white'
                }`}
              >
                <item.icon size={20} />
                <span className="text-xs">{item.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Nav bar */}
      <div className="fixed bottom-0 left-0 right-0 z-50 bg-black/40 backdrop-blur-xl border-t border-white/10">
        <div className="flex justify-around items-center py-2 px-2 max-w-lg mx-auto">
          {NAV_ITEMS.map(item => {
            const isActive = item.id === 'more' ? isMoreActive || showMore : currentScreen === item.id;
            return (
              <button
                key={item.id}
                onClick={() => handleNav(item.id)}
                className={`relative flex flex-col items-center gap-0.5 px-4 py-2 rounded-xl transition-all ${
                  isActive ? 'text-white' : 'text-white/50 hover:text-white/80'
                }`}
              >
                {isActive && (
                  <span className="absolute inset-0 rounded-xl bg-white/15" />
                )}
                <item.icon size={22} />
                <span className="text-xs">{item.label}</span>
                {item.id === SCREENS.ALERTS && activeAlerts > 0 && (
                  <span className="absolute top-1 right-2 min-w-[16px] h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1">
                    {activeAlerts}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </>
  );
};

export default ModernBottomNav;
