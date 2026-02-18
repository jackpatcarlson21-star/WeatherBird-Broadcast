import React, { useState } from 'react';
import {
  Thermometer, Clock, Calendar, Radio, AlertTriangle,
  Droplets, LayoutDashboard, Map, CloudLightning,
  Navigation, BookOpen, Wind, Grid3X3, X,
} from 'lucide-react';
import { SCREENS, DARK_BLUE, BRIGHT_CYAN, MID_BLUE } from '../../utils/constants';

const PRIMARY_TABS = [
  { id: SCREENS.CONDITIONS, name: 'CURRENT', Icon: Thermometer },
  { id: SCREENS.HOURLY, name: '12HR', Icon: Clock },
  { id: SCREENS.DAILY, name: '7-DAY', Icon: Calendar },
  { id: SCREENS.RADAR, name: 'RADAR', Icon: Radio },
  { id: SCREENS.ALERTS, name: 'ALERTS', Icon: AlertTriangle },
];

const SECONDARY_TABS = [
  { id: SCREENS.PRECIP, name: 'PRECIP', Icon: Droplets },
  { id: SCREENS.DASHBOARD, name: 'DASH', Icon: LayoutDashboard },
  { id: SCREENS.WWA, name: 'WWA MAP', Icon: Map },
  { id: SCREENS.SPC, name: 'SPC', Icon: CloudLightning },
  { id: SCREENS.TRIP_WEATHER, name: 'TRIP', Icon: Navigation },
  { id: SCREENS.ALMANAC, name: 'ALMANAC', Icon: BookOpen },
  { id: SCREENS.HURRICANE, name: 'HURRICANE', Icon: Wind },
];

const MobileBottomNav = ({ currentTab, setTab, alertCount = 0 }) => {
  const [moreOpen, setMoreOpen] = useState(false);

  const handleTabSelect = (tabId) => {
    setTab(tabId);
    setMoreOpen(false);
  };

  const isSecondaryActive = SECONDARY_TABS.some(t => t.id === currentTab);

  return (
    <>
      {/* MORE drawer overlay */}
      {moreOpen && (
        <>
          <div
            className="fixed inset-0 bg-black/60 z-40 md:hidden"
            onClick={() => setMoreOpen(false)}
          />
          <div
            className="fixed bottom-16 left-0 right-0 z-50 md:hidden rounded-t-2xl p-4 pb-2 more-drawer-enter"
            style={{
              backgroundColor: DARK_BLUE,
              borderTop: `3px solid ${BRIGHT_CYAN}`,
              borderLeft: `3px solid ${BRIGHT_CYAN}`,
              borderRight: `3px solid ${BRIGHT_CYAN}`,
              boxShadow: '0 -4px 20px 5px rgba(0, 255, 255, 0.2)',
            }}
          >
            <div className="flex justify-between items-center mb-3">
              <span className="text-cyan-400 font-vt323 text-xl tracking-wider">MORE TABS</span>
              <button
                onClick={() => setMoreOpen(false)}
                className="p-2 min-w-[44px] min-h-[44px] flex items-center justify-center text-cyan-400 hover:text-white transition rounded-lg"
              >
                <X size={22} />
              </button>
            </div>
            <div className="grid grid-cols-3 gap-3 pb-2">
              {SECONDARY_TABS.map(({ id, name, Icon }) => (
                <button
                  key={id}
                  onClick={() => handleTabSelect(id)}
                  className="flex flex-col items-center justify-center p-3 min-h-[64px] rounded-lg border-2 font-vt323 text-sm transition-all"
                  style={
                    currentTab === id
                      ? { borderColor: BRIGHT_CYAN, backgroundColor: MID_BLUE, color: BRIGHT_CYAN }
                      : { borderColor: 'rgba(0, 255, 255, 0.25)', color: '#67e8f9' }
                  }
                >
                  <Icon size={24} />
                  <span className="mt-1">{name}</span>
                </button>
              ))}
            </div>
          </div>
        </>
      )}

      {/* Bottom navigation bar */}
      <nav
        className="md:hidden fixed bottom-0 left-0 right-0 z-50 grid grid-cols-6 h-16"
        style={{
          backgroundColor: DARK_BLUE,
          borderTop: `3px solid ${BRIGHT_CYAN}`,
          boxShadow: '0 -2px 10px 2px rgba(0, 255, 255, 0.3)',
          paddingBottom: 'env(safe-area-inset-bottom)',
        }}
      >
        {PRIMARY_TABS.map(({ id, name, Icon }) => {
          const isActive = currentTab === id;
          return (
            <button
              key={id}
              onClick={() => handleTabSelect(id)}
              className="relative flex flex-col items-center justify-center min-h-[44px] transition-colors font-vt323"
              style={{ color: isActive ? BRIGHT_CYAN : '#4b7a8a' }}
            >
              {isActive && (
                <div
                  className="absolute top-0 left-1/2 -translate-x-1/2 h-[3px] w-8 rounded-b"
                  style={{ backgroundColor: BRIGHT_CYAN, boxShadow: `0 0 8px ${BRIGHT_CYAN}` }}
                />
              )}
              <Icon size={22} />
              <span className="text-[10px] mt-0.5">{name}</span>
              {/* Alert badge */}
              {id === SCREENS.ALERTS && alertCount > 0 && (
                <span className="absolute top-1 right-1/2 translate-x-3 w-4 h-4 bg-red-500 rounded-full text-[9px] flex items-center justify-center text-white font-bold alert-badge-pulse">
                  {alertCount > 9 ? '!' : alertCount}
                </span>
              )}
            </button>
          );
        })}

        {/* MORE button */}
        <button
          onClick={() => setMoreOpen(!moreOpen)}
          className="relative flex flex-col items-center justify-center min-h-[44px] transition-colors font-vt323"
          style={{ color: moreOpen || isSecondaryActive ? BRIGHT_CYAN : '#4b7a8a' }}
        >
          {isSecondaryActive && !moreOpen && (
            <div
              className="absolute top-0 left-1/2 -translate-x-1/2 h-[3px] w-8 rounded-b"
              style={{ backgroundColor: BRIGHT_CYAN, boxShadow: `0 0 8px ${BRIGHT_CYAN}` }}
            />
          )}
          <Grid3X3 size={22} />
          <span className="text-[10px] mt-0.5">MORE</span>
        </button>
      </nav>
    </>
  );
};

export default MobileBottomNav;
