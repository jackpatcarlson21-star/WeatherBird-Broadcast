import React from 'react';
import { Play, Pause, MapPin, Volume2, VolumeX, Radio, Minimize, Mic, MicOff } from 'lucide-react';
import { DARK_BLUE, NAVY_BLUE, BRIGHT_CYAN } from '../../utils/constants';

const getHeaderGradient = (weatherCode, night, sunrise, sunset, currentTime) => {
  // Check for golden hour (within 45 minutes of sunrise/sunset)
  if (sunrise && sunset && currentTime) {
    const now = currentTime.getTime();
    const sunriseTime = new Date(sunrise).getTime();
    const sunsetTime = new Date(sunset).getTime();
    const goldenWindow = 45 * 60 * 1000; // 45 minutes in ms

    if (Math.abs(now - sunriseTime) < goldenWindow) {
      return 'linear-gradient(to bottom, #4C1D95, #F97316)'; // purple to orange (sunrise)
    }
    if (Math.abs(now - sunsetTime) < goldenWindow) {
      return 'linear-gradient(to bottom, #4C1D95, #D97706)'; // purple to amber (sunset)
    }
  }

  // Night
  if (night) {
    return 'linear-gradient(to bottom, #020617, #0A0F1E)'; // very deep navy
  }

  // Weather-based gradients
  if (weatherCode >= 95) {
    return 'linear-gradient(to bottom, #1E1038, #0D0A1A)'; // deep purple (storms)
  }
  if ((weatherCode >= 51 && weatherCode <= 67) || (weatherCode >= 80 && weatherCode <= 82)) {
    return 'linear-gradient(to bottom, #1E3A5F, #0A1929)'; // muted blue (rain)
  }
  if (weatherCode === 0) {
    return 'linear-gradient(to bottom, #0A3D6B, #001A33)'; // brighter blue (clear day)
  }

  // Default
  return `linear-gradient(to bottom, ${DARK_BLUE}, ${NAVY_BLUE})`;
};

const Header = ({
  time,
  locationName,
  onLocationClick,
  timezone,
  isPlaying,
  toggleMusic,
  volume,
  setVolume,
  autoCycle,
  setAutoCycle,
  isWidgetMode,
  setIsWidgetMode,
  night,
  weatherCode,
  sunrise,
  sunset,
  voiceEnabled,
  setVoiceEnabled
}) => {
  const timeOptions = { hour: 'numeric', minute: '2-digit', second: '2-digit' };
  const dateOptions = { weekday: 'short', month: 'short', day: 'numeric' };

  if (timezone) {
    timeOptions.timeZone = timezone;
    dateOptions.timeZone = timezone;
  }

  const headerGradient = getHeaderGradient(weatherCode, night, sunrise, sunset, time);

  return (
    <header
      className="p-4 flex justify-between items-center h-20 shrink-0 shadow-neon-lg z-10"
      style={{
        background: headerGradient,
        borderBottom: `4px solid ${BRIGHT_CYAN}`,
        transition: 'background 2s ease',
      }}
    >
      <div className="flex flex-col">
        <div className="flex items-center gap-3">
          <h1 className="text-3xl sm:text-4xl font-bold text-white tracking-widest font-vt323">WEATHERBIRD</h1>
          <span className="live-badge flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-bold tracking-wider border border-red-500/60 bg-red-900/40 text-red-300 shrink-0">
            <span className="live-dot w-2 h-2 rounded-full bg-red-500" />
            LIVE
          </span>
        </div>
        <div className="flex items-center gap-2 text-cyan-300 font-vt323 text-lg">
          <MapPin size={16} /> <span className="truncate max-w-56">{locationName}</span>
        </div>
      </div>
      <style>{`
        @keyframes live-pulse {
          0%, 100% { opacity: 1; box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.7); }
          50% { opacity: 0.4; box-shadow: 0 0 0 4px rgba(239, 68, 68, 0); }
        }
        .live-dot {
          animation: live-pulse 1.5s ease-in-out infinite;
        }
        .live-badge {
          text-shadow: 0 0 6px rgba(239, 68, 68, 0.5);
        }
      `}</style>
      <div className="flex items-center gap-2 sm:gap-5">
        {/* Auto-Cycle Button */}
        <button
          onClick={() => setAutoCycle(!autoCycle)}
          className={`p-2 rounded-full transition shadow-md shrink-0 ${autoCycle ? 'bg-cyan-600' : 'bg-white/10 hover:bg-white/20'}`}
          style={{ border: `1px solid ${BRIGHT_CYAN}` }}
          title={autoCycle ? 'Stop Auto-Cycle' : 'Start Auto-Cycle'}
        >
          <Radio size={18} className={autoCycle ? 'text-white animate-pulse' : 'text-cyan-400'} />
        </button>

        {/* Voice Narration Toggle (only visible during auto-cycle) */}
        {autoCycle && (
          <button
            onClick={() => setVoiceEnabled(!voiceEnabled)}
            className={`p-2 rounded-full transition shadow-md shrink-0 ${voiceEnabled ? 'bg-cyan-600' : 'bg-white/10 hover:bg-white/20'}`}
            style={{ border: `1px solid ${BRIGHT_CYAN}` }}
            title={voiceEnabled ? 'Disable Voice Narration' : 'Enable Voice Narration'}
          >
            {voiceEnabled
              ? <Mic size={18} className="text-white" />
              : <MicOff size={18} className="text-cyan-400" />
            }
          </button>
        )}

        {/* Widget Mode Button */}
        <button
          onClick={() => setIsWidgetMode(true)}
          className="p-2 rounded-full transition shadow-md shrink-0 bg-white/10 hover:bg-white/20"
          style={{ border: `1px solid ${BRIGHT_CYAN}` }}
          title="Compact Widget View"
        >
          <Minimize size={18} className="text-cyan-400" />
        </button>

        {/* Music Controls */}
        <div className="flex items-center gap-2 px-2 sm:px-3 py-2 rounded-full bg-black/30 shrink-0" style={{ border: `1px solid ${BRIGHT_CYAN}` }}>
          <button
            onClick={toggleMusic}
            className="text-cyan-400 hover:text-white transition"
            title={isPlaying ? 'Pause Music' : 'Play Music'}
          >
            {isPlaying ? <Pause size={18} /> : <Play size={18} />}
          </button>
          <div className="hidden sm:flex items-center gap-2">
            <VolumeX size={14} className="text-cyan-600" />
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={volume}
              onChange={(e) => setVolume(parseFloat(e.target.value))}
              className="w-16 h-1.5 bg-cyan-900 rounded-lg appearance-none cursor-pointer"
              style={{ accentColor: BRIGHT_CYAN }}
            />
            <Volume2 size={14} className="text-cyan-400" />
          </div>
        </div>

        {/* Location Button */}
        <button
          onClick={onLocationClick}
          className="p-2 bg-white/10 rounded-full hover:bg-white/20 transition shadow-md shrink-0"
          style={{ border: `1px solid ${BRIGHT_CYAN}`, color: BRIGHT_CYAN }}
        >
          <MapPin size={18} style={{ color: BRIGHT_CYAN }} />
        </button>

        {/* Clock */}
        <div className="text-right hidden sm:block">
          <div className="text-3xl font-bold text-white font-vt323 tracking-widest">
            {time.toLocaleTimeString([], timeOptions)}
          </div>
          <div className="text-sm text-white font-vt323">{time.toLocaleDateString([], dateOptions)}</div>
        </div>
      </div>
    </header>
  );
};

export default Header;
