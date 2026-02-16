import React, { useEffect, memo } from 'react';
import { getWeatherDescription } from '../../utils/helpers';

// --- Color Constants (declared before use) ---
const CLOUD_DAY = '#D1D5DB';
const CLOUD_NIGHT = '#8B95A3';
const FOG_DAY = '#D1D5DB';
const FOG_NIGHT = '#8B95A3';
const THUNDER_DAY = '#9CA3AF';
const THUNDER_NIGHT = '#6B7280';

// --- Inject CSS keyframes once into <head> ---
const STYLE_ID = 'wx-icon-styles';
const injectStyles = () => {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    @keyframes wx-glow {
      0%, 100% { filter: drop-shadow(0 0 2px #FACC15); }
      50% { filter: drop-shadow(0 0 6px #FACC15); }
    }
    @keyframes wx-moon-glow {
      0%, 100% { filter: drop-shadow(0 0 2px #C4B5FD); }
      50% { filter: drop-shadow(0 0 5px #C4B5FD); }
    }
    @keyframes wx-drift {
      0%, 100% { transform: translateX(0); }
      50% { transform: translateX(2px); }
    }
    @keyframes wx-fog-fade {
      0%, 100% { opacity: 0.9; transform: translateX(0); }
      33% { opacity: 0.4; transform: translateX(1px); }
      66% { opacity: 0.7; transform: translateX(-1px); }
    }
    @keyframes wx-fog-fade2 {
      0%, 100% { opacity: 0.7; transform: translateX(0); }
      33% { opacity: 0.3; transform: translateX(-1px); }
      66% { opacity: 0.9; transform: translateX(1px); }
    }
    @keyframes wx-drop-slow {
      0% { transform: translateY(0); opacity: 1; }
      80% { opacity: 1; }
      100% { transform: translateY(6px); opacity: 0; }
    }
    @keyframes wx-drop-fast {
      0% { transform: translateY(0); opacity: 1; }
      70% { opacity: 1; }
      100% { transform: translateY(8px); opacity: 0; }
    }
    @keyframes wx-snow-drift {
      0% { transform: translate(0, 0); opacity: 1; }
      50% { transform: translate(1px, 3px); opacity: 0.8; }
      100% { transform: translate(-1px, 6px); opacity: 0; }
    }
    @keyframes wx-flash {
      0%, 100% { opacity: 1; }
      10% { opacity: 0.2; }
      20% { opacity: 1; }
      30% { opacity: 0.3; }
      40% { opacity: 1; }
    }
    @keyframes wx-star-twinkle {
      0%, 100% { opacity: 0.9; }
      50% { opacity: 0.3; }
    }
    @keyframes wx-star-twinkle2 {
      0%, 100% { opacity: 0.4; }
      50% { opacity: 1; }
    }
  `;
  document.head.appendChild(style);
};

// --- Pixel Art Icon Builders ---
// All icons use a 32x32 viewBox with 2px grid rects

const Sun = () => (
  <g style={{ animation: 'wx-glow 3s ease-in-out infinite' }}>
    {/* Rays */}
    <rect x="14" y="2" width="4" height="2" fill="#FFA500" />
    <rect x="14" y="28" width="4" height="2" fill="#FFA500" />
    <rect x="2" y="14" width="2" height="4" fill="#FFA500" />
    <rect x="28" y="14" width="2" height="4" fill="#FFA500" />
    <rect x="6" y="6" width="2" height="2" fill="#FFA500" />
    <rect x="24" y="6" width="2" height="2" fill="#FFA500" />
    <rect x="6" y="24" width="2" height="2" fill="#FFA500" />
    <rect x="24" y="24" width="2" height="2" fill="#FFA500" />
    {/* Core */}
    <rect x="12" y="8" width="8" height="2" fill="#FACC15" />
    <rect x="10" y="10" width="12" height="2" fill="#FACC15" />
    <rect x="8" y="12" width="16" height="2" fill="#FACC15" />
    <rect x="8" y="14" width="16" height="2" fill="#FACC15" />
    <rect x="8" y="16" width="16" height="2" fill="#FACC15" />
    <rect x="8" y="18" width="16" height="2" fill="#FACC15" />
    <rect x="10" y="20" width="12" height="2" fill="#FACC15" />
    <rect x="12" y="22" width="8" height="2" fill="#FACC15" />
  </g>
);

const Moon = () => (
  <g style={{ animation: 'wx-moon-glow 4s ease-in-out infinite' }}>
    {/* Crescent */}
    <rect x="14" y="4" width="8" height="2" fill="#C4B5FD" />
    <rect x="12" y="6" width="8" height="2" fill="#C4B5FD" />
    <rect x="10" y="8" width="8" height="2" fill="#C4B5FD" />
    <rect x="10" y="10" width="6" height="2" fill="#C4B5FD" />
    <rect x="10" y="12" width="6" height="2" fill="#C4B5FD" />
    <rect x="10" y="14" width="6" height="2" fill="#C4B5FD" />
    <rect x="10" y="16" width="6" height="2" fill="#C4B5FD" />
    <rect x="10" y="18" width="8" height="2" fill="#C4B5FD" />
    <rect x="12" y="20" width="8" height="2" fill="#C4B5FD" />
    <rect x="14" y="22" width="8" height="2" fill="#C4B5FD" />
    {/* Stars */}
    <rect x="4" y="6" width="2" height="2" fill="#FFF" style={{ animation: 'wx-star-twinkle 2s ease-in-out infinite' }} />
    <rect x="26" y="16" width="2" height="2" fill="#FFF" style={{ animation: 'wx-star-twinkle2 2.5s ease-in-out infinite' }} />
    <rect x="6" y="22" width="2" height="2" fill="#FFF" style={{ animation: 'wx-star-twinkle 3s ease-in-out infinite' }} />
  </g>
);

// Shared cloud shape with bumps on top for pixel character
const Cloud = ({ x = 0, y = 0, color = CLOUD_DAY, animate = false }) => (
  <g transform={`translate(${x},${y})`} style={animate ? { animation: 'wx-drift 4s ease-in-out infinite' } : undefined}>
    {/* Top bumps */}
    <rect x="6" y="2" width="4" height="2" fill={color} />
    <rect x="14" y="2" width="6" height="2" fill={color} />
    {/* Upper body */}
    <rect x="4" y="4" width="8" height="2" fill={color} />
    <rect x="12" y="4" width="10" height="2" fill={color} />
    {/* Main body */}
    <rect x="2" y="6" width="24" height="2" fill={color} />
    <rect x="2" y="8" width="26" height="2" fill={color} />
    <rect x="4" y="10" width="22" height="2" fill={color} />
    <rect x="6" y="12" width="18" height="2" fill={color} />
  </g>
);

const SmallSun = ({ x = 0, y = 0 }) => (
  <g transform={`translate(${x},${y})`}>
    {/* Tiny rays */}
    <rect x="4" y="0" width="2" height="2" fill="#FFA500" />
    <rect x="0" y="4" width="2" height="2" fill="#FFA500" />
    <rect x="8" y="4" width="2" height="2" fill="#FFA500" />
    {/* Core */}
    <rect x="2" y="2" width="6" height="2" fill="#FACC15" />
    <rect x="2" y="4" width="6" height="2" fill="#FACC15" />
    <rect x="2" y="6" width="6" height="2" fill="#FACC15" />
  </g>
);

const SmallMoon = ({ x = 0, y = 0 }) => (
  <g transform={`translate(${x},${y})`}>
    <rect x="2" y="0" width="4" height="2" fill="#C4B5FD" />
    <rect x="0" y="2" width="4" height="2" fill="#C4B5FD" />
    <rect x="0" y="4" width="4" height="2" fill="#C4B5FD" />
    <rect x="2" y="6" width="4" height="2" fill="#C4B5FD" />
    {/* Star */}
    <rect x="8" y="2" width="2" height="2" fill="#FFF" style={{ animation: 'wx-star-twinkle 2s ease-in-out infinite' }} />
  </g>
);

// --- Composite Icons ---

const CloudSunIcon = () => (
  <g>
    <SmallSun x={18} y={2} />
    <Cloud x={-2} y={6} animate />
  </g>
);

const CloudMoonIcon = () => (
  <g>
    <SmallMoon x={20} y={2} />
    <Cloud x={-2} y={6} color="#B0B8C4" animate />
  </g>
);

const CloudIcon = ({ night }) => (
  <Cloud x={0} y={6} color={night ? CLOUD_NIGHT : CLOUD_DAY} animate />
);

const FogIcon = ({ night }) => {
  const c = night ? FOG_NIGHT : FOG_DAY;
  return (
    <g>
      <rect x="4" y="6" width="24" height="2" fill={c} style={{ animation: 'wx-fog-fade 4s ease-in-out infinite' }} />
      <rect x="2" y="10" width="20" height="2" fill={c} style={{ animation: 'wx-fog-fade2 4.5s ease-in-out infinite' }} />
      <rect x="6" y="14" width="22" height="2" fill={c} style={{ animation: 'wx-fog-fade 5s ease-in-out infinite' }} />
      <rect x="4" y="18" width="18" height="2" fill={c} style={{ animation: 'wx-fog-fade2 3.5s ease-in-out infinite' }} />
      <rect x="8" y="22" width="20" height="2" fill={c} style={{ animation: 'wx-fog-fade 4.2s ease-in-out infinite' }} />
    </g>
  );
};

const DrizzleIcon = ({ night }) => (
  <g>
    <Cloud x={0} y={0} color={night ? CLOUD_NIGHT : CLOUD_DAY} />
    {/* 2 small drops */}
    <rect x="10" y="16" width="2" height="4" fill="#60A5FA" style={{ animation: 'wx-drop-slow 2s ease-in infinite' }} />
    <rect x="18" y="18" width="2" height="4" fill="#60A5FA" style={{ animation: 'wx-drop-slow 2s ease-in 0.7s infinite' }} />
  </g>
);

// Freezing drizzle: icy cyan drops instead of blue
const FreezingDrizzleIcon = ({ night }) => (
  <g>
    <Cloud x={0} y={0} color={night ? CLOUD_NIGHT : CLOUD_DAY} />
    <rect x="10" y="16" width="2" height="4" fill="#00FFFF" style={{ animation: 'wx-drop-slow 2s ease-in infinite' }} />
    <rect x="18" y="18" width="2" height="4" fill="#00FFFF" style={{ animation: 'wx-drop-slow 2s ease-in 0.7s infinite' }} />
  </g>
);

const RainIcon = ({ night }) => (
  <g>
    <Cloud x={0} y={0} color={night ? CLOUD_NIGHT : CLOUD_DAY} />
    {/* 3 drops */}
    <rect x="8" y="16" width="2" height="4" fill="#60A5FA" style={{ animation: 'wx-drop-fast 1.2s ease-in infinite' }} />
    <rect x="14" y="16" width="2" height="4" fill="#60A5FA" style={{ animation: 'wx-drop-fast 1.2s ease-in 0.3s infinite' }} />
    <rect x="20" y="16" width="2" height="4" fill="#60A5FA" style={{ animation: 'wx-drop-fast 1.2s ease-in 0.6s infinite' }} />
  </g>
);

// Freezing rain: icy cyan drops instead of blue
const FreezingRainIcon = ({ night }) => (
  <g>
    <Cloud x={0} y={0} color={night ? CLOUD_NIGHT : CLOUD_DAY} />
    <rect x="8" y="16" width="2" height="4" fill="#00FFFF" style={{ animation: 'wx-drop-fast 1.2s ease-in infinite' }} />
    <rect x="14" y="16" width="2" height="4" fill="#00FFFF" style={{ animation: 'wx-drop-fast 1.2s ease-in 0.3s infinite' }} />
    <rect x="20" y="16" width="2" height="4" fill="#00FFFF" style={{ animation: 'wx-drop-fast 1.2s ease-in 0.6s infinite' }} />
  </g>
);

const SnowIcon = ({ night }) => (
  <g>
    <Cloud x={0} y={0} color={night ? CLOUD_NIGHT : CLOUD_DAY} />
    {/* 3 plus-shaped flakes */}
    <g style={{ animation: 'wx-snow-drift 3s ease-in-out infinite' }}>
      <rect x="8" y="18" width="2" height="2" fill="#FFF" />
      <rect x="6" y="20" width="2" height="2" fill="#FFF" />
      <rect x="10" y="20" width="2" height="2" fill="#FFF" />
      <rect x="8" y="22" width="2" height="2" fill="#FFF" />
    </g>
    <g style={{ animation: 'wx-snow-drift 3s ease-in-out 0.8s infinite' }}>
      <rect x="16" y="16" width="2" height="2" fill="#FFF" />
      <rect x="14" y="18" width="2" height="2" fill="#FFF" />
      <rect x="18" y="18" width="2" height="2" fill="#FFF" />
      <rect x="16" y="20" width="2" height="2" fill="#FFF" />
    </g>
    <g style={{ animation: 'wx-snow-drift 3s ease-in-out 1.5s infinite' }}>
      <rect x="22" y="18" width="2" height="2" fill="#FFF" />
      <rect x="20" y="20" width="2" height="2" fill="#FFF" />
      <rect x="24" y="20" width="2" height="2" fill="#FFF" />
      <rect x="22" y="22" width="2" height="2" fill="#FFF" />
    </g>
  </g>
);

const ThunderIcon = ({ night }) => (
  <g>
    {/* Dark cloud */}
    <Cloud x={0} y={0} color={night ? THUNDER_NIGHT : THUNDER_DAY} />
    {/* Lightning bolt */}
    <g style={{ animation: 'wx-flash 3s ease-in-out infinite' }}>
      <rect x="14" y="14" width="4" height="2" fill="#FACC15" />
      <rect x="12" y="16" width="4" height="2" fill="#FACC15" />
      <rect x="14" y="18" width="4" height="2" fill="#FACC15" />
      <rect x="16" y="20" width="2" height="2" fill="#FACC15" />
    </g>
    {/* Drops */}
    <rect x="8" y="16" width="2" height="4" fill="#60A5FA" style={{ animation: 'wx-drop-fast 1.2s ease-in infinite' }} />
    <rect x="22" y="16" width="2" height="4" fill="#60A5FA" style={{ animation: 'wx-drop-fast 1.2s ease-in 0.5s infinite' }} />
  </g>
);

// --- WMO Code Mapper ---
const getIconType = (code, night) => {
  if (code === 0) return night ? 'moon' : 'sun';
  if (code <= 2) return night ? 'cloudMoon' : 'cloudSun';
  if (code === 3) return 'cloud';
  if (code >= 45 && code <= 48) return 'fog';
  if (code >= 56 && code <= 57) return 'freezingDrizzle';
  if (code >= 51 && code <= 55) return 'drizzle';
  if (code >= 66 && code <= 67) return 'freezingRain';
  if ((code >= 58 && code <= 65) || (code >= 80 && code <= 82)) return 'rain';
  if ((code >= 71 && code <= 77) || (code >= 85 && code <= 86)) return 'snow';
  if (code >= 95) return 'thunder';
  return 'cloud'; // fallback
};

const ICON_MAP = {
  sun: Sun,
  moon: Moon,
  cloudSun: CloudSunIcon,
  cloudMoon: CloudMoonIcon,
  cloud: CloudIcon,
  fog: FogIcon,
  drizzle: DrizzleIcon,
  freezingDrizzle: FreezingDrizzleIcon,
  rain: RainIcon,
  freezingRain: FreezingRainIcon,
  snow: SnowIcon,
  thunder: ThunderIcon,
};

// Icons that accept a night prop for darker clouds/fog
const NIGHT_AWARE = new Set(['cloud', 'fog', 'drizzle', 'freezingDrizzle', 'rain', 'freezingRain', 'snow', 'thunder']);

const AnimatedWeatherIcon = memo(({ code = 0, night = false, size = 64 }) => {
  useEffect(() => {
    injectStyles();
  }, []);

  const iconType = getIconType(code, night);
  const IconComponent = ICON_MAP[iconType];
  const description = getWeatherDescription(code) || iconType;

  return (
    <svg
      viewBox="0 0 32 32"
      width={size}
      height={size}
      style={{ imageRendering: 'pixelated' }}
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label={description}
    >
      {NIGHT_AWARE.has(iconType) ? <IconComponent night={night} /> : <IconComponent />}
    </svg>
  );
});

export default AnimatedWeatherIcon;
