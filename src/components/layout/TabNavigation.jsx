import React, { useEffect, useRef, useState } from 'react';
import { SCREENS, NAV_TABS, DARK_BLUE, BRIGHT_CYAN, MID_BLUE } from '../../utils/constants';
import { getSevereAlertLevel } from '../../utils/helpers';

// Tabs where an active watch/warning should bleed into the nav itself, so
// urgency is visible without having to open the tab.
const SEVERITY_AWARE_TABS = new Set([SCREENS.ALERTS, SCREENS.SPC]);
const SEVERITY_COLOR = { warning: '#EF4444', watch: '#F97316' };

const TabNavigation = ({ currentTab, setTab, alerts = [] }) => {
  const severity = getSevereAlertLevel(alerts);
  const severityColor = severity ? SEVERITY_COLOR[severity] : null;

  // Shows a fade at the bottom of the (scrollbar-hidden) tab list whenever
  // there are more tabs below the fold, so the list doesn't look clipped.
  const listRef = useRef(null);
  const [canScrollDown, setCanScrollDown] = useState(false);

  useEffect(() => {
    const el = listRef.current;
    if (!el) return;

    const updateFade = () => {
      setCanScrollDown(el.scrollHeight - el.scrollTop - el.clientHeight > 1);
    };

    updateFade();
    el.addEventListener('scroll', updateFade);
    const observer = new ResizeObserver(updateFade);
    observer.observe(el);

    return () => {
      el.removeEventListener('scroll', updateFade);
      observer.disconnect();
    };
  }, []);

  const renderTab = (tab) => {
    const hasAlertBadge = tab.id === SCREENS.ALERTS && alerts.length > 0;
    const isUrgent = severityColor && SEVERITY_AWARE_TABS.has(tab.id);
    const isCurrent = currentTab === tab.id;

    return (
      <button
        key={tab.id}
        onClick={() => setTab(tab.id)}
        className={`relative inline-block md:block w-full py-2 md:py-4 px-3 md:px-4 text-xl md:text-3xl font-vt323 transition-all text-left rounded-lg border-2 text-white snap-start
          ${isCurrent
            ? 'font-bold shadow-inner-neon'
            : isUrgent
              ? 'alert-glow-border hover:bg-white/10'
              : 'border-cyan-800 hover:border-cyan-500 hover:bg-white/10'
          }`}
        style={
          isCurrent
            ? { borderColor: isUrgent ? severityColor : BRIGHT_CYAN, backgroundColor: MID_BLUE }
            : isUrgent
              ? { borderColor: severityColor }
              : {}
        }
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
      className="md:w-72 shrink-0 md:border-r-4 border-b-4 md:border-b-0 shadow-neon-md p-2 relative"
      style={{ backgroundColor: DARK_BLUE, borderColor: BRIGHT_CYAN }}
    >
      <div
        ref={listRef}
        className="flex md:flex-col overflow-x-auto md:overflow-y-auto whitespace-nowrap md:whitespace-normal h-full gap-1.5 md:gap-2 snap-x snap-mandatory md:snap-none [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]"
      >
        {NAV_TABS.map(renderTab)}
      </div>
      {canScrollDown && (
        <div
          className="hidden md:block absolute bottom-2 left-2 right-2 h-10 pointer-events-none rounded-b-lg"
          style={{ background: `linear-gradient(to top, ${DARK_BLUE}, transparent)` }}
        />
      )}
    </div>
  );
};

export default TabNavigation;
