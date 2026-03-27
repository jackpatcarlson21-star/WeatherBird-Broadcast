import React from 'react';
import { DARK_BLUE, NAVY_BLUE, BRIGHT_CYAN } from '../../utils/constants';
import { getWeatherDescription, formatTime } from '../../utils/helpers';

const BirdIcon = () => (
  <img
    src="/icon-192.png"
    alt="WeatherBird"
    className="inline-block h-6 w-6 sm:h-7 sm:w-7 align-middle mx-1"
    style={{ imageRendering: 'pixelated' }}
  />
);

const getAlertStyle = (event = '') => {
  const e = event.toLowerCase();
  if (e.includes('warning'))                          return { color: '#FCA5A5', border: '#EF4444' }; // red
  if (e.includes('watch'))                            return { color: '#FDBA74', border: '#F97316' }; // orange
  if (e.includes('advisory'))                         return { color: '#FDE047', border: '#EAB308' }; // yellow
  if (e.includes('special weather statement'))        return { color: '#93C5FD', border: '#3B82F6' }; // blue
  return                                               { color: '#C4B5FD', border: '#8B5CF6' };        // purple
};

const getBorderColor = (alerts) => {
  if (!alerts?.length) return BRIGHT_CYAN;
  const events = alerts.map(a => (a.properties?.event || '').toLowerCase());
  if (events.some(e => e.includes('warning')))                   return '#EF4444';
  if (events.some(e => e.includes('watch')))                     return '#F97316';
  if (events.some(e => e.includes('advisory')))                  return '#EAB308';
  if (events.some(e => e.includes('special weather statement'))) return '#3B82F6';
  return '#8B5CF6';
};

const Footer = ({ current, daily, locationName, alerts }) => {
  const temp = current ? Math.round(current.temperature_2m) : '--';
  const cond = current ? getWeatherDescription(current.weather_code) : 'LOADING';
  const wind = current ? `${Math.round(current.wind_speed_10m)} MPH` : '--';
  const feelsLike = current ? Math.round(current.apparent_temperature) : '--';
  const high = daily?.temperature_2m_max?.[0] != null ? Math.round(daily.temperature_2m_max[0]) : '--';
  const low = daily?.temperature_2m_min?.[0] != null ? Math.round(daily.temperature_2m_min[0]) : '--';
  const sunrise = daily?.sunrise?.[0] ? formatTime(daily.sunrise[0]) : '--';
  const sunset = daily?.sunset?.[0] ? formatTime(daily.sunset[0]) : '--';
  const hasAlerts = alerts && alerts.length > 0;
  const borderColor = getBorderColor(alerts);

  const baseText = `CURRENTLY IN ${locationName.toUpperCase()}: ${temp}°F ${cond} - FEELS LIKE: ${feelsLike}°F - WIND: ${wind} ::: HIGH: ${high}°F / LOW: ${low}°F ::: SUNRISE: ${sunrise} / SUNSET: ${sunset} ::: WE LOVE YOU SHANNON! ::: CAW CAW! ::: `;

  const tickerSegment = (key) => (
    <span key={key}>
      {hasAlerts && alerts.map((a, i) => {
        const style = getAlertStyle(a.properties?.event);
        return (
          <span key={i} style={{ color: style.color }} className="font-bold">
            {` ${(a.properties?.headline || a.properties?.event || 'ALERT').toUpperCase()} `}
            <span className="text-white/50">{' ::: '}</span>
          </span>
        );
      })}
      <span className="text-cyan-300">{baseText}</span>
      <BirdIcon />
      <span className="text-cyan-300"> THANK YOU FOR USING WEATHERBIRD! </span>
      <BirdIcon />
      <span className="text-cyan-300"> ::: </span>
    </span>
  );

  return (
    <footer
      className={`h-12 shrink-0 flex items-center relative overflow-hidden ${hasAlerts ? 'alert-glow-border' : ''}`}
      style={{
        background: `linear-gradient(to top, ${NAVY_BLUE}, ${DARK_BLUE})`,
        borderTop: `4px solid ${borderColor}`,
        transition: 'border-top-color 0.5s ease',
      }}
    >
      {/* Scrolling Ticker */}
      <div className="w-full relative h-full flex items-center overflow-hidden bg-black/20">
        <div className={`whitespace-nowrap font-vt323 text-base sm:text-xl px-4 tracking-widest absolute ${hasAlerts ? 'animate-marquee-slow' : 'animate-marquee'}`}>
          {tickerSegment(0)}{tickerSegment(1)}{tickerSegment(2)}
        </div>
      </div>

      <style>{`
        @keyframes marquee {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        .animate-marquee { animation: marquee 60s linear infinite; will-change: transform; }
        .animate-marquee-slow { animation: marquee 120s linear infinite; will-change: transform; }
      `}</style>
    </footer>
  );
};

export default Footer;
