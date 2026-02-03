import React from 'react';
import { Play, Pause, MapPin, Volume2, VolumeX, Radio, Minimize } from 'lucide-react';
import { DARK_BLUE, NAVY_BLUE, BRIGHT_CYAN } from '../../utils/constants';

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
  setIsWidgetMode
}) => {
  const timeOptions = { hour: 'numeric', minute: '2-digit', second: '2-digit' };
  const dateOptions = { weekday: 'short', month: 'short', day: 'numeric' };

  if (timezone) {
    timeOptions.timeZone = timezone;
    dateOptions.timeZone = timezone;
  }

  return (
    <header
      className="p-4 flex justify-between items-center h-20 shrink-0 shadow-neon-lg z-10"
      style={{ background: `linear-gradient(to bottom, ${DARK_BLUE}, ${NAVY_BLUE})`, borderBottom: `4px solid ${BRIGHT_CYAN}` }}
    >
      <div className="flex flex-col">
        <h1 className="text-3xl sm:text-4xl font-bold text-white tracking-widest font-vt323">WEATHERBIRD</h1>
        <div className="flex items-center gap-2 text-cyan-300 font-vt323 text-lg">
          <MapPin size={16} /> <span className="truncate max-w-56">{locationName}</span>
        </div>
      </div>
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
